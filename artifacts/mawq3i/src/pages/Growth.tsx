import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { TrendingUp, Package, ShoppingCart, Store as StoreIcon, Loader2 } from 'lucide-react';

interface GrowthEvent {
  id: string;
  category: 'product' | 'store' | 'cart' | string;
  title: string;
  description: string;
  related_product_id: string | null;
  created_at: string;
  status: string;
}

const CATEGORY_ICON: Record<string, any> = {
  product: Package,
  store: StoreIcon,
  cart: ShoppingCart,
};

function timeAgo(dateStr: string, isAr: boolean) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (isAr) {
    if (diff < 3600) return `منذ ${Math.max(1, Math.floor(diff / 60))} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return `منذ ${Math.floor(diff / 86400)} يوم`;
  }
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Growth() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';
  const [events, setEvents] = useState<GrowthEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!currentStore?.id) return;
      setLoading(true);
      const data = await adminRest.select(
        'store_growth_events',
        `store_id=eq.${currentStore.id}&order=created_at.desc&limit=50`,
        currentStore.id
      );
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, [currentStore?.id]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          {isAr ? 'النمو' : 'Growth'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? 'وكيل النمو بيراقب متجرك يومياً ويطلعلك هون أي شي يستاهل انتباهك — منتج راكد، صفحة منتج ما بتحوّل، أو سلات متروكة أكتر من الطبيعي.'
            : 'The growth agent watches your store daily and surfaces anything worth your attention here — a stagnant product, a page that isn\'t converting, or unusually high cart abandonment.'}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card p-8 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'ما في شي يستاهل انتباهك هلأ. وكيل النمو بيفحص متجرك يومياً وبيحطلك هون أي ملاحظة مهمة.'
              : 'Nothing needs your attention right now. The growth agent checks your store daily and will post here when something matters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = CATEGORY_ICON[e.category] || TrendingUp;
            return (
              <div key={e.id} className="rounded-xl border border-border/40 bg-card p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(e.created_at, isAr)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{e.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
