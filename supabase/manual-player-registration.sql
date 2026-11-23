create function app.player_profile_fields(p_profile jsonb,out pos text,out grp text)
language plpgsql immutable set search_path='' as $$
declare positions jsonb:=p_profile->'positions';
begin
 if p_profile is null or p_profile - array['name','nationality','positions','ovr','age','value','potential'] <> '{}'::jsonb or not (p_profile ?& array['name','nationality','positions','ovr','age','value','potential']) or
 coalesce(length(trim(p_profile->>'name')),0) not between 1 and 180 or coalesce(length(trim(p_profile->>'nationality')),0) not between 1 and 100 or
 coalesce((p_profile->>'age')::int,-1) not between 1 and 100 or coalesce((p_profile->>'ovr')::int,-1) not between 0 and 100 or
 (p_profile->>'potential')::int not between 0 and 100 or coalesce((p_profile->>'value')::bigint,-1)<0 or
 jsonb_typeof(positions) is distinct from 'array' then raise exception 'Comprueba los datos de la ficha.';end if;
 if jsonb_array_length(positions) not between 1 and 15 or exists(select from jsonb_array_elements_text(positions) a(pos) where a.pos is null or a.pos not in ('POR','LD','DFC','LI','MCD','MC','MCO','ED','EI','DC','MD','MI','CAD','CAI','SD') group by a.pos)
 or (select count(distinct v) from jsonb_array_elements_text(positions) e(v))<>jsonb_array_length(positions) then raise exception 'Revisa las posiciones.';end if;
 pos:=positions->>0;
 pos:=case pos when 'MD' then 'MC' when 'MI' then 'MC' when 'CAD' then 'LD' when 'CAI' then 'LI' when 'SD' then 'DC' else pos end;
 grp:=case when pos='POR' then 'GK' when pos in ('LD','DFC','LI') then 'DEF' when pos in ('MCD','MC','MCO') then 'MID' else 'FWD' end;
end $$;
revoke all on function app.player_profile_fields(jsonb) from public,anon,authenticated;

create or replace function public.admin_edit_player_profile(p_id uuid,p_before jsonb,p_profile jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); player public.players%rowtype; pos text; grp text;
begin
 select * into strict player from public.players where id=p_id for update;
 if app.editable_player(player) is distinct from p_before then raise exception 'La ficha cambió. Actualiza los resultados antes de guardar.';end if;
 select f.pos,f.grp into pos,grp from app.player_profile_fields(p_profile) f;
 update public.players set name=trim(p_profile->>'name'),nationality=trim(p_profile->>'nationality'),age=(p_profile->>'age')::int,
 ovr=(p_profile->>'ovr')::int,value=(p_profile->>'value')::bigint,position=pos,"group"=grp,
 source_record=coalesce(source_record,'{}')||p_profile||jsonb_build_object('position',pos,'group',grp) where id=p_id;
 perform public.audit(tid,'admin.ficha.editada','players',p_id::text||' · '||(p_profile->>'name'));
end $$;

create function public.admin_create_player(p_profile jsonb,p_sofifa_url text default null,p_club uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); pid uuid:=gen_random_uuid(); link text:=nullif(trim(p_sofifa_url),'');
 sid bigint; pos text; grp text; identity_name text:=lower(trim(p_profile->>'name')); nation text:=lower(trim(p_profile->>'nationality'));
begin
 select f.pos,f.grp into pos,grp from app.player_profile_fields(p_profile) f;
 if link is not null then
   sid:=substring(link from '^https://(?:www\.)?sofifa\.com/player/([1-9][0-9]{0,15})(?:[/?#][^[:space:]]*)?$')::bigint;
   if sid is null then raise exception 'Usa el enlace de la ficha del jugador en SoFIFA o deja el campo vacío.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(identity_name||'/'||nation,0));
 if exists(select from public.players p where (sid is not null and p.sofifa_id=sid) or
 (lower(trim(p.name))=identity_name and lower(trim(p.nationality))=nation and p.age=(p_profile->>'age')::int and (sid is null or p.sofifa_id is null))) then
 raise exception 'Ya existe una ficha coincidente. Busca al jugador en el pool.';end if;
 insert into public.players(id,name,nationality,age,ovr,value,initial_value,position,"group",sofifa_id,source_key,source_record)
 values(pid,trim(p_profile->>'name'),trim(p_profile->>'nationality'),(p_profile->>'age')::int,(p_profile->>'ovr')::int,
 (p_profile->>'value')::bigint,(p_profile->>'value')::bigint,pos,grp,sid,coalesce('sofifa:'||sid,'manual:'||pid),
 p_profile||jsonb_strip_nulls(jsonb_build_object('origin','manual','sofifaUrl',link,'sourceId',sid::text,'position',pos,'group',grp)));
 if p_club is not null then perform public.admin_roster_change(pid,null,p_club,'add');end if;
 perform public.audit(tid,'admin.ficha.creada','players',pid::text||' · '||(p_profile->>'name'),p_club);
 return pid;
end $$;
revoke all on function public.admin_create_player(jsonb,text,uuid) from public,anon;
grant execute on function public.admin_create_player(jsonb,text,uuid) to authenticated;

create or replace function public.admin_player_profiles(p_search text,p_page integer,p_club uuid,p_free boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin();
begin
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.id),'[]') from (
 select p.id,p.name,app.editable_player(p) profile,case when p.sofifa_id is not null then concat('https://sofifa.com/player/',p.sofifa_id) end as "sofifaUrl",c.name club, b.player_id is not null blocked
 from public.players p left join public.squad_players s on s.player_id=p.id and s.tournament_id=tid
 left join public.clubs c on c.id=s.club_id left join app.blocked_signings b on b.tournament_id=tid and b.player_id=p.id
 where (p.catalog_active or s.id is not null) and (p_club is null or s.club_id=p_club) and (not p_free or s.id is null)
 and (strpos(lower(p.name),lower(trim(p_search)))>0 or p.sofifa_id::text=trim(p_search))
 order by p.name,p.id limit 26 offset 25*greatest(0,least(p_page,10000))) x);
end $$;

