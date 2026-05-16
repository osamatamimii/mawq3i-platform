import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { getProducts, updateProduct, deleteProduct } from '@/lib/db';
import { uploadProductImage } from '@/lib/storage';
import { Product, ProductVariant } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Loader2, ImageIcon, X, Plus, Trash2 } from 'lucide-react';

export default function EditProduct() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Variant image uploads
  const [variantFiles, setVariantFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    if (!currentStore?.id) return;
    getProducts(currentStore.id, isAdminMode).then(products => {
      const found = products.find(p => p.id === params.id);
      if (found) {
        setProduct(found);
        setImagePreview(found.imageUrl ?? '');
      }
      setLoading(false);
    });
  }, [params.id, currentStore?.id]);

  const set = (key: keyof Product, value: any) =>
    setProduct(p => p ? { ...p, [key]: value } : p);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  // Variants
  const addVariant = () => {
    const newV: ProductVariant = { id: Date.now().toString(), label: '', imageUrl: '', stock: 0 };
    set('variants', [...(product?.variants ?? []), newV]);
  };

  const updateVariant = (id: string, key: keyof ProductVariant, value: any) =>
    set('variants', (product?.variants ?? []).map(v => v.id === id ? { ...v, [key]: value } : v));

  const removeVariant = (id: string) =>
    set('variants', (product?.variants ?? []).filter(v => v.id !== id));

  const handleVariantFile = (variantId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setVariantFiles(prev => ({ ...prev, [variantId]: file }));
    const reader = new FileReader();
    reader.onload = e => updateVariant(variantId, 'imageUrl', e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !currentStore) return;
    setSaving(true);

    // Upload main image if changed
    let imageUrl = product.imageUrl ?? '';
    if (imageFile) {
      const uploaded = await uploadProductImage(imageFile, currentStore.id);
      if (uploaded) imageUrl = uploaded;
    }

    // Upload variant images
    const updatedVariants = await Promise.all(
      (product.variants ?? []).map(async v => {
        if (variantFiles[v.id]) {
          const uploaded = await uploadProductImage(variantFiles[v.id], currentStore.id);
          return { ...v, imageUrl: uploaded ?? v.imageUrl };
        }
        return v;
      })
    );

    await updateProduct(product.id, { ...product, imageUrl, variants: updatedVariants });
    setSaving(false);
    toast({ title: isAr ? 'تم الحفظ' : 'Saved', description: isAr ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully' });
    setLocation('/dashboard/products');
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!product) return <div className="text-center py-20 text-muted-foreground">{isAr ? 'المنتج غير موجود' : 'Product not found'}</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation('/dashboard/products')}>
          <BackIcon className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'تعديل المنتج' : 'Edit Product'}</h2>
          <p className="text-xs text-muted-foreground">{product.nameAr}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'معلومات المنتج' : 'Product Information'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'} <span className="text-red-400">*</span></Label>
                <Input value={product.nameAr} onChange={e => set('nameAr', e.target.value)} className="bg-background/50 border-border/50" required />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                <Input value={product.nameEn} onChange={e => set('nameEn', e.target.value)} className="bg-background/50 border-border/50" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea value={product.descAr} onChange={e => set('descAr', e.target.value)} className="bg-background/50 border-border/50 resize-none h-20" />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea value={product.descEn} onChange={e => set('descEn', e.target.value)} className="bg-background/50 border-border/50 resize-none h-20" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'السعر' : 'Price'} <span className="text-red-400">*</span></Label>
                <Input type="number" min="0" value={product.price} onChange={e => set('price', Number(e.target.value))} className="bg-background/50 border-border/50 font-mono" required />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'العملة' : 'Currency'}</Label>
                <Select value={product.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ILS">₪ ILS</SelectItem>
                    <SelectItem value="SAR">﷼ SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'المخزون' : 'Stock'}</Label>
                <Input type="number" min="0" value={product.stock} onChange={e => set('stock', Number(e.target.value))} className="bg-background/50 border-border/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'الفئة' : 'Category'}</Label>
                <Input value={product.category} onChange={e => set('category', e.target.value)} className="bg-background/50 border-border/50" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={product.status === 'visible'} onCheckedChange={v => set('status', v ? 'visible' : 'hidden')} />
              <Label>{isAr ? (product.status === 'visible' ? 'ظاهر' : 'مخفي') : (product.status === 'visible' ? 'Visible' : 'Hidden')}</Label>
            </div>
          </CardContent>
        </Card>

        {/* Main Image */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'الصورة الرئيسية' : 'Main Image'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/40'}`}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                  <div className="text-start">
                    <p className="text-sm font-medium text-primary">{isAr ? 'انقر لتغيير الصورة' : 'Click to change image'}</p>
                    <p className="text-xs text-muted-foreground">{imageFile ? imageFile.name : isAr ? 'الصورة الحالية' : 'Current image'}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm">{isAr ? 'اسحب صورة أو انقر للرفع' : 'Drag or click to upload'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Variants */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'المتغيرات (ألوان، أحجام...)' : 'Variants (Colors, Sizes...)'}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addVariant} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs h-7">
              <Plus className="w-3 h-3" />{isAr ? 'إضافة متغير' : 'Add Variant'}
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {(!product.variants || product.variants.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4">{isAr ? 'لا توجد متغيرات — أضف ألوان أو أحجام مختلفة' : 'No variants — add colors or sizes'}</p>
            ) : product.variants.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-background/30 rounded-lg border border-border/30">
                {/* Variant image */}
                <div
                  className="w-12 h-12 rounded-lg border border-border/50 overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary/50 transition-colors bg-muted"
                  onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file'; inp.accept = 'image/*';
                    inp.onchange = (e: any) => { const f = e.target.files?.[0]; if (f) handleVariantFile(v.id, f); };
                    inp.click();
                  }}
                >
                  {v.imageUrl ? <img src={v.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="w-4 h-4 m-auto text-muted-foreground mt-3" />}
                </div>
                <Input
                  value={v.label}
                  onChange={e => updateVariant(v.id, 'label', e.target.value)}
                  placeholder={isAr ? 'مثال: أسود، M، XL' : 'e.g. Black, M, XL'}
                  className="bg-background/50 border-border/50 flex-1 h-8 text-sm"
                />
                <Input
                  type="number" min="0"
                  value={v.stock ?? 0}
                  onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))}
                  placeholder={isAr ? 'مخزون' : 'Stock'}
                  className="bg-background/50 border-border/50 w-20 h-8 text-sm font-mono"
                />
                <button type="button" onClick={() => removeVariant(v.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full h-11 font-medium">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{isAr ? 'جاري الحفظ...' : 'Saving...'}</> : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
        </Button>
      </form>
    </motion.div>
  );
}
