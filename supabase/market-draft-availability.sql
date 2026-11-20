-- Install after market-availability.sql and draft-outgoing.sql.
begin;
create or replace function public.change_squad_availability(p_squad_player_id uuid,p_availability text,p_withdraw boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; pres uuid; pid uuid; player_name text; list_status text; selected boolean; withdrawn boolean:=false;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para actualizar tu plantilla.';end if;
 if p_availability is null or p_availability not in ('transferible','negociacion','neutro','intransferible') or p_withdraw is null then raise exception 'Situación de mercado no válida.';end if;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if tid is null or not public.is_member(tid) then raise exception 'No perteneces al universo activo.';end if;
 perform app.lock_draft_outgoing(tid);
 select id into pres from public.presidents where tournament_id=tid and user_id=auth.uid() for update;
 select sp.player_id,p.name into pid,player_name from public.squad_players sp join public.players p on p.id=sp.player_id
 where sp.id=p_squad_player_id and sp.president_id=pres and sp.tournament_id=tid and sp.club_id=(select club_id from public.presidents where id=pres);
 if pid is null then raise exception 'Solo puedes cambiar jugadores de tu propia plantilla en el universo activo.';end if;
 select status into list_status from app.draft_prelists where president_id=pres for update;
 perform 1 from app.draft_outgoing where president_id=pres and player_id=pid and tournament_id=tid and status='selected' for update;
 selected:=found;
 if selected and p_availability<>'transferible' then
  if exists(select 1 from public.drafts where tournament_id=tid and started_at is not null) then raise exception 'El draft ya comenzó: no puedes retirar esta baja desde el mercado.';end if;
  if list_status='submitted' then raise exception 'Tu prelista está en revisión. Espera la respuesta antes de retirar esta baja.';end if;
  if not p_withdraw then return jsonb_build_object('requiresWithdrawal',true,'withdrawn',false,'playerName',player_name);end if;
  update app.draft_outgoing set status='withdrawn' where president_id=pres and player_id=pid and tournament_id=tid and status='selected';
  update app.draft_prelists set outgoing=(select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from jsonb_array_elements(outgoing) with ordinality where value<>to_jsonb(pid::text)),revision=revision+1,updated_at=now()
  where president_id=pres and outgoing @> jsonb_build_array(pid::text);
  withdrawn:=true;
 end if;
 perform public.set_availability(p_squad_player_id,p_availability);
 if withdrawn then perform public.audit(tid,'draft.baja.retirada','squad_players','Baja retirada y situación de mercado actualizada: '||player_name||'.',(select club_id from public.presidents where id=pres));end if;
 return jsonb_build_object('requiresWithdrawal',false,'withdrawn',withdrawn,'availability',p_availability);
end$$;
revoke all on function public.change_squad_availability(uuid,text,boolean) from public,anon;
grant execute on function public.change_squad_availability(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
