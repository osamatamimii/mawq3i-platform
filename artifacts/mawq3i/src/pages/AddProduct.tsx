import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { addProduct } from '@/lib/db';
import { uploadProductImage } from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Sparkles, RotateCcw, Check, ArrowLeft, ArrowRight, Loader2, ImageIcon, X } from 'lucide-react';

type AIStyle = 'white-studio' | 'luxury-dark' | 'beige-minimal' | 'brand-green';
type AIState = 'idle' | 'loading' | 'done';

const aiStyles: { id: AIStyle; ar: string; en: string; gradient: string }[] = [
  { id: 'white-studio', ar: 'استوديو أبيض', en: 'White Studio', gradient: 'from-gray-100 to-white' },
  { id: 'luxury-dark', ar: 'فاخر داكن', en: 'Luxury Dark', gradient: 'from-gray-900 to-black' },
  { id: 'beige-minimal', ar: 'بيج بسيط', en: 'Beige Minimal', gradient: 'from-amber-50 to-stone-100' },
  { id: 'brand-green', ar: 'أخضر العلامة', en: 'Brand Green', gradient: 'from-emerald-900 to-green-950' },
];

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
  const [selectedStyle, setSelectedStyle] = useState<AIStyle>('luxury-dark');
  const [aiState, setAiState] = useState<AIState>('idle');
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setAiState('idle');
    setUseEnhanced(false);
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setAiState('idle');
    setUseEnhanced(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const runAI = () => {
    setAiState('loading');
    setUseEnhanced(false);
    setTimeout(() => setAiState('done'), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.price) return;

    if (!currentStore) {
      toast({
        title: isAr ? 'خطأ' : 'Error',
        description: isAr ? 'لم يتم ربط حسابك بمتجر' : 'Your account is not linked to a store',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    let imageUrl = '';
    if (imageFile) {
      setUploadProgress(isAr ? 'جاري رفع الصورة...' : 'Uploading image...');
      const uploaded = await uploadProductImage(imageFile, currentStore.id);
      if (uploaded) {
        imageUrl = uploaded;
      } else {
        toast({
          title: isAr ? 'تعذّر رفع الصورة' : 'Image upload failed',
          description: isAr
            ? 'تأكد من وجود bucket باسم product-images في Supabase Storage'
            : 'Make sure a bucket named "product-images" exists in Supabase Storage',
          variant: 'destructive',
        });
      }
    }

    setUploadProgress(isAr ? 'جاري الحفظ...' : 'Saving...');

    const saved = await addProduct({
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      descAr: form.descAr,
      descEn: form.descEn,
      price: Number(form.price),
      currency: form.currency as 'ILS' | 'SAR',
      stock: Number(form.stock) || 0,
      category: form.category,
      status: 'visible',
      imageUrl,
      storeId: currentStore.id,
    });

    setSubmitting(false);
    setUploadProgress('');

    if (saved) {
      toast({
        title: isAr ? 'تم إضافة المنتج' : 'Product added',
        description: isAr
          ? `تم إضافة "${form.nameAr}" بنجاح إلى متجرك`
          : `"${form.nameEn || form.nameAr}" has been added to your store.`,
      });
      setLocation('/dashboard/products');
    } else {
      toast({
        title: isAr ? 'حدث خطأ' : 'Error',
        description: isAr ? 'لم يتم حفظ المنتج، يرجى المحاولة مجدداً' : 'Failed to save product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation('/dashboard/products')} data-testid="button-back">
          <BackIcon className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'إضافة منتج جديد' : 'Add New Product'}</h2>
          <p className="text-xs text-muted-foreground">
            {currentStore
              ? (isAr ? `المتجر: ${currentStore.name}` : `Store: ${currentStore.name}`)
              : (isAr ? 'لم يتم ربط متجر بحسابك' : 'No store linked to your account')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'معلومات المنتج' : 'Product Information'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'اسم المنتج (عربي)' : 'Name (Arabic)'} <span className="text-red-400">*</span></Label>
                <Input value={form.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder="مثال: عطر فاخر" className="bg-background/50 border-border/50 focus:border-primary/50" required data-testid="input-name-ar" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'اسم المنتج (إنجليزي)' : 'Name (English)'}</Label>
                <Input value={form.nameEn} onChange={e => set('nameEn', e.target.value)} placeholder="e.g. Luxury Perfume" className="bg-background/50 border-border/50 focus:border-primary/50" dir="ltr" data-testid="input-name-en" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea value={form.descAr} onChange={e => set('descAr', e.target.value)} placeholder="وصف المنتج..." className="bg-background/50 border-border/50 resize-none h-20 focus:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea value={form.descEn} onChange={e => set('descEn', e.target.value)} placeholder="Product description..." className="bg-background/50 border-border/50 resize-none h-20 focus:border-primary/50" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'السعر' : 'Price'} <span className="text-red-400">*</span></Label>
                <Input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" className="bg-background/50 border-border/50 font-mono" required data-testid="input-price" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'العملة' : 'Currency'}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ILS">₪ ILS</SelectItem>
                    <SelectItem value="SAR">﷼ SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'المخزون' : 'Stock'}</Label>
                <Input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" className="bg-background/50 border-border/50 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{isAr ? 'التصنيف' : 'Category'}</Label>
              <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder={isAr ? 'مثال: عطور' : 'e.g. Perfumes'} className="bg-background/50 border-border/50 focus:border-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'صورة المنتج' : 'Product Image'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !imagePreview && fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragOver ? 'border-primary bg-primary/10' :
                imagePreview ? 'border-primary/30 bg-primary/5' :
                'border-border/60 hover:border-primary/40 hover:bg-white/[0.02] cursor-pointer'
              }`}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              {imagePreview ? (
                <div className="flex items-center justify-center gap-6">
                  <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                  <div className="text-start flex-1">
                    <p className="text-sm font-medium text-primary">{isAr ? 'تم اختيار الصورة' : 'Image selected'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {imageFile?.name ?? ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? 'ستُرفع إلى Supabase Storage عند الحفظ' : 'Will be uploaded to Supabase Storage on save'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); clearImage(); }}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">{isAr ? 'اسحب صورة هنا أو انقر للرفع' : 'Drag image here or click to upload'}</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — {isAr ? 'يُرفع إلى Supabase Storage' : 'uploaded to Supabase Storage'}</p>
                </div>
              )}
            </div>

            {imagePreview && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <Label className="text-sm mb-3 block">{isAr ? 'معاينة الأسلوب (تجميل بصري فقط)' : 'Style Preview (visual only)'}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {aiStyles.map(style => (
                      <button key={style.id} type="button" onClick={() => setSelectedStyle(style.id)}
                        className={`relative rounded-lg border p-2.5 text-xs font-medium transition-all ${selectedStyle === style.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-border text-muted-foreground hover:text-foreground'}`}>
                        <div className={`w-full h-7 rounded bg-gradient-to-br ${style.gradient} mb-2`} />
                        {isAr ? style.ar : style.en}
                        {selectedStyle === style.id && <span className="absolute top-1.5 end-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center"><Check className="w-2 h-2 text-black" /></span>}
                      </button>
                    ))}
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" onClick={runAI} disabled={aiState === 'loading'} variant="outline" className="w-full h-11 gap-2 border-primary/30 text-primary hover:bg-primary/10" data-testid="button-ai-enhance">
                    {aiState === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? 'جاري المعالجة...' : 'Processing...'}</> : <><Sparkles className="w-4 h-4" />{isAr ? 'معاينة التحسين' : 'Preview Enhancement'}</>}
                  </Button>
                </motion.div>
                <AnimatePresence>
                  {aiState === 'done' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-xs text-center text-muted-foreground font-medium">{isAr ? 'الأصلية' : 'Original'}</p>
                          <div className="aspect-square rounded-lg overflow-hidden border border-border/50"><img src={imagePreview} alt="before" className="w-full h-full object-cover" /></div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-center text-primary font-medium">{isAr ? 'بعد التحسين' : 'Enhanced'}</p>
                          <div className={`aspect-square rounded-lg overflow-hidden border border-primary/30 bg-gradient-to-br ${aiStyles.find(s => s.id === selectedStyle)?.gradient} relative`}>
                            <img src={imagePreview} alt="after" className="w-full h-full object-cover opacity-90 mix-blend-luminosity" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button type="button" variant="outline" size="sm" onClick={runAI} className="gap-1.5 border-border/50">
                          <RotateCcw className="w-3.5 h-3.5" />{isAr ? 'إعادة المحاولة' : 'Try Again'}
                        </Button>
                        <Button type="button" size="sm" onClick={() => setUseEnhanced(true)} className={`gap-1.5 ${useEnhanced ? 'opacity-70' : ''}`} data-testid="button-use-image">
                          <Check className="w-3.5 h-3.5" />{useEnhanced ? (isAr ? 'تم الاختيار' : 'Selected') : (isAr ? 'استخدام هذه الصورة' : 'Use This Image')}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button type="submit" disabled={submitting || !currentStore} className="w-full h-11 font-medium" data-testid="button-submit-product">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{uploadProgress || (isAr ? 'جاري الحفظ...' : 'Saving...')}</>
              : (isAr ? 'إضافة المنتج' : 'Add Product')}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
