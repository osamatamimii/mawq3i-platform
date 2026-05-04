import { ReactNode } from 'react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
};

function AdminSidebar() {
  const [location] = useLocation();
  const { language } = useAppContext();
  const isAr = language === 'ar';

  return (
    <div className="w-64 h-full bg-[#080b0f] border-e border-white/[0.06] flex flex-col text-card-foreground flex-shrink-0">
      {/* Brand */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-1">
          <img src="/logo.png" alt="Mawq3i" className="w-8 h-8 object-contain flex-shrink-0" />
          <span className="text-lg font-bold text-white">Mawq3i</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] font-mono text-red-400/80 tracking-wider uppercase">
            {isAr ? 'لوحة المدير' : 'Admin Panel'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = item.exact ? location === item.href : location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="block w-full">
              <div className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer",
                isActive
                  ? "text-white bg-white/[0.08] border border-white/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
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
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] mb-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">أسامة</p>
            <p className="text-[10px] text-white/40 truncate">super admin</p>
          </div>
        </div>
        <Link href="/login" className="block w-full">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function AdminNavbar() {
  const [location] = useLocation();
  const { language, setLanguage } = useAppContext();
  const isAr = language === 'ar';
  const title = adminRouteNames[location];

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#080b0f]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <h2 className="text-base font-semibold text-white">
          {title ? (isAr ? title.ar : title.en) : ''}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="font-mono border-white/10 text-white/60 hover:text-white bg-transparent"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>
        <div className="flex items-center gap-2 ps-4 border-s border-white/[0.06]">
          <p className="text-sm text-white/60 hidden sm:block">{isAr ? 'أسامة' : 'Osama'}</p>
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
        </div>
      </div>
    </header>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-[#060809] overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminNavbar />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
