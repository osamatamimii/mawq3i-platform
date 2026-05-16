import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, DollarSign, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StoreRow {
  id: string;
  name: string;
  owner_email: string;
  subscription: string;
  status: string;
  created_at: string;
  subscription_paid: boolean;
}

export default function AdminSubscriptions() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from('stores')
      .select('id, name, owner_email, subscription, status, created_at, subscription_paid')
      .order('created_at', { ascending: false });
    setStores(data || []);
    setLoading(false);
  }

  async function togglePaid(id: string, current: boolean) {
    setSaving(id);
    await supabase.from('stores').update({ subscription_paid: !current }).eq('id', id);
    setStores(prev => prev.map(s => s.id === id ? { ...s, subscription_paid: !current } : s));
    setSaving(null);
  }

  const collected = stores.filter(s => s.subscription_paid).length;
  const unpaid = stores.filter(s => !s.subscription_paid).length;
  const monthly = 120;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'الاشتراكات' : 'Subscriptions'}</h2>
        <p className="text-sm text-white/40">{stores.length} {isAr ? 'اشتراك' : 'subscriptions'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { titleAr: 'المبالغ المحصلة', titleEn: 'Collected', value: `₪${collected * monthly}`, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { titleAr: 'المبالغ المستحقة', titleEn: 'Pending', value: `₪${unpaid * monthly}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { titleAr: 'إجمالي الاشتراكات', titleEn: 'Total', value: stores.length.toString(), icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map((s, i) => (
          <motion.div key={s.titleAr} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="bg-white/[0.03] border-white/[0.07]">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-white/40">{isAr ? s.titleAr : s.titleEn}</p>
                  <p className="text-xl font-bold text-white font-mono">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-white/[0.03] border-white/[0.07]">
        <CardContent className="p-0">
          {stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-2">
              <span className="text-4xl">💳</span>
              <p className="text-sm">{isAr ? 'لا توجد اشتراكات بعد' : 'No subscriptions yet'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/35">
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المالك' : 'Owner'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الخطة' : 'Plan'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'حالة الاشتراك' : 'Status'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'حالة الدفع' : 'Payment'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store, i) => (
                    <motion.tr key={store.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{store.name}</td>
                      <td className="px-6 py-4 text-white/60 text-xs">{store.owner_email || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium bg-white/[0.06] px-2.5 py-1 rounded-full text-white/60 font-mono">
                          {store.subscription === 'yearly' ? (isAr ? 'سنوي' : 'Yearly') : (isAr ? 'شهري' : 'Monthly')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          store.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 border-red-500/25'
                        }`}>
                          {store.status === 'active'
                            ? <><CheckCircle2 className="w-3 h-3" />{isAr ? 'نشط' : 'Active'}</>
                            : <><AlertTriangle className="w-3 h-3" />{isAr ? 'منتهي' : 'Expired'}</>
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {store.subscription_paid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" />{isAr ? 'مدفوع' : 'Paid'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-500/15 text-amber-400 border-amber-500/25">
                            <Clock className="w-3 h-3" />{isAr ? 'غير مدفوع' : 'Unpaid'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" size="sm"
                          className={`h-7 text-xs border-white/10 bg-transparent ${store.subscription_paid ? 'text-amber-400 hover:border-amber-500/30' : 'text-emerald-400 hover:border-emerald-500/30'} hover:bg-white/5`}
                          disabled={saving === store.id}
                          onClick={() => togglePaid(store.id, store.subscription_paid)}>
                          {saving === store.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : store.subscription_paid
                              ? (isAr ? 'إلغاء الدفع' : 'Mark Unpaid')
                              : (isAr ? 'تأكيد الدفع' : 'Mark Paid')
                          }
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
