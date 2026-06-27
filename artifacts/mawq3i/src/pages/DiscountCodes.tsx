import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Tag, Copy, ToggleLeft, ToggleRight, X, Zap, Percent, DollarSign } from 'lucide-react';

interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
}

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function DiscountCodes() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: randomCode(),
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    min_order: '',
    max_uses: '',
    expires_at: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!currentStore?.id) { setLoading(false); return; }
    supabase.from('discount_codes')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCodes(data || []); setLoading(false); });
  }, [currentStore?.id]);

  const handleSave = async () => {
    if (!form.code || !form.value || !currentStore) return;
    setSaving(true);
    const body = {
      store_id: currentStore.id,
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: parseFloat(form.value),
      min_order: form.min_order ? parseFloat(form.min_order) : 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at || null,
      is_active: true,
    };
    const { data, error } = await supabase.from('discount_codes').insert([body]).select().single();
    setSaving(false);
    if (!error && data) {
      setCodes(prev => [data, ...prev]);
      setForm({ code: randomCode(), type: 'percentage', value: '', min_order: '', max_uses: '', expires_at: '' });
      setShowForm(false);
      toast({ title: isAr ? '✅ تم إضافة الكود' : '✅ Code added' });
    } else {
      toast({ title: isAr ? 'خطأ في الحفظ' : 'Save error', variant: 'destructive' });
    }
  };

  const toggleCode = async (id: string, current: boolean) => {
    await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id);
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
  };

  const deleteCode = async (id: string) => {
    await supabase.from('discount_codes').delete().eq('id', id);
    setCodes(prev => prev.filter(c => c.id !== id));
    toast({ title: isAr ? 'تم حذف الكود' : 'Code deleted' });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: isAr ? `تم نسخ: ${code}` : `Copied: ${code}` });
  };

  const currency = currentStore?.currency === 'SAR' ? '﷼' : '₪';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'أكواد الخصم' : 'Discount Codes'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'أنشئ أكواد خصم للزبائن' : 'Create discount codes for customers'}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 h-9">
          <Plus className="w-4 h-4" />
          {isAr ? 'كود جديد' : 'New Code'}
        </Button>
      </div>

      {/* Stats */}
      {codes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isAr ? 'إجمالي الأكواد' : 'Total Codes', value: codes.length, icon: Tag },
            { label: isAr ? 'أكواد نشطة' : 'Active', value: codes.filter(c => c.is_active).length, icon: Zap },
            { label: isAr ? 'إجمالي الاستخدام' : 'Total Uses', value: codes.reduce((s, c) => s + c.uses_count, 0), icon: Percent },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold font-mono">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {isAr ? 'إضافة كود خصم' : 'Add Discount Code'}
                </CardTitle>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {/* Code + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'الكود' : 'Code'} *</Label>
                    <div className="flex gap-2">
                      <Input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                        className="bg-background/50 border-border/50 font-mono tracking-widest" dir="ltr" />
                      <Button variant="outline" size="icon" onClick={() => set('code', randomCode())} title={isAr ? 'كود عشوائي' : 'Random'}>
                        <Zap className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'نوع الخصم' : 'Discount Type'}</Label>
                    <div className="flex gap-2">
                      {(['percentage', 'fixed'] as const).map(t => (
                        <button key={t} onClick={() => set('type', t)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${form.type === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                          {t === 'percentage' ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                          {t === 'percentage' ? (isAr ? 'نسبة %' : 'Percent') : (isAr ? 'مبلغ ثابت' : 'Fixed')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isAr ? (form.type === 'percentage' ? 'نسبة الخصم %' : 'مبلغ الخصم') : (form.type === 'percentage' ? 'Discount %' : 'Discount Amount')} *</Label>
                    <Input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                      placeholder={form.type === 'percentage' ? '10' : '50'}
                      className="bg-background/50 border-border/50" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? `حد أدنى للطلب (${currency})` : `Min Order (${currency})`}</Label>
                    <Input type="number" value={form.min_order} onChange={e => set('min_order', e.target.value)}
                      placeholder="0" className="bg-background/50 border-border/50" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'أقصى استخدام' : 'Max Uses'}</Label>
                    <Input type="number" value={form.max_uses} onChange={e => set('max_uses', e.target.value)}
                      placeholder={isAr ? 'غير محدود' : 'Unlimited'} className="bg-background/50 border-border/50" dir="ltr" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{isAr ? 'تاريخ انتهاء الكود' : 'Expiry Date'}</Label>
                  <Input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)}
                    className="bg-background/50 border-border/50 w-48" dir="ltr" />
                </div>

                {/* Preview */}
                {form.code && form.value && (
                  <div className="rounded-xl p-4 bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-lg tracking-widest text-primary">{form.code}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.type === 'percentage' ? `${form.value}%` : `${currency}${form.value}`} {isAr ? 'خصم' : 'off'}
                        {form.min_order ? ` • ${isAr ? 'حد أدنى' : 'min'} ${currency}${form.min_order}` : ''}
                      </p>
                    </div>
                    <Tag className="w-8 h-8 text-primary opacity-30" />
                  </div>
                )}

                <Button onClick={handleSave} disabled={saving || !form.code || !form.value} className="w-full">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{isAr ? 'جاري الحفظ...' : 'Saving...'}</> : (isAr ? 'إضافة الكود' : 'Add Code')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Codes List */}
      {codes.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">{isAr ? 'لا توجد أكواد بعد' : 'No discount codes yet'}</p>
            <p className="text-xs text-muted-foreground mt-1 opacity-60">{isAr ? 'أنشئ أول كود خصم لزبائنك' : 'Create your first discount code'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {codes.map(code => {
            const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
            const isFull = code.max_uses !== null && code.uses_count >= code.max_uses;
            return (
              <motion.div key={code.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className={`bg-card border-border shadow-sm transition-opacity ${(!code.is_active || isExpired || isFull) ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-bold text-base tracking-widest text-primary">{code.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                          {code.type === 'percentage' ? `${code.value}%` : `${currency}${code.value}`} {isAr ? 'خصم' : 'off'}
                        </span>
                        {isExpired && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{isAr ? 'منتهي' : 'Expired'}</span>}
                        {isFull && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{isAr ? 'اكتمل' : 'Full'}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        {code.min_order > 0 && <span>{isAr ? 'حد أدنى:' : 'Min:'} {currency}{code.min_order}</span>}
                        <span>{isAr ? 'استُخدم:' : 'Used:'} {code.uses_count}{code.max_uses ? `/${code.max_uses}` : ''}</span>
                        {code.expires_at && <span>{isAr ? 'ينتهي:' : 'Expires:'} {code.expires_at}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => copyCode(code.code)}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleCode(code.id, code.is_active)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        {code.is_active ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                      <button onClick={() => deleteCode(code.id)}
                        className="p-2 text-muted-foreground hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
