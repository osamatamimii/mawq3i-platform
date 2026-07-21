import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, Bell, LineChart, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';
import { markOnboardingSeen } from '@/lib/onboarding';
import { requestNotificationPermissionEarly } from '@/lib/push';

type Feature = {
  icon: typeof Store;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

const features: Feature[] = [
  {
    icon: Store,
    titleAr: 'شوف متجرك قبل ما تلتزم',
    titleEn: 'See your store before you commit',
    bodyAr: 'نبني لك متجر جاهز تتفرج عليه قبل أي دفع',
    bodyEn: 'A ready store to preview before you pay anything',
  },
  {
    icon: Bell,
    titleAr: 'إشعار فوري لكل طلب',
    titleEn: 'An instant alert for every order',
    bodyAr: 'تعرف بالطلب الجديد أول بأول، متل شوبيفاي بالضبط',
    bodyEn: 'Know the moment a customer orders — just like Shopify',
  },
  {
    icon: LineChart,
    titleAr: 'كل شي من موبايلك',
    titleEn: 'Everything from your phone',
    bodyAr: 'منتجاتك وطلباتك ومبيعاتك بمكان واحد، بأي وقت',
    bodyEn: 'Products, orders, and sales in one place, anytime',
  },
];

// STEP.SPLASH -> STEP.FEATURES -> STEP.NOTIFICATIONS -> onDone()
const enum Step {
  Splash = 0,
  Features = 1,
  Notifications = 2,
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { language } = useAppContext();
  const [step, setStep] = useState<Step>(Step.Splash);
  const [enabling, setEnabling] = useState(false);
  const isAr = language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  // Splash auto-advances shortly after the logo animates in.
  useEffect(() => {
    if (step !== Step.Splash) return;
    const t = setTimeout(() => setStep(Step.Features), 1600);
    return () => clearTimeout(t);
  }, [step]);

  const finish = () => {
    markOnboardingSeen();
    onDone();
  };

  const handleEnableNotifications = async () => {
    setEnabling(true);
    try {
      await requestNotificationPermissionEarly();
    } finally {
      setEnabling(false);
      finish();
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#060a0d] overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,hsl(var(--primary)/0.10),transparent)]" />

      <AnimatePresence mode="wait">
        {step === Step.Splash && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center"
            onClick={() => setStep(Step.Features)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative"
            >
              <div className="absolute -inset-8 bg-primary/25 rounded-full blur-3xl" />
              <img
                src="/logo.png"
                alt="Mawq3i"
                className="relative w-24 h-24 object-contain drop-shadow-[0_0_28px_rgba(82,255,63,0.55)]"
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mt-5 text-foreground text-lg font-bold tracking-tight"
            >
              Mawq3i | موقعي
            </motion.p>
          </motion.div>
        )}

        {step === Step.Features && (
          <motion.div
            key="features"
            initial={{ opacity: 0, x: isAr ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 24 : -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top)+2.5rem)]"
          >
            <div className="mb-9">
              <h1 className="text-[26px] font-bold text-foreground leading-tight mb-2">
                {isAr ? 'كل شي يحتاجه تاجر' : 'Everything a merchant needs'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isAr ? 'منصة موقعي بخطوات بسيطة' : 'The Mawq3i platform, made simple'}
              </p>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-7">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.45 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="pt-1">
                    <p className="text-foreground text-[15px] font-semibold mb-0.5">
                      {isAr ? f.titleAr : f.titleEn}
                    </p>
                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                      {isAr ? f.bodyAr : f.bodyEn}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-6">
              <Button onClick={() => setStep(Step.Notifications)} className="w-full h-12 text-base font-semibold gap-2">
                {isAr ? 'التالي' : 'Next'}
                <ArrowIcon className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === Step.Notifications && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: isAr ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 24 : -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="relative mb-8">
              <div className="absolute -inset-6 bg-primary/20 rounded-full blur-3xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                <Bell className="w-9 h-9 text-primary" strokeWidth={1.75} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-snug mb-3 max-w-xs">
              {isAr ? 'خليك أول من يعرف بكل طلب' : 'Be first to know about every order'}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              {isAr
                ? 'فعّل الإشعارات عشان توصلك رسالة فورية أول ما زبون يطلب من متجرك'
                : 'Turn on notifications to get an instant alert the moment a customer orders'}
            </p>

            <div className="w-full max-w-xs mt-10 space-y-3">
              <Button
                onClick={handleEnableNotifications}
                disabled={enabling}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                <Check className="w-4 h-4" />
                {isAr ? 'فعّل الإشعارات' : 'Enable notifications'}
              </Button>
              <button
                onClick={finish}
                disabled={enabling}
                className="w-full text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors py-2"
              >
                {isAr ? 'لاحقًا' : 'Maybe later'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== Step.Splash && (
        <div className="relative z-10 flex justify-center gap-2 pb-6">
          {[Step.Features, Step.Notifications].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-primary' : 'w-1.5 bg-primary/25'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
