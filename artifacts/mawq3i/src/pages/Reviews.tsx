import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getReviews, updateReviewStatus, deleteReview, getProducts } from '@/lib/db';
import { Review, Product } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Star, Check, X, Trash2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export default function Reviews() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [rv, pr] = await Promise.all([
      getReviews(currentStore?.id, isAdminMode),
      getProducts(currentStore?.id, isAdminMode),
    ]);
    setReviews(rv);
    setProducts(pr);
    setLoading(false);
  }

  useEffect(() => { load(); }, [currentStore?.id]);

  const productName = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => { map[p.id] = p.nameAr || p.nameEn || p.id; });
    return (id: string) => map[id] || id;
  }, [products]);

  const counts = useMemo(() => ({
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
    all: reviews.length,
  }), [reviews]);

  const filtered = tab === 'all' ? reviews : reviews.filter((r) => r.status === tab);

  async function handleStatus(id: string, status: Review['status']) {
    setBusyId(id);
    const ok = await updateReviewStatus(id, status, isAdminMode);
    if (ok) {
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast({ title: isAr ? 'تم التحديث' : 'Updated' });
    } else {
      toast({ title: isAr ? 'حدث خطأ' : 'Something went wrong', variant: 'destructive' });
    }
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const ok = await deleteReview(id, isAdminMode);
    if (ok) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast({ title: isAr ? 'تم الحذف' : 'Deleted' });
    } else {
      toast({ title: isAr ? 'حدث خطأ' : 'Something went wrong', variant: 'destructive' });
    }
    setBusyId(null);
  }

  const tabs: { key: FilterTab; labelAr: string; labelEn: string }[] = [
    { key: 'pending', labelAr: 'بانتظار المراجعة', labelEn: 'Pending' },
    { key: 'approved', labelAr: 'منشورة', labelEn: 'Approved' },
    { key: 'rejected', labelAr: 'مرفوضة', labelEn: 'Rejected' },
    { key: 'all', labelAr: 'الكل', labelEn: 'All' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <MessageSquareText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{isAr ? 'التقييمات' : 'Reviews'}</h1>
            <p className="text-sm text-muted-foreground">
              {isAr ? 'راجع ووافق على تقييمات الزبائن قبل ظهورها بالمتجر' : "Review and approve customer reviews before they appear on your store"}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border',
              tab === t.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
            )}
          >
            {isAr ? t.labelAr : t.labelEn}
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === t.key ? 'bg-primary-foreground/20' : 'bg-muted')}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {isAr ? 'لا توجد تقييمات هنا' : 'No reviews here'}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn('w-3.5 h-3.5', i < r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30')}
                            />
                          ))}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{r.customerName}</p>
                        <p className="text-xs text-muted-foreground">{productName(r.productId)}</p>
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium flex-shrink-0',
                        r.status === 'pending' && 'bg-yellow-500/10 text-yellow-500',
                        r.status === 'approved' && 'bg-green-500/10 text-green-500',
                        r.status === 'rejected' && 'bg-red-500/10 text-red-500',
                      )}>
                        {isAr
                          ? (r.status === 'pending' ? 'بانتظار المراجعة' : r.status === 'approved' ? 'منشورة' : 'مرفوضة')
                          : r.status}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{r.comment}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {r.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => handleStatus(r.id, 'approved')}
                          className="gap-1.5 h-8 text-green-600 border-green-500/30 hover:bg-green-500/10 hover:text-green-600"
                        >
                          <Check className="w-3.5 h-3.5" /> {isAr ? 'موافقة' : 'Approve'}
                        </Button>
                      )}
                      {r.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => handleStatus(r.id, 'rejected')}
                          className="gap-1.5 h-8 text-muted-foreground"
                        >
                          <X className="w-3.5 h-3.5" /> {isAr ? 'رفض' : 'Reject'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => handleDelete(r.id)}
                        className="gap-1.5 h-8 text-red-500 border-red-500/20 hover:bg-red-500/10 hover:text-red-500 ms-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {isAr ? 'حذف' : 'Delete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
