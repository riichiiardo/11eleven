import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { accountHandler, type AccountGateway } from "./handler.ts";
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};
const url = Deno.env.get("SUPABASE_URL");
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !secret) throw Error("Servicio de cuentas no configurado.");
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const gateway: AccountGateway = {
  async authenticate(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async authorize(actor, tournament, target) {
    const { error } = await admin.rpc("president_account_authorize", {
      p_actor: actor,
      p_tournament: tournament,
      p_target: target ?? null,
    });
    if (error) throw Error("Acceso denegado.");
  },
  async create(email, password) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    return { data: data.user ? { id: data.user.id } : null, error };
  },
  async update(id, email, password) {
    const { data, error } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
    });
    return { data: data.user ? { id: data.user.id } : null, error };
  },
  async complete(actor, tournament, target, action, passwordChanged) {
    const { error } = await admin.rpc("president_account_complete", {
      p_actor: actor,
      p_tournament: tournament,
      p_target: target,
      p_action: action,
      p_password_changed: passwordChanged,
    });
    if (error) throw Error("No se pudo completar la operación.");
  },
  async rollbackNew(id) {
    const { error } = await admin.auth.admin.deleteUser(id);
    return !error;
  },
};
Deno.serve(accountHandler(gateway));
