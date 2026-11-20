begin;
alter table public.players add column if not exists "Imagen_URL" text;
comment on column public.players."Imagen_URL" is 'URL pública del rostro almacenado en Supabase Storage; photo es el alias compatible del cliente.';
create table if not exists app.player_image_jobs(
 player_id uuid primary key references public.players(id),source_url text not null,
 status text not null default 'pending' check(status in('pending','processing','ready','error')),
 lease uuid,locked_at timestamptz,attempts integer not null default 0,last_error text,updated_at timestamptz not null default now()
);
create index if not exists player_image_jobs_pending on app.player_image_jobs(status,updated_at);
alter table app.player_image_jobs enable row level security;
revoke all on app.player_image_jobs from public,anon,authenticated;

create or replace function app.mirror_player_portrait() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new."Imagen_URL" is not null then new.photo:=new."Imagen_URL";end if;
 elsif new."Imagen_URL" is distinct from old."Imagen_URL" then new.photo:=new."Imagen_URL";
 elsif new."Imagen_URL" is not null then new.photo:=new."Imagen_URL";
 end if;
 return new;
end$$;
revoke all on function app.mirror_player_portrait() from public,anon,authenticated;
drop trigger if exists mirror_player_portrait on public.players;
create trigger mirror_player_portrait before insert or update of "Imagen_URL",photo on public.players for each row execute function app.mirror_player_portrait();

create or replace function app.enqueue_player_portrait() returns trigger language plpgsql security invoker set search_path='' as $$
declare link text:=nullif(new.source_record->>'imageUrl','');parts text[];
begin
 if link is null then return new;end if;
 parts:=regexp_match(link,'^https://cdn\.sofifa\.net/players/([0-9]{3})/([0-9]{3})/[0-9]+_(60|120|240)\.png$');
 if parts is null or new.sofifa_id is null or (parts[1]||parts[2])::bigint<>new.sofifa_id then raise exception 'Imagen_URL no corresponde al ID de SoFIFA.';end if;
 insert into app.player_image_jobs(player_id,source_url)values(new.id,link)
 on conflict(player_id)do update set source_url=excluded.source_url,status='pending',attempts=0,lease=null,locked_at=null,last_error=null,updated_at=now();
 return new;
end$$;
revoke all on function app.enqueue_player_portrait() from public,anon,authenticated;
drop trigger if exists enqueue_player_portrait on public.players;
create trigger enqueue_player_portrait after insert or update of source_record on public.players for each row execute function app.enqueue_player_portrait();

create or replace function public.player_images_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app.require_pool_admin();
 return (select jsonb_build_object('pending',count(*)filter(where j.status='pending'),'processing',count(*)filter(where j.status='processing'),'ready',count(*)filter(where j.status='ready'),'error',count(*)filter(where j.status='error'),'lastError',(select last_error from app.player_image_jobs where status='error' order by updated_at desc limit 1))
 from app.player_image_jobs j join public.players p on p.id=j.player_id where p.catalog_active);
end$$;
create or replace function public.player_images_retry() returns void language plpgsql security definer set search_path='' as $$
begin
 perform app.require_pool_admin();
 update app.player_image_jobs set status='pending',attempts=0,last_error=null,lease=null,locked_at=null where status='error' or (status='processing' and locked_at<now()-interval '5 minutes');
end$$;
revoke all on function public.player_images_status(),public.player_images_retry() from public,anon;
grant execute on function public.player_images_status(),public.player_images_retry() to authenticated;

create or replace function public.player_images_claim(p_limit integer default 16) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with picked as (
 select j.player_id from app.player_image_jobs j join public.players p on p.id=j.player_id
 where p.catalog_active and p.sofifa_id is not null and (j.status='pending' or (j.status='processing' and j.locked_at<now()-interval '5 minutes')) and j.attempts<3
 order by j.updated_at,j.player_id limit greatest(1,least(p_limit,24)) for update of j skip locked
 ), claimed as (
 update app.player_image_jobs j set status='processing',attempts=j.attempts+1,lease=gen_random_uuid(),locked_at=now(),updated_at=now() from picked where j.player_id=picked.player_id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('playerId',j.player_id,'sourceUrl',j.source_url,'lease',j.lease,'sofifaId',p.sofifa_id)),'[]') into result from claimed j join public.players p on p.id=j.player_id;
 return result;
end$$;
create or replace function public.player_images_complete(p_player uuid,p_lease uuid,p_url text default null,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare job app.player_image_jobs%rowtype;
begin
 perform pg_advisory_xact_lock(11127001);
 select * into job from app.player_image_jobs where player_id=p_player and lease=p_lease and status='processing' for update;
 if job.player_id is null then return false;end if;
 if p_error is null then
  if p_url is null or p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/player-faces/[0-9]+/[a-f0-9]+\.png$' then raise exception 'URL de Storage inválida.';end if;
  update public.players set "Imagen_URL"=p_url where id=p_player;
 end if;
 update app.player_image_jobs set status=case when p_error is null then 'ready' else 'error' end,last_error=left(p_error,500),lease=null,locked_at=null,updated_at=now() where player_id=p_player;
 return true;
end$$;
create or replace function public.player_images_release(p_player uuid,p_lease uuid) returns void language sql security definer set search_path='' as $$
 update app.player_image_jobs set status='pending',lease=null,locked_at=null,attempts=greatest(attempts-1,0) where player_id=p_player and lease=p_lease and status='processing';
$$;
revoke all on function public.player_images_claim(integer),public.player_images_complete(uuid,uuid,text,text),public.player_images_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.player_images_claim(integer),public.player_images_complete(uuid,uuid,text,text),public.player_images_release(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
