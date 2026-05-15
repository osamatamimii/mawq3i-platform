import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { addProduct } from '@/lib/db';
import { uploadProductImage } from '@/lib/storage';
import { ProductVariant } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Loader2, ImageIcon, X, Plus, Trash2 } from 'lucide-react';

export default function AddProduct() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({ nameAr: '', nameEn: '', descAr: '', descEn: '', price: '', currency: 'ILS', stock: '', category: '' });
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const [dragOver, setDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Variants
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantFiles, setVariantFiles] = useState<Record<string, File>>({});

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addVariant = () => {
    const v: ProductVariant = { id: Date.now().toString(), label: '', imageUrl: '', stock: 0 };
    setVariants(prev => [...prev, v]);
  };

  const updateVariant = (id: string, key: keyof ProductVariant, value: any) =>
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [key]: value } : v));

  const removeVariant = (id: string) =>
    setVariants(prev => prev.filter(v => v.id !== id));

  const handleVariantFile = (variantId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setVariantFiles(prev => ({ ...prev, [variantId]: file }));
    const reader = new FileReader();
    reader.onload = e => updateVariant(variantId, 'imageUrl', e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.price) return;
    if (!currentStore) {
      toast({ title: isAr ? 'خطأ' : 'Error', description: isAr ? 'لم يتم ربط حسابك بمتجر' : 'No store linked', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    // Upload main image
    let imageUrl = '';
    if (imageFile) {
      setUploadProgress(isAr ? 'جاري رفع الصورة...' : 'Uploading image...');
      const uploaded = await uploadProductImage(imageFile, currentStore.id);
      if (uploaded) imageUrl = uploaded;
    }

    // Upload variant images
    const updatedVariants = await Promise.all(
      variants.map(async v => {
        if (variantFiles[v.id]) {
          setUploadProgress(isAr ? `رفع صورة ${v.label}...` : `Uploading ${v.label}...`);
          const uploaded = await uploadProductImage(variantFiles[v.id], currentStore.id);
          return { ...v, imageUrl: uploaded ?? v.imageUrl };
        }
        return v;
      })
    );

    setUploadProgress(isAr ? 'جاري الحفظ...' : 'Saving...');

    const saved = await addProduct({
      nameAr: form.nameAr, nameEn: form.nameEn,
      descAr: form.descAr, descEn: form.descEn,
      price: Number(form.price), currency: form.currency as 'ILS' | 'SAR',
      stock: Number(form.stock) || 0, category: form.category,
      status: 'visible', imageUrl, storeId: currentStore.id,
      variants: updatedVariants,
    });

    setSubmitting(false);
    setUploadProgress('');

    if (saved) {
      toast({ title: isAr ? 'تم إضافة المنتج' : 'Product added', description: isAr ? `تم إضافة "${form.nameAr}" بنجاح` : `"${form.nameEn || form.nameAr}" added successfully` });
      setLocation('/dashboard/products');
    } else {
      toast({ title: isAr ? 'حدث خطأ' : 'Error', description: isAr ? 'يرجى المحاولة مجدداً' : 'Please try again', variant: 'destructive' });
    }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation('/dashboard/products')}>
          <BackIcon className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'إضافة منتج جديد' : 'Add New Product'}</h2>
          <p className="text-xs text-muted-foreground">{currentStore ? (isAr ? `المتجر: ${currentStore.name}` : `Store: ${currentStore.name}`) : (isAr ? 'لم يتم ربط متجر' : 'No store linked')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'معلومات المنتج' : 'Product Information'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'اسم المنتج (عربي)' : 'Name (Arabic)'} <span className="text-red-400">*</span></Label>
                <Input value={form.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder="مثال: هودي أوفر سايز" className="bg-background/50 border-border/50" required />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'اسم المنتج (إنجليزي)' : 'Name (English)'}</Label>
                <Input value={form.nameEn} onChange={e => set('nameEn', e.target.value)} placeholder="e.g. Oversized Hoodie" className="bg-background/50 border-border/50" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea value={form.descAr} onChange={e => set('descAr', e.target.value)} placeholder="وصف المنتج..." className="bg-background/50 border-border/50 resize-none h-20" />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea value={form.descEn} onChange={e => set('descEn', e.target.value)} placeholder="Product description..." className="bg-background/50 border-border/50 resize-none h-20" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{isAr ? 'السعر' : 'Price'} <span className="text-red-400">*</span></Label>
                <Input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" className="bg-background/50 border-border/50 font-mono" required />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'العملة' : 'Currency'}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ILS">₪ ILS</SelectItem>
                    <SelectItem value="SAR">﷼ SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'المخزون الكلي' : 'Total Stock'}</Label>
                <Input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" className="bg-background/50 border-border/50 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'التصنيف' : 'Category'}</Label>
              <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder={isAr ? 'مثال: هوديات، تيشيرتات' : 'e.g. Hoodies, T-Shirts'} className="bg-background/50 border-border/50" />
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
              onClick={() => !imagePreview && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragOver ? 'border-primary bg-primary/10' : imagePreview ? 'border-primary/30 bg-primary/5' : 'border-border/60 hover:border-primary/40 cursor-pointer'}`}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {imagePreview ? (
                <div className="flex items-center gap-6">
                  <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                  <div className="text-start flex-1">
                    <p className="text-sm font-medium text-primary">{isAr ? 'تم اختيار الصورة' : 'Image selected'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{imageFile?.name}</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); clearImage(); }} className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">{isAr ? 'اسحب صورة هنا أو انقر للرفع' : 'Drag image here or click to upload'}</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Variants */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'المتغيرات' : 'Variants'}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'ألوان، أحجام، أو أي تنويعات للمنتج' : 'Colors, sizes, or any product variations'}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addVariant} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs h-7">
              <Plus className="w-3 h-3" />{isAr ? 'إضافة' : 'Add'}
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {variants.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 opacity-60">{isAr ? 'اختياري — أضف ألواناً أو أحجاماً مختلفة لهذا المنتج' : 'Optional — add colors or sizes for this product'}</p>
            ) : variants.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-background/30 rounded-lg border border-border/30">
                <div
                  className="w-12 h-12 rounded-lg border border-border/50 overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary/50 transition-colors bg-muted flex items-center justify-center"
                  onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file'; inp.accept = 'image/*';
                    inp.onchange = (e: any) => { const f = e.target.files?.[0]; if (f) handleVariantFile(v.id, f); };
                    inp.click();
                  }}
                >
                  {v.imageUrl ? <img src={v.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <Input value={v.label} onChange={e => updateVariant(v.id, 'label', e.target.value)} placeholder={isAr ? 'مثال: أسود، M، XL' : 'e.g. Black, M, XL'} className="bg-background/50 border-border/50 flex-1 h-8 text-sm" />
                <Input type="number" min="0" value={v.stock ?? 0} onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))} placeholder={isAr ? 'مخزون' : 'Stock'} className="bg-background/50 border-border/50 w-20 h-8 text-sm font-mono" />
                <button type="button" onClick={() => removeVariant(v.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting || !currentStore} className="w-full h-11 font-medium">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{uploadProgress || (isAr ? 'جاري الحفظ...' : 'Saving...')}</> : (isAr ? 'إضافة المنتج' : 'Add Product')}
        </Button>
      </form>
    </motion.div>
  );
}
