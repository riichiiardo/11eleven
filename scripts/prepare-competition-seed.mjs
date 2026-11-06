/** Emits a scoped SQL plan only. Does not connect, apply SQL or deploy. */
import {
  BROADCAST_CHANNEL_ID,
  BROADCAST_RECORDINGS,
  BROADCAST_COMPETITIONS,
} from "../src/domain/broadcast.ts";
const target = process.argv
  .find((s) => s.startsWith("--universe="))
  ?.split("=")[1];
if (!target || !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(target))
  throw Error(
    "Indica --universe=<UUID>. Este comando solo genera el SQL para revisión.",
  );
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const comps = BROADCAST_COMPETITIONS.map((c) => ({
  id: c.slug,
  name: c.name,
  kind: c.format,
  rounds: c.format === "cup" ? 1 : 2,
  playoffTeams: 0,
  promotions: 0,
  relegations: 0,
  promotionTarget: "",
  relegationTarget: "",
  u20: { enabled: false, min: 0, max: 11 },
  nationals: { enabled: false, min: 0, max: 11 },
  nationality: "",
  customRules: [],
}));
console.log("begin;");
console.log(
  `do $$begin if not exists(select 1 from public.tournament_rules where tournament_id=${q(target)}::uuid and configuration is not null)then raise exception 'El Universo no tiene configuración de reglas preparada.';end if;end $$;`,
);
console.log(
  `insert into app.broadcast_sources(video_id,channel_id,title,competition_slug,round_number)values ${BROADCAST_RECORDINGS.map((v) => `(${q(v.id)},${q(BROADCAST_CHANNEL_ID)},${q(v.title)},${q(v.competition)},${v.round ?? "null"})`).join(",")} on conflict(video_id)do nothing;`,
);
console.log(
  `update public.tournament_rules set configuration=jsonb_set(configuration,'{competitions}',coalesce(configuration->'competitions','[]'::jsonb)||(select coalesce(jsonb_agg(c),'[]')from jsonb_array_elements(${q(JSON.stringify(comps))}::jsonb)c where not exists(select 1 from jsonb_array_elements(coalesce(configuration->'competitions','[]'))old where old->>'id'=c->>'id')))where tournament_id=${q(target)}::uuid;`,
);
console.log(
  `update public.tournament_rules set configuration=jsonb_set(configuration,'{activeCompetitionId}','"primera"'::jsonb)where tournament_id=${q(target)}::uuid and coalesce(configuration->>'activeCompetitionId','')='';`,
);
for (const c of BROADCAST_COMPETITIONS)
  console.log(
    `update app.universe_competitions set review_from=${c.reviewFrom ?? "null"} where tournament_id=${q(target)}::uuid and slug=${q(c.slug)};`,
  );
console.log("commit;");
