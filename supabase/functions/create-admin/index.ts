
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  const respond = (
    body: Record<string, unknown>,
    status = 200
  ) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return respond({ error: "Sign in as the owner first." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ownerUserId = Deno.env.get("OWNER_USER_ID");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !ownerUserId) {
    return respond({ error: "Server configuration is incomplete." }, 500);
  }

  const token = authHeader.slice("Bearer ".length);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !userData.user) {
    return respond({ error: "Your session is invalid. Sign in again." }, 401);
  }

  if (userData.user.id !== ownerUserId) {
    return respond(
      { error: "Only the designated owner can manage administrators." },
      403
    );
  }

  let body: {
    action?: string;
    email?: string;
    userId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const action = body.action;
  const email = body.email?.trim().toLowerCase();

  // STEP 1: Find an existing account using its email.
  if (action === "lookup") {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: "Enter a valid email address." }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, surname, other_names, email, phone")
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      return respond({ error: "Could not search user profiles." }, 500);
    }

    if (!profile) {
      return respond(
        { error: "No AnambraFix account was found with that email." },
        404
      );
    }

    const { data: authResult, error: authUserError } =
      await adminClient.auth.admin.getUserById(profile.id);

    if (authUserError || !authResult.user) {
      return respond(
        { error: "The matching authentication account could not be verified." },
        404
      );
    }

    if (authResult.user.email?.toLowerCase() !== email) {
      return respond(
        { error: "The email does not match the account's registered email." },
        400
      );
    }

    if (profile.id === ownerUserId) {
      return respond(
        { error: "The owner account is already the highest-level administrator." },
        400
      );
    }

    const { data: existingRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (roleError) {
      return respond({ error: "Could not verify the account role." }, 500);
    }

    if (
      existingRole?.role === "admin" ||
      existingRole?.role === "super_admin"
    ) {
      return respond(
        { error: "This person is already an administrator." },
        409
      );
    }

    return respond({
      success: true,
      profile: {
        id: profile.id,
        surname: profile.surname,
        other_names: profile.other_names,
        email: authResult.user.email,
        phone: profile.phone,
      },
    });
  }

  // STEP 2: Grant admin access only after owner confirmation.
  if (action === "confirm") {
    const userId = body.userId?.trim();

    if (!userId || !email) {
      return respond(
        { error: "The account ID and email are required." },
        400
      );
    }

    if (userId === ownerUserId) {
      return respond({ error: "The owner cannot be reassigned." }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return respond({ error: "The selected profile could not be verified." }, 404);
    }

    const { data: authResult, error: authUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (authUserError || !authResult.user) {
      return respond({ error: "The selected account could not be verified." }, 404);
    }

    if (authResult.user.email?.toLowerCase() !== email) {
      return respond(
        { error: "The account email has changed. Search for it again." },
        400
      );
    }

    const { data: existingRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      return respond({ error: "Could not verify the current role." }, 500);
    }

    if (existingRole?.role === "super_admin") {
      return respond(
        { error: "This account already has Super Admin privileges." },
        409
      );
    }

    if (existingRole?.role === "admin") {
      return respond(
        { error: "This person is already an administrator." },
        409
      );
    }

    let grantError;

    if (existingRole) {
      const result = await adminClient
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", userId);

      grantError = result.error;
    } else {
      const result = await adminClient
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      grantError = result.error;
    }

    if (grantError) {
      return respond(
        { error: "Could not grant administrator access." },
        500
      );
    }

    return respond({
      success: true,
      message: "Administrator access granted successfully.",
    });
  }

  return respond({ error: "Invalid action." }, 400);
});
