import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  normalizePlayerImage,
  playerImageCandidates,
  validPortraitPng,
} from "../../../src/domain/player-image.ts";
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};
type Job = {
  playerId: string;
  sofifaId: number;
  sourceUrl: string;
  lease: string;
};
class SourceBlocked extends Error {}
export async function downloadPortrait(
  source: string,
  id: string,
  request: typeof fetch = fetch,
) {
  const url = normalizePlayerImage(source, id);
  if (!url) throw Error("Falta Imagen_URL.");
  for (const candidate of playerImageCandidates(url)) {
    const response = await request(candidate, {
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 403 || response.status === 429)
      throw new SourceBlocked(
        `El CDN de SoFIFA rechazó la descarga (HTTP ${response.status}). Puedes reintentar más tarde.`,
      );
    if (response.status === 404) continue;
    if (!response.ok)
      throw Error(`El origen devolvió HTTP ${response.status}.`);
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("image/png")
    )
      throw Error("El origen no devolvió una imagen PNG.");
    if (Number(response.headers.get("content-length")) > 2097152)
      throw Error("La foto supera 2 MB.");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Foto vacía.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2097152) {
          await reader.cancel();
          throw Error("La foto supera 2 MB.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (!validPortraitPng(bytes))
      throw Error("La respuesta no es un retrato PNG válido.");
    return bytes;
  }
  throw Error(
    "No se encontró la foto a 240, 120 ni en su resolución original.",
  );
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    origin === "https://riichiiardo.github.io" ||
    /^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/.test(origin);
  const cors: Record<string, string> = {
    "Content-Type": "application/json",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  if (allowed) cors["Access-Control-Allow-Origin"] = origin;
  const answer = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: cors });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return answer({ error: "Usa POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL"),
    anon = Deno.env.get("SUPABASE_ANON_KEY"),
    secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret)
    return answer(
      { error: "El servicio de imágenes no está configurado." },
      503,
    );
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return answer({ error: "Inicia sesión." }, 401);
  const user = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const identity = await user.auth.getUser();
  if (identity.error || !identity.data.user)
    return answer({ error: "Sesión inválida." }, 401);
  const permission = await user.rpc("player_images_status");
  if (permission.error)
    return answer(
      { error: "Solo Administración puede sincronizar rostros." },
      403,
    );
  try {
    const body = await req.json().catch(() => ({}));
    if (body.probe) {
      try {
        const bytes = await downloadPortrait(
          String(body.probe.url ?? ""),
          String(body.probe.sofifaId ?? ""),
        );
        return answer({ ok: true, bytes: bytes.length });
      } catch (e) {
        return answer({
          ok: false,
          blocked: e instanceof SourceBlocked,
          error: e instanceof Error ? e.message : "No se pudo descargar.",
        });
      }
    }
    const admin = createClient(url, secret, {
      auth: { persistSession: false },
    });
    const claim = await admin.rpc("player_images_claim", { p_limit: 16 });
    if (claim.error) throw claim.error;
    const jobs = (claim.data ?? []) as Job[];
    let ready = 0,
      errors = 0,
      blocked = false,
      lastError: string | null = null;
    let bucket: Promise<void> | undefined;
    const ensureBucket = () =>
      (bucket ??= (async () => {
        const existing = await admin.storage.getBucket("player-faces");
        if (!existing.error) return;
        const created = await admin.storage.createBucket("player-faces", {
          public: true,
          fileSizeLimit: 2097152,
          allowedMimeTypes: ["image/png"],
        });
        if (created.error && !/already exists/i.test(created.error.message))
          throw created.error;
      })());
    for (let offset = 0; offset < jobs.length; offset += 4) {
      if (blocked) {
        for (const job of jobs.slice(offset)) {
          const released = await admin.rpc("player_images_release", {
            p_player: job.playerId,
            p_lease: job.lease,
          });
          if (released.error) throw released.error;
        }
        break;
      }
      await Promise.all(
        jobs.slice(offset, offset + 4).map(async (job) => {
          try {
            const bytes = await downloadPortrait(
              job.sourceUrl,
              String(job.sofifaId),
            );
            await ensureBucket();
            const digest = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            )
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
            const path = `${job.sofifaId}/${digest}.png`;
            const uploaded = await admin.storage
              .from("player-faces")
              .upload(path, bytes, {
                contentType: "image/png",
                cacheControl: "31536000",
                upsert: true,
              });
            if (uploaded.error) throw uploaded.error;
            const publicUrl = admin.storage
              .from("player-faces")
              .getPublicUrl(path).data.publicUrl;
            const completed = await admin.rpc("player_images_complete", {
              p_player: job.playerId,
              p_lease: job.lease,
              p_url: publicUrl,
            });
            if (completed.error) throw completed.error;
            if (completed.data) ready++;
          } catch (e) {
            if (e instanceof SourceBlocked) blocked = true;
            errors++;
            lastError =
              e instanceof Error ? e.message : "No se pudo guardar el rostro.";
            const completed = await admin.rpc("player_images_complete", {
              p_player: job.playerId,
              p_lease: job.lease,
              p_error: lastError,
            });
            if (completed.error) throw completed.error;
          }
        }),
      );
    }
    return answer({ ready, errors, blocked, lastError });
  } catch (e) {
    return answer(
      {
        error: e instanceof Error ? e.message : "No se pudo procesar el lote.",
      },
      500,
    );
  }
});
