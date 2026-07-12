import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getStaffForStore, addStaffMember, updateStaffPermissions, removeStaffMember, StaffMember } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Users, ShoppingCart, Package, BarChart3, Settings, Tag } from 'lucide-react';

type PermKey = 'orders' | 'products' | 'analytics' | 'settings' | 'promotions';

const PERMISSION_FIELDS: { key: PermKey; icon: React.ElementType; labelAr: string; labelEn: string }[] = [
  { key: 'orders', icon: ShoppingCart, labelAr: 'الطلبات', labelEn: 'Orders' },
  { key: 'products', icon: Package, labelAr: 'المنتجات', labelEn: 'Products' },
  { key: 'analytics', icon: BarChart3, labelAr: 'الإحصائيات', labelEn: 'Analytics' },
  { key: 'promotions', icon: Tag, labelAr: 'العروض والخصومات', labelEn: 'Promotions & Discounts' },
  { key: 'settings', icon: Settings, labelAr: 'إعدادات المتجر', labelEn: 'Store Settings' },
];

const emptyPerms = () => ({ orders: true, products: false, analytics: false, settings: false, promotions: false });

export default function Staff() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [perms, setPerms] = useState(emptyPerms());

  const load = async () => {
    if (!currentStore) return;
    setLoading(true);
    const data = await getStaffForStore(currentStore.id, isAdminMode);
    setStaff(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentStore?.id]);

  const handleAdd = async () => {
    if (!currentStore || !email.trim()) return;
    setSaving(true);
    const ok = await addStaffMember(currentStore.id, email, fullName, perms, isAdminMode);
    setSaving(false);
    if (ok) {
      toast({ title: isAr ? 'تمت إضافة الموظف' : 'Staff member added' });
      setEmail(''); setFullName(''); setPerms(emptyPerms());
      load();
    } else {
      toast({ title: isAr ? 'تعذّرت الإضافة' : 'Could not add staff member', variant: 'destructive' });
    }
  };

  const togglePerm = async (member: StaffMember, key: PermKey) => {
    const updated = { ...member.permissions, [key]: !member.permissions[key] };
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, permissions: updated } : s));
    await updateStaffPermissions(member.id, updated, isAdminMode);
  };

  const handleRemove = async (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    await removeStaffMember(id, isAdminMode);
  };

  if (!currentStore) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" />{isAr ? 'الموظفون' : 'Staff'}</h2>
        <p className="text-sm text-muted-foreground">{isAr ? 'أضف حسابات محدودة الصلاحيات لفريقك' : 'Add limited-access accounts for your team'}</p>
      </div>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">{isAr ? 'إضافة موظف' : 'Add Staff Member'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} dir="ltr" placeholder="employee@store.com" className="bg-background/50 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'الاسم' : 'Name'}</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={isAr ? 'اسم الموظف' : 'Employee name'} className="bg-background/50 border-border/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{isAr ? 'الصلاحيات' : 'Permissions'}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-background/30">
                  <div className="flex items-center gap-2">
                    <f.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{isAr ? f.labelAr : f.labelEn}</span>
                  </div>
                  <Switch checked={perms[f.key]} onCheckedChange={() => setPerms(p => ({ ...p, [f.key]: !p[f.key] }))} />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            {isAr
              ? 'ملاحظة: بعد إضافة الموظف هون، لازم تنشئ له حساب دخول (بريد + كلمة مرور) بنفس هالإيميل — تواصل معنا لإنشائه.'
              : 'Note: after adding the staff member here, a login account (email + password) still needs to be created for that same email — contact us to set it up.'}
          </p>

          <Button onClick={handleAdd} disabled={saving || !email.trim()} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isAr ? 'إضافة' : 'Add'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">{isAr ? `الموظفون الحاليون (${staff.length})` : `Current Staff (${staff.length})`}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{isAr ? 'لا يوجد موظفون بعد' : 'No staff members yet'}</p>
          ) : (
            <div className="space-y-3">
              {staff.map(member => (
                <div key={member.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{member.fullName || member.email}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{member.email}</p>
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400" onClick={() => handleRemove(member.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PERMISSION_FIELDS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => togglePerm(member, f.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          member.permissions[f.key]
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-background/30 border-border/50 text-muted-foreground'
                        }`}
                      >
                        <f.icon className="w-3 h-3" />
                        {isAr ? f.labelAr : f.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
