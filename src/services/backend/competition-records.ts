import { supabase } from "@/infrastructure/supabase/client";
import type { RecordedCompetition } from "@/domain/competition-records";
export async function getCompetitionArchive(
  universeId: string,
): Promise<RecordedCompetition[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let data: unknown;
  try {
    const response = await supabase
      .rpc("competition_archive", {
        p_tournament_id: universeId,
      })
      .abortSignal(controller.signal);
    if (response.error) throw Error(response.error.message);
    data = response.data;
  } catch (cause) {
    if (controller.signal.aborted)
      throw Error(
        "La consulta de competiciones tardó demasiado. Puedes reintentar.",
      );
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
  if (
    !Array.isArray(data) ||
    data.some(
      (c) =>
        !c ||
        typeof c.id !== "string" ||
        !Array.isArray(c.matches) ||
        !Array.isArray(c.players) ||
        !Array.isArray(c.standings),
    )
  )
    throw Error(
      "La respuesta de las competiciones no tiene un formato válido.",
    );
  return data as RecordedCompetition[];
}
