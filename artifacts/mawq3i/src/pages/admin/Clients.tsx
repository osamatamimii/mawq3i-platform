import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Store, Mail, Phone, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Client {
  id: string;
  email: string;
  store_name: string;
  store_slug: string;
  domain: string;
  owner_phone: string;
  subscription: string;
  status: string;
  created_at: string;
}

export default function AdminClients() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('stores')
        .select('id, name, slug, domain, owner_email, owner_phone, subscription, status, created_at')
        .order('created_at', { ascending: false });

      if (data) {
        setClients(data.map(s => ({
          id: s.id,
          email: s.owner_email || '—',
          store_name: s.name,
          store_slug: s.slug,
          domain: s.domain || `${s.slug}.mawq3i.co`,
          owner_phone: s.owner_phone || '—',
          subscription: s.subscription || 'monthly',
          status: s.status || 'active',
          created_at: s.created_at?.split('T')[0] || '—',
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'العملاء' : 'Clients'}</h2>
        <p className="text-sm text-white/40">{clients.length} {isAr ? 'عميل مسجل' : 'registered clients'}</p>
      </div>

      {clients.length === 0 ? (
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-24 text-white/30 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center">
                <Users className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-base font-medium text-white/40">{isAr ? 'لا يوجد عملاء بعد' : 'No clients yet'}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/35">
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الدومين' : 'Domain'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'تاريخ الانضمام' : 'Joined'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <motion.tr key={c.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Store className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="font-semibold text-white">{c.store_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-white/60">
                          <Mail className="w-3.5 h-3.5" />
                          {c.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-white/60">
                          <Phone className="w-3.5 h-3.5" />
                          {c.owner_phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <a href={`https://${c.domain}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-primary/80 hover:text-primary transition-colors font-mono text-xs">
                          {c.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40">{c.created_at}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          c.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 border-red-500/25'
                        }`}>
                          {c.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Inactive')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
