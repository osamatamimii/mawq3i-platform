import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Check, Shield } from 'lucide-react';

export default function AdminSettings() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    platformName: 'Mawq3i | موقعي',
    adminEmail: 'admin@mawq3i.com',
    supportEmail: 'support@mawq3i.com',
    monthlyPrice: '59',
    yearlyPrice: '588',
    currency: 'ILS',
    trialDays: '14',
    maintenanceMode: false,
    newRegistrations: true,
    emailNotifications: true,
  });

  const set = (key: string, value: string | boolean) => setSettings(s => ({ ...s, [key]: value }));

  const save = () => {
    toast({
      title: isAr ? 'تم الحفظ' : 'Saved',
      description: isAr ? 'تم حفظ إعدادات المنصة بنجاح' : 'Platform settings saved successfully.',
    });
  };

  const Section = ({ titleAr, titleEn, children }: { titleAr: string; titleEn: string; children: React.ReactNode }) => (
    <Card className="bg-white/[0.03] border-white/[0.07]">
      <CardHeader className="border-b border-white/[0.07] pb-4">
        <CardTitle className="text-sm font-semibold text-white/70 uppercase tracking-wide">{isAr ? titleAr : titleEn}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">{children}</CardContent>
    </Card>
  );

  const Field = ({ labelAr, labelEn, children }: { labelAr: string; labelEn: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-3 gap-4 items-center">
      <Label className="text-sm text-white/50 col-span-1">{isAr ? labelAr : labelEn}</Label>
      <div className="col-span-2">{children}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{isAr ? 'إعدادات المنصة' : 'Platform Settings'}</h2>
          <p className="text-xs text-white/40">{isAr ? 'الإعدادات العامة للمنصة' : 'Global platform configuration'}</p>
        </div>
      </div>

      <Section titleAr="معلومات المنصة" titleEn="Platform Info">
        <Field labelAr="اسم المنصة" labelEn="Platform Name">
          <Input value={settings.platformName} onChange={e => set('platformName', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white" />
        </Field>
        <Field labelAr="بريد المدير" labelEn="Admin Email">
          <Input value={settings.adminEmail} onChange={e => set('adminEmail', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white font-mono" dir="ltr" />
        </Field>
        <Field labelAr="بريد الدعم" labelEn="Support Email">
          <Input value={settings.supportEmail} onChange={e => set('supportEmail', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white font-mono" dir="ltr" />
        </Field>
      </Section>

      <Section titleAr="أسعار الاشتراك" titleEn="Subscription Pricing">
        <Field labelAr="السعر الشهري (₪)" labelEn="Monthly Price (₪)">
          <Input type="number" value={settings.monthlyPrice} onChange={e => set('monthlyPrice', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white font-mono" />
        </Field>
        <Field labelAr="السعر السنوي (₪)" labelEn="Yearly Price (₪)">
          <Input type="number" value={settings.yearlyPrice} onChange={e => set('yearlyPrice', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white font-mono" />
        </Field>
        <Field labelAr="فترة التجربة (أيام)" labelEn="Trial Period (days)">
          <Input type="number" value={settings.trialDays} onChange={e => set('trialDays', e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white font-mono" />
        </Field>
      </Section>

      <Section titleAr="إعدادات النظام" titleEn="System Settings">
        {[
          { key: 'maintenanceMode', ar: 'وضع الصيانة', en: 'Maintenance Mode', desc_ar: 'تعطيل الوصول للمنصة مؤقتاً', desc_en: 'Temporarily disable platform access' },
          { key: 'newRegistrations', ar: 'السماح بالتسجيلات الجديدة', en: 'Allow New Registrations', desc_ar: 'تفعيل تسجيل متاجر جديدة', desc_en: 'Enable new store sign-ups' },
          { key: 'emailNotifications', ar: 'إشعارات البريد الإلكتروني', en: 'Email Notifications', desc_ar: 'إرسال إشعارات للعملاء تلقائياً', desc_en: 'Send automated emails to clients' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-white">{isAr ? item.ar : item.en}</p>
              <p className="text-xs text-white/35 mt-0.5">{isAr ? item.desc_ar : item.desc_en}</p>
            </div>
            <Switch checked={(settings as any)[item.key]} onCheckedChange={v => set(item.key, v)} />
          </div>
        ))}
      </Section>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button onClick={save} className="w-full h-11 font-medium gap-2">
          <Check className="w-4 h-4" />
          {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </motion.div>
    </motion.div>
  );
}
