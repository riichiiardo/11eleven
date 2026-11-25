select cron.schedule('11eleven-draft-replacement-clock','10 seconds',$job$
 select app.advance_expired_draft(d.tournament_id)
 from public.drafts d
 where d.status='en_curso' and (
  app.is_draft_bot_slot(d.tournament_id,d."order"[d.current_index+1])
  or (d.current_deadline<=now() and app.draft_waiting_replacement(d,d."order"[d.current_index+1]))
 );
$job$);
