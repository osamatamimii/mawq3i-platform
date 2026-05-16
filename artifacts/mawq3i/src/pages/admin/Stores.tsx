import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { StoreRecord } from '@/data/mockData';
import { getAllStores, addStore, updateStore, deleteStore } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, LogIn, ExternalLink, Pencil, BanIcon, CheckCircle2, Loader2, Trash2, Globe } from 'lucide-react';

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

const subStatusCfg: Record<string, { ar: string; en: string; cls: string }> = {
  active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
  trial: { ar: 'تجريبي', en: 'Trial', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
};
const storStatusCfg: Record<string, { ar: string; en: string; cls: string }> = {
  active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  suspended: { ar: 'موقوف', en: 'Suspended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
};

type AddAlert = { type: 'success' | 'warning'; message: string } | null;

const emptyNew = { name: '', slug: '', domain: '', currency: 'ILS', ownerName: '', ownerEmail: '', ownerPhone: '', password: '' };

function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export default function AdminStores() {
  const { language, setCurrentStore, setCurrentUser} = useAppContext();
  const isAr = language === 'ar';
  const [, setLocation] = useLocation();

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editStore, setEditStore] = useState<StoreRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newStore, setNewStore] = useState(emptyNew);
  const [addAlert, setAddAlert] = useState<AddAlert>(null);
  const [storeOrderCounts, setStoreOrderCounts] = useState<Record<string, number>>({});
  const [storeSales, setStoreSales] = useState<Record<string, number>>({});

  useEffect(() => {
    getAllStores().then(data => {
      setStores(data);
      setLoading(false);
    });
    // Fetch real order counts and revenue per store
    fetch(`${SUPABASE_URL}/rest/v1/orders?select=store_id,amount,status`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    })
      .then(r => r.json())
      .then((rows: any[]) => {
        const counts: Record<string, number> = {};
        const sales: Record<string, number> = {};
        (rows || []).forEach((r: any) => {
          counts[r.store_id] = (counts[r.store_id] || 0) + 1;
          if (r.status !== 'cancelled') sales[r.store_id] = (sales[r.store_id] || 0) + Number(r.amount || 0);
        });
        setStoreOrderCounts(counts);
        setStoreSales(sales);
      })
      .catch(() => {});
  }, []);

  function handleNameChange(name: string) {
    setNewStore(s => ({ ...s, name, slug: toSlug(name) }));
  }

  const toggleStatus = async (id: string) => {
    const store = stores.find(s => s.id === id);
    if (!store) return;
    const newStatus = store.status === 'active' ? 'suspended' : 'active';
    setStores(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    await updateStore(id, { status: newStatus });
  };

  const handleAdd = async () => {
    if (!newStore.name || !newStore.ownerEmail || !newStore.password) return;
    setSaving(true);
    setAddAlert(null);

    const slug = newStore.slug || toSlug(newStore.name);

    // 1. Create auth user
    let newUserId: string | null = null;
    let authOk = false;
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({
          email: newStore.ownerEmail,
          password: newStore.password,
          email_confirm: true,
        }),
      });
      if (authRes.ok) {
        const userData = await authRes.json();
        newUserId = userData?.id ?? null;
        authOk = true;
      }
    } catch {
      authOk = false;
    }

    // 2. Create store record
    const created = await addStore({
      name: newStore.name,
      slug,
      domain: newStore.domain,
      ownerName: newStore.ownerName,
      ownerEmail: newStore.ownerEmail,
      ownerPhone: newStore.ownerPhone,
      currency: newStore.currency as 'ILS' | 'SAR',
      status: 'active',
      ordersCount: 0,
      totalSales: 0,
      subscriptionStatus: 'trial',
      subscriptionPlan: 'monthly',
      subscriptionPaid: false,
      renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      joinDate: new Date().toISOString().slice(0, 10),
    });

    // 3. Link owner_id to store so the owner can access their dashboard
    if (created && newUserId) {
      await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${created.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({ owner_id: newUserId }),
      });
    }

    if (created) setStores(prev => [created, ...prev]);

    setSaving(false);
    setShowAdd(false);

    if (authOk && newUserId) {
      setAddAlert({
        type: 'success',
        message: `✅ تم إنشاء المتجر وحساب المستخدم بنجاح — البريد: ${newStore.ownerEmail} | كلمة المرور: ${newStore.password}`,
      });
    } else if (created) {
      setAddAlert({
        type: 'warning',
        message: `⚠️ تم إنشاء المتجر لكن فشل إنشاء حساب المستخدم. أنشئه يدوياً من Supabase ثم شغّل:\nUPDATE stores SET owner_id = '[user-uuid]' WHERE owner_email = '${newStore.ownerEmail}'`,
      });
    }

    setNewStore(emptyNew);
  };

  const saveEdit = async () => {
    if (!editStore) return;
    setSaving(true);
    setStores(prev => prev.map(s => s.id === editStore.id ? editStore : s));
    await updateStore(editStore.id, editStore);
    setSaving(false);
    setEditStore(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setStores(prev => prev.filter(s => s.id !== deleteId));
    await deleteStore(deleteId);
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{isAr ? 'جميع المتاجر' : 'All Stores'}</h2>
          <p className="text-sm text-white/40">{stores.length} {isAr ? 'متجر' : 'stores'}</p>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={() => { setShowAdd(true); setAddAlert(null); }} className="gap-2">
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة متجر' : 'Add Store'}
          </Button>
        </motion.div>
      </div>

      {addAlert && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            addAlert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
          dir="rtl"
        >
          {addAlert.message}
        </motion.div>
      )}

      <Card className="bg-white/[0.03] border-white/[0.07]">
        <CardContent className="p-0">
          {stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-2">
              <span className="text-4xl">🏪</span>
              <p className="text-sm">{isAr ? 'لا توجد متاجر بعد' : 'No stores yet'}</p>
              <p className="text-xs opacity-60">{isAr ? 'اضغط "إضافة متجر" لإنشاء أول متجر' : 'Click "Add Store" to create the first store'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/35">
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'المالك' : 'Owner'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'الدومين' : 'Domain'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'الطلبات' : 'Orders'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'المبيعات' : 'Sales'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'الاشتراك' : 'Sub'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'التجديد' : 'Renewal'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="text-start px-5 py-3.5 font-medium">{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store, i) => (
                    <motion.tr key={store.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{store.name}</p>
                        <p className="text-xs text-white/35 font-mono">{store.currency}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white/80">{store.ownerName || '—'}</p>
                        <p className="text-xs text-white/35">{store.ownerEmail}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-white/40" dir="ltr">{store.domain || '—'}</td>
                      <td className="px-5 py-4 font-mono font-semibold text-white">{(storeOrderCounts[store.id] || 0).toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <span className="font-mono font-semibold text-white">
                          {store.currency === 'ILS' ? '₪' : '﷼'}{(storeSales[store.id] || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${subStatusCfg[store.subscriptionStatus]?.cls}`}>
                            {isAr ? subStatusCfg[store.subscriptionStatus]?.ar : subStatusCfg[store.subscriptionStatus]?.en}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono">{store.subscriptionPlan === 'yearly' ? (isAr ? 'سنوي' : 'Yearly') : (isAr ? 'شهري' : 'Monthly')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-white/40">{store.renewalDate || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${storStatusCfg[store.status]?.cls}`}>
                          {isAr ? storStatusCfg[store.status]?.ar : storStatusCfg[store.status]?.en}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-primary/10 hover:border-primary/30 text-white/50 hover:text-primary" title={isAr ? 'منشئ الموقع' : 'Site Builder'} onClick={() => setLocation(`/admin/site-builder/${store.slug}`)}>
                            <Globe className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white" title={isAr ? 'تعديل' : 'Edit'} onClick={() => setEditStore({ ...store })}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <a href={store.domain ? `https://${store.domain}` : `/store/${store.slug}`} target="_blank" rel="noopener noreferrer" title={isAr ? 'معاينة' : 'Preview'} className="inline-flex items-center justify-center h-7 w-7 border border-white/10 rounded-md bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-white/5 text-white/50 hover:text-white" title={isAr ? 'دخول كصاحب المتجر' : 'Login as Owner'} onClick={() => {
                            setCurrentStore(store);
                            setCurrentUser('owner');
                            setLocation('/dashboard');
                          }}>
                            <LogIn className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="icon" className={`h-7 w-7 border-white/10 bg-transparent ${store.status === 'active' ? 'hover:text-red-400 hover:border-red-500/30' : 'hover:text-emerald-400 hover:border-emerald-500/30'} text-white/50 hover:bg-white/5`}
                            title={store.status === 'active' ? (isAr ? 'تعليق' : 'Suspend') : (isAr ? 'تفعيل' : 'Activate')} onClick={() => toggleStatus(store.id)}>
                            {store.status === 'active' ? <BanIcon className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 bg-transparent hover:bg-red-500/10 hover:border-red-500/40 text-white/50 hover:text-red-400"
                            title={isAr ? 'حذف المتجر' : 'Delete Store'} onClick={() => setDeleteId(store.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#0e1217] border-white/10 sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{isAr ? 'إضافة متجر جديد' : 'Add New Store'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">{isAr ? 'اسم المتجر' : 'Store Name'}</Label>
              <Input
                value={newStore.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder={isAr ? 'مثال: متجر الأناقة' : 'e.g. Elegance Store'}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">{isAr ? 'الرابط المختصر (Slug)' : 'Slug'}</Label>
              <Input
                value={newStore.slug}
                onChange={e => setNewStore(s => ({ ...s, slug: e.target.value }))}
                placeholder="elegance-store"
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 font-mono"
                dir="ltr"
              />
            </div>
            {[
              { key: 'domain', labelAr: 'الدومين', labelEn: 'Domain', ph: 'store.mawq3i.com', ltr: true },
              { key: 'ownerName', labelAr: 'اسم المالك', labelEn: 'Owner Name', ph: '' },
              { key: 'ownerEmail', labelAr: 'البريد الإلكتروني', labelEn: 'Owner Email', ph: '', ltr: true },
              { key: 'ownerPhone', labelAr: 'رقم الهاتف', labelEn: 'Phone', ph: '', ltr: true },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-white/60 text-xs">{isAr ? f.labelAr : f.labelEn}</Label>
                <Input
                  value={(newStore as any)[f.key]}
                  onChange={e => setNewStore(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25"
                  dir={f.ltr ? 'ltr' : undefined}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">{isAr ? 'كلمة المرور' : 'Password'}</Label>
              <Input
                value={newStore.password}
                onChange={e => setNewStore(s => ({ ...s, password: e.target.value }))}
                type="text"
                placeholder={isAr ? 'كلمة مرور قوية' : 'Strong password'}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">{isAr ? 'العملة' : 'Currency'}</Label>
              <Select value={newStore.currency} onValueChange={v => setNewStore(s => ({ ...s, currency: v }))}>
                <SelectTrigger className="bg-white/[0.04] border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0e1217] border-white/10">
                  <SelectItem value="ILS">₪ ILS</SelectItem>
                  <SelectItem value="SAR">﷼ SAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-white/10 text-white/60">{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAdd} disabled={saving || !newStore.name || !newStore.ownerEmail || !newStore.password}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStore} onOpenChange={o => !o && setEditStore(null)}>
        <DialogContent className="bg-[#0e1217] border-white/10 sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{isAr ? 'تعديل بيانات المتجر' : 'Edit Store'}</DialogTitle></DialogHeader>
          {editStore && (
            <div className="space-y-3 py-2">
              {[
                { key: 'name', labelAr: 'اسم المتجر', labelEn: 'Store Name' },
                { key: 'domain', labelAr: 'الدومين', labelEn: 'Domain', ltr: true },
                { key: 'ownerName', labelAr: 'اسم المالك', labelEn: 'Owner Name' },
                { key: 'ownerEmail', labelAr: 'البريد الإلكتروني', labelEn: 'Email', ltr: true },
                { key: 'ownerPhone', labelAr: 'الهاتف', labelEn: 'Phone', ltr: true },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-white/60 text-xs">{isAr ? f.labelAr : f.labelEn}</Label>
                  <Input value={(editStore as any)[f.key]} onChange={e => setEditStore(s => s ? { ...s, [f.key]: e.target.value } : s)}
                    className="bg-white/[0.04] border-white/10 text-white" dir={f.ltr ? 'ltr' : undefined} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStore(null)} className="border-white/10 text-white/60">{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0e1217] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {isAr ? 'حذف المتجر' : 'Delete Store'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {isAr
                ? 'هل أنت متأكد من حذف هذا المتجر؟ سيتم حذف جميع بياناته بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this store? All data will be permanently removed and this action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 bg-transparent hover:bg-white/5">
              {isAr ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {isAr ? 'حذف نهائي' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
