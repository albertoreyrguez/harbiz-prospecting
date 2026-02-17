// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // DEBUG (solo para ti en local)
  console.log("[admin env check]", {
    url: supabaseUrl ? supabaseUrl.slice(0, 30) + "..." : null,
    serviceRoleKey_present: !!serviceRoleKey,
  });

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin env vars.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
