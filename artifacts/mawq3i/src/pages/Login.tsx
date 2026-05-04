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
      setLocation('/dashboard');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-6 right-6 z-20">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="font-mono bg-background/50 backdrop-blur-sm border-border/50"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </Button>
      </div>

      <motion.div 
        className="w-full max-w-md p-8 z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img
              src="/logo.png"
              alt="Mawq3i"
              className="w-12 h-12 object-contain drop-shadow-[0_0_12px_rgba(82,255,63,0.5)]"
            />
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Mawq3i | موقعي
            </h1>
          </div>
          <p className="text-muted-foreground">
            {isAr ? 'أدر متجرك بسهولة واحترافية' : 'Manage your store easily and professionally'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-2xl border border-border/50 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="admin@mawq3i.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              dir="ltr"
              required
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                {isAr ? 'كلمة المرور' : 'Password'}
              </Label>
            </div>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              dir="ltr"
              required
            />
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium shadow-[0_0_20px_rgba(82,255,63,0.15)] hover:shadow-[0_0_25px_rgba(82,255,63,0.3)] transition-all"
            >
              {isAr ? 'تسجيل الدخول إلى موقعي' : 'Login to Mawq3i'}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
