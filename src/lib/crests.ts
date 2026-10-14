/**
 * Escudos de los clubes del catálogo 11Eleven (FC 27).
 *
 * Los archivos existentes proceden de ESPN; los faltantes de la liga se
 * descargan de Footylogos. Todos se sirven desde `public/crests`.
 * `team-crests.json` asocia los 18 nombres canónicos del Excel a esos archivos.
 *
 * Regenerar: `python3 scripts/sync-crests.py fetch`
 *
 * El mapa se resuelve por el nombre del club del snapshot; cualquier club que
 * no aparezca (p. ej. una liga creada a mano) cae gracefully al escudo de
 * iniciales del componente `Crest`.
 */
import teamCrests from "./team-crests.json";

export const CRESTS: Record<string, string> = {
  "AC Milan": "crests/ac-milan.png",
  "ACF Fiorentina": "crests/acf-fiorentina.png",
  "AFC Ajax": "crests/afc-ajax.png",
  "Al-Ahli SFC": "crests/al-ahli-sfc.png",
  "Al-Hilal SFC": "crests/al-hilal-sfc.png",
  "Al-Ittihad Club": "crests/al-ittihad-club.png",
  "Al-Nassr FC": "crests/al-nassr-fc.png",
  "América de Cali": "crests/america-de-cali.png",
  "Arsenal FC": "crests/arsenal-fc.png",
  "AS Monaco": "crests/as-monaco.png",
  "AS Roma": "crests/as-roma.png",
  "Aston Villa": "crests/aston-villa.png",
  "Atalanta BC": "crests/atalanta-bc.png",
  "Athletic Bilbao": "crests/athletic-bilbao.png",
  "Atlético Madrid": "crests/atletico-madrid.png",
  "Atlético Nacional": "crests/atletico-nacional.png",
  "AZ Alkmaar": "crests/az-alkmaar.png",
  "Bayer Leverkusen": "crests/bayer-leverkusen.png",
  "Bayern de Múnich": "crests/bayern-de-munich.png",
  "Beşiktaş JK": "crests/besiktas-jk.png",
  "Boca Juniors": "crests/boca-juniors.png",
  "Bologna FC": "crests/bologna-fc.png",
  "Borussia Dortmund": "crests/borussia-dortmund.png",
  "Borussia Mönchengladbach": "crests/borussia-monchengladbach.png",
  "Bournemouth": "crests/bournemouth.png",
  "Brentford FC": "crests/brentford-fc.png",
  "Brighton & Hove Albion": "crests/brighton-hove-albion.png",
  "CA Osasuna": "crests/ca-osasuna.png",
  "Cagliari Calcio": "crests/cagliari-calcio.png",
  "CF Monterrey": "crests/cf-monterrey.png",
  "Chelsea FC": "crests/chelsea-fc.png",
  "Chivas de Guadalajara": "crests/chivas-de-guadalajara.png",
  "Club América": "crests/club-america.png",
  "Corinthians": "crests/corinthians.png",
  "Cruz Azul": "crests/cruz-azul.png",
  "Crystal Palace": "crests/crystal-palace.png",
  "Eintracht Frankfurt": "crests/eintracht-frankfurt.png",
  "Estudiantes LP": "crests/estudiantes-lp.png",
  "Everton FC": "crests/everton-fc.png",
  "FC Barcelona": "crests/fc-barcelona.png",
  "FC Porto": "crests/fc-porto.png",
  "Fenerbahçe SK": "crests/fenerbahce-sk.png",
  "Feyenoord Rotterdam": "crests/feyenoord-rotterdam.png",
  "Flamengo": "crests/flamengo.png",
  "Fulham FC": "crests/fulham-fc.png",
  "Galatasaray SK": "crests/galatasaray-sk.png",
  "Genoa CFC": "crests/genoa-cfc.png",
  "Getafe CF": "crests/getafe-cf.png",
  "Grêmio": "crests/gremio.png",
  "Hellas Verona": "crests/hellas-verona.png",
  "Independiente Santa Fe": "crests/independiente-santa-fe.png",
  "Inter de Milán": "crests/inter-de-milan.png",
  "Inter Miami CF": "crests/inter-miami-cf.png",
  "Internacional": "crests/internacional.png",
  "Ipswich Town": "crests/ipswich-town.png",
  "Junior FC": "crests/junior-fc.png",
  "Juventus FC": "crests/juventus-fc.png",
  "Kawasaki Frontale": "crests/kawasaki-frontale.png",
  "LA Galaxy": "crests/la-galaxy.png",
  "Las Palmas": "crests/las-palmas.png",
  "Leicester City": "crests/leicester-city.png",
  "Lille OSC": "crests/lille-osc.png",
  "Liverpool FC": "crests/liverpool-fc.png",
  "Manchester City": "crests/manchester-city.png",
  "Manchester United": "crests/manchester-united.png",
  "Millonarios FC": "crests/millonarios-fc.png",
  "New York City FC": "crests/new-york-city-fc.png",
  "Newcastle United": "crests/newcastle-united.png",
  "Nottingham Forest": "crests/nottingham-forest.png",
  "OGC Nice": "crests/ogc-nice.png",
  "Olympique de Marsella": "crests/olympique-de-marsella.png",
  "Olympique Lyonnais": "crests/olympique-lyonnais.png",
  "Palmeiras": "crests/palmeiras.png",
  "Paris Saint-Germain": "crests/paris-saint-germain.png",
  "PSV Eindhoven": "crests/psv-eindhoven.png",
  "Racing Club": "crests/racing-club.png",
  "Rayo Vallecano": "crests/rayo-vallecano.png",
  "RB Leipzig": "crests/rb-leipzig.png",
  "RC Celta": "crests/rc-celta.png",
  "RC Lens": "crests/rc-lens.png",
  "RC Strasbourg": "crests/rc-strasbourg.png",
  "RCD Mallorca": "crests/rcd-mallorca.png",
  "Real Betis": "crests/real-betis.png",
  "Real Madrid CF": "crests/real-madrid-cf.png",
  "Real Sociedad": "crests/real-sociedad.png",
  "River Plate": "crests/river-plate.png",
  "San Lorenzo": "crests/san-lorenzo.png",
  "Santos FC": "crests/santos-fc.png",
  "SC Braga": "crests/sc-braga.png",
  "SC Freiburg": "crests/sc-freiburg.png",
  "Sevilla FC": "crests/sevilla-fc.png",
  "SL Benfica": "crests/sl-benfica.png",
  "Southampton FC": "crests/southampton-fc.png",
  "Sporting CP": "crests/sporting-cp.png",
  "SS Lazio": "crests/ss-lazio.png",
  "SSC Napoli": "crests/ssc-napoli.png",
  "Stade Rennais": "crests/stade-rennais.png",
  "São Paulo FC": "crests/sao-paulo-fc.png",
  "Tigres UANL": "crests/tigres-uanl.png",
  "Torino FC": "crests/torino-fc.png",
  "Tottenham Hotspur": "crests/tottenham-hotspur.png",
  "Toulouse FC": "crests/toulouse-fc.png",
  "UD Almería": "crests/ud-almeria.png",
  "Udinese Calcio": "crests/udinese-calcio.png",
  "US Lecce": "crests/us-lecce.png",
  "US Sassuolo": "crests/us-sassuolo.png",
  "Valencia CF": "crests/valencia-cf.png",
  "VfB Stuttgart": "crests/vfb-stuttgart.png",
  "VfL Wolfsburg": "crests/vfl-wolfsburg.png",
  "Villarreal CF": "crests/villarreal-cf.png",
  "Vélez Sarsfield": "crests/velez-sarsfield.png",
  "Werder Bremen": "crests/werder-bremen.png",
  "West Ham United": "crests/west-ham-united.png",
  "Wolverhampton": "crests/wolverhampton.png",
  "Yokohama F. Marinos": "crests/yokohama-f-marinos.png",
  ...Object.fromEntries(Object.entries(teamCrests).map(([name, entry]) => [name, entry.path])),
};

/**
 * Ruta pública del escudo de un club, o `null` si el catálogo no lo tiene
 * (entonces `Crest` muestra las iniciales sobre los colores del club).
 * `BASE_URL` cubre tanto el dev server (`/`) como GitHub Pages (`/11eleven/`).
 */
export function crestFor(name?: string | null): string | null {
  if (!name) return null;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const path = CRESTS[name.trim()] ?? Object.entries(CRESTS).find(([key]) => normalize(key) === normalize(name))?.[1];
  if (!path) return null;
  return `${import.meta.env.BASE_URL}${path}`;
}
