-- Supabase Schema Setup Script for RestroFlow POS
-- Copy and run this script in your Supabase SQL Editor.

-- 1. Restaurants Table
CREATE TABLE IF NOT EXISTS public.restaurants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Profiles Table (Hooks into Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('Administrator', 'Restaurant Owner')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
    cgst numeric NOT NULL DEFAULT 0,
    sgst numeric NOT NULL DEFAULT 0,
    gst_enabled boolean NOT NULL DEFAULT false,
    gstin text,
    restaurant_name text NOT NULL,
    address text,
    phone text,
    email text,
    currency text NOT NULL DEFAULT '₹',
    footer_message text,
    print_type text NOT NULL DEFAULT 'Thermal' CHECK (print_type IN ('Thermal', 'A4')),
    auto_print boolean NOT NULL DEFAULT true,
    container_charge_enabled boolean NOT NULL DEFAULT false,
    default_container_charge numeric NOT NULL DEFAULT 0,
    show_fields jsonb NOT NULL DEFAULT '{"gstinOnReceipt": false, "phoneOnReceipt": true, "emailOnReceipt": false, "footerOnReceipt": true}'::jsonb
);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    base_price numeric NOT NULL DEFAULT 0,
    image text,
    available boolean NOT NULL DEFAULT true,
    has_variations boolean NOT NULL DEFAULT false,
    variations jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tables Table
CREATE TABLE IF NOT EXISTS public.tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    number text NOT NULL,
    status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Billing Pending')),
    current_order_id text
);

-- 7. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    total_orders integer NOT NULL DEFAULT 0,
    total_spent numeric NOT NULL DEFAULT 0,
    last_visit timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Sales Invoices Table
CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    token_no text NOT NULL,
    date_time timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    customer_id text NOT NULL DEFAULT 'walk-in',
    customer_name text NOT NULL DEFAULT 'Walk-in Customer',
    order_type text NOT NULL CHECK (order_type IN ('Dine In', 'Takeaway', 'Delivery')),
    table_no text,
    items jsonb NOT NULL,
    subtotal numeric NOT NULL DEFAULT 0,
    cgst numeric NOT NULL DEFAULT 0,
    sgst numeric NOT NULL DEFAULT 0,
    discount numeric NOT NULL DEFAULT 0,
    round_off numeric NOT NULL DEFAULT 0,
    container_charge numeric NOT NULL DEFAULT 0,
    tips numeric NOT NULL DEFAULT 0,
    grand_total numeric NOT NULL DEFAULT 0,
    payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card')),
    payment_details jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 9. KOTs Table
CREATE TABLE IF NOT EXISTS public.kots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    token_no text NOT NULL,
    table_no text,
    order_type text NOT NULL CHECK (order_type IN ('Dine In', 'Takeaway', 'Delivery')),
    time_created timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    items jsonb NOT NULL,
    status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Preparing', 'Ready', 'Served'))
);

-- 10. Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    unit text NOT NULL CHECK (unit IN ('kg', 'g', 'L', 'ml', 'pcs', 'dozen', 'box')),
    quantity numeric NOT NULL DEFAULT 0,
    low_stock_level numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Token Sequences Table
CREATE TABLE IF NOT EXISTS public.token_sequences (
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    date_str text NOT NULL,
    seq integer NOT NULL DEFAULT 0,
    PRIMARY KEY (restaurant_id, date_str)
);

-- 12. Hold Sequence Table
CREATE TABLE IF NOT EXISTS public.hold_sequence (
    restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    seq integer NOT NULL DEFAULT 0
);

-- 13. Active Carts Table
CREATE TABLE IF NOT EXISTS public.active_carts (
    restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    cart_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Disable Row Level Security (RLS) on all tables to allow client-side sync
ALTER TABLE IF EXISTS public.restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.token_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hold_sequence DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.active_carts DISABLE ROW LEVEL SECURITY;

-- Helper function to check if a restaurant exists (bypasses RLS safely if needed)
CREATE OR REPLACE FUNCTION public.has_restaurant()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.restaurants);
END;
$$;

