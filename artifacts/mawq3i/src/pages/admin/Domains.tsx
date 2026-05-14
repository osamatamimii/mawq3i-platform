import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { StoreRecord } from '@/data/mockData';
import { getAllStores } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Globe, CheckCircle2, Loader2 } from 'lucide-react';

export default function AdminDomains() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllStores().then(data => {
      setStores(data.filter(s => s.domain));
      setLoading(false);
    });
  }, []);

  const active = stores.filter(s => s.status === 'active').length;
  const suspended = stores.filter(s => s.status === 'suspended').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'إدارة الدومينات' : 'Domain Management'}</h2>
        <p className="text-sm text-white/40">{stores.length} {isAr ? 'دومين مسجل' : 'registered domains'}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { labelAr: 'نشط', labelEn: 'Active', value: active, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { labelAr: 'موقوف', labelEn: 'Suspended', value: suspended, color: 'text-red-400', bg: 'bg-red-400/10' },
          { labelAr: 'الإجمالي', labelEn: 'Total', value: stores.length, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map((s, i) => (
          <motion.div key={s.labelAr} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="bg-white/[0.03] border-white/[0.07]">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <Globe className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-white/40">{isAr ? s.labelAr : s.labelEn}</p>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
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
              <span className="text-4xl">🌐</span>
              <p className="text-sm">{isAr ? 'لا توجد دومينات بعد' : 'No domains yet'}</p>
              <p className="text-xs opacity-60">{isAr ? 'ستظهر هنا دومينات المتاجر المسجلة' : 'Store domains will appear here'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/35">
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الدومين' : 'Domain'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'النطاق' : 'Slug'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store, i) => (
                    <motion.tr key={store.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{store.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-white/50" dir="ltr">{store.domain || '—'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40" dir="ltr">{store.slug}</td>
                      <td className="px-6 py-4">
                        {store.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {isAr ? 'نشط' : 'Active'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400">
                            {isAr ? 'موقوف' : 'Suspended'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white"
                          onClick={() => { const url = store.domain ? `https://${store.domain}` : `/store/${store.slug}`; window.open(url, '_blank'); }}>
                          <ExternalLink className="w-3 h-3" />
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
