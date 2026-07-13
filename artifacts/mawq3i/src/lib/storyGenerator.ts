import type { Product } from '@/data/mockData';
import type { StoreRecord } from '@/data/mockData';

// Generates a 1080x1920 branded promotional image for a product (Instagram Story format).
// Returns a PNG Blob ready to download or share.
export async function generateStoryImage(product: Product, store: StoreRecord, isAr: boolean): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const W = 1080, H = 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const primaryColor = store.primaryColor || '#52FF3F';
  const storeName = store.name;
  const productName = isAr ? product.nameAr : product.nameEn;
  const currencySymbol = product.currency === 'SAR' ? '﷼' : '₪';
  const price = `${currencySymbol}${product.price}`;

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx!.beginPath();
    ctx!.moveTo(x + r, y);
    ctx!.lineTo(x + w - r, y);
    ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx!.lineTo(x + w, y + h - r);
    ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx!.lineTo(x + r, y + h);
    ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx!.lineTo(x, y + r);
    ctx!.quadraticCurveTo(x, y, x + r, y);
    ctx!.closePath();
  }

  function wrapText(text: string, maxW: number, fontStr: string): string[] {
    ctx!.font = fontStr;
    const words = text.split(' ');
    let line = '';
    const result: string[] = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx!.measureText(test).width > maxW && line) {
        result.push(line);
        line = w;
      } else { line = test; }
    }
    if (line) result.push(line);
    return result;
  }

  // Background
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, W, H);

  // grain
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 200; grainCanvas.height = 200;
  const gctx = grainCanvas.getContext('2d')!;
  const imageData = gctx.createImageData(200, 200);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 255;
    imageData.data[i] = v; imageData.data[i + 1] = v;
    imageData.data[i + 2] = v; imageData.data[i + 3] = 8;
  }
  gctx.putImageData(imageData, 0, 0);
  const grainPat = ctx.createPattern(grainCanvas, 'repeat')!;
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, W, H);

  // Nav bar
  const navH = 110, navY = 80, navPad = 60;
  ctx.save();
  roundRect(navPad, navY, W - navPad * 2, navH, navH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#f0ede8';
  ctx.font = 'bold 46px serif';
  ctx.textAlign = 'right';
  ctx.fillText(storeName, W - navPad - 50, navY + navH * 0.64);

  ctx.fillStyle = 'rgba(240,237,232,0.55)';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(isAr ? '← المتجر' : 'Store →', navPad + 44, navY + navH * 0.64);

  // Product image
  const imgPad = 60;
  const imgX = imgPad, imgY = navY + navH + 60;
  const imgW = W - imgPad * 2;
  const imgH = Math.round(imgW * 1.18);

  ctx.save();
  roundRect(imgX, imgY, imgW, imgH, 48);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.clip();

  if (product.imageUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.max(imgW / img.width, imgH / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        const sx = imgX + (imgW - sw) / 2, sy = imgY + (imgH - sh) / 2;
        ctx!.drawImage(img, sx, sy, sw, sh);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = product.imageUrl!;
    });
  }

  const fadeGrad = ctx.createLinearGradient(0, imgY + imgH * 0.55, 0, imgY + imgH);
  fadeGrad.addColorStop(0, 'transparent');
  fadeGrad.addColorStop(1, 'rgba(12,12,12,0.85)');
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(imgX, imgY, imgW, imgH);
  ctx.restore();

  if (product.badge) {
    ctx.save();
    const badgeText = product.badge;
    ctx.font = 'bold 34px sans-serif';
    const bw = ctx.measureText(badgeText).width + 48;
    roundRect(W - imgPad - bw - 24, imgY + 28, bw, 58, 29);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, W - imgPad - bw / 2 - 24, imgY + 28 + 38);
    ctx.restore();
  }

  // Info section
  const infoY = imgY + imgH + 64;
  const infoPad = 70;

  ctx.fillStyle = 'rgba(240,237,232,0.45)';
  ctx.font = '500 34px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(storeName.toUpperCase(), W - infoPad, infoY);

  const nameLines = wrapText(productName, W - infoPad * 2, 'bold 88px serif');
  ctx.fillStyle = '#f0ede8';
  ctx.textAlign = 'right';
  let nameYCur = infoY + 96;
  for (const l of nameLines) {
    ctx.font = 'bold 88px serif';
    ctx.fillText(l, W - infoPad, nameYCur);
    nameYCur += 104;
  }

  const descText = product.descAr || product.descEn || '';
  if (descText) {
    const descLines = wrapText(descText, W - infoPad * 2, '300 38px sans-serif').slice(0, 2);
    ctx.fillStyle = 'rgba(240,237,232,0.45)';
    ctx.font = '300 38px sans-serif';
    let descY = nameYCur + 12;
    for (const l of descLines) { ctx.fillText(l, W - infoPad, descY); descY += 52; }
    nameYCur = descY + 20;
  }

  ctx.font = 'bold 110px serif';
  ctx.fillStyle = '#f0ede8';
  ctx.textAlign = 'right';
  ctx.fillText(price, W - infoPad, nameYCur + 100);

  // Buttons
  const btnY = nameYCur + 180;
  const btnH = 118, btnR = btnH / 2;
  const btnW = W - infoPad * 2;

  ctx.save();
  roundRect(infoPad, btnY, btnW, btnH, btnR);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#000';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isAr ? 'اطلب الآن عبر واتساب' : 'Order via WhatsApp', W / 2, btnY + btnH * 0.62);

  const btn2Y = btnY + btnH + 28;
  ctx.save();
  roundRect(infoPad, btn2Y, btnW, btnH, btnR);
  ctx.strokeStyle = 'rgba(240,237,232,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(240,237,232,0.75)';
  ctx.font = '400 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isAr ? 'تصفح المتجر كاملاً' : 'Browse Store', W / 2, btn2Y + btnH * 0.62);

  // Bottom domain
  const storeUrl = store.domain ? store.domain : `${store.slug}.mawq3i.co`;
  ctx.fillStyle = primaryColor + 'bb';
  ctx.font = '400 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(storeUrl, W / 2, H - 72);

  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, H - 8, W, 8);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
