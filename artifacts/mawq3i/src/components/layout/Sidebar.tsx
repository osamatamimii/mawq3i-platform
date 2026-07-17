import { Link, useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { useEffect, useLayoutEffect, useState, useRef, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { sendBrowserNotification } from '@/lib/notifications';
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Settings,
  Tag,
  Megaphone,
  LogOut,
  ExternalLink,
  X,
  Shield,
  Sparkles,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import SupportContact from '@/components/SupportContact';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

type MenuItem = {
  href: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  exact: boolean;
  badge?: number;
};

// ── Defined OUTSIDE Sidebar so component type is stable across renders ──
const NavItem = memo(function NavItem({
  item,
  isActive,
  isAr,
  onClose,
  setRef,
}: {
  item: MenuItem;
  isActive: boolean;
  isAr: boolean;
  onClose: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <Link href={item.href} className="block w-full" onClick={onClose}>
      <div
        ref={setRef}
        className={cn(
          'relative flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors cursor-pointer select-none',
          isActive
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )}
      >
        <item.icon className="w-5 h-5 relative z-10 flex-shrink-0" />
        <span className="relative z-10 flex-1">{isAr ? item.labelAr : item.labelEn}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="relative z-10 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </div>
    </Link>
  );
});

export function Sidebar({ open, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { language, signOut, currentStore, supabaseUser, setCurrentUser, setCurrentStore, staffPermissions } = useAppContext();
  const isAr = language === 'ar';
  const ADMIN_EMAIL = 'admin@mawq3i.com';
  const isAdminInOwnerMode = supabaseUser?.email?.toLowerCase() === ADMIN_EMAIL;
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [newGrowthCount, setNewGrowthCount] = useState(0);

  useEffect(() => {
    if (!currentStore?.id) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', currentStore.id)
        .eq('status', 'new');
      setNewOrdersCount(count ?? 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [currentStore?.id]);

  const growthCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentStore?.id) return;
    const fetchGrowthCount = async () => {
      const since = new Date(Date.now() - 3 * 86400000).toISOString();
      const { count } = await supabase
        .from('store_growth_events')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', currentStore.id)
        .gte('created_at', since);
      const newCount = count ?? 0;
      // نبّه فقط لما يزيد العدد بعد أول تحميل (تجنب إشعار عن سجل قديم أول ما يفتح التطبيق)
      if (growthCountRef.current !== null && newCount > growthCountRef.current) {
        sendBrowserNotification('🧠 خبير النمو عنده جديد', `في ${newCount - growthCountRef.current} إجراء/ملاحظة جديدة بانتظارك`);
      }
      growthCountRef.current = newCount;
      setNewGrowthCount(newCount);
    };
    fetchGrowthCount();
    const interval = setInterval(fetchGrowthCount, 60000);
    return () => clearInterval(interval);
  }, [currentStore?.id]);

  useEffect(() => {
    if (location.startsWith('/dashboard/growth')) setNewGrowthCount(0);
  }, [location]);

  useEffect(() => {
    if (location.startsWith('/dashboard/orders')) setNewOrdersCount(0);
  }, [location]);

  const allMenuItems: (MenuItem & { requiresPerm?: 'products' | 'analytics' | 'settings' | 'promotions' })[] = [
    { href: '/dashboard', icon: LayoutDashboard, labelAr: 'لوحة التحكم', labelEn: 'Dashboard', exact: true, requiresPerm: 'analytics' },
    { href: '/dashboard/growth', icon: Activity, labelAr: 'خبير النمو', labelEn: 'Growth Expert', exact: false, requiresPerm: 'analytics', badge: newGrowthCount },
    { href: '/dashboard/ai-advisor', icon: Sparkles, labelAr: 'المستشار الذكي', labelEn: 'AI Advisor', exact: false },
    { href: '/dashboard/products', icon: Package, labelAr: 'المنتجات', labelEn: 'Products', exact: false, requiresPerm: 'products' },
    { href: '/dashboard/winning-products', icon: TrendingUp, labelAr: 'المنتجات الرابحة', labelEn: 'Winning Products', exact: false, requiresPerm: 'products' },
    { href: '/dashboard/orders', icon: ShoppingCart, labelAr: 'الطلبات', labelEn: 'Orders', exact: false, badge: newOrdersCount },
    { href: '/dashboard/analytics', icon: BarChart3, labelAr: 'الإحصائيات', labelEn: 'Analytics', exact: false, requiresPerm: 'analytics' },
    { href: '/dashboard/promotions', icon: Tag, labelAr: 'العروض', labelEn: 'Promotions', exact: false, requiresPerm: 'promotions' },
    { href: '/dashboard/marketing-studio', icon: Megaphone, labelAr: 'استوديو التسويق', labelEn: 'Marketing Studio', exact: false, requiresPerm: 'promotions' },
    { href: '/dashboard/settings', icon: Settings, labelAr: 'إعدادات المتجر', labelEn: 'Store Settings', exact: false, requiresPerm: 'settings' },
  ];

  const menuItems: MenuItem[] = allMenuItems.filter(item => {
    if (item.href === '/dashboard/staff') return !staffPermissions; // owner-only, never delegable
    if (!staffPermissions) return true; // owner/admin: full access
    if (!item.requiresPerm) return true; // no restriction (orders, reviews, ai-advisor, abandoned carts)
    return staffPermissions[item.requiresPerm];
  });

  // ── Sliding indicator ──
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Start with {y:0, h:44} — will be corrected synchronously before first paint
  const [indicator, setIndicator] = useState<{ y: number; h: number }>({ y: 0, h: 44 });
  const [indicatorReady, setIndicatorReady] = useState(false);

  const activeIndex = menuItems.findIndex(item =>
    item.exact ? location === item.href : location.startsWith(item.href)
  );

  // useLayoutEffect fires synchronously after DOM update, before paint
  // so the indicator never visually starts from the wrong position
  useLayoutEffect(() => {
    const el = itemRefs.current[activeIndex];
    const container = navRef.current;
    if (!el || !container || activeIndex < 0) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      y: elRect.top - containerRect.top + container.scrollTop,
      h: elRect.height,
    });
    setIndicatorReady(true);
  }, [location, activeIndex]);

  const handleLogout = async () => {
    await signOut();
    setLocation('/login');
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          'fixed lg:static inset-y-0 start-0 z-50 w-64 h-full bg-card border-e border-border flex flex-col text-card-foreground flex-shrink-0',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : isAr ? 'max-lg:translate-x-full' : 'max-lg:-translate-x-full'
        )}
      >
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 end-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors z-10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 flex items-center gap-3 border-b border-border/50">
          <img src="/logo.png" alt="Mawq3i Logo" className="w-9 h-9 object-contain flex-shrink-0" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Mawq3i | موقعي</h1>
        </div>

        {/* Nav container — position:relative so indicator sits inside it */}
        <div ref={navRef} className="flex-1 px-4 py-4 space-y-1 overflow-y-auto themed-scroll relative">

          {/* Single always-mounted indicator pill
              initial={false} → on first mount snaps to position, no from-top animation
              animate changes → smooth spring transition between positions              */}
          {indicatorReady && (
            <motion.div
              className="absolute inset-x-4 bg-primary rounded-full z-0 shadow-lg shadow-primary/20 pointer-events-none"
              initial={false}
              animate={{ y: indicator.y, height: indicator.h }}
              transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.7 }}
              style={{ top: 0 }}
            />
          )}

          {menuItems.map((item, i) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={i === activeIndex}
              isAr={isAr}
              onClose={onClose}
              setRef={(el) => { itemRefs.current[i] = el; }}
            />
          ))}
        </div>

        <div className="p-4 space-y-2 border-t border-border">
          <a
            href={
              currentStore?.domain
                ? `https://${currentStore.domain}`
                : currentStore?.slug
                ? `https://${currentStore.slug}.mawq3i.co`
                : '#'
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-5 h-5 flex-shrink-0" />
            <span>{isAr ? 'معاينة المتجر' : 'Preview Store'}</span>
          </a>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>

          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] text-muted-foreground/70 mb-2">{isAr ? 'تواصل مع الدعم' : 'Contact support'}</p>
            <SupportContact isAr={isAr} variant="row" />
          </div>

          {isAdminInOwnerMode && (
            <button
              onClick={() => {
                try { sessionStorage.removeItem('mawq3i_admin_store'); } catch {}
                setCurrentUser('admin');
                setCurrentStore(null);
                setLocation('/admin');
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border border-red-500/20"
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span>{isAr ? 'العودة للوحة الأدمن' : 'Back to Admin Panel'}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
