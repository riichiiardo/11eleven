begin;
alter table public.squads add column if not exists fc_tactics_code text not null default '';
alter table public.squads add column if not exists fc_tactics_instructions text not null default '';

create or replace function public.squad_tactics(p_club uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('code',s.fc_tactics_code,'instructions',s.fc_tactics_instructions) into result
 from public.squads s join public.presidents p on p.id=s.president_id and p.club_id=s.club_id and p.tournament_id=s.tournament_id
 join public.profiles pr on pr.id=p.user_id and pr.active_tournament_id=p.tournament_id
 where p.user_id=auth.uid() and s.club_id=p_club;
 if result is null then raise exception 'No puedes consultar la táctica de este equipo.';end if;
 return result;
end$$;

create or replace function public.save_squad_tactics(p_club uuid,p_code text,p_instructions text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 if p_code is null or p_instructions is null or char_length(btrim(p_code))>64 or char_length(p_instructions)>4000 or p_code ~ '[[:cntrl:]]' then
 raise exception 'El código admite hasta 64 caracteres y las instrucciones hasta 4000.';end if;
 update public.squads s set fc_tactics_code=btrim(p_code),fc_tactics_instructions=p_instructions
 from public.presidents p join public.profiles pr on pr.id=p.user_id and pr.active_tournament_id=p.tournament_id
 where p.user_id=auth.uid() and p.club_id=p_club and s.club_id=p.club_id and s.president_id=p.id and s.tournament_id=p.tournament_id
 returning s.tournament_id into tid;
 if tid is null then raise exception 'Solo puedes guardar la táctica de tu equipo en el universo activo.';end if;
 perform public.audit(tid,'tactica.guardada','squads','Código de importación e instrucciones tácticas actualizados.',p_club);
 return public.squad_tactics(p_club);
end$$;
revoke all on function public.squad_tactics(uuid),public.save_squad_tactics(uuid,text,text) from public,anon;
grant execute on function public.squad_tactics(uuid),public.save_squad_tactics(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
