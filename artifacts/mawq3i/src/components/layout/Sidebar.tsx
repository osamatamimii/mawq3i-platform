import { Link, useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { language, signOut } = useAppContext();
  const isAr = language === 'ar';

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, labelAr: 'لوحة التحكم', labelEn: 'Dashboard', exact: true },
    { href: '/dashboard/products', icon: Package, labelAr: 'المنتجات', labelEn: 'Products', exact: false },
    { href: '/dashboard/orders', icon: ShoppingCart, labelAr: 'الطلبات', labelEn: 'Orders', exact: false },
    { href: '/dashboard/analytics', icon: BarChart3, labelAr: 'الإحصائيات', labelEn: 'Analytics', exact: false },
    { href: '/dashboard/settings', icon: Settings, labelAr: 'إعدادات المتجر', labelEn: 'Store Settings', exact: false },
  ];

  const Item = ({ item }: { item: typeof menuItems[0] }) => {
    const isActive = item.exact ? location === item.href : location.startsWith(item.href);
    return (
      <Link href={item.href} className="block w-full">
        <div className={cn(
          'relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer',
          isActive
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )}>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-primary rounded-lg z-0"
              initial={false}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <item.icon className="w-5 h-5 relative z-10 flex-shrink-0" />
          <span className="relative z-10">{isAr ? item.labelAr : item.labelEn}</span>
        </div>
      </Link>
    );
  };

  const handleLogout = async () => {
    await signOut();
    setLocation('/login');
  };

  return (
    <div className="w-64 h-full bg-card border-e border-border flex flex-col text-card-foreground flex-shrink-0">
      <div className="p-5 flex items-center gap-3 border-b border-border/50">
        <img src="/logo.png" alt="Mawq3i Logo" className="w-9 h-9 object-contain flex-shrink-0" />
        <h1 className="text-xl font-bold tracking-tight text-white">
          Mawq3i | موقعي
        </h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>

      <div className="p-4 space-y-2 border-t border-border">
        <button
          onClick={() => window.open('/store/elegance', '_blank')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ExternalLink className="w-5 h-5 flex-shrink-0" />
          <span>{isAr ? 'معاينة المتجر' : 'Preview Store'}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
}
