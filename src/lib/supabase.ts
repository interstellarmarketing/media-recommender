import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let supabase: ReturnType<typeof createBrowserClient>;

if (typeof window !== 'undefined') {
  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Helper function to get user session
export const getSession = async () => {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }
  return session;
};

// Helper function to get user
export const getUser = async () => {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error.message);
    return null;
  }
  return user;
};

export const getSupabase = () => {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client is only available on the client side');
  }
  if (!supabase) {
    supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}; 