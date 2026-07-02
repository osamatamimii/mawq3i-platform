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

export async function enhanceProductImage(
  file: File,
  brandIdentity: string,
  language: 'ar' | 'en'
): Promise<File | null> {
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
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.imageBase64) return null;

    const byteChars = atob(data.imageBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const mimeType = data.mimeType || 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    return new File([byteArray], `enhanced-${Date.now()}.${ext}`, { type: mimeType });
  } catch {
    return null;
  }
}
