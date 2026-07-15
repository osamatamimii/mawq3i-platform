import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { TrendingUp, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import WinningProducts from './WinningProducts';
import CompetitorPrices from './CompetitorPrices';

export default function ResearchHub() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'winning-products' | 'competitor-prices'>('winning-products');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('winning-products')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'winning-products' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-winning-products"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          {isAr ? 'المنتجات الرابحة' : 'Winning Products'}
        </button>
        <button
          onClick={() => setTab('competitor-prices')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'competitor-prices' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-competitor-prices"
        >
          <Scale className="w-3.5 h-3.5" />
          {isAr ? 'أسعار المنافسين' : 'Competitor Prices'}
        </button>
      </div>

      {tab === 'winning-products' ? <WinningProducts /> : <CompetitorPrices />}
    </div>
  );
}
