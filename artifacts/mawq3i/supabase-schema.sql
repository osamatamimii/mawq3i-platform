-- Mawq3i Platform - Supabase Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/mbenszegcjmwgmbjylbf/sql

-- ─── Stores ────────────────────────────────────────────────────────────────
create table if not exists stores (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  slug            text unique not null,
  domain          text,
  owner_name      text,
  owner_email     text,
  owner_phone     text,
  currency        text default 'ILS' check (currency in ('ILS', 'SAR')),
  status          text default 'active' check (status in ('active', 'suspended')),
  orders_count    integer default 0,
  total_sales     numeric default 0,
  subscription_status text default 'trial' check (subscription_status in ('active', 'expired', 'trial')),
  subscription_plan   text default 'monthly' check (subscription_plan in ('monthly', 'yearly')),
  subscription_paid   boolean default false,
  renewal_date    date,
  join_date       date default current_date,
  created_at      timestamptz default now()
);

-- ─── Products ──────────────────────────────────────────────────────────────
create table if not exists products (
  id          uuid default gen_random_uuid() primary key,
  store_id    uuid references stores(id) on delete cascade,
  name_ar     text not null,
  name_en     text,
  desc_ar     text,
  desc_en     text,
  price       numeric not null default 0,
  currency    text default 'ILS' check (currency in ('ILS', 'SAR')),
  stock       integer default 0,
  category    text,
  status      text default 'visible' check (status in ('visible', 'hidden')),
  created_at  timestamptz default now()
);

-- ─── Orders ────────────────────────────────────────────────────────────────
create table if not exists orders (
  id              text primary key,
  store_id        uuid references stores(id) on delete cascade,
  product_id      text,
  product_name    text,
  customer_name   text,
  phone           text,
  city            text,
  amount          numeric,
  currency        text default 'ILS' check (currency in ('ILS', 'SAR')),
  payment_method  text,
  status          text default 'new' check (status in ('new', 'processing', 'delivered', 'cancelled')),
  date            date default current_date,
  created_at      timestamptz default now()
);

-- If upgrading an existing orders table, run these migrations:
-- alter table orders add column if not exists product_id text;
-- alter table orders add column if not exists product_name text;

-- ─── Migrations for stores table (run if table already exists) ────────────
-- alter table stores add column if not exists primary_color text default '#52FF3F';
-- alter table stores add column if not exists logo_url      text;

-- ─── Migration for products table (run if table already exists) ────────────
-- alter table products add column if not exists image_url text;


-- ─── Migration: Add owner_id to stores (run in Supabase SQL Editor) ──────────
-- alter table stores add column if not exists owner_id uuid references auth.users(id);
-- update stores s set owner_id = u.id from auth.users u where u.email = s.owner_email;
-- alter table stores add column if not exists description text;
-- alter table stores add column if not exists primary_color text default '#52FF3F';
-- alter table stores add column if not exists logo_url text;
-- alter table products add column if not exists image_url text;

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Enable RLS on all tables
alter table stores   enable row level security;
alter table products enable row level security;
alter table orders   enable row level security;

-- Allow public read access (anon key) for all tables
create policy "Public read stores"   on stores   for select using (true);
create policy "Public read products" on products for select using (true);
create policy "Public read orders"   on orders   for select using (true);

-- Allow authenticated users to insert/update/delete
create policy "Auth insert stores"   on stores   for insert with check (auth.role() = 'authenticated');
create policy "Auth update stores"   on stores   for update using (auth.role() = 'authenticated');
create policy "Auth delete stores"   on stores   for delete using (auth.role() = 'authenticated');

create policy "Auth insert products" on products for insert with check (auth.role() = 'authenticated');
create policy "Auth update products" on products for update using (auth.role() = 'authenticated');
create policy "Auth delete products" on products for delete using (auth.role() = 'authenticated');

-- Allow anyone (including storefront visitors) to place orders
create policy "Public insert orders" on orders   for insert with check (true);
create policy "Auth update orders"   on orders   for update using (auth.role() = 'authenticated');

-- ─── Sample Data (optional) ────────────────────────────────────────────────
-- Insert a default store for development
insert into stores (name, slug, domain, owner_name, owner_email, owner_phone, currency, status, orders_count, total_sales, subscription_status, subscription_plan, subscription_paid, renewal_date, join_date)
values (
  'متجر الأناقة', 'elegance', 'elegance.mawq3i.com',
  'أحمد السيد', 'owner@mawq3i.com', '+970591234567',
  'ILS', 'active', 1250, 186500,
  'active', 'yearly', true, '2027-01-15', '2025-01-15'
) on conflict (slug) do nothing;

-- ─── Migration: Add variants, badge to products; items, address, notes to orders ──
alter table products add column if not exists variants jsonb default '[]';
alter table products add column if not exists badge text;
alter table orders add column if not exists items jsonb;
alter table orders add column if not exists address text;
alter table orders add column if not exists notes text;

-- ─── RLS: Products — each store owner sees only their store ──────────────────
-- Drop permissive policies first (idempotent)
drop policy if exists "Public read products" on products;
drop policy if exists "Auth insert products" on products;
drop policy if exists "Auth update products" on products;
drop policy if exists "Auth delete products" on products;

-- Re-create with store ownership checks
create policy "Public read products by store"
  on products for select using (true);

create policy "Owner insert products"
  on products for insert
  with check (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner update products"
  on products for update
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner delete products"
  on products for delete
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

-- ─── RLS: Orders — only store owner can read their orders ───────────────────
drop policy if exists "Public read orders" on orders;
drop policy if exists "Auth update orders" on orders;

create policy "Owner read orders"
  on orders for select
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner update orders"
  on orders for update
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

-- Public can insert orders (storefront visitors)
-- Already exists: "Public insert orders"

-- ─── Promotions table ────────────────────────────────────────────────────────
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  title_ar text not null,
  title_en text,
  subtitle_ar text,
  discount_text text,
  badge_color text default '#52FF3F',
  expires_at date,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table promotions enable row level security;

create policy "Owner read promotions"
  on promotions for select
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner insert promotions"
  on promotions for insert
  with check (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner update promotions"
  on promotions for update
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );

create policy "Owner delete promotions"
  on promotions for delete
  using (
    store_id in (
      select id from stores where owner_id = auth.uid() or owner_email = auth.email()
    )
  );
