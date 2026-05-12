import { supabase } from './supabase';

export async function uploadProductImage(file: File, storeId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) return null;

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function uploadStoreLogo(file: File, storeId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `logos/${storeId}.${ext}`;

    const { error } = await supabase.storage
      .from('store-assets')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from('store-assets').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  } catch {
    return null;
  }
}
