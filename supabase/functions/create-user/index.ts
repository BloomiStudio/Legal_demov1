// Permite que un administrador general dé de alta a una persona nueva
// directamente desde Administración > Usuarios, sin depender de que esa
// persona se autoregistre. Crea la cuenta con una contraseña temporal (se
// regresa una sola vez en la respuesta) y deja su perfil ya configurado
// con rol, departamento y permisos.
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabaseClients.ts";

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${password}!`;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

    const {
      email,
      full_name,
      role,
      department_id,
      is_department_admin,
      document_permission,
      can_comment,
      case_visibility_scope,
    } = await req.json();

    if (!email || !full_name || !role) {
      return json({ error: "email, full_name y role son requeridos" }, 400);
    }

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);

    const { data: callerProfile } = await userClient.from("profiles").select("*").eq("id", userData.user.id).single();
    if (callerProfile?.role !== "administrador") {
      return json({ error: "Sólo un administrador general puede crear usuarios" }, 403);
    }

    const admin = createAdminClient();
    const temporaryPassword = generateTemporaryPassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError || !created.user) {
      return json({ error: createError?.message ?? "No se pudo crear la cuenta" }, 400);
    }

    // handle_new_user ya insertó un profile básico (asistente, sin
    // organización). Lo completamos con lo que pidió el administrador.
    const { data: profile, error: updateError } = await admin
      .from("profiles")
      .update({
        organization_id: callerProfile.organization_id,
        department_id: department_id ?? null,
        role,
        is_department_admin: Boolean(is_department_admin),
        document_permission: document_permission ?? "read",
        can_comment: Boolean(can_comment),
        case_visibility_scope: case_visibility_scope ?? "department",
      })
      .eq("id", created.user.id)
      .select()
      .single();
    if (updateError) return json({ error: updateError.message }, 500);

    await admin.from("audit_log").insert({
      actor_id: userData.user.id,
      action: "admin_create_user",
      entity_type: "profiles",
      entity_id: created.user.id,
      metadata: { email, role, department_id },
    });

    return json({ profile, email, temporary_password: temporaryPassword });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
