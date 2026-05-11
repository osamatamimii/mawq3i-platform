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
