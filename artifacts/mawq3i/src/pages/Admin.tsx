import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { adminStores, StoreRecord } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, LogIn, Eye } from 'lucide-react';

type Store = StoreRecord;

export default function Admin() {
  const { language, setCurrentUser } = useAppContext();
  const isAr = language === 'ar';
  const [, setLocation] = useLocation();

  const [stores, setStores] = useState<Store[]>(adminStores);
  const [showAdd, setShowAdd] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', domain: '', currency: 'ILS' });

  const handleAddStore = () => {
    if (!newStore.name || !newStore.domain) return;
    const slug = newStore.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    setStores(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name: newStore.name,
        slug,
        domain: newStore.domain,
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        ordersCount: 0,
        totalSales: 0,
        currency: newStore.currency as 'ILS' | 'SAR',
        status: 'active',
        subscriptionStatus: 'trial',
        subscriptionPlan: 'monthly',
        subscriptionPaid: false,
        renewalDate: '',
        joinDate: new Date().toISOString().split('T')[0],
      },
    ]);
    setNewStore({ name: '', domain: '', currency: 'ILS' });
    setShowAdd(false);
  };

  const enterAsOwner = () => {
    setCurrentUser('owner');
    setLocation('/dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'جميع المتاجر' : 'All Stores'}</h2>
          <p className="text-sm text-muted-foreground">{stores.length} {isAr ? 'متجر' : 'stores'}</p>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة متجر جديد' : 'Add New Store'}
          </Button>
        </motion.div>
      </div>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'اسم المتجر' : 'Store Name'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الدومين' : 'Domain'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'عدد الطلبات' : 'Orders'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'العملة' : 'Currency'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store, i) => (
                  <motion.tr
                    key={store.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold">{store.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground" dir="ltr">{store.domain}</td>
                    <td className="px-6 py-4 font-mono font-semibold">{store.ordersCount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono">
                        {store.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        store.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border-border/50'
                      }`}>
                        {store.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Suspended')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => {}}
                        >
                          <Eye className="w-3 h-3" />
                          {isAr ? 'عرض البيانات' : 'View'}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={enterAsOwner}
                        >
                          <LogIn className="w-3 h-3" />
                          {isAr ? 'دخول كصاحب المتجر' : 'Enter as Owner'}
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

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? 'إضافة متجر جديد' : 'Add New Store'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم المتجر' : 'Store Name'}</Label>
              <Input
                value={newStore.name}
                onChange={e => setNewStore(s => ({ ...s, name: e.target.value }))}
                placeholder={isAr ? 'مثال: متجر الأناقة' : 'e.g. Elegance Store'}
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'الدومين' : 'Domain'}</Label>
              <Input
                value={newStore.domain}
                onChange={e => setNewStore(s => ({ ...s, domain: e.target.value }))}
                placeholder="store.mawq3i.com"
                className="bg-background/50 border-border/50 font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'العملة' : 'Currency'}</Label>
              <Select value={newStore.currency} onValueChange={v => setNewStore(s => ({ ...s, currency: v }))}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="ILS">₪ {isAr ? 'شيكل' : 'ILS'}</SelectItem>
                  <SelectItem value="SAR">﷼ {isAr ? 'ريال سعودي' : 'SAR'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleAddStore}>
              {isAr ? 'إضافة المتجر' : 'Add Store'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
