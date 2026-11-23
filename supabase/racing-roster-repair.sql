-- Production reconciliation. The allowlist maps the 28 supplied names to their existing roster row IDs.
do $$
declare club uuid:='77554376-873a-4501-a8df-5f5ebc32ea30'; tid uuid:='98d2ad67-9355-4d36-a19f-ed6a4941b322';
 keep uuid[]:=array['5e7b85f0-5504-4e6a-bf47-ec166eab9af8',
'17a7983a-e421-4ba7-85e6-5aa47d4710cf',
'741408f9-0550-4cad-adaf-d1c7ea12934b',
'40229a5b-ff8b-41c6-a979-5192daf55e33',
'19aec8e2-f72c-4350-b63d-9a7866a7b1b5',
'6b33a400-e427-4277-a518-ce427b920973',
'c8728881-90ca-44ec-8169-83e6fd26f6e6',
'aa2ab043-fa32-41e6-84ec-a84be786bd38',
'11f8f0bc-77a9-4b1b-adfb-dd9a72fc7ebb',
'90289a62-933e-485f-a815-672f66f8645d',
'4b2289f9-5a85-4ac0-b2e9-362b2a9848e0',
'8d11b7dd-6015-418c-94cc-0bddde020fce',
'3386696b-2346-414b-a711-8e95d19c39b9',
'7778e773-0ae2-4f60-b217-5fc5a240746f',
'f1406fef-f246-4e20-95cd-153d46fafad4',
'b61b54c6-31ce-47c4-bd5c-d9d651e05b3f',
'e9a21f08-dd96-4f64-ba3d-8409b0a18707',
'5b823fd1-f489-4eaa-b473-0fe78fde1e04',
'4fd6a970-71e7-44a6-bf90-fda5691168e7',
'7fd569d2-b15b-41c7-833c-5ac0e01e29ae',
'09856fae-37bb-4d53-9b59-721665816e4c',
'71a3889e-e970-4c29-8e76-051f1cb66f29',
'a0407f33-a717-4faf-a737-cc94a4b92cbb',
'31d44d58-2622-4f6c-b12e-213ece7d5a88',
'ad849e8f-d4e7-4600-93b0-4f3a741d2590',
'3bc7c9df-f5d2-4e4f-b851-64f6e064f62d',
'75022122-d09c-4388-b158-1d0809bd8acc',
'eb4cf80f-f36f-4c2d-a038-79b6ed8a0920']::uuid[];
 release uuid[]:=array['5c23a716-de20-4ebf-80e5-917a144232bf',
'b96fe854-631f-42f9-b712-b4915f075075',
'dc571c74-1c99-4664-ad25-a95969e2c929',
'714b19dd-6e2f-4a54-832d-0e0e694b8df9',
'f625f4b5-5c7e-4ca1-8d8e-2895c82fd34a',
'217f0be9-a67d-43ff-98d2-6502a83dde0f',
'14ba467c-74f9-407c-93af-b16e0ff4112d',
'0375ad77-2ba5-4e80-a501-28746baed7db',
'eb24e0fa-66ab-4b1f-8490-e4f48732acc4',
'8d710fed-b39c-4931-a13b-c6384c9ee079',
'ea3a1012-6f2f-4b55-8d27-4f111f4a95da',
'8bf95b5d-5738-4f1d-a8d1-461d7fa70f49',
'0a6f6808-a65b-4d33-9340-183db1772744',
'577e15ed-6ecf-4291-a895-591a8165457b',
'cd44c056-3301-4afd-9f80-6ba9c1a506eb',
'5125ad54-c780-4dbb-8838-d6caa4dd3dd9',
'e25246fa-fc28-47f6-a4bb-3a7324fad3e6',
'ebf6104d-cd03-4152-9924-bccf499105f7',
'4e4d9e07-f78b-4b7a-bdc0-2705cd9cc766',
'ec0b97fd-2e7b-4a3b-a66b-5c01cc65e31e',
'e3d7e152-7730-4a4c-82cc-7194269d388b',
'3ab05978-d019-41a3-abae-806e15e86fe5',
'6214da3e-18d0-4e09-a946-26c2f551e97a',
'fc976028-233a-4294-b644-e97e113fd91b',
'432bd04b-407d-48fd-b169-dd8e1ca0978a',
'303a964f-e03f-414e-8e41-b32d481541ea',
'50fdfcf4-97de-4715-92c5-949c57fb6161',
'3238776f-d302-4528-b7ef-c37e805aadee',
'f8647cc8-0b7e-4c90-81b2-987172e522a7',
'4a7a7f11-4cf6-4455-9863-55aaa8aca7de']::uuid[];
 n integer;
begin
 perform 1 from public.clubs where id=club and tournament_id=tid for update;
 if not found then return; end if;
 if (select count(*) from public.squad_players where club_id=club and id=any(keep))<>28 then raise exception 'Cambió la plantilla canónica'; end if;
 if (select count(*) from public.squad_players where club_id=club)=28 then return; end if;
 if (select count(*) from public.squad_players where club_id=club)<>58 then raise exception 'Cambió la plantilla de Racing'; end if;
 create table if not exists app.racing_roster_correction_backup(id uuid primary key,record jsonb not null);
 revoke all on app.racing_roster_correction_backup from public,anon,authenticated;
 insert into app.racing_roster_correction_backup select s.id,to_jsonb(s) from public.squad_players s where s.club_id=club and s.id=any(release) on conflict do nothing;
 delete from public.squad_players s using public.players p where s.club_id=club and s.tournament_id=tid and s.id=any(release) and s.player_id=p.id and p.source_record->>'game_team' is null
 and not exists(select from public.offers o where o.tournament_id=tid and p.id=any(o.requested_player_ids||o.offered_player_ids))
 and not exists(select from public.draft_picks dp where dp.tournament_id=tid and dp.player_id=p.id);
 get diagnostics n=row_count;
 if n<>30 then raise exception 'Cambió la situación de los jugadores'; end if;
end $$;
