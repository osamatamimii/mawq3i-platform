import { supabase, adminRest } from './supabase';
import { Product, Order, StoreRecord } from '@/data/mockData';

// When useAdmin=true, use adminRest (REST API with service key, no extra GoTrueClient)
// When useAdmin=false, use standard supabase client (respects RLS)


// ─── Mapping helpers ──────────────────────────────────────────────────

function rowToProduct(row: any): Product {
  return {
    id: String(row.id),
    nameAr: row.name_ar ?? '',
    nameEn: row.name_en ?? '',
    descAr: row.desc_ar ?? '',
    descEn: row.desc_en ?? '',
    price: Number(row.price),
    currency: row.currency ?? 'ILS',
    stock: Number(row.stock),
    category: row.category ?? '',
    status: row.status ?? 'visible',
    imageUrl: row.image_url ?? '',
    badge: row.badge ?? '',
    variants: row.variants ? (typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants) : [],
    storeId: row.store_id ?? '',
  };
}

function productToRow(p: Partial<Product> & { storeId?: string }) {
  return {
    ...(p.nameAr !== undefined && { name_ar: p.nameAr }),
    ...(p.nameEn !== undefined && { name_en: p.nameEn }),
    ...(p.descAr !== undefined && { desc_ar: p.descAr }),
    ...(p.descEn !== undefined && { desc_en: p.descEn }),
    ...(p.price !== undefined && { price: p.price }),
    ...(p.currency !== undefined && { currency: p.currency }),
    ...(p.stock !== undefined && { stock: p.stock }),
    ...(p.category !== undefined && { category: p.category }),
    ...(p.status !== undefined && { status: p.status }),
    ...(p.storeId !== undefined && { store_id: p.storeId }),
    ...(p.imageUrl !== undefined && { image_url: p.imageUrl }),
    ...(p.badge !== undefined && { badge: p.badge }),
    ...(p.variants !== undefined && { variants: JSON.stringify(p.variants) }),
  };
}

function rowToOrder(row: any): Order {
  return {
    id: String(row.id),
    customerName: row.customer_name ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    address: row.address ?? '',
    amount: Number(row.amount),
    currency: row.currency ?? 'ILS',
    paymentMethod: row.payment_method ?? '',
    productName: row.product_name ?? '',
    items: row.items ? (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) : [],
    notes: row.notes ?? '',
    status: row.status ?? 'new',
    date: row.date ?? '',
  };
}

function rowToStore(row: any): StoreRecord {
  return {
    id: String(row.id),
    name: row.name ?? '',
    slug: row.slug ?? '',
    domain: row.domain ?? '',
    ownerName: row.owner_name ?? '',
    ownerEmail: row.owner_email ?? '',
    ownerPhone: row.owner_phone ?? '',
    currency: row.currency ?? 'ILS',
    status: row.status ?? 'active',
    ordersCount: Number(row.orders_count ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    subscriptionStatus: row.subscription_status ?? 'trial',
    subscriptionPlan: row.subscription_plan ?? 'monthly',
    subscriptionPaid: Boolean(row.subscription_paid),
    renewalDate: row.renewal_date ?? '',
    joinDate: row.join_date ?? '',
    primaryColor: row.primary_color ?? '#52FF3F',
    logoUrl: row.logo_url ?? '',
    description: row.description ?? '',
  };
}

// ─── Products ─────────────────────────────────────────────────────────

export async function getProducts(storeId?: string, useAdmin = false): Promise<Product[]> {
  try {
    if (useAdmin && storeId) {
      const rows = await adminRest.select('products',
        `store_id=eq.${storeId}&order=created_at.desc`
      );
      return rows.map(rowToProduct);
    }
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToProduct);
  } catch {
    return [];
  }
}

export async function addProduct(product: Omit<Product, 'id'> & { storeId?: string }, useAdmin = false): Promise<Product | null> {
  try {
    if (useAdmin) {
      const row = productToRow(product);
      const data = await adminRest.insert('products', row);
      if (!data) return null;
      return rowToProduct(data);
    }
    const { data, error } = await supabase.from('products').insert([productToRow(product)]).select().single();
    if (error || !data) return null;
    return rowToProduct(data);
  } catch {
    return null;
  }
}

export async function updateProduct(id: string, updates: Partial<Product>, useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.update('products', `id=eq.${id}`, productToRow(updates));
    }
    const { error } = await supabase.from('products').update(productToRow(updates)).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteProduct(id: string, useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.delete('products', `id=eq.${id}`);
    }
    const { error } = await supabase.from('products').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Orders ──────────────────────────────────────────────────────────

export async function getOrders(storeId?: string, useAdmin = false): Promise<Order[]> {
  try {
    if (useAdmin && storeId) {
      const rows = await adminRest.select('orders',
        `store_id=eq.${storeId}&order=created_at.desc`
      );
      return rows.map(rowToOrder);
    }
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToOrder);
  } catch {
    return [];
  }
}

export async function createOrder(params: {
  storeId: string;
  items: { productId: string; productName: string; variantLabel?: string; quantity: number; price: number }[];
  customerName: string;
  phone: string;
  city: string;
  address?: string;
  paymentMethod: 'cod' | 'card';
  amount: number;
  currency: 'ILS' | 'SAR';
  notes?: string;
}): Promise<Order | null> {
  try {
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString().split('T')[0];
    const firstItem = params.items[0];
    const productName = params.items.map(i => `${i.productName}${i.variantLabel ? ' (' + i.variantLabel + ')' : ''} x${i.quantity}`).join(', ');
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        id: orderId,
        store_id: params.storeId,
        product_id: firstItem?.productId ?? '',
        product_name: productName,
        customer_name: params.customerName,
        phone: params.phone,
        city: params.city,
        address: params.address ?? '',
        items: JSON.stringify(params.items),
        amount: params.amount,
        currency: params.currency,
        payment_method: params.paymentMethod,
        notes: params.notes ?? '',
        status: 'new',
        date: now,
      }])
      .select()
      .single();
    if (error || !data) return null;
    return rowToOrder(data);
  } catch {
    return null;
  }
}

export async function updateOrderStatus(id: string, status: Order['status'], useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.update('orders', `id=eq.${id}`, { status });
    }
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Stores ──────────────────────────────────────────────────────────

export async function getAllStores(): Promise<StoreRecord[]> {
  try {
    const { data, error } = await supabase.from('stores').select('*').order('join_date', { ascending: false });
    if (error || !data) return [];
    return data.map(rowToStore);
  } catch {
    return [];
  }
}

export async function getStoreByOwnerEmail(email: string, userId?: string): Promise<StoreRecord | null> {
  try {
    // Search by email first
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_email', email)
      .maybeSingle();
    if (!error && data) return rowToStore(data);

    // Fallback: search by owner_id (auth user ID)
    if (userId) {
      const { data: data2, error: error2 } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();
      if (!error2 && data2) return rowToStore(data2);
    }

    return null;
  } catch {
    return null;
  }
}

export async function getStoreBySlug(slug: string): Promise<StoreRecord | null> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    return rowToStore(data);
  } catch {
    return null;
  }
}

export async function getStoreByDomain(domain: string): Promise<StoreRecord | null> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('domain', domain)
      .single();
    if (error || !data) return null;
    return rowToStore(data);
  } catch {
    return null;
  }
}

export async function addStore(store: Omit<StoreRecord, 'id'>): Promise<StoreRecord | null> {
  try {
    const row = {
      name: store.name,
      slug: store.slug,
      domain: store.domain,
      owner_name: store.ownerName,
      owner_email: store.ownerEmail,
      owner_phone: store.ownerPhone,
      currency: store.currency,
      status: store.status,
      orders_count: store.ordersCount,
      total_sales: store.totalSales,
      subscription_status: store.subscriptionStatus,
      subscription_plan: store.subscriptionPlan,
      subscription_paid: store.subscriptionPaid,
      renewal_date: store.renewalDate,
      join_date: store.joinDate,
      primary_color: store.primaryColor ?? '#52FF3F',
      logo_url: store.logoUrl ?? '',
    };
    const { data, error } = await supabase.from('stores').insert([row]).select().single();
    if (error || !data) return null;
    return rowToStore(data);
  } catch {
    return null;
  }
}

export async function updateStore(id: string, updates: Partial<StoreRecord>): Promise<boolean> {
  try {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.slug !== undefined) row.slug = updates.slug;
    if (updates.domain !== undefined) row.domain = updates.domain;
    if (updates.ownerName !== undefined) row.owner_name = updates.ownerName;
    if (updates.ownerEmail !== undefined) row.owner_email = updates.ownerEmail;
    if (updates.ownerPhone !== undefined) row.owner_phone = updates.ownerPhone;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.subscriptionPaid !== undefined) row.subscription_paid = updates.subscriptionPaid;
    if (updates.primaryColor !== undefined) row.primary_color = updates.primaryColor;
    if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl;
    const { error } = await supabase.from('stores').update(row).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function updateStoreSettings(id: string, settings: {
  name?: string;
  ownerPhone?: string;
  primaryColor?: string;
  logoUrl?: string;
  currency?: string;
  domain?: string;
  description?: string;
}, useAdmin = false): Promise<boolean> {
  try {
    const row: Record<string, unknown> = {};
    if (settings.name !== undefined) row.name = settings.name;
    if (settings.ownerPhone !== undefined) row.owner_phone = settings.ownerPhone;
    if (settings.primaryColor !== undefined) row.primary_color = settings.primaryColor;
    if (settings.logoUrl !== undefined) row.logo_url = settings.logoUrl;
    if (settings.currency !== undefined) row.currency = settings.currency;
    if (settings.domain !== undefined) row.domain = settings.domain;
    if (settings.description !== undefined) row.description = settings.description;

    if (useAdmin) {
      return await adminRest.update('stores', `id=eq.${id}`, row);
    }
    const { error } = await supabase.from('stores').update(row).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteStore(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('stores').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
