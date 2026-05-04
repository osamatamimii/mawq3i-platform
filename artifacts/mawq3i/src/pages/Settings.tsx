import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Check } from 'lucide-react';

export default function Settings() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    storeName: 'متجر الأناقة',
    primaryColor: '#52FF3F',
    defaultCurrency: 'ILS',
    defaultLanguage: 'ar',
    whatsapp: '+970591234567',
    domain: 'elegance.mawq3i.com',
    cashOnDelivery: true,
    paymentLink: 'https://pay.mawq3i.com/elegance',
  });

  const set = (key: string, value: string | boolean) => setSettings(s => ({ ...s, [key]: value }));

  const handleSave = () => {
    toast({
      title: isAr ? 'تم الحفظ بنجاح' : 'Settings saved',
      description: isAr ? 'تم حفظ إعدادات المتجر' : 'Store settings have been saved successfully.',
    });
  };

  const SectionCard = ({ titleAr, titleEn, children }: { titleAr: string; titleEn: string; children: React.ReactNode }) => (
    <Card className="bg-card border-border/50 shadow-lg">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">{isAr ? titleAr : titleEn}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">{children}</CardContent>
    </Card>
  );

  const Field = ({ labelAr, labelEn, children }: { labelAr: string; labelEn: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
      <Label className="text-sm text-muted-foreground">{isAr ? labelAr : labelEn}</Label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-2xl"
    >
      <SectionCard titleAr="معلومات المتجر" titleEn="Store Information">
        <Field labelAr="اسم المتجر" labelEn="Store Name">
          <Input
            value={settings.storeName}
            onChange={e => set('storeName', e.target.value)}
            className="bg-background/50 border-border/50"
          />
        </Field>
        <Field labelAr="الشعار" labelEn="Logo">
          <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors bg-background/30">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isAr ? 'رفع شعار المتجر' : 'Upload store logo'}
            </span>
            <input type="file" className="hidden" accept="image/*" />
          </label>
        </Field>
        <Field labelAr="اللون الرئيسي" labelEn="Primary Color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.primaryColor}
              onChange={e => set('primaryColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-border/50 bg-transparent cursor-pointer"
            />
            <Input
              value={settings.primaryColor}
              onChange={e => set('primaryColor', e.target.value)}
              className="bg-background/50 border-border/50 font-mono"
              dir="ltr"
            />
          </div>
        </Field>
        <Field labelAr="رقم واتساب" labelEn="WhatsApp Number">
          <Input
            value={settings.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
          />
        </Field>
        <Field labelAr="الدومين" labelEn="Domain">
          <Input
            value={settings.domain}
            onChange={e => set('domain', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
          />
        </Field>
      </SectionCard>

      <SectionCard titleAr="التفضيلات" titleEn="Preferences">
        <Field labelAr="العملة الافتراضية" labelEn="Default Currency">
          <Select value={settings.defaultCurrency} onValueChange={v => set('defaultCurrency', v)}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="ILS">₪ {isAr ? 'شيكل' : 'ILS'}</SelectItem>
              <SelectItem value="SAR">﷼ {isAr ? 'ريال سعودي' : 'SAR'}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field labelAr="اللغة الافتراضية" labelEn="Default Language">
          <Select value={settings.defaultLanguage} onValueChange={v => set('defaultLanguage', v)}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard titleAr="طرق الدفع" titleEn="Payment Methods">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">{isAr ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</p>
            <p className="text-xs text-muted-foreground">{isAr ? 'السماح بالدفع عند التسليم' : 'Allow payment upon delivery'}</p>
          </div>
          <Switch
            checked={settings.cashOnDelivery}
            onCheckedChange={v => set('cashOnDelivery', v)}
          />
        </div>
        <Field labelAr="رابط الدفع" labelEn="Payment Link">
          <Input
            value={settings.paymentLink}
            onChange={e => set('paymentLink', e.target.value)}
            className="bg-background/50 border-border/50 font-mono text-xs"
            dir="ltr"
          />
        </Field>
      </SectionCard>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={handleSave}
          className="w-full h-11 font-medium shadow-[0_0_20px_rgba(82,255,63,0.15)] hover:shadow-[0_0_25px_rgba(82,255,63,0.25)] transition-all"
        >
          <Check className="w-4 h-4 me-2" />
          {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </motion.div>
    </motion.div>
  );
}
