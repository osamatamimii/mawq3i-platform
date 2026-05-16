import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { updateStoreSettings } from '@/lib/db';
import { uploadStoreLogo } from '@/lib/storage';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Check, Loader2, ImageIcon } from 'lucide-react';

export default function Settings() {
  const { language, currentStore, storeLoading, refreshStore } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    storeName: '',
    description: '',
    primaryColor: '#52FF3F',
    defaultCurrency: 'ILS' as 'ILS' | 'SAR',
    whatsapp: '',
    domain: '',
  });
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (currentStore) {
      setSettings({
        storeName: currentStore.name,
        description: currentStore.description ?? '',
        primaryColor: currentStore.primaryColor ?? '#52FF3F',
        defaultCurrency: currentStore.currency,
        whatsapp: currentStore.ownerPhone,
        domain: currentStore.domain,
      });
      setLogoPreview(currentStore.logoUrl ?? '');
    }
  }, [currentStore]);

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentStore) return;
    setSaving(true);

    let logoUrl = currentStore.logoUrl ?? '';

    if (logoFile) {
      setUploadingLogo(true);
      const uploaded = await uploadStoreLogo(logoFile, currentStore.id);
      setUploadingLogo(false);
      if (uploaded) {
        logoUrl = uploaded;
      } else {
        toast({
          title: isAr ? 'تعذّر رفع الشعار' : 'Logo upload failed',
          description: isAr
            ? 'تأكد من وجود bucket باسم store-assets في Supabase Storage'
            : 'Make sure a bucket named "store-assets" exists in Supabase Storage',
          variant: 'destructive',
        });
      }
    }

    await updateStoreSettings(currentStore.id, {
      name: settings.storeName,
      description: settings.description,
      ownerPhone: settings.whatsapp,
      primaryColor: settings.primaryColor,
      logoUrl,
      currency: settings.defaultCurrency,
      domain: settings.domain,
    });

    await refreshStore();
    setSaving(false);
    setLogoFile(null);

    toast({
      title: isAr ? 'تم الحفظ بنجاح' : 'Settings saved',
      description: isAr ? 'تم حفظ إعدادات المتجر وتطبيقها' : 'Store settings have been saved and applied.',
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <Label className="text-sm text-muted-foreground sm:pt-2">{isAr ? labelAr : labelEn}</Label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );

  if (storeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <span className="text-4xl">🏪</span>
        <p className="text-sm">{isAr ? 'لم يتم ربط حسابك بأي متجر بعد' : 'Your account is not linked to a store yet'}</p>
        <p className="text-xs opacity-60">{isAr ? 'تواصل مع المدير لإنشاء متجرك' : 'Contact the admin to create your store'}</p>
      </div>
    );
  }

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

        <Field labelAr="وصف المتجر" labelEn="Store Description">
          <Textarea
            value={settings.description}
            onChange={e => set('description', e.target.value)}
            className="bg-background/50 border-border/50 resize-none h-20"
            placeholder={isAr ? 'اكتب وصفاً مختصراً لمتجرك...' : 'Write a brief description of your store...'}
          />
        </Field>

        <Field labelAr="الشعار" labelEn="Logo">
          <div
            className="flex items-center gap-4 px-4 py-3 border border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors bg-background/30"
            onClick={() => fileRef.current?.click()}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-10 h-10 object-contain rounded-md" />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <span className="text-sm text-muted-foreground block">
                {logoFile
                  ? logoFile.name
                  : logoPreview
                  ? (isAr ? 'انقر لتغيير الشعار' : 'Click to change logo')
                  : (isAr ? 'رفع شعار المتجر' : 'Upload store logo')}
              </span>
              {logoFile && (
                <span className="text-xs text-primary">
                  {isAr ? 'سيُرفع عند الحفظ' : 'Will upload on save'}
                </span>
              )}
            </div>
            <Upload className="w-4 h-4 text-muted-foreground ms-auto" />
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
          </div>
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
            <div
              className="w-10 h-10 rounded-lg border border-border/50 flex-shrink-0"
              style={{ backgroundColor: settings.primaryColor }}
            />
          </div>
        </Field>

        <Field labelAr="رقم واتساب" labelEn="WhatsApp Number">
          <Input
            value={settings.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
            placeholder="+970591234567"
          />
        </Field>

        <Field labelAr="الدومين" labelEn="Domain">
          <Input
            value={settings.domain}
            onChange={e => set('domain', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
            placeholder="my-store.mawq3i.com"
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
      </SectionCard>

      <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">{isAr ? 'معلومات المتجر' : 'Store Info'}</p>
        <p dir="ltr">
          {isAr ? 'الرابط العام: ' : 'Public URL: '}
          {currentStore.domain ? (
            <a href={`https://${currentStore.domain}`} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
              {currentStore.domain}
            </a>
          ) : (
            <span className="font-mono text-primary">{currentStore.slug}.mawq3i.co</span>
          )}
        </p>
        <p>{isAr ? 'البريد الإلكتروني: ' : 'Email: '}<span className="font-mono">{currentStore.ownerEmail}</span></p>
      </div>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-11 font-medium shadow-[0_0_20px_rgba(82,255,63,0.15)] hover:shadow-[0_0_25px_rgba(82,255,63,0.25)] transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              {uploadingLogo
                ? (isAr ? 'جاري رفع الشعار...' : 'Uploading logo...')
                : (isAr ? 'جاري الحفظ...' : 'Saving...')}
            </>
          ) : (
            <>
              <Check className="w-4 h-4 me-2" />
              {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
