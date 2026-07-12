/* @refresh reset */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoreByOwnerEmail, getStaffMembershipByEmail } from '@/lib/db';
import type { User } from '@supabase/supabase-js';
import type { StoreRecord } from '@/data/mockData';

type Language = 'ar' | 'en';
type UserRole = 'owner' | 'admin';
type Theme = 'dark' | 'light';

export type StaffPermissions = {
  orders: boolean;
  products: boolean;
  analytics: boolean;
  settings: boolean;
  promotions: boolean;
};

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  direction: 'rtl' | 'ltr';
  theme: Theme;
  toggleTheme: () => void;
  currentUser: UserRole;
  setCurrentUser: (role: UserRole) => void;
  supabaseUser: User | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
  currentStore: StoreRecord | null;
  setCurrentStore: (store: StoreRecord | null) => void;
  storeLoading: boolean;
  refreshStore: () => Promise<void>;
  isAdminMode: boolean;
  staffPermissions: StaffPermissions | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ADMIN_EMAIL = 'admin@mawq3i.com';
const ADMIN_STORE_KEY = 'mawq3i_admin_store';

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('mawq3i_theme') as Theme) || 'dark'; } catch { return 'dark'; }
  });
  const [currentUser, setCurrentUser] = useState<UserRole>('owner');
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStore, setCurrentStoreState] = useState<StoreRecord | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions | null>(null);

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const setCurrentStore = useCallback((store: StoreRecord | null) => {
    setCurrentStoreState(store);
    if (store) {
      try { sessionStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(store)); } catch {}
    } else {
      try { sessionStorage.removeItem(ADMIN_STORE_KEY); } catch {}
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('mawq3i_theme', theme); } catch {}
  }, [language, direction, theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const loadStore = useCallback(async (email: string, userId?: string) => {
    if (email.toLowerCase() === ADMIN_EMAIL) {
      try {
        const saved = sessionStorage.getItem(ADMIN_STORE_KEY);
        if (saved) {
          setCurrentStoreState(JSON.parse(saved));
          setCurrentUser('owner');
          setStaffPermissions(null);
          return;
        }
      } catch {}
      setCurrentStoreState(null);
      return;
    }

    setStoreLoading(true);
    try {
      const store = await getStoreByOwnerEmail(email, userId);
      if (store) {
        setCurrentStoreState(store);
        setStaffPermissions(null);
        return;
      }
      // Not an owner — check if this email is a staff member of some store
      const staffMatch = await getStaffMembershipByEmail(email);
      if (staffMatch) {
        setCurrentStoreState(staffMatch.store);
        setStaffPermissions(staffMatch.permissions);
      } else {
        setCurrentStoreState(null);
        setStaffPermissions(null);
      }
    } catch (err) {
      console.error('loadStore error', err);
      setCurrentStoreState(null);
      setStaffPermissions(null);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  const refreshStore = useCallback(async () => {
    if (supabaseUser?.email) {
      await loadStore(supabaseUser.email, supabaseUser.id);
    }
  }, [supabaseUser, loadStore]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      setSupabaseUser(user);
      if (user?.email) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
        setCurrentUser(isAdmin ? 'admin' : 'owner');
        loadStore(user.email, user.id);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      setSupabaseUser(user);
      if (user?.email) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
        setCurrentUser(isAdmin ? 'admin' : 'owner');
        loadStore(user.email, user.id);
      } else {
        setCurrentUser('owner');
        setCurrentStoreState(null);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadStore]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentStoreState(null);
    try { sessionStorage.removeItem(ADMIN_STORE_KEY); } catch {}
  }, []);

  const isAdminMode = supabaseUser?.email?.toLowerCase() === ADMIN_EMAIL && currentUser === 'admin';

  return (
    <AppContext.Provider value={{
      language, setLanguage, direction, theme, toggleTheme,
      currentUser, setCurrentUser,
      supabaseUser, authLoading, signOut,
      currentStore, setCurrentStore, storeLoading, refreshStore,
      isAdminMode, staffPermissions,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
