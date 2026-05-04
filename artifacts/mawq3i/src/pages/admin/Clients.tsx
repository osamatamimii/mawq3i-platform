import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminClients, adminStores, Client } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, LogIn, BanIcon, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'wouter';

export default function AdminClients() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [, setLocation] = useLocation();
  const [clients, setClients] = useState<Client[]>(adminClients);

  const toggleStatus = (id: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'suspended' : 'active' } : c));
  };

  const storeSub = (storeId: string) => {
    const store = adminStores.find(s => s.id === storeId);
    return store?.subscriptionStatus ?? 'trial';
  };

  const subCfg: Record<string, { ar: string; en: string; cls: string }> = {
    active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
    trial: { ar: 'تجريبي', en: 'Trial', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    suspended: { ar: 'موقوف', en: 'Suspended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'العملاء' : 'Clients'}</h2>
        <p className="text-sm text-white/40">{clients.length} {isAr ? 'عميل مسجل' : 'registered clients'}</p>
      </div>

      <Card className="bg-white/[0.03] border-white/[0.07]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/35">
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'العميل' : 'Client'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الهاتف' : 'Phone'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الدولة' : 'Country'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الاشتراك' : 'Subscription'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'تاريخ الانضمام' : 'Joined'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => {
                  const sub = storeSub(client.storeId);
                  return (
                    <motion.tr key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white/70 flex-shrink-0">
                            {client.name.charAt(0)}
                          </div>
                          <span className="font-medium text-white">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/50 text-xs font-mono" dir="ltr">{client.email}</td>
                      <td className="px-6 py-4 text-white/50 text-xs font-mono" dir="ltr">{client.phone}</td>
                      <td className="px-6 py-4 text-white/60">{client.country}</td>
                      <td className="px-6 py-4">
                        <span className="text-white/70 font-medium">{client.storeName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${subCfg[sub].cls}`}>
                          {isAr ? subCfg[sub].ar : subCfg[sub].en}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40">{client.joinDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${subCfg[client.status].cls}`}>
                          {isAr ? subCfg[client.status].ar : subCfg[client.status].en}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white"
                            title={isAr ? 'دخول كصاحب المتجر' : 'Login as Owner'} onClick={() => setLocation('/dashboard')}>
                            <LogIn className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white"
                            title={isAr ? 'عرض المتجر' : 'View Store'} onClick={() => window.open(`/store/${adminStores.find(s => s.id === client.storeId)?.slug}`, '_blank')}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="icon" className={`h-7 w-7 border-white/10 bg-transparent ${client.status === 'active' ? 'hover:text-red-400' : 'hover:text-emerald-400'} text-white/50 hover:bg-white/5`}
                            title={client.status === 'active' ? (isAr ? 'تعليق' : 'Suspend') : (isAr ? 'تفعيل' : 'Activate')} onClick={() => toggleStatus(client.id)}>
                            {client.status === 'active' ? <BanIcon className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          </Button>
                        </div>
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
