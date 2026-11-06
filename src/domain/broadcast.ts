/** Public channel and recordings observed on 2026-11-06. Never an API secret. */
export const BROADCAST_CHANNEL = "SUPERNOVALEAGUEKTV";
export const BROADCAST_CHANNEL_ID = "UCdi3BBPwD7Y0XTp86qGCofA";
export const BROADCAST_CHANNEL_URL = `https://www.youtube.com/@${BROADCAST_CHANNEL}`;
export const BROADCAST_MIN_WIDTH = 200;
export const BROADCAST_COMPETITIONS = [
  { slug: "primera", name: "Primera", format: "league", reviewFrom: 9 },
  { slug: "ascenso", name: "Ascenso", format: "league", reviewFrom: 9 },
  {
    slug: "liga-mx",
    name: "Liga MX",
    format: "league_playoffs",
    reviewFrom: 9,
  },
  { slug: "champions", name: "Champions", format: "cup", reviewFrom: 5 },
  { slug: "libertadores", name: "Libertadores", format: "cup", reviewFrom: 3 },
  { slug: "fa-cup", name: "FA Cup", format: "cup", reviewFrom: null },
] as const;
export const BROADCAST_RECORDINGS = [
  {
    id: "EWOxcfACXhQ",
    title: "4Tos FA CUP",
    duration: "1 h 42 min",
    competition: "fa-cup",
    round: null,
  },
  {
    id: "RTZJHD2pLu0",
    title: "4Tos FA CUP",
    duration: "1 min 16 s",
    competition: "fa-cup",
    round: null,
  },
  {
    id: "EUpPyzN-sTU",
    title: "J11 PRIMERA",
    duration: "1 h 34 min",
    competition: "primera",
    round: 11,
  },
  {
    id: "7ePqGdInMGs",
    title: "J11 ASCENSO",
    duration: "1 h 25 min",
    competition: "ascenso",
    round: 11,
  },
  {
    id: "WnA9J8rJAO0",
    title: "J11 LIGA MX",
    duration: "44 min",
    competition: "liga-mx",
    round: 11,
  },
  {
    id: "cDoiWNVv6gE",
    title: "J11 LIGA MX",
    duration: "39 min",
    competition: "liga-mx",
    round: 11,
  },
  {
    id: "0RF0JPPN1Kc",
    title: "J5 CHAMPIONS",
    duration: "1 h 12 min",
    competition: "champions",
    round: 5,
  },
  {
    id: "96pC3TYT690",
    title: "J5 CHAMPIONS",
    duration: "1 h 48 min",
    competition: "champions",
    round: 5,
  },
  {
    id: "cBHoOBbwZ1U",
    title: "J10 ASCENSO",
    duration: "1 h 19 min",
    competition: "ascenso",
    round: 10,
  },
  {
    id: "Bmj00ao9S7s",
    title: "J10 1ERA",
    duration: "1 h 28 min",
    competition: "primera",
    round: 10,
  },
  {
    id: "q1hCOhKym64",
    title: "J10 1ERA",
    duration: "25 min",
    competition: "primera",
    round: 10,
  },
  {
    id: "B0E2cv7bmZM",
    title: "J10 LIGA MX",
    duration: "3 h 16 min",
    competition: "liga-mx",
    round: 10,
  },
  {
    id: "3DQfddVDtZo",
    title: "J3 LIBERTADORES",
    duration: "2 h 40 min",
    competition: "libertadores",
    round: 3,
  },
  {
    id: "Ax3pHQdXZm8",
    title: "J9 1ERA",
    duration: "1 h 26 min",
    competition: "primera",
    round: 9,
  },
  {
    id: "Dd4rk0jWPjw",
    title: "J9 2DA división",
    duration: "18 min",
    competition: "ascenso",
    round: 9,
  },
  {
    id: "IviPCCXMnIg",
    title: "J9 2DA división",
    duration: "57 min",
    competition: "ascenso",
    round: 9,
  },
  {
    id: "mgt2EO2Wv5k",
    title: "J9 LIGA MX",
    duration: "1 h 10 min",
    competition: "liga-mx",
    round: 9,
  },
] as const;

export function youtubeEmbedUrl(
  selection: string,
  origin: string,
  second = 0,
): string | null {
  let location: URL;
  try {
    location = new URL(origin);
  } catch {
    return null;
  }
  if (
    !/^https?:$/.test(location.protocol) ||
    location.origin !== origin ||
    location.username ||
    location.password
  )
    return null;
  if (!validPlayback(selection, second)) return null;
  const url = new URL(
    selection === "live"
      ? "https://www.youtube.com/embed/live_stream"
      : `https://www.youtube.com/embed/${selection}`,
  );
  if (selection === "live")
    url.searchParams.set("channel", BROADCAST_CHANNEL_ID);
  else if (second > 0) url.searchParams.set("start", String(second));
  for (const [key, value] of Object.entries({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    controls: "1",
    rel: "0",
    origin,
  }))
    url.searchParams.set(key, value);
  return url.href;
}

export type BroadcastPlayback = { selection: string; second: number };

/** Only public catalog IDs and whole, nonnegative timestamps are playable. */
export function parseBroadcastPlayback(search: string): BroadcastPlayback {
  const params = new URLSearchParams(search);
  const selection = params.get("video") ?? "live";
  const rawSecond = params.get("t") ?? "0";
  const second = /^\d+$/.test(rawSecond) ? Number(rawSecond) : 0;
  return validPlayback(selection, second)
    ? { selection, second }
    : { selection: "live", second: 0 };
}

export function broadcastEvidencePath(
  videoId: string,
  second: number,
): string | null {
  if (videoId === "live" || !validPlayback(videoId, second)) return null;
  const query = new URLSearchParams({ video: videoId, t: String(second) });
  return `/dashboard/transmision?${query}`;
}

function validPlayback(selection: string, second: number): boolean {
  return (
    (selection === "live" ||
      BROADCAST_RECORDINGS.some((v) => v.id === selection)) &&
    Number.isInteger(second) &&
    second >= 0 &&
    second <= 86400
  );
}
