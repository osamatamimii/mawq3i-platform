function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:mime;base64," prefix
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type EnhanceImageResult = {
  file: File | null;
  limitReached?: boolean;
  errorMessage?: string;
};

export async function enhanceProductImage(
  file: File,
  brandIdentity: string,
  language: 'ar' | 'en',
  storeId?: string
): Promise<EnhanceImageResult> {
  try {
    const imageBase64 = await fileToBase64(file);
    const res = await fetch('/api/enhance-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: file.type || 'image/jpeg',
        brandIdentity,
        language,
        storeId,
      }),
    });
    const data = await res.json();
    if (data.limitReached) {
      return { file: null, limitReached: true, errorMessage: data.error };
    }
    if (!res.ok || !data.imageBase64) {
      return { file: null, errorMessage: data.error };
    }

    const byteChars = atob(data.imageBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const mimeType = data.mimeType || 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    const enhancedFile = new File([byteArray], `enhanced-${Date.now()}.${ext}`, { type: mimeType });
    return { file: enhancedFile };
  } catch {
    return { file: null };
  }
}
