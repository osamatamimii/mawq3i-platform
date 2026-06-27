import { useAppContext } from '@/context/AppContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Menu, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { language, setLanguage, currentStore, supabaseUser, theme, toggleTheme } = useAppContext();
  const [location] = useLocation();
  const isAr = language === 'ar';

  const routeNames: Record<string, { ar: string; en: string }> = {
    '/dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
    '/dashboard/products': { ar: 'المنتجات', en: 'Products' },
    '/dashboard/add-product': { ar: 'إضافة منتج', en: 'Add Product' },
    '/dashboard/orders': { ar: 'الطلبات', en: 'Orders' },
    '/dashboard/analytics': { ar: 'الإحصائيات', en: 'Analytics' },
    '/dashboard/settings': { ar: 'إعدادات المتجر', en: 'Store Settings' },
    '/dashboard/promotions': { ar: 'العروض', en: 'Promotions' },
  };

  const getTitle = () => {
    if (routeNames[location]) return routeNames[location];
    if (location.startsWith('/dashboard/products/edit/')) return { ar: 'تعديل المنتج', en: 'Edit Product' };
    return null;
  };

  const title = getTitle();

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg md:text-xl font-semibold">{title ? (isAr ? title.ar : title.en) : ''}</h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #1a1f35 0%, #2d3561 100%)'
              : 'linear-gradient(135deg, #87CEEB 0%, #FDB97D 100%)',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? (isAr ? 'الوضع النهاري' : 'Light mode') : (isAr ? 'الوضع الليلي' : 'Dark mode')}
        >
          {/* Stars (dark mode) */}
          {theme === 'dark' && (
            <>
              <span className="absolute top-1 left-2 w-0.5 h-0.5 bg-white rounded-full opacity-80" />
              <span className="absolute top-2.5 left-3.5 w-0.5 h-0.5 bg-white rounded-full opacity-60" />
              <span className="absolute top-1.5 left-5 w-0.5 h-0.5 bg-white rounded-full opacity-70" />
            </>
          )}
          {/* Sliding circle with icon */}
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
          className="font-mono"
          data-testid="button-language-toggle"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>

        <div className="flex items-center gap-3 ps-3 md:ps-4 border-s border-border/50">
          <div className="text-sm hidden sm:block">
            <p className="font-medium">{currentStore?.name || (isAr ? 'صاحب المتجر' : 'Store Owner')}</p>
            <p className="text-xs text-muted-foreground">{supabaseUser?.email || currentStore?.ownerEmail || ''}</p>
          </div>
          <Avatar className="border border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {(currentStore?.name || supabaseUser?.email || 'م').charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
