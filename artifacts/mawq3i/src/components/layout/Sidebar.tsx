import { Link, useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  ShieldAlert, 
  Store, 
  LogOut 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [location] = useLocation();
  const { language, currentUser } = useAppContext();

  const isAr = language === 'ar';

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, labelAr: 'لوحة التحكم', labelEn: 'Dashboard' },
    { href: '/products', icon: Package, labelAr: 'المنتجات', labelEn: 'Products' },
    { href: '/orders', icon: ShoppingCart, labelAr: 'الطلبات', labelEn: 'Orders' },
    { href: '/analytics', icon: BarChart3, labelAr: 'الإحصائيات', labelEn: 'Analytics' },
    { href: '/settings', icon: Settings, labelAr: 'إعدادات المتجر', labelEn: 'Settings' },
  ];

  if (currentUser === 'admin') {
    menuItems.push({ href: '/admin', icon: ShieldAlert, labelAr: 'لوحة الإدارة', labelEn: 'Admin Panel' });
  }

  const bottomItems = [
    { href: '/store', icon: Store, labelAr: 'المتجر', labelEn: 'Storefront' },
    { href: '/login', icon: LogOut, labelAr: 'تسجيل الخروج', labelEn: 'Logout' },
  ];

  const Item = ({ item }: { item: typeof menuItems[0] }) => {
    const isActive = location === item.href;
    return (
      <Link href={item.href} className="block w-full">
        <div className={cn(
          "relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer",
          isActive 
            ? "text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-primary rounded-lg z-0"
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <item.icon className="w-5 h-5 relative z-10" />
          <span className="relative z-10">{isAr ? item.labelAr : item.labelEn}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="w-64 h-full bg-card border-l border-border flex flex-col text-card-foreground">
      <div className="p-5 flex items-center gap-3">
        <img src="/logo.png" alt="Mawq3i Logo" className="w-9 h-9 object-contain flex-shrink-0" />
        <h1 className="text-xl font-bold tracking-tight text-white">
          Mawq3i | موقعي
        </h1>
      </div>

      <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>

      <div className="p-4 space-y-1 border-t border-border">
        {bottomItems.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
