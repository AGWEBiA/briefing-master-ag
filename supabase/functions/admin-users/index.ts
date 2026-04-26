// admin-users: gestão completa de usuários para administradores.
// Ações: list | update | delete. Usa Service Role e valida que o caller é admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    // Cliente como o usuário (para identificar quem chama)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userRes.user.id;

    // Cliente service role
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Confirma admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Carrega lista completa de usuários (com paginação) — usado para detectar emails duplicados
    const loadAllUsers = async () => {
      const all: Array<{ id: string; email: string | null }> = [];
      let page = 1;
      const perPage = 200;
      while (page <= 25) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) break;
        for (const u of data.users) all.push({ id: u.id, email: u.email ?? null });
        if (data.users.length < perPage) break;
        page += 1;
      }
      return all;
    };
    const buildEmailSet = (users: Array<{ email: string | null }>) =>
      new Set(users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean));

    if (action === "list") {
      const { data: list, error: lerr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (lerr) return json({ error: lerr.message }, 500);

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("id, display_name, avatar_url").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const users = list.users.map((u) => {
        const p = profiles?.find((x) => x.id === u.id);
        const userRoles = (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          roles: userRoles,
          is_admin: userRoles.includes("admin"),
        };
      });
      return json({ users });
    }

    if (action === "update") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id required" }, 400);
      const { email, password, display_name, is_admin } = body;

      // Atualiza auth (email/senha)
      if (email || password) {
        const patch: Record<string, unknown> = {};
        if (email) patch.email = email;
        if (password) patch.password = password;
        const { error: ae } = await admin.auth.admin.updateUserById(id, patch);
        if (ae) return json({ error: ae.message }, 400);
      }

      // Atualiza perfil
      if (typeof display_name === "string") {
        const { error: pe } = await admin
          .from("profiles")
          .update({ display_name })
          .eq("id", id);
        if (pe) return json({ error: pe.message }, 400);
      }

      // Atualiza role admin
      if (typeof is_admin === "boolean") {
        if (is_admin) {
          await admin.from("user_roles").upsert(
            { user_id: id, role: "admin" },
            { onConflict: "user_id,role" },
          );
        } else {
          if (id === callerId) return json({ error: "Você não pode remover seu próprio admin." }, 400);
          await admin.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
        }
      }
      return json({ ok: true });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const display_name = body.display_name ? String(body.display_name) : null;
      const is_admin = !!body.is_admin;
      if (!email || !password) return json({ error: "email e password obrigatórios" }, 400);
      if (password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);

      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: display_name ? { full_name: display_name } : undefined,
      });
      if (ce || !created.user) return json({ error: ce?.message ?? "Falha ao criar" }, 400);

      const newId = created.user.id;
      // O trigger handle_new_user já cria profile e role 'user'.
      if (display_name) {
        await admin.from("profiles").upsert({ id: newId, display_name });
      }
      if (is_admin) {
        await admin.from("user_roles").upsert(
          { user_id: newId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      }
      return json({ ok: true, id: newId });
    }

    if (action === "bulk_create") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return json({ error: "Lista vazia" }, 400);

      const results: Array<{ email: string; status: "created" | "error"; error?: string }> = [];
      for (const raw of items) {
        const email = String(raw?.email ?? "").trim();
        const password = String(raw?.password ?? "");
        const display_name = raw?.display_name ? String(raw.display_name) : null;
        const is_admin = !!raw?.is_admin;

        if (!email || !password || password.length < 6) {
          results.push({ email, status: "error", error: "Email/senha inválidos (mín. 6)" });
          continue;
        }
        const { data: created, error: ce } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: display_name ? { full_name: display_name } : undefined,
        });
        if (ce || !created.user) {
          results.push({ email, status: "error", error: ce?.message ?? "Falha" });
          continue;
        }
        const newId = created.user.id;
        if (display_name) {
          await admin.from("profiles").upsert({ id: newId, display_name });
        }
        if (is_admin) {
          await admin.from("user_roles").upsert(
            { user_id: newId, role: "admin" },
            { onConflict: "user_id,role" },
          );
        }
        results.push({ email, status: "created" });
      }
      const created = results.filter((r) => r.status === "created").length;
      return json({ ok: true, created, total: results.length, results });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id required" }, 400);
      if (id === callerId) return json({ error: "Você não pode excluir a si mesmo." }, 400);
      const { error: de } = await admin.auth.admin.deleteUser(id);
      if (de) return json({ error: de.message }, 400);
      // profiles + user_roles + briefings deveriam cair via FK/cascata; apagamos por segurança:
      await admin.from("profiles").delete().eq("id", id);
      await admin.from("user_roles").delete().eq("user_id", id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
