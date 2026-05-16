import { useAppContext } from '@/context/AppContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { language, setLanguage, currentStore, supabaseUser } = useAppContext();
  const [location] = useLocation();
  const isAr = language === 'ar';

  const routeNames: Record<string, { ar: string; en: string }> = {
    '/dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
    '/dashboard/products': { ar: 'المنتجات', en: 'Products' },
    '/dashboard/add-product': { ar: 'إضافة منتج', en: 'Add Product' },
    '/dashboard/orders': { ar: 'الطلبات', en: 'Orders' },
    '/dashboard/analytics': { ar: 'الإحصائيات', en: 'Analytics' },
    '/dashboard/settings': { ar: 'إعدادات المتجر', en: 'Store Settings' },
  };

  const title = routeNames[location] ? (isAr ? routeNames[location].ar : routeNames[location].en) : '';

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
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
