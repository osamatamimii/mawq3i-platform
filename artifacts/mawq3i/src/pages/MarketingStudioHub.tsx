import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Megaphone, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import MarketingStudio from './MarketingStudio';
import AbandonedCarts from './AbandonedCarts';

export default function MarketingStudioHub() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'marketing' | 'abandoned-carts'>('marketing');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('marketing')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'marketing' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-marketing"
        >
          <Megaphone className="w-3.5 h-3.5" />
          {isAr ? 'استوديو التسويق' : 'Marketing Studio'}
        </button>
        <button
          onClick={() => setTab('abandoned-carts')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'abandoned-carts' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-abandoned-carts"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          {isAr ? 'سلات متروكة' : 'Abandoned Carts'}
        </button>
      </div>

      {tab === 'marketing' ? <MarketingStudio /> : <AbandonedCarts />}
    </div>
  );
}
