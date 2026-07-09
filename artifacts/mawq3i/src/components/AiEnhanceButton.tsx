import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check, RefreshCw } from 'lucide-react';

interface AiEnhanceButtonProps {
  fieldType: 'product_name' | 'product_description' | 'promo_title' | 'promo_subtitle' | 'store_description';
  currentText: string;
  context?: string;
  language?: string; // 'ar' | 'en'
  onApply: (text: string) => void;
  disabled?: boolean;
}

/**
 * A small inline "✨ Enhance with AI" button meant to sit next to any text
 * Input/Textarea across the dashboard. Calls the shared /api/enhance-text
 * endpoint and lets the merchant pick from 2-3 rewritten variants.
 */
export default function AiEnhanceButton({
  fieldType,
  currentText,
  context,
  language = 'ar',
  onApply,
  disabled,
}: AiEnhanceButtonProps) {
  const isAr = language !== 'en';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldType, currentText, context, language }),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestions?.length) {
        setError(data.error || (isAr ? 'صار خطأ، جرب تاني' : 'Something went wrong, try again'));
      } else {
        setSuggestions(data.suggestions);
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال، تحقق من الإنترنت' : 'Connection failed, check your internet');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && suggestions.length === 0 && !loading) {
      fetchSuggestions();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={isAr ? 'حسّن بالذكاء الصناعي' : 'Enhance with AI'}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary/80 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isAr ? 'حسّن بالذكاء الصناعي' : 'Enhance with AI'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 bg-popover border-border/50 p-3" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {isAr ? 'اقتراحات' : 'Suggestions'}
          </span>
          {!loading && (
            <button
              onClick={fetchSuggestions}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={isAr ? 'أعد التوليد' : 'Regenerate'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isAr ? 'جاري التوليد...' : 'Generating...'}
          </div>
        )}

        {!loading && error && (
          <div className="py-3 text-center">
            <p className="text-xs text-red-400 mb-2">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchSuggestions} className="h-7 text-xs">
              {isAr ? 'حاول مرة ثانية' : 'Try again'}
            </Button>
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  onApply(s);
                  setOpen(false);
                }}
                className="w-full text-start rounded-md border border-border/50 bg-background/40 hover:bg-background/70 hover:border-primary/40 px-2.5 py-2 text-xs leading-relaxed transition-colors group flex items-start gap-2"
              >
                <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
