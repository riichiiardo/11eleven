import { parseAccountRequest } from "../../../src/domain/account-management.ts";
// Dependency boundary keeps server credentials out of UI and enables deterministic Auth tests.
type Result<T> = { data: T; error: { code?: string; status?: number } | null };
export type AccountGateway = {
  authenticate: (token: string) => Promise<string | null>;
  authorize: (
    actor: string,
    tournament: string,
    target?: string,
  ) => Promise<void>;
  create: (
    email: string,
    password: string,
  ) => Promise<Result<{ id: string } | null>>;
  update: (
    id: string,
    email: string,
    password?: string,
  ) => Promise<Result<{ id: string } | null>>;
  complete: (
    actor: string,
    tournament: string,
    target: string,
    action: string,
    passwordChanged: boolean,
  ) => Promise<void>;
  rollbackNew: (id: string) => Promise<boolean>;
};
export function accountHandler(gateway: AccountGateway) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin") ?? "";
    const allowed =
      origin === "https://riichiiardo.github.io" ||
      /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization,x-client-info,apikey,content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (allowed) headers["Access-Control-Allow-Origin"] = origin;
    const answer = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers });
    if (origin && !allowed)
      return answer({ error: "Origen no permitido." }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return answer({ error: "Usa POST." }, 405);
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return answer({ error: "Inicia sesión." }, 401);
    let actor: string | null;
    try {
      actor = await gateway.authenticate(token);
    } catch {
      return answer({ error: "No se pudo verificar la sesión." }, 401);
    }
    if (!actor)
      return answer(
        { error: "La sesión no es válida. Vuelve a ingresar." },
        401,
      );
    let input;
    try {
      if (Number(req.headers.get("content-length")) > 4096)
        return answer({ error: "Solicitud demasiado grande." }, 413);
      const reader = req.body?.getReader();
      if (!reader) return answer({ error: "Solicitud vacía." }, 400);
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          return answer({ error: "Solicitud demasiado grande." }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      input = parseAccountRequest(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (cause) {
      return answer(
        {
          error:
            cause instanceof SyntaxError
              ? "Solicitud JSON no válida."
              : cause instanceof Error
                ? cause.message
                : "Revisa los campos de la cuenta.",
        },
        400,
      );
    }
    try {
      await gateway.authorize(actor, input.tournamentId, input.userId);
    } catch {
      return answer(
        {
          error:
            "Solo el administrador principal puede gestionar presidentes de este universo. No se pueden modificar cuentas administrativas ni tu propia cuenta desde aquí.",
        },
        403,
      );
    }
    if (input.action === "check") return answer({ ok: true });
    let result: Result<{ id: string } | null>;
    try {
      result =
        input.action === "create"
          ? await gateway.create(input.email, input.password!)
          : await gateway.update(input.userId!, input.email, input.password);
    } catch {
      return answer(
        {
          error:
            "No se pudo contactar con el servicio de cuentas. Revisa la lista antes de reintentar.",
        },
        503,
      );
    }
    if (result.error || !result.data) {
      if (
        result.error?.code === "email_exists" ||
        result.error?.code === "email_address_exists" ||
        result.error?.status === 422
      )
        return answer(
          {
            error:
              "Ese correo ya está registrado o no admite el cambio. No se modificó otra cuenta.",
          },
          409,
        );
      return answer(
        {
          error:
            "Supabase no pudo guardar la cuenta. Comprueba el correo y los requisitos de contraseña.",
        },
        400,
      );
    }
    const target = result.data.id;
    try {
      await gateway.complete(
        actor,
        input.tournamentId,
        target,
        input.action,
        Boolean(input.password),
      );
    } catch {
      if (input.action === "create") {
        let rolledBack = false;
        try {
          rolledBack = await gateway.rollbackNew(target);
        } catch {
          /* Report a partial failure without secrets. */
        }
        return answer(
          {
            error: rolledBack
              ? "No se pudo registrar la presidencia. La cuenta nueva se retiró; puedes reintentar."
              : "No se pudo completar la presidencia. Revisa la lista de cuentas antes de reintentar.",
          },
          500,
        );
      }
      return answer(
        {
          error:
            "Las credenciales se actualizaron, pero no se pudo registrar la auditoría. Actualiza la lista antes de reintentar.",
        },
        500,
      );
    }
    return answer({
      ok: true,
      userId: target,
      message:
        input.action === "create"
          ? "Presidente creado. Puede ingresar con el correo y la contraseña y elegir su equipo."
          : "Cuenta actualizada. La contraseña anterior se conserva si no introdujiste una nueva.",
    });
  };
}
