import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle2, AlertTriangle, DollarSign, Clock, Loader2, Pencil, Settings, Plus, Trash2, X } from 'lucide-react';

const SB_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

interface StoreRow {
  id: string;
  name: string;
  owner_email: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_price: number | null;
  subscription_currency: string | null;
  status: string;
  created_at: string;
  join_date: string | null;
  renewal_date: string | null;
  subscription_paid: boolean;
}

interface PlanRow {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  is_active: boolean;
  sort_order: number;
}

const emptyPlan = { name: '', price: '', currency: 'USD', period: 'yearly' };

const CURRENCIES = ['USD', 'ILS', 'JOD', 'SAR'];
const currencySymbol: Record<string, string> = { USD: '$', ILS: '₪', JOD: 'د.أ', SAR: 'ر.س' };

export default function AdminSubscriptions() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // edit subscription modal
  const [editStore, setEditStore] = useState<StoreRow | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // plans manager modal
  const [showPlans, setShowPlans] = useState(false);
  const [newPlan, setNewPlan] = useState(emptyPlan);
  const [savingPlan, setSavingPlan] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<any>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [storesRes, plansRes] = await Promise.all([
      fetch(
        `${SB_URL}/rest/v1/stores?select=id,name,owner_email,subscription_plan,subscription_status,subscription_price,subscription_currency,status,created_at,join_date,renewal_date,subscription_paid&order=created_at.desc`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      ),
      fetch(
        `${SB_URL}/rest/v1/subscription_plans?select=*&order=sort_order.asc`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      ),
    ]);
    const storesData = await storesRes.json();
    const plansData = await plansRes.json();
    setStores(Array.isArray(storesData) ? storesData : []);
    setPlans(Array.isArray(plansData) ? plansData : []);
    setLoading(false);
  }

  async function togglePaid(id: string, current: boolean) {
    setSaving(id);
    await fetch(`${SB_URL}/rest/v1/stores?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_paid: !current })
    });
    setStores(prev => prev.map(s => s.id === id ? { ...s, subscription_paid: !current } : s));
    setSaving(null);
  }

  function openEdit(store: StoreRow) {
    setEditStore(store);
    setEditForm({
      subscription_plan: store.subscription_plan || '',
      subscription_status: store.subscription_status || 'trial',
      subscription_price: store.subscription_price ?? '',
      subscription_currency: store.subscription_currency || 'USD',
      subscription_paid: store.subscription_paid,
      join_date: store.join_date ? store.join_date.slice(0, 10) : '',
      renewal_date: store.renewal_date ? store.renewal_date.slice(0, 10) : '',
    });
  }

  function applyPlanToForm(planName: string) {
    const plan = plans.find(p => p.name === planName);
    setEditForm((f: any) => ({
      ...f,
      subscription_plan: planName,
      subscription_price: plan ? plan.price : f.subscription_price,
      subscription_currency: plan ? plan.currency : f.subscription_currency,
    }));
  }

  async function saveEdit() {
    if (!editStore || !editForm) return;
    setSavingEdit(true);
    const body: any = {
      subscription_plan: editForm.subscription_plan,
      subscription_status: editForm.subscription_status,
      subscription_price: editForm.subscription_price === '' ? null : Number(editForm.subscription_price),
      subscription_currency: editForm.subscription_currency,
      subscription_paid: editForm.subscription_paid,
      join_date: editForm.join_date || null,
      renewal_date: editForm.renewal_date || null,
    };
    await fetch(`${SB_URL}/rest/v1/stores?id=eq.${editStore.id}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setStores(prev => prev.map(s => s.id === editStore.id ? { ...s, ...body } : s));
    setSavingEdit(false);
    setEditStore(null);
    setEditForm(null);
  }

  async function addPlan() {
    if (!newPlan.name.trim()) return;
    setSavingPlan(true);
    const res = await fetch(`${SB_URL}/rest/v1/subscription_plans`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        name: newPlan.name.trim(),
        price: Number(newPlan.price) || 0,
        currency: newPlan.currency,
        period: newPlan.period,
        sort_order: plans.length,
      })
    });
    const created = await res.json();
    if (Array.isArray(created) && created[0]) {
      setPlans(prev => [...prev, created[0]]);
    }
    setNewPlan(emptyPlan);
    setSavingPlan(false);
  }

  function startEditPlan(plan: PlanRow) {
    setEditPlanId(plan.id);
    setEditPlanForm({ name: plan.name, price: plan.price, currency: plan.currency, period: plan.period, is_active: plan.is_active });
  }

  async function saveEditPlan(id: string) {
    if (!editPlanForm) return;
    await fetch(`${SB_URL}/rest/v1/subscription_plans?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editPlanForm.name,
        price: Number(editPlanForm.price) || 0,
        currency: editPlanForm.currency,
        period: editPlanForm.period,
        is_active: editPlanForm.is_active,
      })
    });
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...editPlanForm, price: Number(editPlanForm.price) || 0 } : p));
    setEditPlanId(null);
    setEditPlanForm(null);
  }

  async function confirmDeletePlan() {
    if (!deletePlanId) return;
    await fetch(`${SB_URL}/rest/v1/subscription_plans?id=eq.${deletePlanId}`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    setPlans(prev => prev.filter(p => p.id !== deletePlanId));
    setDeletePlanId(null);
  }

  // totals grouped by currency
  const totalsByCurrency = stores.reduce((acc: Record<string, { collected: number; pending: number }>, s) => {
    const cur = s.subscription_currency || 'USD';
    const price = s.subscription_price || 0;
    if (!acc[cur]) acc[cur] = { collected: 0, pending: 0 };
    if (s.subscription_paid) acc[cur].collected += price; else acc[cur].pending += price;
    return acc;
  }, {});
  const formatTotals = (key: 'collected' | 'pending') =>
    Object.entries(totalsByCurrency)
      .filter(([, v]) => v[key] > 0)
      .map(([cur, v]) => `${currencySymbol[cur] || cur}${v[key]}`)
      .join(' + ') || '0';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{isAr ? 'الاشتراكات' : 'Subscriptions'}</h2>
          <p className="text-sm text-muted-foreground">{stores.length} {isAr ? 'اشتراك' : 'subscriptions'}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/10" onClick={() => setShowPlans(true)}>
          <Settings className="w-3.5 h-3.5" />
          {isAr ? 'إدارة الخطط' : 'Manage Plans'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { titleAr: 'المبالغ المحصلة', titleEn: 'Collected', value: formatTotals('collected'), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { titleAr: 'المبالغ المستحقة', titleEn: 'Pending', value: formatTotals('pending'), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { titleAr: 'إجمالي الاشتراكات', titleEn: 'Total', value: stores.length.toString(), icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map((s, i) => (
          <motion.div key={s.titleAr} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? s.titleAr : s.titleEn}</p>
                  <p className="text-xl font-bold text-foreground font-mono">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 gap-2">
              <span className="text-4xl">💳</span>
              <p className="text-sm">{isAr ? 'لا توجد اشتراكات بعد' : 'No subscriptions yet'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground/60">
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الخطة' : 'Plan'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'السعر' : 'Price'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'حالة الاشتراك' : 'Status'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'تاريخ التسجيل' : 'Registered'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'تاريخ التجديد' : 'Renewal'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'الدفع' : 'Payment'}</th>
                    <th className="text-start px-6 py-3.5 font-medium">{isAr ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store, i) => (
                    <motion.tr key={store.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-border/40 hover:bg-white/[0.025] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.owner_email || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium bg-background px-2.5 py-1 rounded-full text-muted-foreground">
                          {store.subscription_plan || (isAr ? 'غير محدد' : 'Not set')}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-foreground">
                        {store.subscription_price != null
                          ? `${currencySymbol[store.subscription_currency || 'USD'] || store.subscription_currency}${store.subscription_price}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          store.subscription_status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                            : store.subscription_status === 'trial'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                              : 'bg-red-500/15 text-red-400 border-red-500/25'
                        }`}>
                          {store.subscription_status === 'active'
                            ? <><CheckCircle2 className="w-3 h-3" />{isAr ? 'نشط' : 'Active'}</>
                            : store.subscription_status === 'trial'
                              ? <>{isAr ? 'تجريبي' : 'Trial'}</>
                              : <><AlertTriangle className="w-3 h-3" />{isAr ? 'منتهي' : 'Expired'}</>
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {store.join_date ? store.join_date.slice(0, 10) : (store.created_at ? store.created_at.slice(0, 10) : '—')}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {store.renewal_date ? store.renewal_date.slice(0, 10) : '—'}
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
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm"
                            className="h-7 text-xs border-white/10 bg-transparent text-foreground hover:bg-white/5"
                            onClick={() => openEdit(store)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
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

      {/* Edit subscription dialog */}
      <Dialog open={!!editStore} onOpenChange={(o) => { if (!o) { setEditStore(null); setEditForm(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? `تعديل اشتراك — ${editStore?.name}` : `Edit Subscription — ${editStore?.name}`}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>{isAr ? 'نوع الاشتراك (الخطة)' : 'Plan'}</Label>
                <Select value={editForm.subscription_plan} onValueChange={applyPlanToForm}>
                  <SelectTrigger><SelectValue placeholder={isAr ? 'اختر خطة' : 'Select plan'} /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name} — {currencySymbol[p.currency] || p.currency}{p.price}</SelectItem>
                    ))}
                    {editForm.subscription_plan && !plans.some(p => p.name === editForm.subscription_plan) && (
                      <SelectItem value={editForm.subscription_plan}>{editForm.subscription_plan} ({isAr ? 'مخصص' : 'custom'})</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-1.5"
                  placeholder={isAr ? 'أو اكتب اسم خطة مخصصة...' : 'Or type a custom plan name...'}
                  value={editForm.subscription_plan}
                  onChange={e => setEditForm((f: any) => ({ ...f, subscription_plan: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isAr ? 'السعر' : 'Price'}</Label>
                  <Input type="number" value={editForm.subscription_price}
                    onChange={e => setEditForm((f: any) => ({ ...f, subscription_price: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{isAr ? 'العملة' : 'Currency'}</Label>
                  <Select value={editForm.subscription_currency} onValueChange={v => setEditForm((f: any) => ({ ...f, subscription_currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{isAr ? 'حالة الاشتراك' : 'Subscription status'}</Label>
                <Select value={editForm.subscription_status} onValueChange={v => setEditForm((f: any) => ({ ...f, subscription_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">{isAr ? 'تجريبي' : 'Trial'}</SelectItem>
                    <SelectItem value="active">{isAr ? 'نشط' : 'Active'}</SelectItem>
                    <SelectItem value="expired">{isAr ? 'منتهي' : 'Expired'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isAr ? 'تاريخ التسجيل' : 'Registration date'}</Label>
                  <Input type="date" value={editForm.join_date}
                    onChange={e => setEditForm((f: any) => ({ ...f, join_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{isAr ? 'تاريخ التجديد' : 'Renewal date'}</Label>
                  <Input type="date" value={editForm.renewal_date}
                    onChange={e => setEditForm((f: any) => ({ ...f, renewal_date: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5">
                <Label className="cursor-pointer">{isAr ? 'تم الدفع؟' : 'Paid?'}</Label>
                <Switch checked={editForm.subscription_paid}
                  onCheckedChange={v => setEditForm((f: any) => ({ ...f, subscription_paid: v }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditStore(null); setEditForm(null); }}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plans manager dialog */}
      <Dialog open={showPlans} onOpenChange={setShowPlans}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAr ? 'إدارة خطط الاشتراك' : 'Manage Subscription Plans'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {plans.map(plan => (
              <div key={plan.id} className="border border-border rounded-lg p-3">
                {editPlanId === plan.id && editPlanForm ? (
                  <div className="space-y-2">
                    <Input value={editPlanForm.name} onChange={e => setEditPlanForm((f: any) => ({ ...f, name: e.target.value }))} placeholder={isAr ? 'اسم الخطة' : 'Plan name'} />
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="number" value={editPlanForm.price} onChange={e => setEditPlanForm((f: any) => ({ ...f, price: e.target.value }))} placeholder={isAr ? 'السعر' : 'Price'} />
                      <Select value={editPlanForm.currency} onValueChange={v => setEditPlanForm((f: any) => ({ ...f, currency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={editPlanForm.period} onValueChange={v => setEditPlanForm((f: any) => ({ ...f, period: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">{isAr ? 'تجريبي' : 'Trial'}</SelectItem>
                          <SelectItem value="monthly">{isAr ? 'شهري' : 'Monthly'}</SelectItem>
                          <SelectItem value="yearly">{isAr ? 'سنوي' : 'Yearly'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={editPlanForm.is_active} onCheckedChange={v => setEditPlanForm((f: any) => ({ ...f, is_active: v }))} />
                        <Label className="text-xs text-muted-foreground">{isAr ? 'مفعّلة' : 'Active'}</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditPlanId(null); setEditPlanForm(null); }}>
                          <X className="w-3 h-3" />
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveEditPlan(plan.id)}>
                          {isAr ? 'حفظ' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}{!plan.is_active && <span className="text-xs text-muted-foreground ms-2">({isAr ? 'غير مفعّلة' : 'inactive'})</span>}</p>
                      <p className="text-xs text-muted-foreground font-mono">{currencySymbol[plan.currency] || plan.currency}{plan.price} · {plan.period === 'yearly' ? (isAr ? 'سنوي' : 'yearly') : plan.period === 'monthly' ? (isAr ? 'شهري' : 'monthly') : (isAr ? 'تجريبي' : 'trial')}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-white/10" onClick={() => startEditPlan(plan)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-white/10 text-red-400 hover:border-red-500/30" onClick={() => setDeletePlanId(plan.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{isAr ? 'لا توجد خطط بعد' : 'No plans yet'}</p>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">{isAr ? 'إضافة خطة جديدة' : 'Add new plan'}</Label>
            <Input value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} placeholder={isAr ? 'مثال: سنوي - مصر' : 'e.g. Yearly - Egypt'} />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" value={newPlan.price} onChange={e => setNewPlan(p => ({ ...p, price: e.target.value }))} placeholder={isAr ? 'السعر' : 'Price'} />
              <Select value={newPlan.currency} onValueChange={v => setNewPlan(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={newPlan.period} onValueChange={v => setNewPlan(p => ({ ...p, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">{isAr ? 'تجريبي' : 'Trial'}</SelectItem>
                  <SelectItem value="monthly">{isAr ? 'شهري' : 'Monthly'}</SelectItem>
                  <SelectItem value="yearly">{isAr ? 'سنوي' : 'Yearly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gap-1.5" size="sm" onClick={addPlan} disabled={savingPlan || !newPlan.name.trim()}>
              {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {isAr ? 'إضافة خطة' : 'Add Plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePlanId} onOpenChange={(o) => !o && setDeletePlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف الخطة؟' : 'Delete plan?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? 'هذا الإجراء لا يمكن التراجع عنه. المتاجر المرتبطة بهذه الخطة تحتفظ بقيمتها الحالية لكن الخطة لن تظهر في القائمة بعد الآن.' : 'This cannot be undone. Stores already on this plan keep their current values but the plan will no longer appear in the list.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePlan} className="bg-red-500 hover:bg-red-600">
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
