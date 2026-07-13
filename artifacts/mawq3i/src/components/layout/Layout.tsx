import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { currentStore } = useAppContext();

  // Fire-and-forget page-view tracking per dashboard section, so admins can
  // see which parts of the platform actually get used.
  useEffect(() => {
    if (!currentStore?.id) return;
    supabase
      .from('feature_usage_events')
      .insert([{ store_id: currentStore.id, event_type: 'page_view', feature_key: location }])
      .then(() => {}, () => {});
  }, [location, currentStore?.id]);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden selection:bg-primary/30">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6 themed-scroll">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
