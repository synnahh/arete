// Authenticated client for the server-side AI gateway. Provider credentials
// never cross this boundary or enter the Vite bundle.
import { supabase } from '../supabase/supabase.js';

async function functionError(error) {
  const response = error?.context;
  if (response?.clone) {
    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || error.message;
    } catch {}
  }
  return error?.message || 'AI service unavailable';
}

export async function invokeAI(body) {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body });
  if (error) throw new Error(await functionError(error));
  return data;
}

export async function aiStatus() {
  try {
    const data = await invokeAI({ mode: 'status' });
    return data?.ok === true;
  } catch {
    return false;
  }
}
