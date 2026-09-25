//  useSupabaseStatus  connection indicator 
import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

export function useSupabaseStatus() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSynced(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSynced(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return synced;
}
