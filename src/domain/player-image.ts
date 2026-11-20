/** A CSV may contain the image URL or the first SoFIFA table cell as HTML. */
export function normalizePlayerImage(
  input: string,
  sourceId: string,
): string | undefined {
  let value = input.trim();
  if (!value) return undefined;
  if (value.includes("<")) {
    const firstCell = value.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? value;
    const img = firstCell.match(/<img\b[^>]*>/i)?.[0] ?? "";
    value = (
      img.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1] ??
      img.match(/(?:^|\s)src\s*=\s*["']([^"']+)["']/i)?.[1] ??
      ""
    ).replace(/&amp;/g, "&");
  }
  if (value.startsWith("//")) value = "https:" + value;
  const url = new URL(value);
  const match = url.pathname.match(
    /^\/players\/(\d{3})\/(\d{3})\/\d+_(60|120|240)\.png$/,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "cdn.sofifa.net" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match ||
    Number(match[1] + match[2]) !== Number(sourceId)
  )
    throw Error(
      "Imagen_URL debe ser una foto PNG del CDN de SoFIFA correspondiente al ID del jugador.",
    );
  return url.href;
}
export function playerImageCandidates(source: string): string[] {
  return [
    ...new Set([
      source.replace(/_(60|120|240)\.png$/, "_240.png"),
      source.replace(/_(60|120|240)\.png$/, "_120.png"),
      source,
    ]),
  ];
}
export function validPortraitPng(bytes: Uint8Array): boolean {
  if (
    bytes.length < 24 ||
    bytes.length > 2097152 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => bytes[i] !== b)
  )
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  return width >= 32 && width <= 2048 && height >= 32 && height <= 2048;
}
