import { useAppContext } from '@/context/AppContext';
import { adminStores, adminSubscriptions } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const cardV = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

export default function AdminOverview() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const totalStores = adminStores.length;
  const activeStores = adminStores.filter(s => s.status === 'active').length;
  const totalRevenue = adminStores.reduce((a, s) => a + s.totalSales, 0);
  const expiredSubs = adminSubscriptions.filter(s => s.status === 'expired').length;
  const unpaidSubs = adminSubscriptions.filter(s => !s.paid).length;
  const trialStores = adminStores.filter(s => s.subscriptionStatus === 'trial').length;

  const stats = [
    { titleAr: 'إجمالي المتاجر', titleEn: 'Total Stores', value: totalStores, icon: Store, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { titleAr: 'المتاجر النشطة', titleEn: 'Active Stores', value: activeStores, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { titleAr: 'إجمالي المبيعات', titleEn: 'Total Revenue', value: totalRevenue.toLocaleString(), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', prefix: '₪' },
    { titleAr: 'اشتراكات منتهية', titleEn: 'Expired Subs', value: expiredSubs, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  const statusConfig: Record<string, { ar: string; en: string; cls: string }> = {
    active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    suspended: { ar: 'موقوف', en: 'Suspended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
    trial: { ar: 'تجريبي', en: 'Trial', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  };

  return (
    <div className="space-y-7">
      {/* Stats */}
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

      {/* Alerts */}
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

      {/* Recent Stores Table */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardHeader className="border-b border-white/[0.07] pb-4">
            <CardTitle className="text-sm font-semibold text-white/80">
              {isAr ? 'أحدث المتاجر' : 'Recent Stores'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                  {adminStores.map((store, i) => (
                    <motion.tr key={store.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.04 }} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{store.name}</p>
                        <p className="text-xs text-white/35 font-mono">{store.domain}</p>
                      </td>
                      <td className="px-6 py-4 text-white/60">{store.ownerName}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-white">{store.ordersCount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[store.subscriptionStatus].cls}`}>
                          {isAr ? statusConfig[store.subscriptionStatus].ar : statusConfig[store.subscriptionStatus].en}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[store.status].cls}`}>
                          {isAr ? statusConfig[store.status].ar : statusConfig[store.status].en}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
