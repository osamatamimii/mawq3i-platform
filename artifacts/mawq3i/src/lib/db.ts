import { supabase, adminRest } from './supabase';
import { Product, Order, StoreRecord, Review } from '@/data/mockData';

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
    videoUrl: row.video_url ?? '',
    badge: row.badge ?? '',
    variants: row.variants ? (typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants) : [],
    storeId: row.store_id ?? '',
    relatedProductIds: Array.isArray(row.related_product_ids) ? row.related_product_ids : [],
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
    ...(p.videoUrl !== undefined && { video_url: p.videoUrl }),
    ...(p.badge !== undefined && { badge: p.badge }),
    ...(p.variants !== undefined && { variants: JSON.stringify(p.variants) }),
    ...(p.relatedProductIds !== undefined && { related_product_ids: p.relatedProductIds }),
  };
}

function rowToReview(row: any): Review {
  return {
    id: String(row.id),
    storeId: row.store_id ?? '',
    productId: String(row.product_id ?? ''),
    customerName: row.customer_name ?? '',
    rating: Number(row.rating) || 0,
    comment: row.comment ?? '',
    status: row.status ?? 'pending',
    createdAt: row.created_at ?? '',
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
    paymentStatus: row.payment_status ?? '',
    deliveryProvider: row.delivery_provider ?? 'self',
    togoDeliveryOrderId: row.togo_delivery_order_id ?? '',
    togoDeliveryStatus: row.togo_delivery_status ?? '',
    togoCourierName: row.togo_courier_name ?? '',
    togoDeliveryPrice: row.togo_delivery_price != null ? Number(row.togo_delivery_price) : undefined,
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
    brandIdentity: row.brand_identity ?? '',
    secondaryColor: row.secondary_color ?? '#1A1A1A',
    accentColor: row.accent_color ?? row.primary_color ?? '#52FF3F',
    heroImageUrl: row.hero_image_url ?? '',
    heroTitle: row.hero_title ?? '',
    heroSubtitle: row.hero_subtitle ?? '',
    footerText: row.footer_text ?? '',
    showLogo: row.show_logo !== false,
    togoApiKey: row.togo_api_key ?? '',
    togoMerchantId: row.togo_merchant_id ?? '',
    cardPaymentEnabled: Boolean(row.card_payment_enabled),
    togoMerchantAddressId: row.togo_merchant_address_id ?? '',
    togoPickupAreaId: row.togo_pickup_area_id ?? '',
    togoPickupDetails: row.togo_pickup_details ?? '',
    togoDeliveryEnabled: Boolean(row.togo_delivery_enabled),
    socialInstagram: row.social_instagram ?? '',
    socialFacebook: row.social_facebook ?? '',
    socialTiktok: row.social_tiktok ?? '',
    socialSnapchat: row.social_snapchat ?? '',
    contactEmail: row.contact_email ?? '',
    secondaryPhone: row.secondary_phone ?? '',
    faq: Array.isArray(row.faq) ? row.faq : [],
    returnPolicy: row.return_policy ?? '',
    tieredDiscounts: Array.isArray(row.tiered_discounts) ? row.tiered_discounts : [],
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

// ─── Reviews ─────────────────────────────────────────────────────────

export async function getReviews(storeId?: string, useAdmin = false): Promise<Review[]> {
  try {
    if (useAdmin && storeId) {
      const rows = await adminRest.select('reviews',
        `store_id=eq.${storeId}&order=created_at.desc`
      );
      return rows.map(rowToReview);
    }
    let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToReview);
  } catch {
    return [];
  }
}

export async function updateReviewStatus(id: string, status: Review['status'], useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.update('reviews', `id=eq.${id}`, { status });
    }
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteReview(id: string, useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.delete('reviews', `id=eq.${id}`);
    }
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Stores ──────────────────────────────────────────────────────────

export async function getAllStores(): Promise<StoreRecord[]> {
  try {
    const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];

    const { data: orders } = await supabase.from('orders').select('store_id, amount, status');
    const stats: Record<string, { count: number; sales: number }> = {};
    (orders || []).forEach((o: any) => {
      if (!stats[o.store_id]) stats[o.store_id] = { count: 0, sales: 0 };
      stats[o.store_id].count += 1;
      if (o.status !== 'cancelled') stats[o.store_id].sales += Number(o.amount || 0);
    });

    return data.map(row => {
      const s = rowToStore(row);
      const st = stats[row.id];
      if (st) { s.ordersCount = st.count; s.totalSales = st.sales; }
      return s;
    });
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
    if (updates.togoApiKey !== undefined) row.togo_api_key = updates.togoApiKey;
    if (updates.togoMerchantId !== undefined) row.togo_merchant_id = updates.togoMerchantId;
    if (updates.cardPaymentEnabled !== undefined) row.card_payment_enabled = updates.cardPaymentEnabled;
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
  brandIdentity?: string;
  secondaryColor?: string;
  accentColor?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  footerText?: string;
  showLogo?: boolean;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTiktok?: string;
  socialSnapchat?: string;
  contactEmail?: string;
  secondaryPhone?: string;
  faq?: { q: string; a: string }[];
  returnPolicy?: string;
  tieredDiscounts?: { threshold: number; percent: number }[];
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
    if (settings.brandIdentity !== undefined) row.brand_identity = settings.brandIdentity;
    if (settings.secondaryColor !== undefined) row.secondary_color = settings.secondaryColor;
    if (settings.accentColor !== undefined) row.accent_color = settings.accentColor;
    if (settings.heroImageUrl !== undefined) row.hero_image_url = settings.heroImageUrl;
    if (settings.heroTitle !== undefined) row.hero_title = settings.heroTitle;
    if (settings.heroSubtitle !== undefined) row.hero_subtitle = settings.heroSubtitle;
    if (settings.footerText !== undefined) row.footer_text = settings.footerText;
    if (settings.showLogo !== undefined) row.show_logo = settings.showLogo;
    if (settings.socialInstagram !== undefined) row.social_instagram = settings.socialInstagram;
    if (settings.socialFacebook !== undefined) row.social_facebook = settings.socialFacebook;
    if (settings.socialTiktok !== undefined) row.social_tiktok = settings.socialTiktok;
    if (settings.socialSnapchat !== undefined) row.social_snapchat = settings.socialSnapchat;
    if (settings.contactEmail !== undefined) row.contact_email = settings.contactEmail;
    if (settings.secondaryPhone !== undefined) row.secondary_phone = settings.secondaryPhone;
    if (settings.faq !== undefined) row.faq = settings.faq;
    if (settings.returnPolicy !== undefined) row.return_policy = settings.returnPolicy;
    if (settings.tieredDiscounts !== undefined) row.tiered_discounts = settings.tieredDiscounts;

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

// ─── Staff (multi-user roles) ─────────────────────────────────────────

export type StaffMember = {
  id: string;
  storeId: string;
  userId: string | null;
  email: string;
  fullName: string;
  permissions: { orders: boolean; products: boolean; analytics: boolean; settings: boolean; promotions: boolean };
  createdAt: string;
};

function rowToStaff(row: any): StaffMember {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    userId: row.user_id ? String(row.user_id) : null,
    email: row.email ?? '',
    fullName: row.full_name ?? '',
    permissions: {
      orders: !!row.permissions?.orders,
      products: !!row.permissions?.products,
      analytics: !!row.permissions?.analytics,
      settings: !!row.permissions?.settings,
      promotions: !!row.permissions?.promotions,
    },
    createdAt: row.created_at ?? '',
  };
}

export async function getStaffForStore(storeId: string, useAdmin = false): Promise<StaffMember[]> {
  try {
    if (useAdmin) {
      const rows = await adminRest.select('store_staff', `store_id=eq.${storeId}&order=created_at.desc`);
      return rows.map(rowToStaff);
    }
    const { data, error } = await supabase.from('store_staff').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(rowToStaff);
  } catch {
    return [];
  }
}

export async function addStaffMember(storeId: string, email: string, fullName: string, permissions: StaffMember['permissions'], useAdmin = false): Promise<boolean> {
  try {
    const row = { store_id: storeId, email: email.trim().toLowerCase(), full_name: fullName, permissions };
    if (useAdmin) {
      const res = await adminRest.insert('store_staff', row);
      return !!res;
    }
    const { error } = await supabase.from('store_staff').insert([row]);
    return !error;
  } catch {
    return false;
  }
}

export async function updateStaffPermissions(id: string, permissions: StaffMember['permissions'], useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.update('store_staff', `id=eq.${id}`, { permissions });
    }
    const { error } = await supabase.from('store_staff').update({ permissions }).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeStaffMember(id: string, useAdmin = false): Promise<boolean> {
  try {
    if (useAdmin) {
      return await adminRest.delete('store_staff', `id=eq.${id}`);
    }
    const { error } = await supabase.from('store_staff').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// Looks up whether an email belongs to a staff member, and if so returns
// the parent store plus that staff member's permissions.
export async function getStaffMembershipByEmail(email: string): Promise<{ store: StoreRecord; permissions: StaffMember['permissions'] } | null> {
  try {
    const { data, error } = await supabase
      .from('store_staff')
      .select('*, stores(*)')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (error || !data || !data.stores) return null;
    const staff = rowToStaff(data);
    return { store: rowToStore(data.stores), permissions: staff.permissions };
  } catch {
    return null;
  }
}

// ─── Offline sales (in-store, unified inventory tracking) ─────────────

export type OfflineSale = {
  id: string;
  storeId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  salePrice: number;
  note: string;
  createdAt: string;
};

function rowToOfflineSale(row: any): OfflineSale {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    productId: row.product_id ? String(row.product_id) : null,
    productName: row.product_name ?? '',
    quantity: Number(row.quantity) || 0,
    salePrice: Number(row.sale_price) || 0,
    note: row.note ?? '',
    createdAt: row.created_at ?? '',
  };
}

export async function getOfflineSalesForStore(storeId: string, useAdmin = false): Promise<OfflineSale[]> {
  try {
    if (useAdmin) {
      const rows = await adminRest.select('offline_sales', `store_id=eq.${storeId}&order=created_at.desc&limit=500`);
      return rows.map(rowToOfflineSale);
    }
    const { data, error } = await supabase.from('offline_sales').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(500);
    if (error || !data) return [];
    return data.map(rowToOfflineSale);
  } catch {
    return [];
  }
}

// Records a manual (in-store/offline) sale and decrements the product's stock accordingly.
export async function recordOfflineSale(
  storeId: string,
  product: { id: string; name: string; stock: number },
  quantity: number,
  salePrice: number,
  note: string,
  useAdmin = false
): Promise<boolean> {
  try {
    const newStock = Math.max(0, (product.stock || 0) - quantity);
    const row = {
      store_id: storeId,
      product_id: product.id,
      product_name: product.name,
      quantity,
      sale_price: salePrice,
      note,
    };
    if (useAdmin) {
      const inserted = await adminRest.insert('offline_sales', row);
      if (!inserted) return false;
      return await adminRest.update('products', `id=eq.${product.id}`, { stock: newStock });
    }
    const { error: insertError } = await supabase.from('offline_sales').insert([row]);
    if (insertError) return false;
    const { error: updateError } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
    return !updateError;
  } catch {
    return false;
  }
}
