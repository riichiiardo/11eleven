/** Public, repository-owned evidence paths only. */
export function isCompetitionEvidencePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /^evidence\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:png|jpg|jpeg|webp)$/.test(
      path,
    )
  );
}
export function competitionEvidenceImageUrl(path: string): string | null {
  return isCompetitionEvidencePath(path)
    ? `${import.meta.env.BASE_URL}${path}`
    : null;
}
