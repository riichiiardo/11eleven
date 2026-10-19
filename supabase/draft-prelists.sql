-- Apply after schema.sql, rules-configuration.sql and rule-edit-session.sql.
-- Preselection only: this migration NEVER transfers players or changes budgets.
begin;
create table if not exists app.draft_prelists (
  president_id uuid primary key references public.presidents(id) on delete cascade,
  entries jsonb not null default '[]' check (jsonb_typeof(entries)='array'),
  outgoing jsonb not null default '[]' check (jsonb_typeof(outgoing)='array'),
  status text not null default 'draft' check(status in ('draft','submitted','reviewed')),
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table app.draft_prelists enable row level security;
revoke all on app.draft_prelists from public,anon,authenticated;
-- No direct API writes. All access is scoped by the checked internal RPCs below.
create table if not exists app.draft_reviewers (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(tournament_id,user_id)
);
alter table app.draft_reviewers enable row level security;
revoke all on app.draft_reviewers from public,anon,authenticated;

create or replace function app.can_review_draft(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (public.is_admin(tid) or
    (public.is_member(tid) and exists(select 1 from app.draft_reviewers r where r.tournament_id=tid and r.user_id=auth.uid())));
$$;

create or replace function app.assert_draft_rule() returns trigger
language plpgsql set search_path='' as $$
declare c jsonb:=new.configuration->'draft';
begin
  if c is not null and (jsonb_typeof(c)<>'object'
    or coalesce(jsonb_typeof(c->'maxTransfers'),'')<>'number'
    or coalesce(jsonb_typeof(c->'extraPlayer'),'')<>'boolean'
    or (c->>'maxTransfers')::numeric not between 0 and 100
    or trunc((c->>'maxTransfers')::numeric)<>(c->>'maxTransfers')::numeric) then
    raise exception 'Draft: límite entero entre 0 y 100 y autorización adicional booleana requeridos.';
  end if;
  return new;
end $$;
drop trigger if exists validate_draft_rule on public.tournament_rules;
create trigger validate_draft_rule before insert or update of configuration on public.tournament_rules
  for each row execute function app.assert_draft_rule();

create or replace function app.draft_prelist_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; me public.presidents%rowtype; saved app.draft_prelists%rowtype; cap integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select * into me from public.presidents where tournament_id=tid and user_id=auth.uid();
  if me.id is null or not public.is_member(tid) then raise exception 'Selecciona un club para preparar tu draft.'; end if;
  select * into saved from app.draft_prelists where president_id=me.id;
  select coalesce((configuration->'draft'->>'maxTransfers')::int,6)+case when coalesce((configuration->'draft'->>'extraPlayer')::boolean,false) then 1 else 0 end into cap
    from public.tournament_rules where tournament_id=tid;
  return jsonb_build_object('revision',coalesce(saved.revision,0),'status',coalesce(saved.status,'draft'),
    'canReview',app.can_review_draft(tid),'limit',coalesce(cap,6),
    'entries',coalesce(saved.entries,'[]'),'outgoing',coalesce(saved.outgoing,'[]'),
    'clubs',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name),'[]')
      from public.clubs c join public.presidents p on p.club_id=c.id and p.tournament_id=c.tournament_id
      where c.tournament_id=tid and p.id<>me.id),
    'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'clubId',sp.club_id,'name',p.name,'nationality',p.nationality,'position',p.position,'ovr',p.ovr) order by p.name),'[]')
      from public.squad_players sp join public.players p on p.id=sp.player_id
      join public.presidents owner on owner.id=sp.president_id and owner.club_id=sp.club_id and owner.tournament_id=sp.tournament_id
      where sp.tournament_id=tid and sp.president_id<>me.id),
    'ownPlayers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'clubId',sp.club_id,'name',p.name,'nationality',p.nationality,'position',p.position,'ovr',p.ovr) order by p.name),'[]')
      from public.squad_players sp join public.players p on p.id=sp.player_id where sp.tournament_id=tid and sp.president_id=me.id));
end $$;

create or replace function app.save_draft_prelist(p_entries jsonb,p_outgoing jsonb,p_revision integer,p_submit boolean)
returns integer language plpgsql security definer set search_path='' as $$
declare tid uuid; me uuid; cap integer; r app.draft_prelists%rowtype; item jsonb; old jsonb;
  clean jsonb:='[]'; key text; seen text[]:='{}'; seen_ids text[]:='{}'; player public.players%rowtype;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  if not public.is_member(tid) then raise exception 'No perteneces al Universo.'; end if;
  -- Same lock as saving rules: limits cannot change halfway through validation.
  select coalesce((configuration->'draft'->>'maxTransfers')::int,6)+case when coalesce((configuration->'draft'->>'extraPlayer')::boolean,false) then 1 else 0 end into cap
    from public.tournament_rules where tournament_id=tid for share;
  select id into me from public.presidents where tournament_id=tid and user_id=auth.uid() and club_id is not null for update;
  if me is null then raise exception 'Selecciona primero tu club.'; end if;
  if coalesce(jsonb_typeof(p_entries),'')<>'array' or coalesce(jsonb_typeof(p_outgoing),'')<>'array' then raise exception 'Prelista inválida.'; end if;
  if jsonb_array_length(p_entries)>coalesce(cap,6) or jsonb_array_length(p_outgoing)>coalesce(cap,6) then raise exception 'Has superado el máximo de altas o bajas del draft.'; end if;
  insert into app.draft_prelists(president_id) values(me) on conflict do nothing;
  select * into r from app.draft_prelists where president_id=me for update;
  if p_revision is null or p_revision<>r.revision then raise exception 'La prelista cambió. Recarga la revisión antes de continuar.'; end if;
  if r.status='submitted' then raise exception 'La lista está en revisión. Espera la respuesta antes de modificarla.'; end if;
  for item in select value from jsonb_array_elements(p_entries) loop
    if coalesce(jsonb_typeof(item),'')<>'object' or coalesce(item->>'id','')!~'^[0-9a-fA-F-]{36}$'
       or coalesce(jsonb_typeof(item->'price'),'')<>'number' or (item->>'price')::numeric not between 0.01 and 2000000000
       or (item->>'price')::numeric<>round((item->>'price')::numeric,2) then raise exception 'Identificador o precio de adquisición inválido.'; end if;
    perform (item->>'id')::uuid;
    if item->>'id'=any(seen_ids) then raise exception 'Selección repetida.'; end if;
    seen_ids:=array_append(seen_ids,item->>'id');
    if coalesce(item->>'sofifaUrl','')!~'^https://sofifa[.]com/player/[1-9][0-9]*(/[^[:space:]]*)?$' or length(item->>'sofifaUrl')>500 then raise exception 'Introduce la ficha HTTPS de SoFIFA.'; end if;
    if item->>'kind'='owned' then
      select p.* into player from public.players p join public.squad_players sp on sp.player_id=p.id
        join public.presidents owner on owner.id=sp.president_id and owner.club_id=sp.club_id and owner.tournament_id=sp.tournament_id
        where p.id=(item->>'playerId')::uuid and sp.club_id=(item->>'clubId')::uuid
          and sp.tournament_id=tid and sp.president_id<>me for share of sp,owner;
      if not found then raise exception 'El jugador ya no pertenece al equipo vendedor de este Universo.'; end if;
      key:=item->>'playerId';
      item:=jsonb_build_object('id',item->>'id','kind','owned','playerId',key,'clubId',item->>'clubId','price',item->'price','sofifaUrl',item->>'sofifaUrl');
    elsif item->>'kind'='new' then
      if coalesce(length(trim(item->>'name')),0) not between 2 and 150 or trim(item->>'name')!~'[^[:space:]]+[[:space:]]+[^[:space:]]+'
        or coalesce(length(trim(item->>'nationality')),0) not between 2 and 80
        or coalesce(jsonb_typeof(item->'ovr'),'')<>'number' or (item->>'ovr')::numeric not between 1 and 99
        or trunc((item->>'ovr')::numeric)<>(item->>'ovr')::numeric
        or coalesce(jsonb_typeof(item->'positions'),'')<>'array' then raise exception 'Revisa nombre, nacionalidad, media y posiciones del jugador nuevo.'; end if;
      if jsonb_array_length(item->'positions') not between 1 and 12
        or exists(select 1 from jsonb_array_elements_text(item->'positions') pos where pos not in ('POR','LD','DFC','LI','MCD','MC','MCO','MD','MI','ED','EI','DC'))
        or (select count(*)<>count(distinct value) from jsonb_array_elements_text(item->'positions')) then raise exception 'Posiciones inválidas o repetidas.'; end if;
      key:=lower(trim(item->>'name'));
      item:=jsonb_build_object('id',item->>'id','kind','new','name',trim(item->>'name'),'price',item->'price','ovr',item->'ovr','positions',item->'positions','nationality',trim(item->>'nationality'),'sofifaUrl',item->>'sofifaUrl');
    else raise exception 'Tipo de jugador no admitido.';
    end if;
    if key=any(seen) then raise exception 'Jugador repetido en la prelista.'; end if;
    seen:=array_append(seen,key);
    select value into old from jsonb_array_elements(r.entries) where value->>'id'=item->>'id';
    if old is not null and (old-'reviewStatus'-'reviewNote'-'reviewedBy')=item and old->>'reviewStatus' in ('approved','rejected') then
      item:=old;
    else item:=item||jsonb_build_object('reviewStatus','pending','reviewNote',''); end if;
    clean:=clean||jsonb_build_array(item);
  end loop;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(p_outgoing)) then raise exception 'Baja repetida.'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_outgoing) v where not exists(
    select 1 from public.squad_players sp where sp.player_id=v::uuid and sp.president_id=me and sp.tournament_id=tid)) then raise exception 'Solo puedes proponer bajas de tu plantilla.'; end if;
  if p_submit and not exists(select 1 from jsonb_array_elements(clean) e where e->>'reviewStatus'='pending') then raise exception 'No hay selecciones pendientes para enviar.'; end if;
  if p_submit and exists(select 1 from jsonb_array_elements(clean) e where e->>'reviewStatus'='rejected') then raise exception 'Modifica o sustituye las selecciones rechazadas antes de reenviar.'; end if;
  update app.draft_prelists set entries=clean,outgoing=p_outgoing,revision=revision+1,
    status=case when p_submit then 'submitted' else 'draft' end,updated_at=now() where president_id=me returning revision into p_revision;
  return p_revision;
end $$;

create or replace function app.draft_review_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  if not app.can_review_draft(tid) then raise exception 'Solo el administrador del draft o su designado puede revisar.'; end if;
  return jsonb_build_object('isAdmin',public.is_admin(tid),
    'reviewers',(select coalesce(jsonb_agg(user_id),'[]') from app.draft_reviewers where tournament_id=tid),
    'presidents',(select coalesce(jsonb_agg(jsonb_build_object('userId',p.user_id,'name',p.nickname)),'[]') from public.presidents p where p.tournament_id=tid),
    'lists',(select coalesce(jsonb_agg(jsonb_build_object('presidentId',p.id,'president',p.nickname,'revision',r.revision,'outgoing',r.outgoing,
      'entries',(select coalesce(jsonb_agg(e||case when e->>'kind'='owned' then
        jsonb_build_object('name',pl.name,'nationality',pl.nationality,'position',pl.position,'ovr',pl.ovr,'seller',c.name,
          'available',exists(select 1 from public.squad_players sp where sp.player_id=pl.id and sp.tournament_id=tid and sp.club_id=(e->>'clubId')::uuid and sp.president_id<>p.id))
        else '{}'::jsonb end),'[]') from jsonb_array_elements(r.entries) e
        left join public.players pl on e->>'kind'='owned' and pl.id=(e->>'playerId')::uuid
        left join public.clubs c on c.id=(e->>'clubId')::uuid))) ,'[]')
      from app.draft_prelists r join public.presidents p on p.id=r.president_id where p.tournament_id=tid and r.status='submitted'));
end $$;

create or replace function app.review_draft_entry(p_president_id uuid,p_entry_id uuid,p_revision integer,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; r app.draft_prelists%rowtype; item jsonb; reviewed_entries jsonb;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  if not app.can_review_draft(tid) then raise exception 'No tienes permiso para revisar el draft.'; end if;
  if p_approve is null or length(coalesce(p_note,''))>1000 or (not p_approve and length(trim(coalesce(p_note,'')))=0) then raise exception 'Indica un motivo para el rechazo (máximo 1000 caracteres).'; end if;
  select r0.* into r from app.draft_prelists r0 join public.presidents p on p.id=r0.president_id
    where p.tournament_id=tid and p.id=p_president_id for update of r0;
  if r.president_id is null or r.status<>'submitted' or r.revision<>p_revision or p_revision is null then raise exception 'La lista cambió o ya fue revisada. Actualiza la revisión.'; end if;
  select e into item from jsonb_array_elements(r.entries) e where e->>'id'=p_entry_id::text and e->>'reviewStatus'='pending';
  if item is null then raise exception 'Selección no disponible para revisión.'; end if;
  if p_approve and item->>'kind'='owned' and not exists(select 1 from public.squad_players sp
    where sp.player_id=(item->>'playerId')::uuid and sp.club_id=(item->>'clubId')::uuid and sp.tournament_id=tid and sp.president_id<>p_president_id for share) then raise exception 'El jugador ya no pertenece al equipo vendedor. Rechaza esta selección para corregirla.'; end if;
  select jsonb_agg(case when e->>'id'=p_entry_id::text then e||jsonb_build_object('reviewStatus',case when p_approve then 'approved' else 'rejected' end,'reviewNote',trim(coalesce(p_note,'')),'reviewedBy',auth.uid()) else e end order by n)
    into reviewed_entries from jsonb_array_elements(r.entries) with ordinality as items(e,n);
  update app.draft_prelists set entries=reviewed_entries,revision=revision+1,updated_at=now(),
    status=case when exists(select 1 from jsonb_array_elements(reviewed_entries) e where e->>'reviewStatus'='pending') then 'submitted' else 'reviewed' end
    where president_id=p_president_id;
end $$;

create or replace function app.set_draft_reviewer(p_user_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  if auth.uid() is null or not public.is_admin(tid) then raise exception 'Solo Administración puede designar revisores.'; end if;
  if p_enabled is null then raise exception 'Indica si habilitar al revisor.'; end if;
  if p_enabled then
    if not public.is_member(tid) or not exists(select 1 from public.league_members where tournament_id=tid and user_id=p_user_id) then raise exception 'El designado debe pertenecer al Universo.'; end if;
    insert into app.draft_reviewers values(tid,p_user_id) on conflict do nothing;
  else delete from app.draft_reviewers where tournament_id=tid and user_id=p_user_id; end if;
end $$;

-- Exposed wrappers are invoker-rights. Privileged implementations remain private.
create or replace function public.draft_prelist_state() returns jsonb language sql security invoker set search_path='' as $$ select app.draft_prelist_state() $$;
create or replace function public.save_draft_prelist(p_entries jsonb,p_outgoing jsonb,p_revision integer,p_submit boolean default false) returns integer
  language sql security invoker set search_path='' as $$ select app.save_draft_prelist(p_entries,p_outgoing,p_revision,p_submit) $$;
create or replace function public.draft_review_state() returns jsonb language sql security invoker set search_path='' as $$ select app.draft_review_state() $$;
create or replace function public.review_draft_entry(p_president_id uuid,p_entry_id uuid,p_revision integer,p_approve boolean,p_note text) returns void
  language sql security invoker set search_path='' as $$ select app.review_draft_entry(p_president_id,p_entry_id,p_revision,p_approve,p_note) $$;
create or replace function public.set_draft_reviewer(p_user_id uuid,p_enabled boolean) returns void
  language sql security invoker set search_path='' as $$ select app.set_draft_reviewer(p_user_id,p_enabled) $$;
revoke all on function app.assert_draft_rule() from public,anon,authenticated;
revoke all on function app.can_review_draft(uuid),app.draft_prelist_state(),app.save_draft_prelist(jsonb,jsonb,integer,boolean),app.draft_review_state(),app.review_draft_entry(uuid,uuid,integer,boolean,text),app.set_draft_reviewer(uuid,boolean) from public,anon;
grant execute on function app.can_review_draft(uuid),app.draft_prelist_state(),app.save_draft_prelist(jsonb,jsonb,integer,boolean),app.draft_review_state(),app.review_draft_entry(uuid,uuid,integer,boolean,text),app.set_draft_reviewer(uuid,boolean) to authenticated;
revoke all on function public.draft_prelist_state(),public.save_draft_prelist(jsonb,jsonb,integer,boolean),public.draft_review_state(),public.review_draft_entry(uuid,uuid,integer,boolean,text),public.set_draft_reviewer(uuid,boolean) from public,anon;
grant execute on function public.draft_prelist_state(),public.save_draft_prelist(jsonb,jsonb,integer,boolean),public.draft_review_state(),public.review_draft_entry(uuid,uuid,integer,boolean,text),public.set_draft_reviewer(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
