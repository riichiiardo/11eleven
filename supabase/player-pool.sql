begin;
alter table public.players add column if not exists sofifa_id bigint;
create unique index if not exists players_sofifa_id on public.players(sofifa_id) where sofifa_id is not null;
create index if not exists players_pool_identity on public.players(lower(btrim(name)),lower(btrim(nationality))) where sofifa_id is null;
create table if not exists app.pool_imports(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),
 label text not null check(length(label) between 1 and 200),expected integer not null check(expected between 1 and 30000),
 status text not null default 'pending' check(status in('pending','applied')),created_at timestamptz not null default now(),summary jsonb
);
create table if not exists app.pool_import_rows(
 job uuid not null references app.pool_imports(id) on delete cascade,
 row_no integer not null check(row_no>0),payload jsonb not null,primary key(job,row_no)
);
create unique index if not exists pool_import_source_identity on app.pool_import_rows(job,(payload->>'sourceId'));
create table if not exists app.pool_reconciliations(
 id bigint generated always as identity primary key,actor uuid not null references auth.users(id),
 preserved_id uuid not null references public.players(id),retired_id uuid not null references public.players(id),
 recorded_at timestamptz not null default now(),before_record jsonb not null,source_record jsonb not null
);
create table if not exists app.pool_import_snapshots(
 job uuid primary key references app.pool_imports(id),recorded_at timestamptz not null default now(),
 players jsonb not null,squad_players jsonb not null,squads jsonb not null
);
alter table app.pool_import_snapshots enable row level security;
revoke all on app.pool_import_snapshots from public,anon,authenticated;
alter table app.pool_imports enable row level security;
alter table app.pool_import_rows enable row level security;
alter table app.pool_reconciliations enable row level security;
revoke all on app.pool_imports,app.pool_import_rows,app.pool_reconciliations from public,anon,authenticated;

create or replace function app.require_pool_admin() returns uuid
language plpgsql security invoker set search_path='' as $$
declare tid uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if auth.uid() is null or not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración puede gestionar el pool.';end if;
 return tid;
end$$;
revoke all on function app.require_pool_admin() from public,anon,authenticated;

create or replace function public.pool_status(p_search text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid;
begin
 tid:=app.require_pool_admin();
 return jsonb_build_object(
 'active',(select count(*) from public.players where catalog_active),
 'identified',(select count(*) from public.players where catalog_active and sofifa_id is not null),
 'pending',(select coalesce(jsonb_agg(x order by x.name),'[]') from(
  select distinct p.id,p.name,p.nationality,p.age,p.position from public.players p
  join public.squad_players sp on sp.player_id=p.id where not p.catalog_active and sp.tournament_id=tid
 )x),
 'candidates',(select coalesce(jsonb_agg(x),'[]') from(
  select id,sofifa_id,name,nationality,age,position,value from public.players
  where catalog_active and length(btrim(p_search))>=2 and name ilike '%'||btrim(left(p_search,100))||'%'
  order by name,id limit 30
 )x),
 'lastImport',(select jsonb_build_object('label',label,'summary',summary,'at',created_at) from app.pool_imports where status='applied' order by created_at desc limit 1));
end$$;

create or replace function public.pool_import_start(p_expected integer,p_label text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform app.require_pool_admin();
 insert into app.pool_imports(actor,label,expected)values(auth.uid(),btrim(p_label),p_expected)returning id into result;
 return result;
end$$;

create or replace function public.pool_import_batch(p_job uuid,p_offset integer,p_rows jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_job app.pool_imports%rowtype;entry jsonb;row_number integer:=0;field text;
begin
 perform app.require_pool_admin();
 select * into v_job from app.pool_imports where id=p_job and actor=auth.uid() for update;
 if v_job.id is null or v_job.status<>'pending' then raise exception 'La importación no está disponible.';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 or p_offset<0 or p_offset+jsonb_array_length(p_rows)>v_job.expected then raise exception 'Lote inválido.';end if;
 for entry in select value from jsonb_array_elements(p_rows) loop
  row_number:=row_number+1;
  if jsonb_typeof(entry)<>'object' or coalesce(length(btrim(entry->>'name')),0) not between 1 and 150
   or coalesce(length(btrim(entry->>'nationality')),0) not between 1 and 100
   or coalesce(entry->>'sourceId','') !~ '^[0-9]{1,12}$' or (entry->>'sourceId')::bigint<=0
   or entry->>'position' not in('POR','LD','DFC','LI','MCD','MC','MCO','ED','EI','DC')
   or entry->>'group' not in('GK','DEF','MID','FWD')
   or coalesce((entry->>'ovr')::numeric,-1) not between 0 and 100
   or coalesce((entry->>'age')::numeric,-1) not between 10 and 70
   or coalesce((entry->>'value')::numeric,-1) not between 0 and 100000000000
   or coalesce((entry->>'potential')::numeric,-1) not between 0 and 100 then raise exception 'Revisa la fila %.',p_offset+row_number;end if;
  foreach field in array array['ovr','age','potential','value'] loop
   if jsonb_typeof(entry->field) is distinct from 'number' or trunc((entry->>field)::numeric)<>(entry->>field)::numeric then raise exception 'Dato numérico inválido en fila %.',p_offset+row_number;end if;
  end loop;
  if entry->>'position' is null or entry->>'group' is null or jsonb_typeof(entry->'positions') is distinct from 'array' then raise exception 'Faltan posiciones en fila %.',p_offset+row_number;end if;
  if jsonb_array_length(entry->'positions') not between 1 and 15 or exists(select 1 from jsonb_array_elements_text(entry->'positions') pos where pos not in('POR','LD','DFC','LI','MCD','MC','MCO','ED','EI','DC','MD','MI','CAD','CAI','SD')) then raise exception 'Posiciones inválidas.';end if;
  if exists(select 1 from app.pool_import_rows where job=p_job and row_no=p_offset+row_number and payload<>entry) then raise exception 'El lote ya tiene otros datos.';end if;
  insert into app.pool_import_rows(job,row_no,payload)values(p_job,p_offset+row_number,entry)on conflict(job,row_no) do nothing;
 end loop;
end$$;

create or replace function public.pool_import_finish(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='55s' as $$
declare v_job app.pool_imports%rowtype;new_count integer;updated_count integer;result jsonb;
begin
 perform app.require_pool_admin();
 perform pg_advisory_xact_lock(11127001);
 select * into v_job from app.pool_imports where id=p_job and actor=auth.uid() for update;
 if v_job.id is null then raise exception 'La importación no existe.';end if;
 if v_job.status='applied' then return v_job.summary;end if;
 if (select count(*) from app.pool_import_rows where job=p_job)<>v_job.expected then raise exception 'Faltan lotes por cargar.';end if;
 lock table public.players in share row exclusive mode;
 insert into app.pool_import_snapshots(job,players,squad_players,squads)
 select p_job,(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.players p),
 (select coalesce(jsonb_agg(to_jsonb(sp)),'[]') from public.squad_players sp),
 (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.squads s);
 create temporary table pool_import_resolution on commit drop as
 with incoming as materialized (
 select r.*,count(*) over(partition by lower(btrim(payload->>'name')),lower(btrim(payload->>'nationality'))) identity_count
 from app.pool_import_rows r where r.job=p_job
 ), legacy_identity as materialized (
 select lower(btrim(name)) name,lower(btrim(nationality)) nationality,count(*) total,(array_agg(id))[1] id
 from public.players where sofifa_id is null group by 1,2
 )
 select r.row_no,r.payload,
  coalesce(identified.id,explicit.id,case when names.total=1 then names.id end,gen_random_uuid()) player_id,
  identified.id is null and explicit.id is null and coalesce(names.total,0)<>1 is_new,
  case when identified.id is not null or explicit.id is not null then 0 else coalesce(names.total,0) end ambiguous,
  nullif(r.payload->>'poolId','') is not null and coalesce(identified.id,explicit.id) is distinct from (r.payload->>'poolId')::uuid invalid_id
 from incoming r
 left join public.players identified on identified.sofifa_id=(r.payload->>'sourceId')::bigint
 left join public.players explicit on explicit.id=nullif(r.payload->>'poolId','')::uuid and explicit.sofifa_id is null
 left join legacy_identity names on r.identity_count=1 and names.name=lower(btrim(r.payload->>'name')) and names.nationality=lower(btrim(r.payload->>'nationality')) where r.job=p_job;
 if exists(select 1 from pg_temp.pool_import_resolution where invalid_id) then raise exception 'Hay un ID Pool inválido o asociado a otro ID SoFIFA.';end if;
 if exists(select 1 from pg_temp.pool_import_resolution group by player_id having count(*)>1) then raise exception 'Dos filas identifican la misma ficha del pool.';end if;
 create unique index on pg_temp.pool_import_resolution(player_id);
 analyze pg_temp.pool_import_resolution;
 select count(*) filter(where is_new),count(*) filter(where not is_new) into new_count,updated_count from pg_temp.pool_import_resolution;
 update public.players p set
  sofifa_id=(r.payload->>'sourceId')::bigint,name=r.payload->>'name',position=r.payload->>'position',"group"=r.payload->>'group',
  ovr=(r.payload->>'ovr')::int,age=(r.payload->>'age')::int,value=(r.payload->>'value')::bigint,nationality=r.payload->>'nationality',real_club=coalesce(r.payload->>'club','Agente libre'),
  catalog_active=true,source_updated_at=now(),source_record=r.payload||jsonb_build_object('game_team',p.source_record->>'game_team','importId',p_job)
 from pg_temp.pool_import_resolution r where p.id=r.player_id and not r.is_new;
 insert into public.players(id,sofifa_id,name,position,"group",ovr,age,value,nationality,real_club,source_key,source_record,catalog_active)
 select r.player_id,(r.payload->>'sourceId')::bigint,r.payload->>'name',r.payload->>'position',r.payload->>'group',(r.payload->>'ovr')::int,(r.payload->>'age')::int,(r.payload->>'value')::bigint,r.payload->>'nationality',coalesce(r.payload->>'club','Agente libre'),'sofifa:'||(r.payload->>'sourceId'),r.payload||jsonb_build_object('importId',p_job),true
 from pg_temp.pool_import_resolution r where r.is_new;
 update public.players p set catalog_active=false where p.catalog_active and not exists(select 1 from pg_temp.pool_import_resolution r where r.player_id=p.id);
 result:=jsonb_build_object('total',v_job.expected,'inserted',new_count,'updated',updated_count);
 update app.pool_imports set status='applied',summary=result where id=p_job;
 insert into public.catalog_stats(id,total,version,last_sync,updated_at)values(1,v_job.expected,'CSV · '||v_job.label,result||jsonb_build_object('source',v_job.label,'at',now()),now())on conflict(id)do update set total=excluded.total,version=excluded.version,last_sync=excluded.last_sync,updated_at=excluded.updated_at;
 return result;
end$$;

create or replace function public.pool_reconcile(p_preserve uuid,p_source uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target public.players%rowtype;old public.players%rowtype;ref record;used boolean;
begin
 perform app.require_pool_admin();
 perform pg_advisory_xact_lock(11127001);
 if p_preserve=p_source then raise exception 'Selecciona dos fichas diferentes.';end if;
 perform 1 from public.players where id in(p_preserve,p_source)order by id for update;
 select * into old from public.players where id=p_preserve;
 select * into target from public.players where id=p_source;
 if old.id is null or target.id is null or old.catalog_active or not target.catalog_active then raise exception 'Las fichas ya cambiaron. Recarga el pool.';end if;
 if not exists(select 1 from public.squad_players where player_id=p_preserve) or exists(select 1 from public.squad_players where player_id=p_preserve and not public.is_admin(tournament_id)) then raise exception 'No tienes permiso para conciliar esta ficha.';end if;
 if target.source_record->>'game_team' is not null and target.source_record->>'game_team' is distinct from old.source_record->>'game_team' then raise exception 'La ficha pertenece a otra plantilla inicial.';end if;
 for ref in select n.nspname,t.relname,a.attname from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid join pg_catalog.pg_namespace n on n.oid=t.relnamespace join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1] where c.confrelid='public.players'::regclass and cardinality(c.conkey)=1 loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',ref.nspname,ref.relname,ref.attname) into used using p_source;
  if used then raise exception 'La ficha del pool ya tiene referencias. Debe revisarse antes de vincularla.';end if;
 end loop;
 if exists(select 1 from public.offers where p_source=any(requested_player_ids) or p_source=any(offered_player_ids)) then raise exception 'La ficha tiene negociaciones.';end if;
 insert into app.pool_reconciliations(actor,preserved_id,retired_id,before_record,source_record)values(auth.uid(),old.id,target.id,to_jsonb(old),to_jsonb(target));
 update public.players set catalog_active=false,sofifa_id=null,source_key='merged:'||id::text where id=target.id;
 update public.players set sofifa_id=target.sofifa_id,name=target.name,position=target.position,"group"=target."group",ovr=target.ovr,age=target.age,value=target.value,nationality=target.nationality,real_club=target.real_club,source_key=target.source_key,source_record=target.source_record||jsonb_build_object('game_team',old.source_record->>'game_team','reconciliation','manual'),catalog_active=true,source_updated_at=now() where id=old.id;
end$$;
revoke all on function public.pool_status(text),public.pool_import_start(integer,text),public.pool_import_batch(uuid,integer,jsonb),public.pool_import_finish(uuid),public.pool_reconcile(uuid,uuid) from public,anon;
grant execute on function public.pool_status(text),public.pool_import_start(integer,text),public.pool_import_batch(uuid,integer,jsonb),public.pool_import_finish(uuid),public.pool_reconcile(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
