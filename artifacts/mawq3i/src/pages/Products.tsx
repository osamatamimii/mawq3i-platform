import { useState } from 'react';
import { Link } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { initialProducts, Product } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Products() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, status: p.status === 'visible' ? 'hidden' : 'visible' } : p)
    );
  };

  const handleEdit = (product: Product) => setEditProduct({ ...product });

  const saveEdit = () => {
    if (!editProduct) return;
    setProducts(prev => prev.map(p => p.id === editProduct.id ? editProduct : p));
    setEditProduct(null);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setProducts(prev => prev.filter(p => p.id !== deleteId));
    setDeleteId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'قائمة المنتجات' : 'Products List'}</h2>
          <p className="text-sm text-muted-foreground">{products.length} {isAr ? 'منتج' : 'products'}</p>
        </div>
        <Link href="/add-product">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button className="gap-2 shadow-[0_0_15px_rgba(82,255,63,0.1)] hover:shadow-[0_0_20px_rgba(82,255,63,0.2)] transition-all">
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة منتج' : 'Add Product'}
            </Button>
          </motion.div>
        </Link>
      </div>

      {/* Table */}
      <Card className="bg-card border-border/50 shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الصورة' : 'Image'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'اسم المنتج' : 'Product Name'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'العملة' : 'Currency'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'المخزون' : 'Stock'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, i) => (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                        {['🕌', '🌿', '💎', '☕', '🫐', '🪔', '✨', '💍'][parseInt(product.id) - 1] ?? '📦'}
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono">
                        {product.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono text-sm font-semibold ${product.stock <= 5 ? 'text-amber-400' : 'text-foreground'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={product.status === 'visible'}
                          onCheckedChange={() => toggleVisibility(product.id)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {product.status === 'visible' ? (isAr ? 'ظاهر' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-border/50 hover:border-primary/30"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editProduct} onOpenChange={open => !open && setEditProduct(null)}>
        <DialogContent className="bg-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAr ? 'تعديل المنتج' : 'Edit Product'}</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                  <Input
                    value={editProduct.nameAr}
                    onChange={e => setEditProduct(p => p ? { ...p, nameAr: e.target.value } : p)}
                    className="bg-background/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input
                    value={editProduct.nameEn}
                    onChange={e => setEditProduct(p => p ? { ...p, nameEn: e.target.value } : p)}
                    className="bg-background/50 border-border/50"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'السعر' : 'Price'}</Label>
                  <Input
                    type="number"
                    value={editProduct.price}
                    onChange={e => setEditProduct(p => p ? { ...p, price: Number(e.target.value) } : p)}
                    className="bg-background/50 border-border/50 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'العملة' : 'Currency'}</Label>
                  <Select
                    value={editProduct.currency}
                    onValueChange={v => setEditProduct(p => p ? { ...p, currency: v as 'ILS' | 'SAR' } : p)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="ILS">₪ ILS</SelectItem>
                      <SelectItem value="SAR">﷼ SAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'المخزون' : 'Stock'}</Label>
                  <Input
                    type="number"
                    value={editProduct.stock}
                    onChange={e => setEditProduct(p => p ? { ...p, stock: Number(e.target.value) } : p)}
                    className="bg-background/50 border-border/50 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? 'التصنيف' : 'Category'}</Label>
                  <Input
                    value={editProduct.category}
                    onChange={e => setEditProduct(p => p ? { ...p, category: e.target.value } : p)}
                    className="bg-background/50 border-border/50"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveEdit}>{isAr ? 'حفظ التغييرات' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف المنتج' : 'Delete Product'}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isAr ? 'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this product? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50">{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
