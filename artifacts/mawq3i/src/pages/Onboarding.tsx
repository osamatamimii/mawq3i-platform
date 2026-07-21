import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, Bell, LineChart, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';
import AnimatedGlobe from '@/components/AnimatedGlobe';
import { markOnboardingSeen } from '@/lib/onboarding';

type Slide = {
  icon: typeof Store;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

const slides: Slide[] = [
  {
    icon: Store,
    titleAr: 'شوف متجرك قبل ما تلتزم',
    titleEn: 'See your store before you commit',
    bodyAr: 'موقعي يبني لك متجر جاهز تتفرج عليه قبل أي دفع — إذا عجبك، نكمل',
    bodyEn: "We build your store first, so you can see it before paying — if you like it, we go live",
  },
  {
    icon: Bell,
    titleAr: 'كل طلب، تعرف فيه أول بأول',
    titleEn: 'Know about every order, the moment it lands',
    bodyAr: 'إشعار فوري على تلفونك أول ما زبون يطلب — متل شوبيفاي بالضبط',
    bodyEn: "An instant push the second a customer orders — just like Shopify",
  },
  {
    icon: LineChart,
    titleAr: 'كل شي بمكان واحد',
    titleEn: 'Everything in one place',
    bodyAr: 'منتجاتك، طلباتك، ومبيعاتك — تتحكم فيهم من موبايلك بأي وقت',
    bodyEn: "Your products, orders, and sales — managed from your phone, anytime",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { language } = useAppContext();
  const [step, setStep] = useState(0);
  const isAr = language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const isLast = step === slides.length - 1;

  const finish = () => {
    markOnboardingSeen();
    onDone();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  const slide = slides[step];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#060a0d] overflow-hidden relative">
      {/* Ambient brand glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,hsl(var(--primary)/0.10),transparent)]" />

      {/* Skip */}
      <div className="relative z-10 flex justify-end px-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        {!isLast && (
          <button
            onClick={finish}
            className="text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors px-3 py-1.5"
          >
            {isAr ? 'تخطي' : 'Skip'}
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: isAr ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 24 : -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center max-w-xs"
          >
            {step === 0 ? (
              <div className="mb-8 opacity-90">
                <AnimatedGlobe size={180} />
              </div>
            ) : (
              <div className="relative mb-8">
                <div className="absolute -inset-5 bg-primary/15 rounded-full blur-2xl" />
                <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                  <slide.icon className="w-9 h-9 text-primary" strokeWidth={1.75} />
                </div>
              </div>
            )}

            <h1 className="text-2xl font-bold text-foreground leading-snug mb-3">
              {isAr ? slide.titleAr : slide.titleEn}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isAr ? slide.bodyAr : slide.bodyEn}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots + CTA */}
      <div className="relative z-10 px-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-primary/25'
              }`}
            />
          ))}
        </div>

        <Button
          onClick={next}
          className="w-full h-12 text-base font-semibold gap-2"
        >
          {isLast ? (isAr ? 'ابدأ' : 'Get started') : (isAr ? 'التالي' : 'Next')}
          <ArrowIcon className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
