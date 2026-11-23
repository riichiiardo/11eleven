-- Match the same identity criteria used by admin_create_player, including retired records.
create function public.admin_player_matches(p_name text,p_nation text,p_age int,p_link text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); sid bigint:=substring(trim(p_link) from '^https://(?:www\.)?sofifa\.com/player/([1-9][0-9]{0,15})(?:[/?#][^[:space:]]*)?$')::bigint;
begin
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.id),'[]') from (
 select p.id,p.name,p.nationality,p.age,p.catalog_active active,c.name club,s.club_id,b.player_id is not null blocked from public.players p
 left join public.squad_players s on s.tournament_id=tid and s.player_id=p.id
 left join public.clubs c on c.id=s.club_id left join app.blocked_signings b on b.tournament_id=tid and b.player_id=p.id
 where p.sofifa_id=sid or (lower(trim(p.name))=lower(trim(p_name)) and lower(trim(p.nationality))=lower(trim(p_nation)) and p.age=p_age and (sid is null or p.sofifa_id is null))) x);
end $$;

-- When an admin removes exactly one outgoing entry, the release RPC already updates its tracking row.
do $$declare d text:=pg_get_functiondef('app.sync_draft_outgoing()'::regprocedure); marker text:='  if auth.uid() is not null and owner.user_id<>auth.uid()';
begin
 if strpos(d,marker)=0 then raise exception 'Revisar el disparador de bajas';end if;
 execute replace(d,marker,'  if tg_op=''UPDATE'' and public.is_admin(owner.tournament_id)
 and current_setting(''app.admin_release_player'',true) is not null
 and new.outgoing = old.outgoing - current_setting(''app.admin_release_player'',true)
 then return new; end if;
'||marker);
end $$;

create function public.admin_release_roster_player(p_player uuid,p_club uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); owner_id uuid;
begin
 perform app.lock_draft_outgoing(tid);
 select president_id into owner_id from public.squad_players where tournament_id=tid and club_id=p_club and player_id=p_player for update;
 if not found then raise exception 'El jugador ya no pertenece a este club. Actualiza la plantilla.';end if;
 if exists(select from public.offers where tournament_id=tid and status in ('aceptada','reservada') and (p_player=any(requested_player_ids) or p_player=any(offered_player_ids))) then
 raise exception 'Este jugador tiene un acuerdo aceptado o reservado. Resuelve la venta en Negociaciones antes de dejarlo libre.';end if;
 update public.offers set status='invalidada',invalid_reason='Jugador liberado por Administración.',updated_at=now()
 where tournament_id=tid and status in ('enviada','negociacion') and (p_player=any(requested_player_ids) or p_player=any(offered_player_ids));
 update app.draft_outgoing set status='withdrawn' where tournament_id=tid and player_id=p_player and status='selected';
 perform set_config('app.admin_release_player',p_player::text,true);
 update app.draft_prelists set outgoing=outgoing-p_player::text where president_id=owner_id and outgoing ? p_player::text;
 perform set_config('app.admin_release_player','',true);
 perform public.admin_roster_change(p_player,p_club,null,'release');
end $$;
revoke all on function public.admin_release_roster_player(uuid,uuid), public.admin_player_matches(text,text,int,text) from public,anon;
grant execute on function public.admin_release_roster_player(uuid,uuid), public.admin_player_matches(text,text,int,text) to authenticated;
