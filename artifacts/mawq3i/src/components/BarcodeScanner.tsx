import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ScanBarcode, X } from 'lucide-react';

// يحمّل مكتبة html5-qrcode (خفيفة، مجانية، تدعم أكواد EAN/UPC/Code128...) من CDN مرة وحدة فقط
let libPromise: Promise<any> | null = null;
function loadLib(): Promise<any> {
  if ((window as any).Html5Qrcode) return Promise.resolve((window as any).Html5Qrcode);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload = () => resolve((window as any).Html5Qrcode);
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  return libPromise;
}

export default function BarcodeScanner({
  open, onOpenChange, onScan, isAr,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (code: string) => void;
  isAr: boolean;
}) {
  const elId = 'barcode-scanner-viewport';
  const scannerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setErr('');
    loadLib().then((Html5Qrcode) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(elId, { verbose: false });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 260, height: 160 } },
          (decodedText: string) => {
            if (cancelled) return;
            onScan(decodedText);
          },
          () => {} // يتجاهل فشل قراءة الفريم — طبيعي أثناء البحث عن الكود
        )
        .then(() => !cancelled && setReady(true))
        .catch(() => !cancelled && setErr(isAr ? 'تعذّر تشغيل الكاميرا. تأكد من إعطاء الإذن.' : 'Could not start camera. Check permission.'));
    }).catch(() => setErr(isAr ? 'تعذّر تحميل السكانر' : 'Could not load scanner'));

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ScanBarcode className="w-4 h-4" />
            {isAr ? 'وجّه الكاميرا نحو الباركود' : 'Point camera at the barcode'}
          </DialogTitle>
        </DialogHeader>
        <div className="relative p-4 pt-2">
          <div id={elId} className="w-full rounded-lg overflow-hidden bg-black/80 min-h-[220px]" />
          {!ready && !err && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {err && (
            <p className="mt-2 text-xs text-destructive text-center">{err}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            {isAr ? 'كمان بيشتغل مع آلة سكانر خارجية موصولة بالموبايل/الكمبيوتر — بس دبّس بالحقل واسحب الكود' : 'Also works with an external USB/Bluetooth scanner — just focus the field and scan'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
