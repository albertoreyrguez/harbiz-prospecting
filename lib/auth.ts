import { createClient } from '@/lib/supabase/server';

export async function getAuthenticatedUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}
