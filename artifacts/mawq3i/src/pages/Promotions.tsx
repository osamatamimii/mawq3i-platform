import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase, adminRest } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Tag, Calendar, ToggleLeft, ToggleRight, X, Pencil, ShieldCheck } from 'lucide-react';

interface Promotion {
  id: string;
  title_ar: string;
  title_en?: string;
  subtitle_ar?: string;
  discount_text?: string;
  badge_color: string;
  text_color?: string;
  expires_at?: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  title_ar: '', title_en: '', subtitle_ar: '',
  discount_text: '', badge_color: '#C21F1F', text_color: '#FFFFFF', expires_at: ''
};

export default function Promotions() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loadPromos = () => {
    if (!currentStore?.id) { setLoading(false); return; }
    if (isAdminMode) {
      adminRest.select('promotions',
        `store_id=eq.${currentStore.id}&order=created_at.desc`
      ).then(data => { setPromos(data || []); setLoading(false); });
    } else {
      supabase.from('promotions')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setPromos((data as any) || []); setLoading(false); });
    }
  };

  useEffect(loadPromos, [currentStore?.id, isAdminMode]);

  const openNewForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEditForm = (promo: Promotion) => {
    setEditingId(promo.id);
    setForm({
      title_ar: promo.title_ar || '',
      title_en: promo.title_en || '',
      subtitle_ar: promo.subtitle_ar || '',
      discount_text: promo.discount_text || '',
      badge_color: promo.badge_color || '#C21F1F',
      text_color: promo.text_color || '#FFFFFF',
      expires_at: promo.expires_at ? promo.expires_at.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title_ar || !currentStore) return;
    setSaving(true);
    const body = {
      store_id: currentStore.id,
      title_ar: form.title_ar, title_en: form.title_en || null,
      subtitle_ar: form.subtitle_ar || null,
      discount_text: form.discount_text || null,
      badge_color: form.badge_color,
      text_color: form.text_color,
      expires_at: form.expires_at || null,
    };

    if (editingId) {
      if (isAdminMode) {
        await adminRest.update('promotions', `id=eq.${editingId}`, body);
      } else {
        await supabase.from('promotions').update(body).eq('id', editingId);
      }
      setPromos(prev => prev.map(p => p.id === editingId ? { ...p, ...body } as Promotion : p));
      setSaving(false);
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      setShowForm(false);
      toast({ title: isAr ? 'تم تحديث العرض' : 'Promotion updated' });
      return;
    }

    let data: any = null;
    if (isAdminMode) {
      data = await adminRest.insert('promotions', { ...body, is_active: true });
    } else {
      const res = await supabase.from('promotions').insert([{ ...body, is_active: true }]).select().single();
      data = res.error ? null : res.data;
    }
    setSaving(false);
    if (data) {
      setPromos(prev => [data, ...prev]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      toast({ title: isAr ? 'تم إضافة العرض' : 'Promotion added' });
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (isAdminMode) {
      await adminRest.update('promotions', `id=eq.${id}`, { is_active: !current });
    } else {
      await supabase.from('promotions').update({ is_active: !current }).eq('id', id);
    }
    setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
  };

  const deletePromo = async (id: string) => {
    if (isAdminMode) {
      await adminRest.delete('promotions', `id=eq.${id}`);
    } else {
      await supabase.from('promotions').delete().eq('id', id);
    }
    setPromos(prev => prev.filter(p => p.id !== id));
    toast({ title: isAr ? 'تم حذف العرض' : 'Promotion deleted' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'العروض والبانرات' : 'Promotions & Banners'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'تظهر فوق المنتجات في موقعك' : 'Shown above products on your site'}</p>
        </div>
        <Button onClick={() => (showForm ? setShowForm(false) : openNewForm())} className="gap-2 h-9">
          <Plus className="w-4 h-4" />
          {isAr ? 'عرض جديد' : 'New Promo'}
        </Button>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="bg-card border-border/50 shadow-lg">
              <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {editingId ? (isAr ? 'تعديل العرض' : 'Edit Promotion') : (isAr ? 'إضافة عرض جديد' : 'Add New Promotion')}
                </CardTitle>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'عنوان العرض (عربي)' : 'Title (Arabic)'} *</Label>
                    <Input value={form.title_ar} onChange={e => set('title_ar', e.target.value)}
                      placeholder={isAr ? 'مثال: تخفيضات نهاية الموسم' : 'e.g. End of Season Sale'}
                      className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'نص التخفيض' : 'Discount Text'}</Label>
                    <Input value={form.discount_text} onChange={e => set('discount_text', e.target.value)}
                      placeholder={isAr ? 'مثال: خصم 30%' : 'e.g. 30% OFF'}
                      className="bg-background/50 border-border/50" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{isAr ? 'وصف إضافي' : 'Subtitle'}</Label>
                  <Input value={form.subtitle_ar} onChange={e => set('subtitle_ar', e.target.value)}
                    placeholder={isAr ? 'مثال: على جميع المنتجات حتى نهاية الشهر' : 'e.g. On all products until end of month'}
                    className="bg-background/50 border-border/50" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'لون الخلفية' : 'Background Color'}</Label>
                    <div className="flex gap-2">
                      <input type="color" value={form.badge_color} onChange={e => set('badge_color', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-border/50 bg-transparent" />
                      <Input value={form.badge_color} onChange={e => set('badge_color', e.target.value)}
                        className="bg-background/50 border-border/50 font-mono" dir="ltr" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'لون النص' : 'Text Color'}</Label>
                    <div className="flex gap-2">
                      <input type="color" value={form.text_color} onChange={e => set('text_color', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-border/50 bg-transparent" />
                      <Input value={form.text_color} onChange={e => set('text_color', e.target.value)}
                        className="bg-background/50 border-border/50 font-mono" dir="ltr" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</Label>
                    <Input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)}
                      className="bg-background/50 border-border/50" dir="ltr" />
                  </div>
                </div>

                {/* Live Preview — mirrors the real storefront banner */}
                {form.title_ar && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isAr ? 'معاينة حية' : 'Live Preview'}</Label>
                    <div
                      dir="rtl"
                      className="relative overflow-hidden rounded-xl px-6 py-7 flex items-center justify-between gap-4 flex-wrap"
                      style={{
                        background: `linear-gradient(135deg, ${form.badge_color}dd, ${form.badge_color} 55%, ${form.badge_color}bb)`,
                        boxShadow: '0 20px 40px -16px rgba(0,0,0,.4)'
                      }}
                    >
                      <div
                        className="w-16 h-20 flex-shrink-0 flex flex-col items-center justify-center rounded-lg -rotate-6"
                        style={{
                          background: form.text_color,
                          boxShadow: 'inset 0 2px 6px rgba(255,255,255,.5), 0 10px 20px -8px rgba(0,0,0,.5)'
                        }}
                      >
                        <Tag className="w-6 h-6" style={{ color: form.badge_color }} fill={form.badge_color} strokeWidth={0} />
                      </div>
                      <div className="flex-1 min-w-[160px] flex flex-col items-end text-right gap-1.5">
                        {form.discount_text && (
                          <span
                            className="text-xs font-extrabold px-3 py-1 rounded-full"
                            style={{ background: `${form.text_color}22`, border: `1px solid ${form.text_color}55`, color: form.text_color }}
                          >
                            {form.discount_text}
                          </span>
                        )}
                        <p className="font-black text-xl leading-snug" style={{ color: form.text_color }}>{form.title_ar}</p>
                        {form.subtitle_ar && <p className="text-xs font-medium opacity-80" style={{ color: form.text_color }}>{form.subtitle_ar}</p>}
                        <div className="flex items-center gap-1 text-[10px] font-bold opacity-70 mt-1" style={{ color: form.text_color }}>
                          <ShieldCheck className="w-3 h-3" /> {isAr ? 'جودة مضمونة' : 'Quality guaranteed'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={handleSave} disabled={saving || !form.title_ar} className="w-full">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{isAr ? 'جاري الحفظ...' : 'Saving...'}</>
                    : editingId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إضافة العرض' : 'Add Promotion')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promos List */}
      {promos.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-16 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">{isAr ? 'لا توجد عروض بعد' : 'No promotions yet'}</p>
            <p className="text-xs text-muted-foreground mt-1 opacity-60">{isAr ? 'أضف عرضاً يظهر فوق منتجاتك' : 'Add a promotion to show above your products'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map(promo => (
            <motion.div key={promo.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className={`bg-card border-border/50 shadow-sm transition-opacity ${!promo.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
                    style={{ background: `linear-gradient(135deg, ${promo.badge_color}dd, ${promo.badge_color})` }}>
                    <Tag className="w-5 h-5" style={{ color: promo.text_color || '#fff' }} fill={promo.text_color || '#fff'} strokeWidth={0} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{promo.title_ar}</p>
                      {promo.discount_text && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: promo.badge_color + '20', color: promo.badge_color }}>
                          {promo.discount_text}
                        </span>
                      )}
                    </div>
                    {promo.subtitle_ar && <p className="text-xs text-muted-foreground mt-0.5 truncate">{promo.subtitle_ar}</p>}
                    {promo.expires_at && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{isAr ? 'ينتهي:' : 'Expires:'} {promo.expires_at}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEditForm(promo)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(promo.id, promo.is_active)}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      {promo.is_active
                        ? <ToggleRight className="w-6 h-6 text-primary" />
                        : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <button onClick={() => deletePromo(promo.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
