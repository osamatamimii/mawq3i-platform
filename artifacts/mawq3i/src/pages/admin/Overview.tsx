import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { StoreRecord } from '@/data/mockData';
import { getAllStores } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const SB_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

const cardV = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

const statusConfig: Record<string, { ar: string; en: string; cls: string }> = {
  active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  suspended: { ar: 'موقوف', en: 'Suspended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
  trial: { ar: 'تجريبي', en: 'Trial', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
};

export default function AdminOverview() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [realRevenue, setRealRevenue] = useState(0);
  const [realOrdersCount, setRealOrdersCount] = useState(0);
  const [storeOrderCounts, setStoreOrderCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getAllStores().then(data => {
      setStores(data);
      setLoading(false);
    });
    // Fetch all orders to compute per-store counts and total revenue
    fetch(`${SB_URL}/rest/v1/orders?select=store_id,amount,status`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    })
      .then(r => r.json())
      .then((rows: any[]) => {
        const counts: Record<string, number> = {};
        let revenue = 0;
        (rows || []).forEach((r: any) => {
          counts[r.store_id] = (counts[r.store_id] || 0) + 1;
          if (r.status !== 'cancelled') revenue += Number(r.amount || 0);
        });
        setStoreOrderCounts(counts);
        setRealRevenue(revenue);
        setRealOrdersCount(rows?.length || 0);
      })
      .catch(() => {});
  }, []);

  const totalStores = stores.length;
  const activeStores = stores.filter(s => s.status === 'active').length;
  const expiredSubs = stores.filter(s => s.subscriptionStatus === 'expired').length;
  const unpaidSubs = stores.filter(s => !s.subscriptionPaid).length;
  const trialStores = stores.filter(s => s.subscriptionStatus === 'trial').length;

  const stats = [
    { titleAr: 'إجمالي المتاجر', titleEn: 'Total Stores', value: totalStores, icon: Store, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { titleAr: 'المتاجر النشطة', titleEn: 'Active Stores', value: activeStores, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { titleAr: 'إجمالي الإيرادات', titleEn: 'Total Revenue', value: realRevenue.toLocaleString(), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', prefix: '₪' },
    { titleAr: 'اشتراكات منتهية', titleEn: 'Expired Subs', value: expiredSubs, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.titleAr} custom={i} initial="hidden" animate="visible" variants={cardV} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
            <Card className="bg-white/[0.03] border-white/[0.07] hover:border-white/[0.12] transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-white/40 font-medium uppercase tracking-wide">{isAr ? s.titleAr : s.titleEn}</p>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg}`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white font-mono">{s.prefix}{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {(unpaidSubs > 0 || trialStores > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-3">
          {unpaidSubs > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{isAr ? `${unpaidSubs} اشتراك غير مدفوع` : `${unpaidSubs} unpaid subscription(s)`}</span>
            </div>
          )}
          {trialStores > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span>{isAr ? `${trialStores} متجر في الفترة التجريبية` : `${trialStores} store(s) on trial`}</span>
            </div>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardHeader className="border-b border-white/[0.07] pb-4">
            <CardTitle className="text-sm font-semibold text-white/80">
              {isAr ? 'أحدث المتاجر' : 'Recent Stores'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-2">
                <span className="text-4xl">🏪</span>
                <p className="text-sm">{isAr ? 'لا توجد متاجر بعد' : 'No stores yet'}</p>
                <p className="text-xs opacity-60">{isAr ? 'ستظهر هنا المتاجر المسجلة في المنصة' : 'Registered stores will appear here'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-white/35">
                      <th className="text-start px-6 py-3 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                      <th className="text-start px-6 py-3 font-medium">{isAr ? 'المالك' : 'Owner'}</th>
                      <th className="text-start px-6 py-3 font-medium">{isAr ? 'الطلبات' : 'Orders'}</th>
                      <th className="text-start px-6 py-3 font-medium">{isAr ? 'الاشتراك' : 'Subscription'}</th>
                      <th className="text-start px-6 py-3 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((store, i) => (
                      <motion.tr key={store.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.04 }} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{store.name}</p>
                          <p className="text-xs text-white/35 font-mono">{store.domain}</p>
                        </td>
                        <td className="px-6 py-4 text-white/60">{store.ownerName || '—'}</td>
                        <td className="px-6 py-4 font-mono font-semibold text-white">{(storeOrderCounts[store.id] || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[store.subscriptionStatus]?.cls}`}>
                            {isAr ? statusConfig[store.subscriptionStatus]?.ar : statusConfig[store.subscriptionStatus]?.en}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[store.status]?.cls}`}>
                            {isAr ? statusConfig[store.status]?.ar : statusConfig[store.status]?.en}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
