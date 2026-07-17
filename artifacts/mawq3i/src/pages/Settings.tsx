import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { updateStoreSettings } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { uploadStoreLogo, uploadStoreHeroImage } from '@/lib/storage';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Check, Loader2, ImageIcon, Plus, Trash2, Percent } from 'lucide-react';
import AiEnhanceButton from '@/components/AiEnhanceButton';

function SectionCard({ titleAr, titleEn, isAr, children }: { titleAr: string; titleEn: string; isAr: boolean; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border/50 shadow-lg">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">{isAr ? titleAr : titleEn}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">{children}</CardContent>
    </Card>
  );
}

function Field({ labelAr, labelEn, isAr, children }: { labelAr: string; labelEn: string; isAr: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <Label className="text-sm text-muted-foreground sm:pt-2">{isAr ? labelAr : labelEn}</Label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function DeliveryAddressSection({ isAr, currentStore }: { isAr: boolean; currentStore: any }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('Main Branch');
  const [senderName, setSenderName] = useState(currentStore?.ownerName || '');
  const [senderPhone, setSenderPhone] = useState(currentStore?.ownerPhone || '');
  const [details, setDetails] = useState(currentStore?.togoPickupDetails || '');
  const [citySearch, setCitySearch] = useState('');
  const [areaResults, setAreaResults] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const isConfigured = !!currentStore?.togoMerchantAddressId;

  const COMMON_CITIES = ['نابلس', 'رام الله', 'الخليل', 'القدس', 'بيت لحم', 'جنين', 'طولكرم', 'قلقيلية', 'أريحا', 'سلفيت', 'طوباس'];

  const searchAreas = async (queryOverride?: string) => {
    const q = (queryOverride ?? citySearch).trim();
    if (!q || !currentStore?.id) return;
    if (queryOverride) setCitySearch(queryOverride);
    setSearching(true);
    setAreaResults([]);
    setSelectedArea(null);
    try {
      const res = await fetch(`/api/togo?resource=merchant-address&action=areas&storeId=${currentStore.id}&search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setAreaResults(data?.data?.items || []);
      if (!data?.data?.items?.length) {
        toast({ title: isAr ? 'ما في نتائج' : 'No results', description: isAr ? 'جرب اسم مدينة مختلف' : 'Try a different city name', variant: 'destructive' });
      }
    } catch {
      toast({ title: isAr ? 'خطأ بالبحث' : 'Search error', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!currentStore?.id || !selectedArea || !senderName || !senderPhone) {
      toast({ title: isAr ? 'أكمل الحقول المطلوبة واختر المنطقة' : 'Fill required fields and pick an area', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/togo?resource=merchant-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: currentStore.id, title, senderName, senderPhone,
          areaId: selectedArea.id, details,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: isAr ? '✅ تم تسجيل عنوان الاستلام' : '✅ Pickup address saved' });
      } else {
        toast({ title: isAr ? 'فشل الحفظ' : 'Save failed', description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: isAr ? 'خطأ بالاتصال' : 'Connection error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      titleAr="🚚 عنوان الاستلام (للتوصيل عبر Togo)"
      titleEn="🚚 Pickup Address (for Togo delivery)"
      isAr={isAr}
    >
      <p className="text-xs text-muted-foreground -mt-2">
        {isAr
          ? 'سجّل عنوان استلام الطرود مرة واحدة عشان تقدر تطلب توصيل عبر Togo من صفحة الطلبات. يحتاج مفتاح Togo مفعّل على متجرك أولاً.'
          : 'Register your pickup address once so you can request Togo delivery from the Orders page. Requires a Togo API key configured on your store first.'}
      </p>
      {isConfigured && (
        <p className="text-xs text-emerald-400">{isAr ? '✅ مسجّل حالياً' : '✅ Currently configured'}</p>
      )}
      <Field labelAr="اسم الفرع" labelEn="Branch title" isAr={isAr}>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-card border-border/50" />
      </Field>
      <Field labelAr="اسم المرسل" labelEn="Sender name" isAr={isAr}>
        <Input value={senderName} onChange={e => setSenderName(e.target.value)} className="bg-card border-border/50" />
      </Field>
      <Field labelAr="هاتف المرسل" labelEn="Sender phone" isAr={isAr}>
        <Input value={senderPhone} onChange={e => setSenderPhone(e.target.value)} dir="ltr" className="bg-card border-border/50" />
      </Field>
      <Field labelAr="المدينة / المنطقة" labelEn="City / Area" isAr={isAr}>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COMMON_CITIES.map(city => (
            <button key={city} type="button" onClick={() => searchAreas(city)}
              className="text-xs px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
              {city}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder={isAr ? 'أو اكتب اسم مدينة/بلدة أخرى' : 'or type another city/town'} className="bg-card border-border/50" />
          <Button type="button" variant="outline" onClick={() => searchAreas()} disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'بحث' : 'Search')}
          </Button>
        </div>
        {areaResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {areaResults.map((a: any) => (
              <button key={a.id} type="button" onClick={() => setSelectedArea(a)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedArea?.id === a.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-primary/40'}`}>
                {a.area_name_ar || a.area_name_en || a.id}
              </button>
            ))}
          </div>
        )}
        {selectedArea && (
          <p className="text-xs text-emerald-400 mt-1">{isAr ? 'المنطقة المختارة: ' : 'Selected area: '}{selectedArea.area_name_ar || selectedArea.area_name_en}</p>
        )}
      </Field>
      <Field labelAr="تفاصيل إضافية" labelEn="Extra details" isAr={isAr}>
        <Textarea value={details} onChange={e => setDetails(e.target.value)} className="bg-card border-border/50" rows={2} />
      </Field>
      <Button type="button" onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Check className="w-4 h-4 me-2" />}
        {isAr ? 'حفظ عنوان الاستلام' : 'Save pickup address'}
      </Button>
    </SectionCard>
  );
}

function AdAccountsSection({ isAr, currentStore }: { isAr: boolean; currentStore: any }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<'meta' | 'tiktok' | null>(null);

  useEffect(() => {
    (async () => {
      if (!currentStore?.id) return;
      const { data } = await supabase
        .from('ad_accounts')
        .select('id, platform, external_account_name, status')
        .eq('store_id', currentStore.id);
      setAccounts(data || []);
      setLoading(false);
    })();
  }, [currentStore?.id]);

  const connect = async (platform: 'meta' | 'tiktok') => {
    setConnecting(platform);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast({ title: isAr ? 'سجّل دخولك من جديد' : 'Please sign in again', variant: 'destructive' }); return; }

      const endpoint = `/api/growth-agent?action=oauth-start&platform=${platform}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ store_id: currentStore.id }),
      });
      const data = await res.json();
      if (!data.configured) {
        toast({ title: isAr ? 'هاي الميزة لسا ما اتفعّلت' : 'Not available yet', description: data.message, variant: 'destructive' });
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      toast({ title: isAr ? 'صار خطأ، حاول لاحقاً' : 'Something went wrong', variant: 'destructive' });
    } finally {
      setConnecting(null);
    }
  };

  const platformLabel = (p: string) => (p === 'meta' ? 'Meta (فيسبوك/إنستغرام)' : 'TikTok');
  const statusBadge = (s: string) => {
    const map: Record<string, { ar: string; en: string; cls: string }> = {
      connected: { ar: 'مربوط', en: 'Connected', cls: 'bg-primary/10 text-primary' },
      expired: { ar: 'انتهت الصلاحية، أعد الربط', en: 'Expired, reconnect', cls: 'bg-red-500/10 text-red-500' },
      revoked: { ar: 'مُلغى', en: 'Revoked', cls: 'bg-muted text-muted-foreground' },
    };
    const m = map[s] || map.connected;
    return <span className={`text-xs rounded-full px-2 py-0.5 ${m.cls}`}>{isAr ? m.ar : m.en}</span>;
  };

  return (
    <SectionCard titleAr="حسابات الإعلانات" titleEn="Ad Accounts" isAr={isAr}>
      <p className="text-sm text-muted-foreground -mt-2">
        {isAr
          ? 'اربط حساب إعلاناتك عشان وكيل النمو يقدر يشخّص أداء حملاتك ويقارنها بمعايير السوق.'
          : 'Connect your ad account so the growth agent can diagnose campaign performance against market benchmarks.'}
      </p>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <p className="text-sm font-medium">{platformLabel(a.platform)}</p>
                <p className="text-xs text-muted-foreground">{a.external_account_name}</p>
              </div>
              {statusBadge(a.status)}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" disabled={connecting === 'meta'} onClick={() => connect('meta')}>
          {connecting === 'meta' ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
          {isAr ? 'ربط حساب Meta الإعلاني' : 'Connect Meta Ads'}
        </Button>
        <Button variant="outline" disabled={connecting === 'tiktok'} onClick={() => connect('tiktok')}>
          {connecting === 'tiktok' ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
          {isAr ? 'ربط حساب TikTok الإعلاني' : 'Connect TikTok Ads'}
        </Button>
      </div>
    </SectionCard>
  );
}

export default function Settings() {
  const { language, currentStore, storeLoading, refreshStore, isAdminMode } = useAppContext();
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
    brandIdentity: '',
    secondaryColor: '#1A1A1A',
    accentColor: '#52FF3F',
    heroTitle: '',
    heroSubtitle: '',
    footerText: '',
    showLogo: true,
    socialInstagram: '',
    socialFacebook: '',
    socialTiktok: '',
    socialSnapchat: '',
    contactEmail: '',
    secondaryPhone: '',
    returnPolicy: '',
  });
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);
  const [tiers, setTiers] = useState<{ threshold: number; percent: number }[]>([]);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string>('');
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentStore) {
      setSettings({
        storeName: currentStore.name,
        description: currentStore.description ?? '',
        primaryColor: currentStore.primaryColor ?? '#52FF3F',
        defaultCurrency: currentStore.currency,
        whatsapp: currentStore.ownerPhone,
        domain: currentStore.domain,
        brandIdentity: currentStore.brandIdentity ?? '',
        secondaryColor: currentStore.secondaryColor ?? '#1A1A1A',
        accentColor: currentStore.accentColor ?? currentStore.primaryColor ?? '#52FF3F',
        heroTitle: currentStore.heroTitle ?? '',
        heroSubtitle: currentStore.heroSubtitle ?? '',
        footerText: currentStore.footerText ?? '',
        showLogo: currentStore.showLogo !== false,
        socialInstagram: currentStore.socialInstagram ?? '',
        socialFacebook: currentStore.socialFacebook ?? '',
        socialTiktok: currentStore.socialTiktok ?? '',
        socialSnapchat: currentStore.socialSnapchat ?? '',
        contactEmail: currentStore.contactEmail ?? '',
        secondaryPhone: currentStore.secondaryPhone ?? '',
        returnPolicy: currentStore.returnPolicy ?? '',
      });
      setFaq(currentStore.faq && currentStore.faq.length ? currentStore.faq : []);
      setTiers(currentStore.tieredDiscounts && currentStore.tieredDiscounts.length ? currentStore.tieredDiscounts : []);
      setLogoPreview(currentStore.logoUrl ?? '');
      setHeroPreview(currentStore.heroImageUrl ?? '');
    }
  }, [currentStore]);

  const set = (key: string, value: string | boolean) => setSettings(s => ({ ...s, [key]: value }));

  const addFaqItem = () => setFaq(f => [...f, { q: '', a: '' }]);
  const removeFaqItem = (i: number) => setFaq(f => f.filter((_, idx) => idx !== i));
  const updateFaqItem = (i: number, key: 'q' | 'a', value: string) =>
    setFaq(f => f.map((item, idx) => idx === i ? { ...item, [key]: value } : item));

  const addTier = () => setTiers(t => [...t, { threshold: 0, percent: 0 }]);
  const removeTier = (i: number) => setTiers(t => t.filter((_, idx) => idx !== i));
  const updateTier = (i: number, key: 'threshold' | 'percent', value: number) =>
    setTiers(t => t.map((item, idx) => idx === i ? { ...item, [key]: value } : item));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setHeroPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentStore) return;
    setSaving(true);

    let logoUrl = currentStore.logoUrl ?? '';
    let heroImageUrl = currentStore.heroImageUrl ?? '';

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

    if (heroFile) {
      setUploadingHero(true);
      const uploaded = await uploadStoreHeroImage(heroFile, currentStore.id);
      setUploadingHero(false);
      if (uploaded) {
        heroImageUrl = uploaded;
      } else {
        toast({
          title: isAr ? 'تعذّر رفع صورة البانر' : 'Hero image upload failed',
          description: isAr
            ? 'تأكد من وجود bucket باسم store-assets في Supabase Storage'
            : 'Make sure a bucket named "store-assets" exists in Supabase Storage',
          variant: 'destructive',
        });
      }
    }

    const ok = await updateStoreSettings(currentStore.id, {
      name: settings.storeName,
      description: settings.description,
      ownerPhone: settings.whatsapp,
      primaryColor: settings.primaryColor,
      logoUrl,
      currency: settings.defaultCurrency,
      domain: settings.domain,
      brandIdentity: settings.brandIdentity,
      secondaryColor: settings.secondaryColor,
      accentColor: settings.accentColor,
      heroImageUrl,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      footerText: settings.footerText,
      showLogo: settings.showLogo,
      socialInstagram: settings.socialInstagram,
      socialFacebook: settings.socialFacebook,
      socialTiktok: settings.socialTiktok,
      socialSnapchat: settings.socialSnapchat,
      contactEmail: settings.contactEmail,
      secondaryPhone: settings.secondaryPhone,
      faq: faq.filter(f => f.q.trim() && f.a.trim()),
      returnPolicy: settings.returnPolicy,
      tieredDiscounts: tiers.filter(t => t.threshold > 0 && t.percent > 0).sort((a, b) => a.threshold - b.threshold),
    }, isAdminMode);

    if (!ok) {
      setSaving(false);
      toast({
        title: isAr ? 'تعذّر حفظ الإعدادات' : 'Could not save settings',
        description: isAr
          ? 'حدث خطأ أثناء الحفظ (قد يكون بسبب صلاحيات الوصول) — حاول تاني أو أعد تحميل الصفحة'
          : 'An error occurred while saving (possibly a permissions issue) — try again or reload the page',
        variant: 'destructive',
      });
      return;
    }

    await refreshStore();
    setSaving(false);
    setLogoFile(null);
    setHeroFile(null);

    toast({
      title: isAr ? 'تم الحفظ بنجاح' : 'Settings saved',
      description: isAr ? 'تم حفظ إعدادات المتجر وتطبيقها' : 'Store settings have been saved and applied.',
    });
  };

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
      <SectionCard titleAr="معلومات المتجر" titleEn="Store Information" isAr={isAr}>
        <Field labelAr="اسم المتجر" labelEn="Store Name" isAr={isAr}>
          <Input
            value={settings.storeName}
            onChange={e => set('storeName', e.target.value)}
            className="bg-background/50 border-border/50"
          />
        </Field>

        <Field labelAr="وصف المتجر" labelEn="Store Description" isAr={isAr}>
          <div className="flex justify-end mb-1.5">
            <AiEnhanceButton
              fieldType="store_description"
              currentText={settings.description}
              context={[settings.storeName, currentStore?.brandIdentity].filter(Boolean).join(' — ')}
              language={language}
              onApply={(text) => set('description', text)}
            />
          </div>
          <Textarea
            value={settings.description}
            onChange={e => set('description', e.target.value)}
            className="bg-background/50 border-border/50 resize-none h-20"
            placeholder={isAr ? 'اكتب وصفاً مختصراً لمتجرك...' : 'Write a brief description of your store...'}
          />
        </Field>

        <Field labelAr="الشعار" labelEn="Logo" isAr={isAr}>
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

        <Field labelAr="اللون الرئيسي" labelEn="Primary Color" isAr={isAr}>
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

        <Field labelAr="رقم واتساب" labelEn="WhatsApp Number" isAr={isAr}>
          <Input
            value={settings.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
            placeholder="+970591234567"
          />
        </Field>

        <Field labelAr="الدومين" labelEn="Domain" isAr={isAr}>
          <Input
            value={settings.domain}
            onChange={e => set('domain', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
            placeholder="my-store.mawq3i.com"
          />
        </Field>
      </SectionCard>

      <SectionCard titleAr="روابط التواصل" titleEn="Contact & Social Links" isAr={isAr}>
        <Field labelAr="رقم هاتف إضافي" labelEn="Secondary Phone" isAr={isAr}>
          <Input
            value={settings.secondaryPhone}
            onChange={e => set('secondaryPhone', e.target.value)}
            className="bg-background/50 border-border/50 font-mono"
            dir="ltr"
            placeholder="+970591234567"
          />
        </Field>

        <Field labelAr="البريد الإلكتروني" labelEn="Contact Email" isAr={isAr}>
          <Input
            value={settings.contactEmail}
            onChange={e => set('contactEmail', e.target.value)}
            className="bg-background/50 border-border/50"
            dir="ltr"
            placeholder="info@store.com"
          />
        </Field>

        <Field labelAr="انستقرام" labelEn="Instagram" isAr={isAr}>
          <Input
            value={settings.socialInstagram}
            onChange={e => set('socialInstagram', e.target.value)}
            className="bg-background/50 border-border/50"
            dir="ltr"
            placeholder="https://instagram.com/yourstore"
          />
        </Field>

        <Field labelAr="فيسبوك" labelEn="Facebook" isAr={isAr}>
          <Input
            value={settings.socialFacebook}
            onChange={e => set('socialFacebook', e.target.value)}
            className="bg-background/50 border-border/50"
            dir="ltr"
            placeholder="https://facebook.com/yourstore"
          />
        </Field>

        <Field labelAr="تيك توك" labelEn="TikTok" isAr={isAr}>
          <Input
            value={settings.socialTiktok}
            onChange={e => set('socialTiktok', e.target.value)}
            className="bg-background/50 border-border/50"
            dir="ltr"
            placeholder="https://tiktok.com/@yourstore"
          />
        </Field>

        <Field labelAr="سناب شات" labelEn="Snapchat" isAr={isAr}>
          <Input
            value={settings.socialSnapchat}
            onChange={e => set('socialSnapchat', e.target.value)}
            className="bg-background/50 border-border/50"
            dir="ltr"
            placeholder="https://snapchat.com/add/yourstore"
          />
        </Field>
      </SectionCard>

      <SectionCard titleAr="الأسئلة الشائعة" titleEn="FAQ" isAr={isAr}>
        <div className="space-y-3">
          {faq.length === 0 && (
            <p className="text-sm text-muted-foreground">{isAr ? 'لا توجد أسئلة بعد. أضف أول سؤال شائع لعملائك.' : 'No questions yet. Add your first FAQ item.'}</p>
          )}
          {faq.map((item, i) => (
            <div key={i} className="flex gap-2 items-start p-3 rounded-lg border border-border/50 bg-background/30">
              <div className="flex-1 space-y-2">
                <Input
                  value={item.q}
                  onChange={e => updateFaqItem(i, 'q', e.target.value)}
                  placeholder={isAr ? 'السؤال' : 'Question'}
                  className="bg-background/50 border-border/50 text-sm"
                />
                <Textarea
                  value={item.a}
                  onChange={e => updateFaqItem(i, 'a', e.target.value)}
                  placeholder={isAr ? 'الإجابة' : 'Answer'}
                  className="bg-background/50 border-border/50 text-sm resize-none h-16"
                />
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400 flex-shrink-0" onClick={() => removeFaqItem(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addFaqItem}>
            <Plus className="w-3.5 h-3.5" />
            {isAr ? 'إضافة سؤال' : 'Add Question'}
          </Button>
        </div>
      </SectionCard>

      <SectionCard titleAr="سياسة التبديل والاسترجاع" titleEn="Exchange & Return Policy" isAr={isAr}>
        <Field labelAr="نص السياسة" labelEn="Policy Text" isAr={isAr}>
          <Textarea
            value={settings.returnPolicy}
            onChange={e => set('returnPolicy', e.target.value)}
            className="bg-background/50 border-border/50 resize-none h-32"
            placeholder={isAr ? 'مثال: يمكن استبدال أو استرجاع المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون بحالته الأصلية...' : 'e.g. Products can be exchanged or returned within 7 days of delivery, provided they are in original condition...'}
          />
        </Field>
      </SectionCard>

      <SectionCard titleAr="عروض تصاعدية على السلة" titleEn="Tiered Cart Discounts" isAr={isAr}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {isAr
              ? 'كل ما زادت قيمة سلة العميل، بيزيد الخصم تلقائياً — بدون كود. مثال: 200₪ خصم 10%، 400₪ خصم 15%.'
              : 'The bigger the cart, the bigger the automatic discount — no code needed. e.g. 200₪ → 10% off, 400₪ → 15% off.'}
          </p>
          {tiers.length === 0 && (
            <p className="text-sm text-muted-foreground">{isAr ? 'لا توجد عروض تصاعدية بعد.' : 'No tiers configured yet.'}</p>
          )}
          {tiers.map((tier, i) => (
            <div key={i} className="flex gap-2 items-center p-3 rounded-lg border border-border/50 bg-background/30">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{isAr ? 'الحد الأدنى للسلة' : 'Min cart value'}</Label>
                  <Input
                    type="number"
                    value={tier.threshold || ''}
                    onChange={e => updateTier(i, 'threshold', Number(e.target.value))}
                    className="bg-background/50 border-border/50 text-sm font-mono"
                    placeholder="200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{isAr ? 'نسبة الخصم %' : 'Discount %'}</Label>
                  <Input
                    type="number"
                    value={tier.percent || ''}
                    onChange={e => updateTier(i, 'percent', Number(e.target.value))}
                    className="bg-background/50 border-border/50 text-sm font-mono"
                    placeholder="10"
                  />
                </div>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 hover:border-red-500/50 hover:text-red-400 flex-shrink-0 self-end" onClick={() => removeTier(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addTier}>
            <Plus className="w-3.5 h-3.5" />
            {isAr ? 'إضافة مستوى' : 'Add Tier'}
          </Button>
        </div>
      </SectionCard>

      <SectionCard titleAr="تخصيص واجهة المتجر" titleEn="Storefront Customization" isAr={isAr}>
        <p className="text-xs text-muted-foreground -mt-2">
          {isAr
            ? 'هذه التعديلات تنعكس مباشرة على متجرك الإلكتروني (البانر الرئيسي، الألوان، والتذييل).'
            : 'These changes apply directly to your live storefront (hero banner, colors, and footer).'}
        </p>

        <Field labelAr="صورة البانر الرئيسي" labelEn="Hero Banner Image" isAr={isAr}>
          <div
            className="flex items-center gap-4 px-4 py-3 border border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors bg-background/30"
            onClick={() => heroFileRef.current?.click()}
          >
            {heroPreview ? (
              <img src={heroPreview} alt="hero" className="w-16 h-10 object-cover rounded-md" />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <span className="text-sm text-muted-foreground block">
                {heroFile
                  ? heroFile.name
                  : heroPreview
                  ? (isAr ? 'انقر لتغيير صورة البانر' : 'Click to change hero image')
                  : (isAr ? 'رفع صورة بانر مخصصة' : 'Upload custom hero image')}
              </span>
              {heroFile && (
                <span className="text-xs text-primary">
                  {isAr ? 'سيُرفع عند الحفظ' : 'Will upload on save'}
                </span>
              )}
            </div>
            <Upload className="w-4 h-4 text-muted-foreground ms-auto" />
            <input ref={heroFileRef} type="file" className="hidden" accept="image/*" onChange={handleHeroChange} />
          </div>
        </Field>

        <Field labelAr="عنوان البانر الرئيسي" labelEn="Hero Title" isAr={isAr}>
          <Input
            value={settings.heroTitle}
            onChange={e => set('heroTitle', e.target.value)}
            className="bg-background/50 border-border/50"
            placeholder={isAr ? 'مثال: الأناقة التي تميّزك' : 'e.g. Elegance that defines you'}
          />
        </Field>

        <Field labelAr="النص الفرعي للبانر" labelEn="Hero Subtitle" isAr={isAr}>
          <Textarea
            value={settings.heroSubtitle}
            onChange={e => set('heroSubtitle', e.target.value)}
            className="bg-background/50 border-border/50 resize-none h-16"
          />
        </Field>

        <Field labelAr="اللون الثانوي" labelEn="Secondary Color" isAr={isAr}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.secondaryColor}
              onChange={e => set('secondaryColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-border/50 bg-transparent cursor-pointer"
            />
            <Input
              value={settings.secondaryColor}
              onChange={e => set('secondaryColor', e.target.value)}
              className="bg-background/50 border-border/50 font-mono"
              dir="ltr"
            />
          </div>
        </Field>

        <Field labelAr="لون التمييز" labelEn="Accent Color" isAr={isAr}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accentColor}
              onChange={e => set('accentColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-border/50 bg-transparent cursor-pointer"
            />
            <Input
              value={settings.accentColor}
              onChange={e => set('accentColor', e.target.value)}
              className="bg-background/50 border-border/50 font-mono"
              dir="ltr"
            />
          </div>
        </Field>

        <Field labelAr="نص التذييل (Footer)" labelEn="Footer Text" isAr={isAr}>
          <Input
            value={settings.footerText}
            onChange={e => set('footerText', e.target.value)}
            className="bg-background/50 border-border/50"
            placeholder={isAr ? 'مثال: جميع الحقوق محفوظة © 2026' : 'e.g. All rights reserved © 2026'}
          />
        </Field>

        <Field labelAr="إظهار الشعار" labelEn="Show Logo" isAr={isAr}>
          <div className="flex items-center gap-3">
            <Switch checked={settings.showLogo} onCheckedChange={(v) => set('showLogo', v)} />
            <span className="text-sm text-muted-foreground">
              {settings.showLogo
                ? (isAr ? 'الشعار ظاهر بالمتجر' : 'Logo is visible on storefront')
                : (isAr ? 'الشعار مخفي بالمتجر' : 'Logo is hidden on storefront')}
            </span>
          </div>
        </Field>
      </SectionCard>

      <SectionCard titleAr="التفضيلات" titleEn="Preferences" isAr={isAr}>
        <Field labelAr="العملة الافتراضية" labelEn="Default Currency" isAr={isAr}>
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

      <SectionCard titleAr="الهوية البصرية (لتحسين الصور بالذكاء الاصطناعي)" titleEn="Brand Identity (for AI image enhancement)" isAr={isAr}>
        <p className="text-xs text-muted-foreground -mt-2">
          {isAr
            ? 'اوصف الستايل اللي بتحبه لصور منتجاتك — هذا الوصف بيُستخدم تلقائياً كل مرة تحسّن فيها صورة منتج بالذكاء الاصطناعي، عشان كل صورك تطلع بنفس الهوية البصرية.'
            : "Describe the style you want for your product photos — this is automatically used every time you enhance a photo with AI, so all your images share one consistent brand look."}
        </p>
        <Field labelAr="وصف الستايل" labelEn="Style Description" isAr={isAr}>
          <Textarea
            value={settings.brandIdentity}
            onChange={e => set('brandIdentity', e.target.value)}
            className="bg-background/50 border-border/50 resize-none h-24"
            placeholder={isAr
              ? 'مثال: خلفية بيضاء نظيفة بستايل ستوديو، إضاءة ناعمة، ظل خفيف تحت المنتج، ألوان دافئة تناسب هوية متجري'
              : 'e.g. clean white studio background, soft lighting, subtle shadow under the product, warm tones matching my brand'}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(isAr
            ? ['خلفية بيضاء ستوديو', 'خلفية طبيعية خارجية', 'ستايل مینیمال فاخر', 'ألوان دافئة', 'إضاءة ناعمة احترافية']
            : ['White studio background', 'Natural outdoor background', 'Minimal luxury style', 'Warm tones', 'Soft professional lighting']
          ).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => set('brandIdentity', settings.brandIdentity ? `${settings.brandIdentity}، ${chip}` : chip)}
              className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
            >
              + {chip}
            </button>
          ))}
        </div>
      </SectionCard>

      <DeliveryAddressSection isAr={isAr} currentStore={currentStore} />

      <AdAccountsSection isAr={isAr} currentStore={currentStore} />

      <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">{isAr ? 'معلومات المتجر' : 'Store Info'}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span>{isAr ? 'الرابط العام:' : 'Public URL:'}</span>
          {currentStore.domain ? (
            <a href={`https://${currentStore.domain}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-primary hover:underline" dir="ltr">
              {currentStore.domain}
            </a>
          ) : (
            <span className="font-mono text-primary" dir="ltr">{currentStore.slug}.mawq3i.co</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span>{isAr ? 'البريد الإلكتروني:' : 'Email:'}</span>
          <span className="font-mono" dir="ltr">{currentStore.ownerEmail}</span>
        </div>
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
