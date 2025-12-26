-- Fix ALL RLS policies for Øresund CRM
-- Run this in Supabase SQL Editor

-- =============================================
-- ADD MISSING COLUMNS
-- =============================================

-- Add last_read_at to chat_participants for notification tracking
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_delete" ON storage.objects;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "storage_objects_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read files
CREATE POLICY "storage_objects_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated users to update their files
CREATE POLICY "storage_objects_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (true);

-- Allow authenticated users to delete their files
CREATE POLICY "storage_objects_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (true);

-- =============================================
-- CHAT POLICIES (disable RLS to avoid recursion)
-- =============================================

DROP POLICY IF EXISTS "Users can view participants in their rooms" ON chat_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select_own" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert_self" ON chat_participants;

DROP POLICY IF EXISTS "Users can view their rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_select" ON chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_insert" ON chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update" ON chat_rooms;

DROP POLICY IF EXISTS "Users can view messages in their rooms" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;

DROP FUNCTION IF EXISTS get_user_room_ids(uuid);

-- Disable RLS on chat tables
ALTER TABLE chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENTS TABLE (if exists)
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- INVOICES TABLE (if exists)
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- CONTRACTS TABLE - ensure authenticated can access
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "contracts_select" ON contracts;
    DROP POLICY IF EXISTS "contracts_insert" ON contracts;
    DROP POLICY IF EXISTS "contracts_update" ON contracts;
    DROP POLICY IF EXISTS "contracts_delete" ON contracts;

    -- Disable RLS for simplicity
    ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- LEADS TABLE
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- CUSTOMERS TABLE
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- BUREAUS TABLE
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bureaus') THEN
    ALTER TABLE bureaus DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- MEETINGS TABLE
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meetings') THEN
    ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================
-- USERS TABLE - Keep RLS but simplify
-- =============================================

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Allow all authenticated users to read all users
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "users_update" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Ensure RLS is enabled on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
