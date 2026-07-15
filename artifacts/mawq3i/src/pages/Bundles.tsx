import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Bundle, BundleItem, Product } from '@/data/mockData';
import { getBundles, addBundle, updateBundle, deleteBundle, getProducts } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, Boxes, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DraftBundle = {
  id?: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  imageUrl: string;
  price: string;
  currency: 'ILS' | 'SAR';
  status: 'visible' | 'hidden';
  items: BundleItem[];
};

const emptyDraft: DraftBundle = { nameAr: '', nameEn: '', descAr: '', imageUrl: '', price: '', currency: 'ILS', status: 'visible', items: [] };

export default function Bundles() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftBundle>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStore?.id) return;
    Promise.all([
      getBundles(currentStore.id, isAdminMode),
      getProducts(currentStore.id, isAdminMode),
    ]).then(([b, p]) => {
      setBundles(b);
      setProducts(p);
      setLoading(false);
    });
  }, [currentStore?.id]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const originalTotal = useMemo(
    () => draft.items.reduce((sum, it) => {
      const p = productsById.get(it.productId);
      return sum + (p ? p.price * it.qty : 0);
    }, 0),
    [draft.items, productsById]
  );

  const openAdd = () => {
    setDraft({ ...emptyDraft, currency: currentStore?.currency || 'ILS' });
    setDialogOpen(true);
  };

  const openEdit = (b: Bundle) => {
    setDraft({
      id: b.id, nameAr: b.nameAr, nameEn: b.nameEn, descAr: b.descAr || '',
      imageUrl: b.imageUrl || '', price: String(b.price), currency: b.currency,
      status: b.status, items: b.productIds,
    });
    setDialogOpen(true);
  };

  const toggleProduct = (productId: string) => {
    setDraft(d => {
      const exists = d.items.find(i => i.productId === productId);
      if (exists) return { ...d, items: d.items.filter(i => i.productId !== productId) };
      return { ...d, items: [...d.items, { productId, qty: 1 }] };
    });
  };

  const setQty = (productId: string, qty: number) => {
    setDraft(d => ({ ...d, items: d.items.map(i => i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i) }));
  };

  const save = async () => {
    if (!currentStore?.id) return;
    const name = draft.nameAr.trim();
    const price = parseFloat(draft.price);
    if (!name || !draft.items.length || isNaN(price) || price <= 0) {
      toast({ title: isAr ? 'تحقق من الاسم، المنتجات، والسعر' : 'Check name, products, and price', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      storeId: currentStore.id,
      nameAr: name,
      nameEn: draft.nameEn.trim() || name,
      descAr: draft.descAr.trim(),
      imageUrl: draft.imageUrl.trim(),
      productIds: draft.items,
      price,
      currency: draft.currency,
      status: draft.status,
    };
    if (draft.id) {
      const ok = await updateBundle(draft.id, payload, isAdminMode);
      if (ok) {
        setBundles(prev => prev.map(b => b.id === draft.id ? { ...b, ...payload } as Bundle : b));
        toast({ title: isAr ? 'تم تحديث الباكج' : 'Bundle updated' });
      }
    } else {
      const created = await addBundle(payload, isAdminMode);
      if (created) {
        setBundles(prev => [created, ...prev]);
        toast({ title: isAr ? 'تم إنشاء الباكج' : 'Bundle created' });
      }
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const toggleVisibility = async (b: Bundle) => {
    const newStatus = b.status === 'visible' ? 'hidden' : 'visible';
    setBundles(prev => prev.map(x => x.id === b.id ? { ...x, status: newStatus } : x));
    await updateBundle(b.id, { status: newStatus }, isAdminMode);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setBundles(prev => prev.filter(b => b.id !== deleteId));
    await deleteBundle(deleteId, isAdminMode);
    setDeleteId(null);
  };

  const currencySymbol = (c: string) => (c === 'SAR' ? '﷼' : '₪');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'الباكجات' : 'Bundles'}</h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? 'اجمع أكثر من منتج بسعر واحد لزيادة قيمة السلة' : 'Bundle products together at one price to boost cart value'}
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={openAdd} className="gap-2 shadow-[0_0_15px_rgba(82,255,63,0.1)] hover:shadow-[0_0_20px_rgba(82,255,63,0.2)] transition-all" data-testid="button-add-bundle">
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة باكج' : 'Add Bundle'}
          </Button>
        </motion.div>
      </div>

      {bundles.length === 0 ? (
        <Card className="bg-card border-border/50 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Boxes className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">{isAr ? 'لا توجد باكجات بعد' : 'No bundles yet'}</p>
            <p className="text-xs opacity-60">{isAr ? 'اضغط "إضافة باكج" لتجميع أول باكج' : 'Click "Add Bundle" to create your first one'}</p>
            <Button size="sm" className="mt-2 gap-2" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" />
              {isAr ? 'إضافة باكج' : 'Add Bundle'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map(b => {
            const names = b.productIds.map(it => productsById.get(it.productId)?.nameAr).filter(Boolean);
            const img = b.imageUrl || (b.productIds.length ? productsById.get(b.productIds[0].productId)?.imageUrl : '') || '';
            return (
              <Card key={b.id} className="bg-card border-border/50 shadow-lg overflow-hidden">
                <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                  {img ? <img src={img} alt={b.nameAr} className="w-full h-full object-cover" /> : <Boxes className="w-10 h-10 text-muted-foreground/30" />}
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{b.nameAr}</h3>
                    <Switch checked={b.status === 'visible'} onCheckedChange={() => toggleVisibility(b)} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{names.join(' + ')}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-mono font-semibold text-primary">{b.price} {currencySymbol(b.currency)}</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="icon" className="h-7 w-7 border-border/50" onClick={() => openEdit(b)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 border-border/50 hover:border-red-500/50 hover:text-red-400" onClick={() => setDeleteId(b.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border/50 sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? (isAr ? 'تعديل الباكج' : 'Edit Bundle') : (isAr ? 'إضافة باكج جديد' : 'Add New Bundle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isAr ? 'اسم الباكج (عربي)' : 'Bundle name (Arabic)'}</Label>
                <Input value={draft.nameAr} onChange={e => setDraft(d => ({ ...d, nameAr: e.target.value }))} className="bg-background/50 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isAr ? 'اسم الباكج (إنجليزي)' : 'Bundle name (English)'}</Label>
                <Input value={draft.nameEn} onChange={e => setDraft(d => ({ ...d, nameEn: e.target.value }))} className="bg-background/50 border-border/50" dir="ltr" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'اختر المنتجات وحدد الكمية' : 'Select products & quantities'}</Label>
              <div className="border border-border/50 rounded-lg max-h-52 overflow-y-auto divide-y divide-border/30">
                {products.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">{isAr ? 'لا توجد منتجات في المتجر بعد' : 'No products in this store yet'}</p>
                )}
                {products.map(p => {
                  const item = draft.items.find(i => i.productId === p.id);
                  const checked = !!item;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={checked} onChange={() => toggleProduct(p.id)} className="w-4 h-4 accent-primary" />
                      <span className="flex-1 text-xs truncate">{p.nameAr || p.nameEn}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{p.price} {currencySymbol(p.currency)}</span>
                      {checked && (
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(p.id, (item?.qty || 1) - 1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-5 text-center text-xs font-mono">{item?.qty}</span>
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(p.id, (item?.qty || 1) + 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isAr ? 'سعر الباكج' : 'Bundle price'}</Label>
                <Input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isAr ? 'العملة' : 'Currency'}</Label>
                <Select value={draft.currency} onValueChange={v => setDraft(d => ({ ...d, currency: v as 'ILS' | 'SAR' }))}>
                  <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ILS">₪ ILS</SelectItem>
                    <SelectItem value="SAR">﷼ SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draft.items.length > 0 && (
              <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                {isAr
                  ? `مجموع أسعار المنتجات منفردة: ${originalTotal.toFixed(0)} ${currencySymbol(draft.currency)}` +
                    (parseFloat(draft.price) > 0 && parseFloat(draft.price) < originalTotal
                      ? ` — التوفير للزبون: ${(originalTotal - parseFloat(draft.price)).toFixed(0)} ${currencySymbol(draft.currency)}`
                      : '')
                  : `Sum of individual prices: ${originalTotal.toFixed(0)} ${currencySymbol(draft.currency)}` +
                    (parseFloat(draft.price) > 0 && parseFloat(draft.price) < originalTotal
                      ? ` — Customer saves: ${(originalTotal - parseFloat(draft.price)).toFixed(0)} ${currencySymbol(draft.currency)}`
                      : '')}
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'وصف مختصر (اختياري)' : 'Short description (optional)'}</Label>
              <Input value={draft.descAr} onChange={e => setDraft(d => ({ ...d, descAr: e.target.value }))} className="bg-background/50 border-border/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'رابط صورة الباكج (اختياري — بدون ما يعرض صورة أول منتج)' : 'Bundle image URL (optional — defaults to first product image)'}</Label>
              <Input value={draft.imageUrl} onChange={e => setDraft(d => ({ ...d, imageUrl: e.target.value }))} className="bg-background/50 border-border/50" dir="ltr" placeholder="https://..." />
            </div>

            <div className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2.5">
              <Label className="text-xs">{isAr ? 'ظاهر على المتجر' : 'Visible on storefront'}</Label>
              <Switch checked={draft.status === 'visible'} onCheckedChange={c => setDraft(d => ({ ...d, status: c ? 'visible' : 'hidden' }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />}
              {isAr ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف الباكج' : 'Delete Bundle'}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isAr ? 'هل أنت متأكد من حذف هذا الباكج؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50">{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isAr ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
