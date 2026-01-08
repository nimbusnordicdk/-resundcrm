-- =====================================================
-- SQL for alle nye features
-- Kør denne SQL i Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TEMP PASSWORD TIL USERS OG BUREAUS
-- =====================================================

-- Tilføj temp_password kolonne til users tabellen
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- Tilføj temp_password og user_id kolonner til bureaus tabellen
ALTER TABLE bureaus ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE bureaus ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- =====================================================
-- 2. EMAIL SYSTEM FOR SÆLGERE
-- =====================================================

-- Opret tabel til bruger email indstillinger
CREATE TABLE IF NOT EXISTS user_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 143,
  imap_user TEXT,
  imap_password TEXT,
  from_name TEXT,
  from_email TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tilføj nye kolonner hvis tabellen allerede eksisterer
ALTER TABLE user_email_settings ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE user_email_settings ADD COLUMN IF NOT EXISTS imap_user TEXT;
ALTER TABLE user_email_settings ADD COLUMN IF NOT EXISTS imap_password TEXT;

-- Opret tabel til emails
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for email settings
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email settings"
  ON user_email_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email settings"
  ON user_email_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email settings"
  ON user_email_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for emails
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emails"
  ON emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emails"
  ON emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emails"
  ON emails FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_email_settings_user_id ON user_email_settings(user_id);

-- =====================================================
-- 3. LEAD EJERSKAB SYSTEM
-- =====================================================

-- Tilføj owned_by og owned_at kolonner til leads tabellen
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owned_by UUID REFERENCES auth.users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owned_at TIMESTAMPTZ;

-- Index for owned_by queries
CREATE INDEX IF NOT EXISTS idx_leads_owned_by ON leads(owned_by);

-- Drop eksisterende policies og opret nye med ejerskab
DROP POLICY IF EXISTS "Saelgere kan se uejede leads og egne leads" ON leads;

-- Policy: Sælgere kan kun se leads der:
-- 1. Ikke er ejet af nogen (owned_by IS NULL)
-- 2. Er ejet af dem selv
CREATE POLICY "Saelgere kan se uejede leads og egne leads"
  ON leads FOR SELECT
  USING (
    owned_by IS NULL
    OR owned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Sælgere kan opdatere leads de ejer
DROP POLICY IF EXISTS "Saelgere kan opdatere egne leads" ON leads;

CREATE POLICY "Saelgere kan opdatere egne leads"
  ON leads FOR UPDATE
  USING (
    owned_by = auth.uid()
    OR owned_by IS NULL
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- =====================================================
-- 4. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_email_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON emails TO authenticated;

-- =====================================================
-- DONE! Kør denne SQL i Supabase SQL Editor
-- =====================================================
