create table if not exists app.closed_draft_prelists (
  draft_id uuid not null,
  president_id uuid not null,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (draft_id, president_id)
);
alter table app.closed_draft_prelists enable row level security;
revoke all on app.closed_draft_prelists from public, anon, authenticated;

create or replace function public.admin_universe_pool()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name),'[]'::jsonb)
  from public.clubs c
  where c.tournament_id=app.require_admin_permission('configuracion') and not c.in_universe
$$;

create or replace function public.admin_include_universe_club(p_club uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_admin_permission('configuracion'); club_name text;
begin
  perform app.lock_draft_outgoing(tid);
  update public.clubs set in_universe=true
  where id=p_club and tournament_id=tid and not in_universe returning name into club_name;
  if not found then raise exception 'El club no está disponible en el pool de este universo.'; end if;
  perform public.audit(tid,'universo.club_incluido','clubs',club_name,p_club);
end $$;

create or replace function public.admin_rename_universe(p_name text)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_admin_permission('configuracion'); new_name text:=btrim(p_name);
begin
  if new_name is null or char_length(new_name) not between 1 and 100 then
    raise exception 'Escribe un nombre de 1 a 100 caracteres.';
  end if;
  update public.tournaments set name=new_name where id=tid and name is distinct from new_name;
  if found then perform public.audit(tid,'universo.renombrado','tournaments',new_name,null); end if;
end $$;

revoke all on function public.admin_universe_pool(),public.admin_include_universe_club(uuid),
  public.admin_rename_universe(text) from public,anon;
grant execute on function public.admin_universe_pool(),public.admin_include_universe_club(uuid),
  public.admin_rename_universe(text) to authenticated;
