/* @refresh reset */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoreByOwnerEmail } from '@/lib/db';
import type { User } from '@supabase/supabase-js';
import type { StoreRecord } from '@/data/mockData';

type Language = 'ar' | 'en';
type UserRole = 'owner' | 'admin';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  direction: 'rtl' | 'ltr';
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ADMIN_EMAIL = 'admin@mawq3i.com';
const ADMIN_STORE_KEY = 'mawq3i_admin_store';

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ar');
  const [currentUser, setCurrentUser] = useState<UserRole>('owner');
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStore, setCurrentStoreState] = useState<StoreRecord | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  // Wrap setCurrentStore to persist admin-selected store in sessionStorage
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
    document.documentElement.classList.add('dark');
  }, [language, direction]);

  const loadStore = useCallback(async (email: string, userId?: string) => {
    if (email.toLowerCase() === ADMIN_EMAIL) {
      // Admin: restore previously selected store from sessionStorage if any
      try {
        const saved = sessionStorage.getItem(ADMIN_STORE_KEY);
        if (saved) {
          setCurrentStoreState(JSON.parse(saved));
          setCurrentUser('owner'); // keep in owner mode
          return;
        }
      } catch {}
      setCurrentStoreState(null);
      return;
    }
    setStoreLoading(true);
    const store = await getStoreByOwnerEmail(email, userId);
    setCurrentStoreState(store);
    setStoreLoading(false);
  }, []);

  const refreshStore = useCallback(async () => {
    if (!supabaseUser?.email) return;
    await loadStore(supabaseUser.email, supabaseUser.id);
  }, [supabaseUser, loadStore]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setSupabaseUser(user);
      if (user?.email?.toLowerCase() === ADMIN_EMAIL) setCurrentUser('admin');
      setAuthLoading(false);
      if (user?.email) loadStore(user.email, user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setSupabaseUser(user);
      if (user?.email?.toLowerCase() === ADMIN_EMAIL) {
        setCurrentUser('admin');
        // Don't clear currentStore here — loadStore will restore from sessionStorage
        loadStore(ADMIN_EMAIL);
      } else {
        setCurrentUser('owner');
        if (user?.email) loadStore(user.email, user.id);
        else setCurrentStoreState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadStore]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSupabaseUser(null);
    setCurrentUser('owner');
    setCurrentStoreState(null);
    try { sessionStorage.removeItem(ADMIN_STORE_KEY); } catch {}
  };

  const isAdminMode = supabaseUser?.email?.toLowerCase() === ADMIN_EMAIL && currentStore !== null;

  return (
    <AppContext.Provider value={{
      language, setLanguage, direction,
      currentUser, setCurrentUser,
      supabaseUser, authLoading,
      signOut,
      currentStore, setCurrentStore, storeLoading, refreshStore,
      isAdminMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
