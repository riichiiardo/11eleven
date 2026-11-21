export const ACCOUNT_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
export const ACCOUNT_PASSWORD_HINT =
  "Mínimo 6 caracteres: incluye mayúsculas, minúsculas, números y un carácter especial.";
export type AccountInput = {
  action: "create" | "update";
  tournamentId: string;
  userId?: string;
  email: string;
  password?: string;
};
export function parseAccountInput(value: unknown): AccountInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Solicitud de cuenta no válida.");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        !["action", "tournamentId", "userId", "email", "password"].includes(k),
    )
  )
    throw Error("La solicitud contiene campos no permitidos.");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    (v.action !== "create" && v.action !== "update") ||
    typeof v.tournamentId !== "string" ||
    !uuid.test(v.tournamentId)
  )
    throw Error("Acción o universo no válido.");
  if (
    v.action === "update" &&
    (typeof v.userId !== "string" || !uuid.test(v.userId))
  )
    throw Error("Selecciona la cuenta del presidente.");
  if (v.action === "create" && v.userId !== undefined)
    throw Error("No puedes elegir el identificador de una cuenta nueva.");
  const email = typeof v.email === "string" ? v.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Introduce un correo válido.");
  if (v.password !== undefined && typeof v.password !== "string")
    throw Error("Contraseña no válida.");
  const password = v.password as string | undefined;
  if (v.action === "create" || (password !== undefined && password !== "")) {
    if (
      !password ||
      password.length > 128 ||
      !ACCOUNT_PASSWORD_PATTERN.test(password)
    )
      throw Error(ACCOUNT_PASSWORD_HINT + " Máximo 128 caracteres.");
  }
  return {
    action: v.action,
    tournamentId: v.tournamentId,
    email,
    ...(v.action === "update" ? { userId: v.userId as string } : {}),
    ...(password ? { password } : {}),
  };
}

export function parseAccountRequest(
  value: unknown,
): AccountInput | { action: "check"; tournamentId: string; userId?: string } {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).action === "check"
  ) {
    const v = value as Record<string, unknown>;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      Object.keys(v).some(
        (k) => !["action", "tournamentId", "userId"].includes(k),
      ) ||
      typeof v.tournamentId !== "string" ||
      !uuid.test(v.tournamentId) ||
      (v.userId !== undefined &&
        (typeof v.userId !== "string" || !uuid.test(v.userId)))
    )
      throw Error("Comprobación de cuenta no válida.");
    return {
      action: "check",
      tournamentId: v.tournamentId,
      ...(typeof v.userId === "string" ? { userId: v.userId } : {}),
    };
  }
  return parseAccountInput(value);
}
