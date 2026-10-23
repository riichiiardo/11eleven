/** Public channel only: no stream key, OAuth token or server credential. */
export const TWITCH_CHANNEL = "superliganova";
export const TWITCH_CHANNEL_URL = `https://www.twitch.tv/${TWITCH_CHANNEL}`;
export const TWITCH_MIN_WIDTH = 400;

/** parent is a hostname, never an origin, path or URL supplied by a visitor. */
export function twitchEmbedUrl(hostname: string): string | null {
  if (
    !hostname ||
    hostname.length > 253 ||
    !hostname
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  )
    return null;
  const url = new URL("https://player.twitch.tv/");
  url.search = new URLSearchParams({
    channel: TWITCH_CHANNEL,
    parent: hostname.toLowerCase(),
    autoplay: "false",
    muted: "true",
  }).toString();
  return url.href;
}
