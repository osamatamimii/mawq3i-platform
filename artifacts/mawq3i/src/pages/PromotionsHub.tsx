import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Tag, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import Promotions from './Promotions';
import DiscountCodes from './DiscountCodes';

export default function PromotionsHub() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'promotions' | 'discount-codes'>('promotions');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('promotions')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'promotions' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-promotions"
        >
          <Tag className="w-3.5 h-3.5" />
          {isAr ? 'العروض' : 'Promotions'}
        </button>
        <button
          onClick={() => setTab('discount-codes')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'discount-codes' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-discount-codes"
        >
          <Percent className="w-3.5 h-3.5" />
          {isAr ? 'أكواد الخصم' : 'Discount Codes'}
        </button>
      </div>

      {tab === 'promotions' ? <Promotions /> : <DiscountCodes />}
    </div>
  );
}
