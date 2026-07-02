import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import {
  LayoutGrid,
  Store,
  Users,
  CreditCard,
  Globe,
  Settings,
  LogOut,
  Shield,
  X,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  { href: '/admin', icon: LayoutGrid, labelAr: 'نظرة عامة', labelEn: 'Overview', exact: true },
  { href: '/admin/stores', icon: Store, labelAr: 'المتاجر', labelEn: 'Stores', exact: false },
  { href: '/admin/clients', icon: Users, labelAr: 'العملاء', labelEn: 'Clients', exact: false },
  { href: '/admin/subscriptions', icon: CreditCard, labelAr: 'الاشتراكات', labelEn: 'Subscriptions', exact: false },
  { href: '/admin/domains', icon: Globe, labelAr: 'الدومينات', labelEn: 'Domains', exact: false },
  { href: '/admin/settings', icon: Settings, labelAr: 'الإعدادات', labelEn: 'Settings', exact: false },
];

const adminRouteNames: Record<string, { ar: string; en: string }> = {
  '/admin': { ar: 'نظرة عامة', en: 'Overview' },
  '/admin/stores': { ar: 'المتاجر', en: 'Stores' },
  '/admin/clients': { ar: 'العملاء', en: 'Clients' },
  '/admin/subscriptions': { ar: 'الاشتراكات', en: 'Subscriptions' },
  '/admin/domains': { ar: 'الدومينات', en: 'Domains' },
  '/admin/settings': { ar: 'الإعدادات', en: 'Settings' },
  '/admin/site-builder': { ar: 'منشئ المواقع', en: 'Site Builder' },
};

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { language, signOut } = useAppContext();
  const isAr = language === 'ar';

  const handleLogout = async () => {
    await signOut();
    setLocation('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="admin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:static inset-y-0 start-0 z-50 w-64 h-full bg-sidebar border-e border-sidebar-border flex flex-col text-sidebar-foreground flex-shrink-0',
          'transition-transform duration-300 ease-in-out',
          open
            ? 'translate-x-0'
            : isAr
            ? 'max-lg:translate-x-full'
            : 'max-lg:-translate-x-full'
        )}
      >
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 end-4 p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors z-10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.12)] dark:shadow-none">
              <img src="/logo.png" alt="Mawq3i" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">Mawq3i</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] font-mono text-red-400 tracking-wider uppercase">
              {isAr ? 'لوحة المدير' : 'Admin Panel'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
          {adminNavItems.map((item) => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="block w-full" onClick={onClose}>
                <div className={cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  isActive
                    ? "text-sidebar-primary-foreground bg-sidebar-primary/20 border border-sidebar-primary/30"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="admin-sidebar-active"
                      className="absolute inset-0 rounded-lg z-0"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn("w-4 h-4 relative z-10 flex-shrink-0", isActive ? "text-red-400" : "")} />
                  <span className="relative z-10">{isAr ? item.labelAr : item.labelEn}</span>
                  {isActive && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-red-400 relative z-10" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border mb-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">أسامة</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">super admin</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

interface AdminNavbarProps {
  onMenuClick: () => void;
}

function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const [location] = useLocation();
  const { language, setLanguage, theme, toggleTheme } = useAppContext();
  const isAr = language === 'ar';
  const title = adminRouteNames[location];

  return (
    <header className="h-16 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <h2 className="text-base font-semibold text-sidebar-foreground">
          {title ? (isAr ? title.ar : title.en) : ''}
        </h2>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #1a1f35 0%, #2d3561 100%)'
              : 'linear-gradient(135deg, #87CEEB 0%, #FDB97D 100%)',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' && (
            <>
              <span className="absolute top-1 left-2 w-0.5 h-0.5 bg-white rounded-full opacity-80" />
              <span className="absolute top-2.5 left-3.5 w-0.5 h-0.5 bg-white rounded-full opacity-60" />
              <span className="absolute top-1.5 left-5 w-0.5 h-0.5 bg-white rounded-full opacity-70" />
            </>
          )}
          <span
            className="absolute top-0.5 flex items-center justify-center w-6 h-6 rounded-full shadow-md transition-all duration-300"
            style={{
              left: theme === 'dark' ? '2px' : 'calc(100% - 26px)',
              background: theme === 'dark'
                ? 'linear-gradient(135deg, #c8d6f0 0%, #e8edf5 100%)'
                : 'linear-gradient(135deg, #FFE066 0%, #FFB800 100%)',
            }}
          >
            {theme === 'dark'
              ? <Moon className="w-3.5 h-3.5 text-slate-600" />
              : <Sun className="w-3.5 h-3.5 text-amber-700" />
            }
          </span>
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="font-mono border-white/10 text-white/60 hover:text-white bg-transparent"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>
        <div className="flex items-center gap-2 ps-3 md:ps-4 border-s border-white/[0.06]">
          <p className="text-sm text-sidebar-foreground/60 hidden sm:block">{isAr ? 'أسامة' : 'Osama'}</p>
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
        </div>
      </div>
    </header>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
