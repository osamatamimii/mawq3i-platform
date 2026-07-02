import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { addProduct } from '@/lib/db';
import { uploadProductImage, uploadProductVideo } from '@/lib/storage';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Loader2, ImageIcon, X, Plus, Trash2, Palette, Ruler, Package, Video } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type VariantMode = 'none' | 'colors' | 'sizes';

type ColorVariant = {
  id: string;
  name: string;         // e.g. "أسود"
  hex: string;          // e.g. "#1C1A16"
  stock: number;
  images: { preview: string; file?: File }[];
};

type SizeVariant = {
  id: string;
  label: string;        // e.g. "S" or "كبير"
  stock: number;
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function AddProduct() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Basic form
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', descAr: '', descEn: '',
    price: '', currency: 'ILS', category: '', badge: ''
  });
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  // Main images (multiple)
  const [mainImages, setMainImages] = useState<{ preview: string; file: File }[]>([]);
  const mainFileRef = useRef<HTMLInputElement>(null);

  // Optional product video (in addition to images, never instead of)
  const [video, setVideo] = useState<{ preview: string; file: File } | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // Variant mode
  const [variantMode, setVariantMode] = useState<VariantMode>('none');

  // Colors
  const [colors, setColors] = useState<ColorVariant[]>([]);

  // Sizes
  const [sizes, setSizes] = useState<SizeVariant[]>([]);
  const [noVariantStock, setNoVariantStock] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // ── Main Images ──────────────────────────────────────────────────────────────
  const addMainImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => setMainImages(prev => [
        ...prev, { preview: e.target?.result as string, file }
      ]);
      reader.readAsDataURL(file);
    });
  };

  const removeMainImage = (idx: number) =>
    setMainImages(prev => prev.filter((_, i) => i !== idx));

  // ── Optional Video ───────────────────────────────────────────────────────────
  const addVideo = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith('video/')) return;
    if (file.size > 50 * 1024 * 1024) {
      // Keep it simple: cap at 50MB so uploads stay reliable on mobile connections
      return;
    }
    const preview = URL.createObjectURL(file);
    setVideo({ preview, file });
  };

  const removeVideo = () => {
    if (video) URL.revokeObjectURL(video.preview);
    setVideo(null);
  };

  // ── Color Variants ───────────────────────────────────────────────────────────
  const addColor = () => setColors(prev => [...prev, {
    id: Date.now().toString(), name: '', hex: '#000000', stock: 0, images: []
  }]);

  const updateColor = (id: string, key: keyof ColorVariant, value: any) =>
    setColors(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));

  const removeColor = (id: string) =>
    setColors(prev => prev.filter(c => c.id !== id));

  const addColorImages = (id: string, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => setColors(prev => prev.map(c =>
        c.id === id ? { ...c, images: [...c.images, { preview: e.target?.result as string, file }] } : c
      ));
      reader.readAsDataURL(file);
    });
  };

  const removeColorImage = (colorId: string, imgIdx: number) =>
    setColors(prev => prev.map(c =>
      c.id === colorId ? { ...c, images: c.images.filter((_, i) => i !== imgIdx) } : c
    ));

  // ── Size Variants ────────────────────────────────────────────────────────────
  const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const addDefaultSizes = () => setSizes(
    DEFAULT_SIZES.map(label => ({ id: Date.now().toString() + label, label, stock: 0 }))
  );

  const addSize = () => setSizes(prev => [...prev, {
    id: Date.now().toString(), label: '', stock: 0
  }]);

  const updateSize = (id: string, key: keyof SizeVariant, value: any) =>
    setSizes(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));

  const removeSize = (id: string) =>
    setSizes(prev => prev.filter(s => s.id !== id));

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.price) return;
    if (!currentStore) {
      toast({ title: isAr ? 'خطأ' : 'Error', description: isAr ? 'لم يتم ربط حسابك بمتجر' : 'No store linked', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    // Upload main images
    const uploadedMainUrls: string[] = [];
    for (let i = 0; i < mainImages.length; i++) {
      setUploadProgress(isAr ? `رفع الصورة ${i + 1}/${mainImages.length}...` : `Uploading image ${i + 1}/${mainImages.length}...`);
      const url = await uploadProductImage(mainImages[i].file, currentStore.id);
      if (url) uploadedMainUrls.push(url);
    }

    // Upload optional video (in addition to images)
    let uploadedVideoUrl = '';
    if (video) {
      setUploadProgress(isAr ? 'جاري رفع الفيديو...' : 'Uploading video...');
      uploadedVideoUrl = (await uploadProductVideo(video.file, currentStore.id)) || '';
    }

    // Build variants array for DB
    let variantsForDb: any[] = [];
    let totalStock = 0;

    if (variantMode === 'colors') {
      for (const color of colors) {
        const colorImgUrls: string[] = [];
        for (let i = 0; i < color.images.length; i++) {
          if (color.images[i].file) {
            setUploadProgress(isAr ? `رفع صور ${color.name}...` : `Uploading ${color.name} images...`);
            const url = await uploadProductImage(color.images[i].file!, currentStore.id);
            if (url) colorImgUrls.push(url);
          }
        }
        variantsForDb.push({
          id: color.id, type: 'color',
          label: color.name, hex: color.hex,
          stock: color.stock, images: colorImgUrls,
          imageUrl: colorImgUrls[0] || ''
        });
        totalStock += color.stock;
      }
    } else if (variantMode === 'sizes') {
      variantsForDb = sizes.map(s => ({
        id: s.id, type: 'size',
        label: s.label, stock: s.stock, imageUrl: ''
      }));
      totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);
    } else {
      totalStock = Number(noVariantStock) || 0;
    }

    setUploadProgress(isAr ? 'جاري الحفظ...' : 'Saving...');

    const saved = await addProduct({
      nameAr: form.nameAr, nameEn: form.nameEn,
      descAr: form.descAr, descEn: form.descEn,
      price: Number(form.price), currency: form.currency as 'ILS' | 'SAR',
      stock: totalStock, category: form.category,
      status: 'visible',
      imageUrl: uploadedMainUrls[0] || '',
      videoUrl: uploadedVideoUrl,
      badge: form.badge || '',
      storeId: currentStore.id,
      variants: variantsForDb,
    }, isAdminMode);

    setSubmitting(false);
    setUploadProgress('');

    if (saved) {
      toast({ title: isAr ? 'تم إضافة المنتج' : 'Product added' });
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

        {/* ── Info ── */}
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
                <Label>{isAr ? 'التصنيف' : 'Category'}</Label>
                <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder={isAr ? 'مثال: هوديات' : 'e.g. Hoodies'} className="bg-background/50 border-border/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'الشارة (اختياري)' : 'Badge (optional)'}</Label>
              <Select value={form.badge} onValueChange={v => set('badge', v === 'none' ? '' : v)}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue placeholder={isAr ? 'بدون شارة' : 'No badge'} /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="none">{isAr ? 'بدون' : 'None'}</SelectItem>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="BEST SELLER">BEST SELLER</SelectItem>
                  <SelectItem value="POPULAR">POPULAR</SelectItem>
                  <SelectItem value="SALE">SALE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Main Images ── */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'صور المنتج الرئيسية' : 'Product Images'}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'يمكنك إضافة أكثر من صورة' : 'You can add multiple images'}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => mainFileRef.current?.click()} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs h-7">
              <Plus className="w-3 h-3" />{isAr ? 'إضافة صور' : 'Add Images'}
            </Button>
            <input ref={mainFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addMainImages(e.target.files)} />
          </CardHeader>
          <CardContent className="pt-4">
            {mainImages.length === 0 ? (
              <div
                onClick={() => mainFileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 border-border/60 transition-all"
              >
                <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">{isAr ? 'اسحب الصور هنا أو انقر للرفع' : 'Drag images here or click to upload'}</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {mainImages.map((img, idx) => (
                  <div key={idx} className="relative group w-24 h-24">
                    <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg border border-border/30" />
                    {idx === 0 && <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">{isAr ? 'رئيسية' : 'Main'}</span>}
                    <button type="button" onClick={() => removeMainImage(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div onClick={() => mainFileRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-border/60 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Optional Product Video (in addition to images) ── */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'فيديو المنتج (اختياري)' : 'Product Video (optional)'}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'إضافة فيديو لا تلغي الصور — يظهر الاثنان معاً بالمتجر' : "Adding a video doesn't replace images — both show together on your store"}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={e => addVideo(e.target.files)} />
            {!video ? (
              <div
                onClick={() => videoFileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 border-border/60 transition-all"
              >
                <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">{isAr ? 'اسحب فيديو هنا أو انقر للرفع' : 'Drag a video here or click to upload'}</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, WebM — {isAr ? 'حتى 50 ميغابايت' : 'up to 50MB'}</p>
              </div>
            ) : (
              <div className="relative w-full max-w-xs">
                <video src={video.preview} controls className="w-full rounded-lg border border-border/30" />
                <button type="button" onClick={removeVideo} className="absolute top-2 end-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'الكمية والمتغيرات' : 'Stock & Variants'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">

            {/* Mode Picker */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { mode: 'none' as VariantMode, icon: <Package className="w-4 h-4" />, label: isAr ? 'بدون متغيرات' : 'No Variants', sub: isAr ? 'كمية واحدة' : 'Single stock' },
                { mode: 'colors' as VariantMode, icon: <Palette className="w-4 h-4" />, label: isAr ? 'ألوان' : 'Colors', sub: isAr ? 'كل لون بصوره وكميته' : 'Each color has images & stock' },
                { mode: 'sizes' as VariantMode, icon: <Ruler className="w-4 h-4" />, label: isAr ? 'مقاسات' : 'Sizes', sub: isAr ? 'كل مقاس بكميته' : 'Each size has its own stock' },
              ].map(({ mode, icon, label, sub }) => (
                <button
                  key={mode} type="button"
                  onClick={() => setVariantMode(mode)}
                  className={`p-3 rounded-xl border text-start transition-all ${variantMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30 text-muted-foreground'}`}
                >
                  <div className="flex items-center gap-2 mb-1">{icon}<span className="text-sm font-medium">{label}</span></div>
                  <p className="text-xs opacity-70">{sub}</p>
                </button>
              ))}
            </div>

            {/* No Variants — single stock */}
            {variantMode === 'none' && (
              <div className="space-y-1.5">
                <Label>{isAr ? 'الكمية المتوفرة' : 'Available Stock'}</Label>
                <Input type="number" min="0" value={noVariantStock} onChange={e => setNoVariantStock(e.target.value)} placeholder="0" className="bg-background/50 border-border/50 font-mono w-40" />
              </div>
            )}

            {/* Colors */}
            {variantMode === 'colors' && (
              <div className="space-y-3">
                {colors.map(color => (
                  <div key={color.id} className="p-4 bg-background/30 rounded-xl border border-border/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color" value={color.hex}
                        onChange={e => updateColor(color.id, 'hex', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border/50 cursor-pointer bg-transparent p-0.5"
                        title={isAr ? 'اختر اللون' : 'Pick color'}
                      />
                      <Input
                        value={color.name}
                        onChange={e => updateColor(color.id, 'name', e.target.value)}
                        placeholder={isAr ? 'اسم اللون (مثال: أسود، أزرق فاتح)' : 'Color name (e.g. Black, Light Blue)'}
                        className="bg-background/50 border-border/50 flex-1 h-9 text-sm"
                      />
                      <Input
                        type="number" min="0" value={color.stock}
                        onChange={e => updateColor(color.id, 'stock', Number(e.target.value))}
                        placeholder={isAr ? 'الكمية' : 'Stock'}
                        className="bg-background/50 border-border/50 w-24 h-9 text-sm font-mono"
                      />
                      <button type="button" onClick={() => removeColor(color.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Color images */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{isAr ? `صور ${color.name || 'هذا اللون'}` : `Images for ${color.name || 'this color'}`}</p>
                      <div className="flex flex-wrap gap-2">
                        {color.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="relative group w-16 h-16">
                            <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg border border-border/30" />
                            <button type="button" onClick={() => removeColorImage(color.id, imgIdx)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                        <label className="w-16 h-16 border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all gap-1">
                          <input type="file" accept="image/*" multiple className="hidden" onChange={e => addColorImages(color.id, e.target.files)} />
                          <Plus className="w-4 h-4 text-primary" />
                          <span className="text-[9px] text-primary">{isAr ? 'صورة' : 'Photo'}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addColor} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs w-full">
                  <Plus className="w-3 h-3" />{isAr ? 'إضافة لون' : 'Add Color'}
                </Button>
              </div>
            )}

            {/* Sizes */}
            {variantMode === 'sizes' && (
              <div className="space-y-3">
                {sizes.length === 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={addDefaultSizes} className="gap-1.5 border-border/50 text-xs">
                    {isAr ? 'إضافة مقاسات افتراضية (XS-XXL)' : 'Add default sizes (XS-XXL)'}
                  </Button>
                )}
                <div className="space-y-2">
                  {sizes.map(size => (
                    <div key={size.id} className="flex items-center gap-3 p-3 bg-background/30 rounded-lg border border-border/30">
                      <Input
                        value={size.label}
                        onChange={e => updateSize(size.id, 'label', e.target.value)}
                        placeholder={isAr ? 'المقاس (مثال: S, M, L أو صغير، وسط)' : 'Size (e.g. S, M, L or Small, Medium)'}
                        className="bg-background/50 border-border/50 flex-1 h-8 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">{isAr ? 'الكمية' : 'Stock'}</Label>
                        <Input
                          type="number" min="0" value={size.stock}
                          onChange={e => updateSize(size.id, 'stock', Number(e.target.value))}
                          className="bg-background/50 border-border/50 w-20 h-8 text-sm font-mono"
                        />
                      </div>
                      <button type="button" onClick={() => removeSize(size.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSize} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs w-full">
                  <Plus className="w-3 h-3" />{isAr ? 'إضافة مقاس' : 'Add Size'}
                </Button>
                {sizes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isAr ? `إجمالي الكمية: ${sizes.reduce((s, v) => s + v.stock, 0)}` : `Total stock: ${sizes.reduce((s, v) => s + v.stock, 0)}`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting || !currentStore} className="w-full h-11 font-medium">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{uploadProgress || (isAr ? 'جاري الحفظ...' : 'Saving...')}</>
            : (isAr ? 'إضافة المنتج' : 'Add Product')}
        </Button>
      </form>
    </motion.div>
  );
}
