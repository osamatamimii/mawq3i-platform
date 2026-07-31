import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Boxes, Plus, Trash2 } from 'lucide-react';

export type WholesaleTier = { minQty: number; price: number };

interface Props {
  isAr: boolean;
  tiers: WholesaleTier[];
  onChange: (tiers: WholesaleTier[]) => void;
  moq: string; // kept as string to match other numeric inputs in the forms
  onMoqChange: (moq: string) => void;
  currency: string;
}

/** محرر أسعار الجملة حسب الكمية + الحد الأدنى للطلب (MOQ) — يُستخدم بصفحات إضافة/تعديل المنتج */
export default function WholesaleTiersEditor({ isAr, tiers, onChange, moq, onMoqChange, currency }: Props) {
  const addTier = () => {
    const lastMin = tiers.length ? tiers[tiers.length - 1].minQty : 1;
    onChange([...tiers, { minQty: lastMin + 10, price: 0 }]);
  };
  const removeTier = (idx: number) => onChange(tiers.filter((_, i) => i !== idx));
  const updateTier = (idx: number, key: keyof WholesaleTier, value: number) => {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t)));
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary" />
          {isAr ? 'أسعار الجملة (اختياري)' : 'Wholesale Pricing (optional)'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? 'حدّد سعر أقل تلقائياً لما الزبون يطلب كمية أكبر — بيتحسب بالسلة مباشرة بدون كوبون.'
            : 'Automatically apply a lower price at higher quantities — calculated live in the cart, no coupon needed.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">{isAr ? 'الحد الأدنى للطلب (MOQ)' : 'Minimum Order Quantity (MOQ)'}</Label>
          <Input
            type="number"
            min={1}
            className="bg-background/50 border-border/50 max-w-[160px]"
            value={moq}
            onChange={e => onMoqChange(e.target.value)}
            placeholder="1"
          />
          <p className="text-[11px] text-muted-foreground">
            {isAr ? 'ما رح يقدر الزبون يشتري أقل من هالكمية.' : "Customers can't buy fewer than this quantity."}
          </p>
        </div>

        {tiers.length > 0 && (
          <div className="space-y-2">
            {tiers
              .slice()
              .sort((a, b) => a.minQty - b.minQty)
              .map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{isAr ? 'من كمية' : 'From qty'}</Label>
                    <Input
                      type="number"
                      min={1}
                      className="bg-background/50 border-border/50"
                      value={tier.minQty || ''}
                      onChange={e => updateTier(idx, 'minQty', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {isAr ? `السعر (${currency})` : `Price (${currency})`}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="bg-background/50 border-border/50"
                      value={tier.price || ''}
                      onChange={e => updateTier(idx, 'price', Number(e.target.value))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-5 h-9 w-9 text-destructive shrink-0"
                    onClick={() => removeTier(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
          </div>
        )}

        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addTier}>
          <Plus className="w-4 h-4 me-1.5" />
          {isAr ? 'أضف درجة سعر جملة' : 'Add price tier'}
        </Button>
      </CardContent>
    </Card>
  );
}
