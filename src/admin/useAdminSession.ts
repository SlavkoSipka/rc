import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AdminStatus = 'loading' | 'signed-out' | 'not-admin' | 'admin';

// Supabase Auth session plus the is_admin() check (e-mail listed in admin_users)
export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AdminStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const check = async (next: Session | null) => {
      setSession(next);
      if (!next) {
        setStatus('signed-out');
        return;
      }
      const { data, error } = await supabase.rpc('is_admin');
      if (!cancelled) setStatus(!error && data === true ? 'admin' : 'not-admin');
    };

    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      void check(next);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, status };
}
