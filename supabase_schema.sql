-- ==========================================
-- SUPABASE DATABASE SCHEMA SETUP
-- Run this in your Supabase SQL Editor to prepare your database.
-- ==========================================

-- 1. Create 'reservations' table
CREATE TABLE IF NOT EXISTS reservations (
  id text PRIMARY KEY,
  guest_name text NOT NULL,
  guest_surname text NOT NULL,
  guest_phone text,
  guest_email text,
  guest_nationality text,
  booking_ref text,
  booking_date text,
  adults integer,
  children integer,
  source text NOT NULL,
  check_in text NOT NULL,
  check_out text NOT NULL,
  nights integer NOT NULL,
  total_price numeric NOT NULL,
  notes text,
  extras jsonb DEFAULT '[]'::jsonb,
  check_in_status jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'confirmed',
  valnea_sub_channel text,
  valnea_platform_commission_percentage numeric,
  valnea_platform_commission_tax_percentage numeric,
  valnea_owner_percentage numeric,
  valnea_agent_percentage numeric,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Create 'expenses' table
CREATE TABLE IF NOT EXISTS expenses (
  id text PRIMARY KEY,
  category text NOT NULL,
  custom_category_name text,
  amount numeric NOT NULL,
  date text NOT NULL,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Create 'settings' table
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'default',
  valnea_platform_commission_percentage numeric NOT NULL,
  valnea_owner_percentage numeric NOT NULL,
  valnea_agent_percentage numeric NOT NULL,
  valnea_platform_commission_tax_percentage numeric NOT NULL,
  channels jsonb DEFAULT '[]'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 5. Set up Row Level Security (RLS) Policies
-- This enables safe access control:
-- - Authenticated users only see and manage their own data linked to their user_id.
-- - For unauthenticated/anonymous initial use when auth is not configured, we allow reads and writes of records where user_id is null.

-- RESERVATIONS POLICIES
CREATE POLICY "Allow select for owner" ON reservations
  FOR SELECT USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow insert for owner" ON reservations
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow update for owner" ON reservations
  FOR UPDATE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow delete for owner" ON reservations
  FOR DELETE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

-- EXPENSES POLICIES
CREATE POLICY "Allow select for owner_expenses" ON expenses
  FOR SELECT USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow insert for owner_expenses" ON expenses
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow update for owner_expenses" ON expenses
  FOR UPDATE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow delete for owner_expenses" ON expenses
  FOR DELETE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

-- SETTINGS POLICIES
CREATE POLICY "Allow select for settings" ON settings
  FOR SELECT USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow insert for settings" ON settings
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow update for settings" ON settings
  FOR UPDATE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Allow delete for settings" ON settings
  FOR DELETE USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );
