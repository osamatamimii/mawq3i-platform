import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Store, BarChart3, Sliders, ArrowLeft, ArrowRight } from 'lucide-react';
import SupportContact from '@/components/SupportContact';
import AnimatedGlobe from '@/components/AnimatedGlobe';

function navigateByEmail(email: string, setLocation: (path: string) => void) {
  if (email.trim().toLowerCase() === 'admin@mawq3i.com') {
    setLocation('/admin');
  } else {
    setLocation('/dashboard');
  }
}

const features = [
  {
    icon: Store,
    titleAr: 'متجر احترافي',
    titleEn: 'Professional Store',
    descAr: 'أنشئ متجرك الإلكتروني باحترافية عالية',
    descEn: 'Build your online store professionally',
  },
  {
    icon: BarChart3,
    titleAr: 'إحصائيات لحظية',
    titleEn: 'Real-time Analytics',
    descAr: 'تابع مبيعاتك وطلباتك لحظة بلحظة',
    descEn: 'Track your sales and orders in real-time',
  },
  {
    icon: Sliders,
    titleAr: 'إدارة سهلة',
    titleEn: 'Easy Management',
    descAr: 'واجهة بسيطة تتحكم بها بكل سهولة',
    descEn: 'Simple interface for effortless control',
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { language, setLanguage } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAr = language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!signInError && data.user) {
        navigateByEmail(data.user.email ?? email, setLocation);
        return;
      }

      setError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Incorrect email or password');
    } catch {
      setError(isAr ? 'حدث خطأ، يرجى المحاولة مجدداً' : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex bg-background overflow-hidden">
      {/* ── Left Panel (visual, hidden on mobile) ─────────────────────── */}
      <motion.div
        className="hidden lg:flex flex-col justify-between w-[52%] relative p-12 overflow-hidden"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-background dark:bg-[#060a0d]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,hsl(var(--primary)/0.07),transparent)]" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background dark:from-[#060a0d] to-transparent" />

        {/* Animated globe decoration */}
        <div className="hidden xl:block absolute top-1/2 end-8 -translate-y-1/2 pointer-events-none">
          <AnimatedGlobe size={340} />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="Mawq3i" className="w-10 h-10 object-contain" />
          <span className="text-foreground text-xl font-bold tracking-tight">Mawq3i | موقعي</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-10">
          {/* Glowing logo */}
          <div className="flex flex-col items-start gap-6">
            <div className="relative">
              <div className="absolute -inset-6 bg-primary/20 rounded-full blur-3xl" />
              <img
                src="/logo.png"
                alt="Mawq3i"
                className="relative w-20 h-20 object-contain drop-shadow-[0_0_18px_hsl(var(--primary)/0.45)] dark:drop-shadow-[0_0_24px_rgba(82,255,63,0.6)]"
              />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3">
                {isAr ? 'نساعد التجّار على' : 'We help merchants'}<br />
                <span className="text-primary">{isAr ? 'البيع أكثر' : 'sell more'}</span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-xs">
                {isAr
                  ? 'منصة متكاملة للتجار في الوطن العربي لبناء متاجرهم الإلكترونية'
                  : 'Complete platform for merchants across the Arab world to build their online stores'}
              </p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12, duration: 0.5 }}
                className="flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">{isAr ? f.titleAr : f.titleEn}</p>
                  <p className="text-muted-foreground text-xs">{isAr ? f.descAr : f.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary/80 text-xs font-medium">
              {isAr ? 'متاح 24/7 — ILS & SAR' : '24/7 available — ILS & SAR'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Right Panel (form) ─────────────────────────────────────────── */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {/* Language toggle */}
        <div className="absolute top-6 end-6">
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors bg-card/50 backdrop-blur-sm font-mono"
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <img src="/logo.png" alt="Mawq3i" className="w-9 h-9 object-contain" />
          <span className="text-foreground text-xl font-bold">Mawq3i | موقعي</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {isAr ? 'أهلاً بعودتك' : 'Welcome back'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAr ? 'سجّل الدخول للوصول إلى لوحة التحكم' : 'Sign in to access your dashboard'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-foreground/70 font-medium">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="owner@store.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="h-11 bg-card/60 border-border/60 dir-ltr placeholder:text-muted-foreground/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-foreground/70 font-medium">
                {isAr ? 'كلمة المرور' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="h-11 bg-card/60 border-border/60 placeholder:text-muted-foreground/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
                required
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2 text-center"
              >
                {error}
              </motion.p>
            )}

            <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-bold gap-2 shadow-[0_0_24px_rgba(82,255,63,0.12)] hover:shadow-[0_0_36px_rgba(82,255,63,0.25)] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isAr ? 'تسجيل الدخول' : 'Sign In'}
                    <ArrowIcon className="w-4 h-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Support contact */}
          <div className="mt-8 pt-6 border-t border-border/40 flex flex-col items-center gap-2.5">
            <p className="text-xs text-muted-foreground">{isAr ? 'بحاجة مساعدة؟ تواصل معنا' : 'Need help? Get in touch'}</p>
            <SupportContact isAr={isAr} variant="row" />
          </div>

        </div>
      </motion.div>
    </div>
  );
}
