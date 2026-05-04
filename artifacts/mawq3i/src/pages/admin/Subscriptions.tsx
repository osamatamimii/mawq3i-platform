import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminSubscriptions, Subscription } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertTriangle, DollarSign } from 'lucide-react';

export default function AdminSubscriptions() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [subs, setSubs] = useState<Subscription[]>(adminSubscriptions);

  const togglePaid = (id: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, paid: !s.paid } : s));
  };

  const statusCfg: Record<string, { ar: string; en: string; cls: string; icon: typeof Clock }> = {
    active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
    expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-red-500/15 text-red-400 border-red-500/25', icon: AlertTriangle },
    trial: { ar: 'تجريبي', en: 'Trial', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: Clock },
  };

  const totalDue = subs.filter(s => !s.paid).reduce((a, s) => a + s.amount, 0);
  const totalCollected = subs.filter(s => s.paid).reduce((a, s) => a + s.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'الاشتراكات' : 'Subscriptions'}</h2>
        <p className="text-sm text-white/40">{subs.length} {isAr ? 'اشتراك' : 'subscriptions'}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { titleAr: 'المبالغ المحصلة', titleEn: 'Collected', value: totalCollected, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { titleAr: 'المبالغ المستحقة', titleEn: 'Pending', value: totalDue, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { titleAr: 'إجمالي الاشتراكات', titleEn: 'Total Subs', value: subs.length, icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-400/10', noPrefix: true },
        ].map((s, i) => (
          <motion.div key={s.titleAr} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="bg-white/[0.03] border-white/[0.07]">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-white/40">{isAr ? s.titleAr : s.titleEn}</p>
                  <p className="text-xl font-bold text-white font-mono">{s.noPrefix ? s.value : `₪${s.value}`}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-white/[0.03] border-white/[0.07]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/35">
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المالك' : 'Owner'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الخطة' : 'Plan'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'تاريخ التجديد' : 'Renewal'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'حالة الاشتراك' : 'Status'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'حالة الدفع' : 'Payment'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub, i) => {
                  const cfg = statusCfg[sub.status];
                  return (
                    <motion.tr key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{sub.storeName}</td>
                      <td className="px-6 py-4 text-white/60">{sub.ownerName}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium bg-white/[0.06] px-2.5 py-1 rounded-full text-white/60 font-mono">
                          {sub.plan === 'yearly' ? (isAr ? 'سنوي' : 'Yearly') : (isAr ? 'شهري' : 'Monthly')}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-white">
                        {sub.currency === 'ILS' ? '₪' : '﷼'}{sub.amount}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40">{sub.renewalDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
                          <cfg.icon className="w-3 h-3" />
                          {isAr ? cfg.ar : cfg.en}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {sub.paid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" />
                            {isAr ? 'مدفوع' : 'Paid'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-500/15 text-amber-400 border-amber-500/25">
                            <Clock className="w-3 h-3" />
                            {isAr ? 'غير مدفوع' : 'Unpaid'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" size="sm" className={`h-7 text-xs border-white/10 bg-transparent ${sub.paid ? 'text-amber-400 hover:border-amber-500/30' : 'text-emerald-400 hover:border-emerald-500/30'} hover:bg-white/5`}
                          onClick={() => togglePaid(sub.id)}>
                          {sub.paid ? (isAr ? 'إلغاء الدفع' : 'Mark Unpaid') : (isAr ? 'تأكيد الدفع' : 'Mark Paid')}
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
