import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Package, Boxes, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import Products from './Products';
import Bundles from './Bundles';
import Wholesale from './Wholesale';

export default function ProductsHub() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'products' | 'bundles' | 'wholesale'>('products');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('products')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'products' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-products"
        >
          <Package className="w-3.5 h-3.5" />
          {isAr ? 'المنتجات' : 'Products'}
        </button>
        <button
          onClick={() => setTab('bundles')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'bundles' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-bundles"
        >
          <Boxes className="w-3.5 h-3.5" />
          {isAr ? 'الباكجات' : 'Bundles'}
        </button>
        <button
          onClick={() => setTab('wholesale')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'wholesale' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-wholesale"
        >
          <Layers className="w-3.5 h-3.5" />
          {isAr ? 'الجملة' : 'Wholesale'}
        </button>
      </div>

      {tab === 'products' ? <Products /> : tab === 'bundles' ? <Bundles /> : <Wholesale />}
    </div>
  );
}
