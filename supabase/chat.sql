-- Apply after the existing backend modules. No backfill, emails or remote calls.
begin;
create table if not exists app.chat_threads (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  kind text not null check(kind in ('general','direct','offer','bot')),
  topic text not null,
  president_a uuid references public.presidents(id) on delete cascade,
  president_b uuid references public.presidents(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  unique(tournament_id,kind,topic),
  check ((kind='general' and president_a is null and president_b is null and offer_id is null)
    or (kind='bot' and president_a is not null and president_b is null and offer_id is null)
    or (kind='direct' and president_a is not null and president_b is not null and president_a<>president_b and offer_id is null)
    or (kind='offer' and president_a is not null and president_b is not null and president_a<>president_b and offer_id is not null))
);
create index if not exists chat_threads_a on app.chat_threads(tournament_id,president_a);
create index if not exists chat_threads_b on app.chat_threads(tournament_id,president_b);
create index if not exists chat_threads_offer on app.chat_threads(offer_id);
create table if not exists app.chat_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  author_id uuid references public.presidents(id) on delete set null,
  author_name text not null,
  sender text not null check(sender in ('president','bot')),
  body text not null check(length(btrim(body)) between 1 and 4000),
  metadata jsonb not null default '{}',
  client_id uuid,
  event_key text,
  created_at timestamptz not null default now(),
  unique(author_id,client_id),
  unique(thread_id,event_key)
);
create index if not exists chat_messages_thread on app.chat_messages(thread_id,id desc);
create index if not exists chat_messages_rate on app.chat_messages(author_id,created_at desc) where sender='president';
create table if not exists app.chat_reads (
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  president_id uuid not null references public.presidents(id) on delete cascade,
  last_message_id bigint not null default 0,
  primary key(thread_id,president_id)
);
alter table app.chat_threads enable row level security;
alter table app.chat_messages enable row level security;
alter table app.chat_reads enable row level security;
revoke all on app.chat_threads,app.chat_messages,app.chat_reads from public,anon,authenticated;
revoke all on sequence app.chat_messages_id_seq from public,anon,authenticated;

create or replace function app.chat_me(p_expected uuid default null) returns public.presidents
language plpgsql stable security definer set search_path='' as $$
declare me public.presidents%rowtype; tid uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select * into me from public.presidents where tournament_id=tid and user_id=auth.uid() and club_id is not null;
  if me.id is null or not coalesce(public.is_member(tid),false) then raise exception 'Selecciona un club y un Universo para usar el chat.'; end if;
  if p_expected is not null and p_expected<>tid then raise exception 'El Universo cambió. Recarga el chat antes de continuar.'; end if;
  return me;
end $$;

-- Internal resolver. Every RPC calls this with identity derived from auth.uid().
create or replace function app.chat_resolve(p_kind text,p_target uuid,p_create boolean default false,p_tournament_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare me public.presidents%rowtype:=app.chat_me(p_tournament_id); a uuid; b uuid; offer_ref uuid; topic_ref text; result uuid; o public.offers%rowtype;
begin
  if p_kind is null or p_kind not in ('general','direct','offer','bot') then raise exception 'Tipo de conversación inválido.'; end if;
  if p_kind in ('general','bot') then
    if p_target is not null then raise exception 'Esta conversación no admite destinatario.'; end if;
    if p_kind='general' then topic_ref:='general'; else a:=me.id;topic_ref:=me.id::text; end if;
  elsif p_kind='direct' then
    if p_target is null or p_target=me.id or not exists(select 1 from public.presidents p where p.id=p_target and p.tournament_id=me.tournament_id and p.club_id is not null
      and (exists(select 1 from public.league_members m where m.tournament_id=p.tournament_id and m.user_id=p.user_id)
        or exists(select 1 from public.tournament_admins m where m.tournament_id=p.tournament_id and m.user_id=p.user_id))) then
      raise exception 'El destinatario no pertenece a tu Universo.';
    end if;
    a:=least(me.id,p_target);b:=greatest(me.id,p_target);topic_ref:=a::text||':'||b::text;
  else
    select * into o from public.offers where id=p_target and tournament_id=me.tournament_id;
    if o.id is null or o.seller_president_id is null or me.id not in (o.bidder_president_id,o.seller_president_id) then raise exception 'No tienes acceso a esta negociación.'; end if;
    a:=o.bidder_president_id;b:=o.seller_president_id;offer_ref:=o.id;topic_ref:=o.id::text;
  end if;
  if p_create then
    insert into app.chat_threads(tournament_id,kind,topic,president_a,president_b,offer_id)
      values(me.tournament_id,p_kind,topic_ref,a,b,offer_ref) on conflict do nothing;
  end if;
  select id into result from app.chat_threads where tournament_id=me.tournament_id and kind=p_kind and topic=topic_ref;
  return result;
end $$;

create or replace function app.chat_inbox(p_tournament_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.presidents%rowtype:=app.chat_me(p_tournament_id);
begin
  return jsonb_build_object('presidentId',me.id,'unread',(
    select count(*) from app.chat_messages m join app.chat_threads t on t.id=m.thread_id
      left join app.chat_reads r on r.thread_id=t.id and r.president_id=me.id
    where t.tournament_id=me.tournament_id and (t.kind='general' or me.id in(t.president_a,t.president_b))
      and m.id>coalesce(r.last_message_id,0) and m.author_id is distinct from me.id),
    'contacts',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.nickname,'club',c.name)order by c.name,p.nickname),'[]')
      from public.presidents p join public.clubs c on c.id=p.club_id and c.tournament_id=p.tournament_id
      where p.tournament_id=me.tournament_id and p.id<>me.id and (exists(select 1 from public.league_members l where l.tournament_id=p.tournament_id and l.user_id=p.user_id)
        or exists(select 1 from public.tournament_admins l where l.tournament_id=p.tournament_id and l.user_id=p.user_id))),
    'threads',(select coalesce(jsonb_agg(to_jsonb(v)order by v."lastId" desc),'[]') from (
      select t.id,t.kind,case when t.kind='direct' then case when t.president_a=me.id then t.president_b else t.president_a end when t.kind='offer' then t.offer_id end as "targetId",
        case t.kind when 'general' then 'Sala general' when 'bot' then 'Bot 11Eleven'
          when 'direct' then coalesce((select nickname from public.presidents where id=case when t.president_a=me.id then t.president_b else t.president_a end),'Presidente')
          else 'Oferta · '||coalesce((select string_agg(p.name,', 'order by p.name)from public.offers o join public.players p on p.id=any(o.requested_player_ids)where o.id=t.offer_id),'Negociación')end as title,
        latest.body as preview,latest.id as "lastId",latest.created_at as "updatedAt",
        (select count(*)from app.chat_messages m where m.thread_id=t.id and m.id>coalesce(r.last_message_id,0)and m.author_id is distinct from me.id)as unread
      from app.chat_threads t left join app.chat_reads r on r.thread_id=t.id and r.president_id=me.id
      join lateral(select id,body,created_at from app.chat_messages where thread_id=t.id order by id desc limit 1)latest on true
      where t.tournament_id=me.tournament_id and (t.kind='general' or me.id in(t.president_a,t.president_b))
      order by latest.id desc limit 100
    )v));
end $$;

create or replace function app.chat_history(p_kind text,p_target uuid default null,p_before bigint default null,p_after bigint default null,p_tournament_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare thread_ref uuid:=app.chat_resolve(p_kind,p_target,false,p_tournament_id); messages jsonb; oldest bigint; newest bigint;
begin
  if (p_before is not null and p_before<=0)or(p_after is not null and p_after<=0)or(p_before is not null and p_after is not null)then raise exception 'Cursor inválido.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'authorId',m.author_id,'authorName',m.author_name,'sender',m.sender,
    'body',m.body,'metadata',m.metadata,'createdAt',m.created_at)order by m.id),'[]'),min(m.id),max(m.id) into messages,oldest,newest
    from(select * from app.chat_messages where thread_id=thread_ref and (p_before is null or id<p_before)and(p_after is null or id>p_after)
      order by case when p_after is not null then id end asc,id desc limit 50)m;
  return jsonb_build_object('messages',messages,'hasMore',exists(select 1 from app.chat_messages where thread_id=thread_ref and id<oldest),
    'hasNewer',p_after is not null and exists(select 1 from app.chat_messages where thread_id=thread_ref and id>coalesce(newest,p_after)),
    'offer',case when p_kind='offer' then(select jsonb_build_object('id',id,'status',status,'cash',cash)from public.offers where id=p_target)end);
end $$;

create or replace function app.chat_send(p_kind text,p_target uuid,p_body text,p_client_id uuid,p_tournament_id uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare me public.presidents%rowtype:=app.chat_me(p_tournament_id); thread_ref uuid; previous app.chat_messages%rowtype; result bigint;
begin
  if p_kind='bot' then raise exception 'Solo el servidor publica avisos del bot.'; end if;
  if p_client_id is null or p_body is null or length(btrim(p_body)) not between 1 and 2000 then raise exception 'Escribe un mensaje de 1 a 2000 caracteres.'; end if;
  -- Serialize sends per president (rate limit/idempotency) and then per thread.
  perform 1 from public.presidents where id=me.id for no key update;
  thread_ref:=app.chat_resolve(p_kind,p_target,true,me.tournament_id);
  select * into previous from app.chat_messages where author_id=me.id and client_id=p_client_id;
  if previous.id is not null then
    if previous.thread_id<>thread_ref or previous.body<>btrim(p_body) then raise exception 'Identificador de envío reutilizado con otro mensaje.'; end if;
    return previous.id::text;
  end if;
  if(select count(*)from app.chat_messages where author_id=me.id and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'Has enviado muchos mensajes. Espera un minuto.'; end if;
  perform 1 from app.chat_threads where id=thread_ref for update;
  insert into app.chat_messages(thread_id,author_id,author_name,sender,body,client_id)
    values(thread_ref,me.id,me.nickname,'president',btrim(p_body),p_client_id)returning id into result;
  return result::text;
end $$;

create or replace function app.chat_mark_read(p_kind text,p_target uuid,p_message_id bigint,p_tournament_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare me public.presidents%rowtype:=app.chat_me(p_tournament_id); thread_ref uuid:=app.chat_resolve(p_kind,p_target,false,me.tournament_id);
begin
  if not exists(select 1 from app.chat_messages where thread_id=thread_ref and id=p_message_id)then raise exception 'El mensaje no pertenece a esta conversación.'; end if;
  insert into app.chat_reads(thread_id,president_id,last_message_id)values(thread_ref,me.id,p_message_id)
    on conflict(thread_id,president_id)do update set last_message_id=greatest(app.chat_reads.last_message_id,excluded.last_message_id);
end $$;

-- Internal writer: callable only by the database owner, never by browser roles.
create or replace function app.chat_bot_post(p_tid uuid,p_kind text,p_topic text,p_a uuid,p_b uuid,p_offer uuid,p_body text,p_metadata jsonb,p_event text) returns void
language plpgsql security definer set search_path='' as $$
declare thread_ref uuid;
begin
  if not exists(select 1 from public.presidents where id=p_a and tournament_id=p_tid)or(p_b is not null and not exists(select 1 from public.presidents where id=p_b and tournament_id=p_tid))then return; end if;
  insert into app.chat_threads(tournament_id,kind,topic,president_a,president_b,offer_id)values(p_tid,p_kind,p_topic,p_a,p_b,p_offer)on conflict do nothing;
  select id into thread_ref from app.chat_threads where tournament_id=p_tid and kind=p_kind and topic=p_topic for update;
  insert into app.chat_messages(thread_id,author_name,sender,body,metadata,event_key)values(thread_ref,'Bot 11Eleven','bot',left(p_body,4000),p_metadata,p_event)on conflict(thread_id,event_key)do nothing;
end $$;

create or replace function app.chat_offer_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare names text; bidder text; seller text; text_body text;
begin
  if new.seller_president_id is null or new.bidder_president_id=new.seller_president_id then return new; end if;
  if tg_op='UPDATE'and row(new.status,new.cash,new.message,new.requested_player_ids,new.offered_player_ids)is not distinct from row(old.status,old.cash,old.message,old.requested_player_ids,old.offered_player_ids)then return new; end if;
  select string_agg(name,', 'order by name)into names from public.players where id=any(new.requested_player_ids);
  select name into bidder from public.clubs where id=new.bidder_club_id;
  select name into seller from public.clubs where id=new.seller_club_id;
  text_body:=coalesce(bidder,'Un club')||' → '||coalesce(seller,'Otro club')||' · '||coalesce(names,'Jugador')||' · '||new.cash::text||' €'||case when cardinality(new.offered_player_ids)>0 or cardinality(new.requested_player_ids)>1 then ' (efectivo total de la operación)'else ''end||' · Estado: '||new.status;
  if tg_op='INSERT'and nullif(btrim(new.message),'')is not null then text_body:=text_body||E'\nMensaje del ofertante: '||left(new.message,2000); end if;
  perform app.chat_bot_post(new.tournament_id,'offer',new.id::text,new.bidder_president_id,new.seller_president_id,new.id,text_body,
    jsonb_build_object('event','offer','offerId',new.id,'status',new.status,'cash',new.cash),
    'offer:'||new.id::text||':'||md5(to_jsonb(new)::text));
  return new;
end $$;
drop trigger if exists chat_offer_event on public.offers;
create trigger chat_offer_event after insert or update on public.offers for each row execute function app.chat_offer_event();

create or replace function app.chat_schedule_notice(p_fixture uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; recipient record; home_name text; away_name text;
begin
  select * into f from public.fixtures where id=p_fixture;
  if f.id is null or f.status='jugado' or f.matchday<>(select current_matchday from public.tournaments where id=f.tournament_id)then return; end if;
  select name into home_name from public.clubs where id=f.home_club_id;
  select name into away_name from public.clubs where id=f.away_club_id;
  for recipient in select id from public.presidents where tournament_id=f.tournament_id and club_id in(f.home_club_id,f.away_club_id)loop
    perform app.chat_bot_post(f.tournament_id,'bot',recipient.id::text,recipient.id,null,null,
      case when f.status='en_curso'then 'Tu partido está en curso: 'else 'Tienes partido: 'end||'Jornada '||f.matchday||' · '||coalesce(home_name,'Local')||' vs '||coalesce(away_name,'Visitante')||' · Fecha UTC: '||to_char(f.kickoff_at at time zone 'UTC','YYYY-MM-DD HH24:MI'),
      jsonb_build_object('event','fixture','fixtureId',f.id,'matchday',f.matchday,'kickoffAt',f.kickoff_at,'status',f.status),
      'fixture:'||f.id::text||':'||md5(jsonb_build_array(f.matchday,f.kickoff_at,f.home_club_id,f.away_club_id,f.status)::text));
  end loop;
end $$;

create or replace function app.chat_matchday_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare f record;
begin
  if new.current_matchday is not distinct from old.current_matchday then return new; end if;
  for f in select id from public.fixtures where tournament_id=new.id and matchday=new.current_matchday and status<>'jugado'loop
    perform app.chat_schedule_notice(f.id);
  end loop;
  return new;
end $$;
drop trigger if exists chat_matchday_event on public.tournaments;
create trigger chat_matchday_event after update of current_matchday on public.tournaments for each row execute function app.chat_matchday_event();

create or replace function app.chat_fixture_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; recipient record; home_name text; away_name text; text_body text; event_type text; scorers text:='';
begin
  if tg_table_name='fixture_reports'then
    if tg_op='UPDATE'and row(new.home_goals,new.away_goals,new.goals)is not distinct from row(old.home_goals,old.away_goals,old.goals)then return new; end if;
    select * into f from public.fixtures where id=new.fixture_id;
    event_type:='result';
    select string_agg(coalesce(p.name,'Jugador')||' ×'||coalesce(g->>'count','1'),', 'order by p.name)into scorers
      from jsonb_array_elements(new.goals)g left join public.players p on p.id::text=g->>'playerId';
  else
    if tg_op='UPDATE'and row(new.status,new.kickoff_at,new.matchday,new.home_club_id,new.away_club_id)is not distinct from row(old.status,old.kickoff_at,old.matchday,old.home_club_id,old.away_club_id)then return new; end if;
    perform app.chat_schedule_notice(new.id);
    return new;
  end if;
  select name into home_name from public.clubs where id=f.home_club_id;
  select name into away_name from public.clubs where id=f.away_club_id;
  text_body:='Jornada '||f.matchday||' · '||coalesce(home_name,'Local')||' vs '||coalesce(away_name,'Visitante');
  if event_type='result'then
    text_body:=case when tg_op='UPDATE'then 'Resultado corregido: 'else 'Resultado registrado: 'end||text_body||' · '||new.home_goals||'–'||new.away_goals||case when scorers is not null then E'\nGoles registrados: '||scorers else ''end;
  else text_body:='Tienes partido: '||text_body||' · Fecha UTC: '||to_char(f.kickoff_at at time zone 'UTC','YYYY-MM-DD HH24:MI'); end if;
  for recipient in select id from public.presidents where tournament_id=f.tournament_id and club_id in(f.home_club_id,f.away_club_id)loop
    perform app.chat_bot_post(f.tournament_id,'bot',recipient.id::text,recipient.id,null,null,text_body,
      jsonb_build_object('event',event_type,'fixtureId',f.id,'matchday',f.matchday,'kickoffAt',f.kickoff_at),
      event_type||':'||f.id::text||':'||md5(to_jsonb(new)::text));
  end loop;
  return new;
end $$;
drop trigger if exists chat_fixture_event on public.fixtures;
create trigger chat_fixture_event after insert or update on public.fixtures for each row execute function app.chat_fixture_event();
drop trigger if exists chat_result_event on public.fixture_reports;
create trigger chat_result_event after insert or update on public.fixture_reports for each row execute function app.chat_fixture_event();

revoke all on function app.chat_me(uuid),app.chat_resolve(text,uuid,boolean,uuid),app.chat_bot_post(uuid,text,text,uuid,uuid,uuid,text,jsonb,text),app.chat_offer_event(),app.chat_fixture_event(),app.chat_schedule_notice(uuid),app.chat_matchday_event()from public,anon,authenticated;
revoke all on function app.chat_inbox(uuid),app.chat_history(text,uuid,bigint,bigint,uuid),app.chat_send(text,uuid,text,uuid,uuid),app.chat_mark_read(text,uuid,bigint,uuid)from public,anon;
grant execute on function app.chat_inbox(uuid),app.chat_history(text,uuid,bigint,bigint,uuid),app.chat_send(text,uuid,text,uuid,uuid),app.chat_mark_read(text,uuid,bigint,uuid)to authenticated;
create or replace function public.chat_inbox(p_tournament_id uuid default null)returns jsonb language sql security invoker set search_path='' as $$select app.chat_inbox(p_tournament_id)$$;
create or replace function public.chat_history(p_kind text,p_target uuid default null,p_before bigint default null,p_after bigint default null,p_tournament_id uuid default null)returns jsonb language sql security invoker set search_path='' as $$select app.chat_history(p_kind,p_target,p_before,p_after,p_tournament_id)$$;
create or replace function public.chat_send(p_kind text,p_target uuid,p_body text,p_client_id uuid,p_tournament_id uuid default null)returns text language sql security invoker set search_path='' as $$select app.chat_send(p_kind,p_target,p_body,p_client_id,p_tournament_id)$$;
create or replace function public.chat_mark_read(p_kind text,p_target uuid,p_message_id bigint,p_tournament_id uuid default null)returns void language sql security invoker set search_path='' as $$select app.chat_mark_read(p_kind,p_target,p_message_id,p_tournament_id)$$;
revoke all on function public.chat_inbox(uuid),public.chat_history(text,uuid,bigint,bigint,uuid),public.chat_send(text,uuid,text,uuid,uuid),public.chat_mark_read(text,uuid,bigint,uuid)from public,anon;
grant execute on function public.chat_inbox(uuid),public.chat_history(text,uuid,bigint,bigint,uuid),public.chat_send(text,uuid,text,uuid,uuid),public.chat_mark_read(text,uuid,bigint,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
