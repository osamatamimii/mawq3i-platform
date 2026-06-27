import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { Product } from '@/data/mockData';
import { getProducts, updateProduct, deleteProduct } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, Package, Camera, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emojis = ['🕌', '🌿', '💎', '☕', '🫐', '🪔', '✨', '💍'];

export default function Products() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const [, setLocation] = useLocation();
  const isAr = language === 'ar';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  useEffect(() => {
    getProducts(currentStore?.id, isAdminMode).then(data => {
      setProducts(data);
      setLoading(false);
    });
  }, [currentStore?.id]);

  const openImageUpload = (productId: string) => {
    uploadTargetRef.current = productId;
    imageInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const productId = uploadTargetRef.current;
    if (!file || !productId || !currentStore) return;
    if (imageInputRef.current) imageInputRef.current.value = '';

    setUploadingImageId(productId);
    const path = `${currentStore.id}/${productId}/${file.name}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      await updateProduct(productId, { imageUrl: publicUrl }, isAdminMode);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, imageUrl: publicUrl } : p));
    }
    setUploadingImageId(null);
  };

  const toggleVisibility = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStatus = product.status === 'visible' ? 'hidden' : 'visible';
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    await updateProduct(id, { status: newStatus }, isAdminMode);
  };

  const saveEdit = async () => {
    if (!editProduct) return;
    setSaving(true);
    setProducts(prev => prev.map(p => p.id === editProduct.id ? editProduct : p));
    await updateProduct(editProduct.id, editProduct, isAdminMode);
    setSaving(false);
    setEditProduct(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setProducts(prev => prev.filter(p => p.id !== deleteId));
    await deleteProduct(deleteId, isAdminMode);
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }


  // ── CSV Import ──────────────────────────────────────────
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStore?.id) return;
    setCsvImporting(true);
    const text = await file.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) { setCsvImporting(false); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    let added = 0, failed = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || [];
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      const price = parseFloat(row['price'] || row['السعر'] || '0');
      const stock = parseInt(row['stock'] || row['المخزون'] || '0');
      const name = row['name'] || row['name_ar'] || row['الاسم'] || row['اسم المنتج'] || '';
      if (!name || isNaN(price)) { failed++; continue; }
      const { error } = await supabase.from('products').insert([{
        store_id: currentStore.id,
        name_ar: name,
        name_en: row['name_en'] || row['english name'] || name,
        desc_ar: row['desc'] || row['description'] || row['الوصف'] || '',
        price,
        stock,
        category: row['category'] || row['الفئة'] || '',
        status: 'visible',
        image_url: row['image'] || row['image_url'] || null,
        currency: currentStore.currency || 'ILS',
        variants: [],
      }]);
      if (!error) added++; else failed++;
    }
    setCsvImporting(false);
    if (csvInputRef.current) csvInputRef.current.value = '';
    // Refresh products
    const { data } = await supabase.from('products').select('*').eq('store_id', currentStore.id).order('created_at', { ascending: false });
    if (data) setProducts(data.map((p: any) => ({ id: p.id, nameAr: p.name_ar, nameEn: p.name_en, descAr: p.desc_ar, descEn: p.desc_en || '', price: p.price, stock: p.stock, category: p.category, status: p.status, imageUrl: p.image_url, variants: p.variants || [], badge: p.badge, currency: p.currency || 'ILS' })));
    const msg = isAr ? `✅ تم استيراد ${added} منتج` + (failed ? ` (فشل ${failed})` : '') : `✅ Imported ${added} products` + (failed ? ` (${failed} failed)` : '');
    toast({ title: msg });
  };

  const downloadTemplate = () => {
    const csv = 'name_ar,name_en,price,stock,category,desc\nاسم المنتج,Product Name,99,10,ملابس,وصف المنتج';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'products-template.csv'; a.click();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'قائمة المنتجات' : 'Products'}</h2>
          <p className="text-sm text-muted-foreground">{products.length} {isAr ? 'منتج' : 'products'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs h-8">
            <Download className="w-3.5 h-3.5" />
            {isAr ? 'قالب CSV' : 'CSV Template'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} disabled={csvImporting} className="gap-1.5 text-xs h-8">
            {csvImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {isAr ? 'استيراد CSV' : 'Import CSV'}
          </Button>
          <Link href="/dashboard/add-product">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button className="gap-2 shadow-[0_0_15px_rgba(82,255,63,0.1)] hover:shadow-[0_0_20px_rgba(82,255,63,0.2)] transition-all" data-testid="button-add-product">
                <Plus className="w-4 h-4" />
                {isAr ? 'إضافة منتج' : 'Add Product'}
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Package className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">{isAr ? 'لا توجد منتجات بعد' : 'No products yet'}</p>
              <p className="text-xs opacity-60">{isAr ? 'اضغط "إضافة منتج" لإضافة أول منتج' : 'Click "Add Product" to add your first product'}</p>
              <Link href="/dashboard/add-product">
                <Button size="sm" className="mt-2 gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  {isAr ? 'إضافة منتج' : 'Add Product'}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'الصورة' : 'Image'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'اسم المنتج' : 'Product'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'السعر' : 'Price'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'العملة' : 'Currency'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'المخزون' : 'Stock'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="text-start px-6 py-4 font-medium">{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, i) => (
                    <motion.tr key={product.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-border/30 hover:bg-white/[0.02] transition-colors" data-testid={`row-product-${product.id}`}>
                      <td className="px-6 py-4">
                        <div
                          className="relative w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg overflow-hidden group cursor-pointer"
                          onClick={() => openImageUpload(product.id)}
                          title={isAr ? 'انقر لتغيير الصورة' : 'Click to change image'}
                        >
                          {uploadingImageId === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (
                            <>
                              {product.imageUrl
                                ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                : <span>{emojis[parseInt(product.id) - 1] ?? '📦'}</span>}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                <Camera className="w-3.5 h-3.5 text-white" />
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{isAr ? product.nameAr : product.nameEn}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold">
                        {product.currency === 'ILS' ? '₪' : '﷼'}{product.price}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono">{product.currency}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-mono text-sm font-semibold ${product.stock <= 5 ? 'text-amber-400' : ''}`}>{product.stock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={product.status === 'visible'} onCheckedChange={() => toggleVisibility(product.id)} data-testid={`switch-visibility-${product.id}`} />
                          <span className="text-xs text-muted-foreground">
                            {product.status === 'visible' ? (isAr ? 'ظاهر' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-primary/30" onClick={() => setLocation(`/dashboard/products/edit/${product.id}`)} data-testid={`button-edit-${product.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400" onClick={() => setDeleteId(product.id)} data-testid={`button-delete-${product.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
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

      <Dialog open={!!editProduct} onOpenChange={o => !o && setEditProduct(null)}>
        <DialogContent className="bg-card border-border/50 sm:max-w-lg">
          <DialogHeader><DialogTitle>{isAr ? 'تعديل المنتج' : 'Edit Product'}</DialogTitle></DialogHeader>
          {editProduct && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                  <Input value={editProduct.nameAr} onChange={e => setEditProduct(p => p ? { ...p, nameAr: e.target.value } : p)} className="bg-background/50 border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input value={editProduct.nameEn} onChange={e => setEditProduct(p => p ? { ...p, nameEn: e.target.value } : p)} className="bg-background/50 border-border/50" dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'السعر' : 'Price'}</Label>
                  <Input type="number" value={editProduct.price} onChange={e => setEditProduct(p => p ? { ...p, price: Number(e.target.value) } : p)} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'العملة' : 'Currency'}</Label>
                  <Select value={editProduct.currency} onValueChange={v => setEditProduct(p => p ? { ...p, currency: v as 'ILS' | 'SAR' } : p)}>
                    <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="ILS">₪ ILS</SelectItem>
                      <SelectItem value="SAR">﷼ SAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'المخزون' : 'Stock'}</Label>
                  <Input type="number" value={editProduct.stock} onChange={e => setEditProduct(p => p ? { ...p, stock: Number(e.target.value) } : p)} className="bg-background/50 border-border/50 font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isAr ? 'التصنيف' : 'Category'}</Label>
                <Input value={editProduct.category} onChange={e => setEditProduct(p => p ? { ...p, category: e.target.value } : p)} className="bg-background/50 border-border/50" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف المنتج' : 'Delete Product'}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isAr ? 'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}
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
