//  supabase.js  Supabase client + auth 
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

//  User ID 
let _userId = null;

// Returns the signed-in user's id, or null when there's no session.
// NOTE: no anonymous sign-in and no local device-id fallback — those minted a
// DIFFERENT id per device, which broke cross-device sync and made RLS reject
// writes (rows silently vanished). One real account = one id on every device.
export async function getUserId() {
  if (_userId) return _userId;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) { _userId = session.user.id; return _userId; }
  return null;
}

export function getUserIdSync() {
  return _userId;
}

//  Email / Password Auth
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmail(email, password, username = '') {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username: username || email.split('@')[0] } },
  });
  if (error) throw error;
  // If session is null, Supabase requires email confirmation before signing in.
  if (!data.session) throw new Error('CHECK_EMAIL');
  return data.user;
}

// Keep for any legacy callers — no-op so nothing breaks
export async function signInWithGoogle() {
  throw new Error('Google sign-in has been replaced with email/password.');
}

export async function signOut() {
  _userId = null;
  await supabase.auth.signOut();
}

//  Auth state 
export async function getAuthUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// Now accepts any authenticated user (email/password or Google)
export function isGoogleSignedIn(user) {
  return !!user;
}

// Initialise auth on startup — restore the persisted session only.
// (No anonymous sign-in: it created a new user per device and broke sync.)
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user?.id) _userId = session.user.id;
});

supabase.auth.onAuthStateChange((_event, session) => {
  _userId = session?.user?.id ?? null;
});
