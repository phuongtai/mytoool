import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase Config:", { url: supabaseUrl, hasKey: !!supabaseAnonKey });

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase Environment Variables! Check .env");
} 
// Note: Frontend should usually use Anon Key, but user has Service Role in .env. 
// Ideally we should have VITE_SUPABASE_ANON_KEY.
// For now, I will try to use the key available. 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
