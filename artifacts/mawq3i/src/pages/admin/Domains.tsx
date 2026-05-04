import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminStores } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Globe, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

type DomainRecord = {
  id: string;
  storeName: string;
  domain: string;
  type: 'subdomain' | 'custom';
  status: 'active' | 'pending' | 'error';
  ssl: boolean;
  updatedAt: string;
};

const initialDomains: DomainRecord[] = [
  { id: '1', storeName: 'متجر الأناقة', domain: 'elegance.mawq3i.com', type: 'subdomain', status: 'active', ssl: true, updatedAt: '2026-01-15' },
  { id: '2', storeName: 'تراثيات', domain: 'heritage.mawq3i.com', type: 'subdomain', status: 'active', ssl: true, updatedAt: '2025-03-10' },
  { id: '3', storeName: 'عطور الشرق', domain: 'oud.mawq3i.com', type: 'subdomain', status: 'active', ssl: true, updatedAt: '2026-04-20' },
  { id: '4', storeName: 'مكتبة اقرأ', domain: 'read.mawq3i.com', type: 'subdomain', status: 'error', ssl: false, updatedAt: '2025-06-20' },
  { id: '5', storeName: 'إلكترونيات بلس', domain: 'electro.mawq3i.com', type: 'subdomain', status: 'active', ssl: true, updatedAt: '2024-12-01' },
  { id: '6', storeName: 'عسل الجبل', domain: 'honey.mawq3i.com', type: 'subdomain', status: 'pending', ssl: false, updatedAt: '2025-11-10' },
];

const statusCfg = {
  active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
  pending: { ar: 'قيد المعالجة', en: 'Pending', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: Clock },
  error: { ar: 'خطأ', en: 'Error', cls: 'bg-red-500/15 text-red-400 border-red-500/25', icon: AlertTriangle },
};

export default function AdminDomains() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [domains] = useState<DomainRecord[]>(initialDomains);

  const active = domains.filter(d => d.status === 'active').length;
  const pending = domains.filter(d => d.status === 'pending').length;
  const errors = domains.filter(d => d.status === 'error').length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'إدارة الدومينات' : 'Domain Management'}</h2>
        <p className="text-sm text-white/40">{domains.length} {isAr ? 'دومين مسجل' : 'registered domains'}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { labelAr: 'نشط', labelEn: 'Active', value: active, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { labelAr: 'قيد المعالجة', labelEn: 'Pending', value: pending, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { labelAr: 'أخطاء', labelEn: 'Errors', value: errors, color: 'text-red-400', bg: 'bg-red-400/10' },
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/35">
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الدومين' : 'Domain'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">SSL</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'آخر تحديث' : 'Updated'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d, i) => {
                  const cfg = statusCfg[d.status];
                  return (
                    <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{d.storeName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-white/50" dir="ltr">{d.domain}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-white/[0.06] px-2.5 py-1 rounded-full text-white/50">
                          {d.type === 'subdomain' ? (isAr ? 'نطاق فرعي' : 'Subdomain') : (isAr ? 'دومين مخصص' : 'Custom')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {d.ssl
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> SSL</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" /> {isAr ? 'غير محمي' : 'No SSL'}</span>
                        }
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40">{d.updatedAt}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
                          <cfg.icon className="w-3 h-3" />
                          {isAr ? cfg.ar : cfg.en}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white"
                          onClick={() => window.open(`https://${d.domain}`, '_blank')}>
                          <ExternalLink className="w-3 h-3" />
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
