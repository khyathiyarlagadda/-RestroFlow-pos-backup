import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';

// Main client used for standard auth and database queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Secondary client that does NOT persist session, used by Admins to sign up cashiers without logging out
export const supabaseSignupClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
