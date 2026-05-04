import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [, setLocation] = useLocation();
  const { language, setLanguage } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isAr = language === 'ar';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      if (email === 'admin@mawq3i.com') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[130px]" />
      </div>

      <div className="absolute top-6 end-6 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="font-mono bg-background/50 backdrop-blur-sm border-border/50"
          data-testid="button-language-toggle"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>
      </div>

      <motion.div
        className="w-full max-w-md px-6 z-10"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/logo.png"
              alt="Mawq3i"
              className="w-14 h-14 object-contain drop-shadow-[0_0_16px_rgba(82,255,63,0.5)]"
            />
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Mawq3i | موقعي
            </h1>
          </div>
          <p className="text-muted-foreground text-base">
            {isAr ? 'أدر متجرك بسهولة واحترافية' : 'Manage your store easily and professionally'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card p-8 rounded-2xl border border-border/50 shadow-2xl">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="owner@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary transition-colors h-11"
              dir="ltr"
              required
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
              {isAr ? 'كلمة المرور' : 'Password'}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary transition-colors h-11"
              dir="ltr"
              required
              data-testid="input-password"
            />
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(82,255,63,0.15)] hover:shadow-[0_0_30px_rgba(82,255,63,0.3)] transition-all"
              data-testid="button-login"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Button>
          </motion.div>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-5">
          {isAr
            ? 'للدخول كمدير: admin@mawq3i.com'
            : 'Admin login: admin@mawq3i.com'}
        </p>
      </motion.div>
    </div>
  );
}
