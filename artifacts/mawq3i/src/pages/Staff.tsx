import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getStaffForStore, addStaffMember, updateStaffPermissions, removeStaffMember, createStaffLoginAccount, StaffMember } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Users, ShoppingCart, Package, BarChart3, Settings, Tag, KeyRound, Copy, CheckCircle2 } from 'lucide-react';

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
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [credentialsDialog, setCredentialsDialog] = useState<{ email: string; password: string } | null>(null);

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
    const created = await addStaffMember(currentStore.id, email, fullName, perms, isAdminMode);
    if (!created) {
      setSaving(false);
      toast({ title: isAr ? 'تعذّرت الإضافة' : 'Could not add staff member', variant: 'destructive' });
      return;
    }
    toast({ title: isAr ? 'تمت إضافة الموظف' : 'Staff member added' });
    const addedEmail = created.email;
    setEmail(''); setFullName(''); setPerms(emptyPerms());
    await load();

    // Auto-provision a real login account right away — no manual step needed.
    setProvisioningId(created.id);
    const result = await createStaffLoginAccount(created.id, addedEmail, created.fullName);
    setProvisioningId(null);
    setSaving(false);
    if (result.success && result.tempPassword) {
      setCredentialsDialog({ email: addedEmail, password: result.tempPassword });
      load();
    } else if (result.success && result.alreadyExisted) {
      toast({ title: isAr ? 'الحساب مربوط — البريد كان له حساب دخول مسبقاً' : 'Linked — this email already had a login account' });
      load();
    } else {
      toast({ title: isAr ? 'تمت إضافة الموظف لكن تعذّر إنشاء حساب الدخول تلقائياً' : 'Staff member added but auto login setup failed', description: result.error, variant: 'destructive' });
    }
  };

  const provisionAccount = async (member: StaffMember) => {
    setProvisioningId(member.id);
    const result = await createStaffLoginAccount(member.id, member.email, member.fullName);
    setProvisioningId(null);
    if (result.success && result.tempPassword) {
      setCredentialsDialog({ email: member.email, password: result.tempPassword });
      load();
    } else if (result.success && result.alreadyExisted) {
      toast({ title: isAr ? 'الحساب مربوط — البريد كان له حساب دخول مسبقاً' : 'Linked — this email already had a login account' });
      load();
    } else {
      toast({ title: isAr ? 'تعذّر إنشاء الحساب' : 'Could not create account', description: result.error, variant: 'destructive' });
    }
  };

  const copyCredentials = () => {
    if (!credentialsDialog) return;
    const text = isAr
      ? `بيانات الدخول لمنصة موقعي:\nالبريد: ${credentialsDialog.email}\nكلمة المرور المؤقتة: ${credentialsDialog.password}\nرابط الدخول: https://mawq3i.co/login`
      : `Mawq3i login details:\nEmail: ${credentialsDialog.email}\nTemporary password: ${credentialsDialog.password}\nLogin: https://mawq3i.co/login`;
    navigator.clipboard?.writeText(text);
    toast({ title: isAr ? 'تم النسخ ✅' : 'Copied ✅' });
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

          <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
            {isAr
              ? 'حساب الدخول بينعمل تلقائياً فور الإضافة — رح تظهرلك كلمة مرور مؤقتة تقدر تنسخها وترسلها للموظف على واتساب.'
              : 'A login account is created automatically as soon as you add the staff member — you\'ll get a temporary password to copy and send them.'}
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
                    <div className="flex items-center gap-2">
                      {member.userId ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-1">
                          <CheckCircle2 className="w-3 h-3" />{isAr ? 'الحساب مفعّل' : 'Account active'}
                        </span>
                      ) : (
                        <Button
                          variant="outline" size="sm"
                          className="h-7 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          disabled={provisioningId === member.id}
                          onClick={() => provisionAccount(member)}
                        >
                          {provisioningId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                          {isAr ? 'إنشاء حساب دخول' : 'Create login'}
                        </Button>
                      )}
                      <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400" onClick={() => handleRemove(member.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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

      <Dialog open={!!credentialsDialog} onOpenChange={(open) => !open && setCredentialsDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />{isAr ? 'بيانات دخول الموظف' : 'Staff login details'}</DialogTitle>
            <DialogDescription>
              {isAr ? 'انسخ البيانات وأرسلها للموظف على واتساب — ما رح تظهر مرة ثانية.' : 'Copy these and send them to the staff member — this won\'t be shown again.'}
            </DialogDescription>
          </DialogHeader>
          {credentialsDialog && (
            <div className="space-y-2 bg-background/50 border border-border/50 rounded-lg p-4" dir="ltr">
              <p className="text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-mono">{credentialsDialog.email}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Password:</span> <span className="font-mono font-semibold">{credentialsDialog.password}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Login:</span> <span className="font-mono">mawq3i.co/login</span></p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={copyCredentials} className="gap-2 w-full"><Copy className="w-4 h-4" />{isAr ? 'نسخ البيانات' : 'Copy details'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
