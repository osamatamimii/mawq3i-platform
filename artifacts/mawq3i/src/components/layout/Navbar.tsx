import { useAppContext } from '@/context/AppContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export function Navbar() {
  const { language, setLanguage } = useAppContext();
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
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="font-mono"
          data-testid="button-language-toggle"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>

        <div className="flex items-center gap-3 ps-4 border-s border-border/50">
          <div className="text-sm hidden sm:block">
            <p className="font-medium">{isAr ? 'صاحب المتجر' : 'Store Owner'}</p>
            <p className="text-xs text-muted-foreground">owner@mawq3i.com</p>
          </div>
          <Avatar className="border border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">م</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
