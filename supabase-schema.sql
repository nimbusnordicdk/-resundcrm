-- =============================================
-- ØRESUND PARTNERS CRM - SUPABASE DATABASE SCHEMA
-- =============================================
-- Kør dette script i Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE user_role AS ENUM ('admin', 'saelger', 'bureau');

CREATE TYPE lead_status AS ENUM (
  'nyt_lead',
  'kvalifikationskald_booket',
  'discoverykald_booket',
  'salgskald_booket',
  'onboarding_booket',
  'kontrakt_sendt',
  'kontrakt_underskrevet',
  'lead_tabt',
  'bureau_afvist'
);

CREATE TYPE contract_status AS ENUM ('afventer', 'underskrevet', 'afvist');

CREATE TYPE file_visibility AS ENUM ('admin', 'intern', 'offentlig');

CREATE TYPE customer_status AS ENUM ('aktiv', 'opsagt', 'afventer_bekraeftelse');

CREATE TYPE campaign_type AS ENUM ('kold', 'bureau');

CREATE TYPE call_direction AS ENUM ('outbound', 'inbound');

CREATE TYPE call_status AS ENUM ('completed', 'no_answer', 'busy', 'failed');

-- =============================================
-- TABLES
-- =============================================

-- Bureauer (Marketing bureauer)
CREATE TABLE bureaus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  cvr_nr VARCHAR(20) UNIQUE NOT NULL,
  logo_url TEXT,
  contact_person VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Brugere (Admin, Sælgere, Bureau brugere)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'saelger',
  phone VARCHAR(20),
  cpr_nr VARCHAR(20),
  commission_percent DECIMAL(5,2) DEFAULT 20.00,
  bureau_id UUID REFERENCES bureaus(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kampagner (Kold og Bureau)
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type campaign_type NOT NULL,
  bureau_id UUID REFERENCES bureaus(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  csv_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  notes TEXT,
  note1 TEXT,
  note2 TEXT,
  note3 TEXT,
  note4 TEXT,
  note5 TEXT,
  status lead_status NOT NULL DEFAULT 'nyt_lead',
  assigned_saelger_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kunder (Lukkede leads)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  cvr_nr VARCHAR(20),
  email VARCHAR(255),
  phone VARCHAR(20),
  bureau_id UUID REFERENCES bureaus(id) ON DELETE SET NULL NOT NULL,
  saelger_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status customer_status NOT NULL DEFAULT 'afventer_bekraeftelse',
  notes TEXT,
  lead_lost_reason TEXT,
  contract_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Møder
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  google_meet_link TEXT,
  saelger_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kontrakter
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  parties JSONB NOT NULL DEFAULT '[]',
  status contract_status NOT NULL DEFAULT 'afventer',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  public_link VARCHAR(255) UNIQUE NOT NULL,
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  signer_ip VARCHAR(45),
  signer_name VARCHAR(255),
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fakturaer
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bureau_id UUID REFERENCES bureaus(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  file_url TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bureau_id, customer_id, month, year)
);

-- Filer
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  visibility file_visibility NOT NULL DEFAULT 'intern',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Rum
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  is_team_chat BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Deltagere
CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Chat Beskeder
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opkaldslog (Twilio)
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  saelger_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  country_code VARCHAR(5) NOT NULL DEFAULT '+45',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  direction call_direction NOT NULL DEFAULT 'outbound',
  status call_status NOT NULL DEFAULT 'completed',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  twilio_call_sid VARCHAR(255),
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_bureau_id ON users(bureau_id);
CREATE INDEX idx_users_email ON users(email);

-- Bureaus
CREATE INDEX idx_bureaus_cvr ON bureaus(cvr_nr);

-- Campaigns
CREATE INDEX idx_campaigns_type ON campaigns(type);
CREATE INDEX idx_campaigns_bureau_id ON campaigns(bureau_id);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);

-- Leads
CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_saelger ON leads(assigned_saelger_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Customers
CREATE INDEX idx_customers_bureau_id ON customers(bureau_id);
CREATE INDEX idx_customers_saelger_id ON customers(saelger_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);

-- Meetings
CREATE INDEX idx_meetings_saelger_id ON meetings(saelger_id);
CREATE INDEX idx_meetings_date ON meetings(date);
CREATE INDEX idx_meetings_lead_id ON meetings(lead_id);

-- Contracts
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_public_link ON contracts(public_link);

-- Invoices
CREATE INDEX idx_invoices_bureau_id ON invoices(bureau_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_month_year ON invoices(year, month);

-- Files
CREATE INDEX idx_files_visibility ON files(visibility);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

-- Chat
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_participants_room_id ON chat_participants(room_id);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);

-- Call Logs
CREATE INDEX idx_call_logs_saelger_id ON call_logs(saelger_id);
CREATE INDEX idx_call_logs_created_at ON call_logs(created_at);
CREATE INDEX idx_call_logs_lead_id ON call_logs(lead_id);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bureaus_updated_at
  BEFORE UPDATE ON bureaus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE bureaus ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get user bureau_id
CREATE OR REPLACE FUNCTION get_user_bureau_id(user_id UUID)
RETURNS UUID AS $$
  SELECT bureau_id FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- BUREAUS POLICIES
CREATE POLICY "Admin can do everything on bureaus" ON bureaus
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view all bureaus" ON bureaus
  FOR SELECT USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Bureau can view own bureau" ON bureaus
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'bureau' AND
    id = get_user_bureau_id(auth.uid())
  );

-- USERS POLICIES
CREATE POLICY "Admin can do everything on users" ON users
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view all users" ON users
  FOR SELECT USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Bureau can view own profile" ON users
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'bureau' AND
    id = auth.uid()
  );

-- CAMPAIGNS POLICIES
CREATE POLICY "Admin can do everything on campaigns" ON campaigns
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view all campaigns" ON campaigns
  FOR SELECT USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Bureau can view own campaigns" ON campaigns
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'bureau' AND
    bureau_id = get_user_bureau_id(auth.uid())
  );

-- LEADS POLICIES
CREATE POLICY "Admin can do everything on leads" ON leads
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view and update leads" ON leads
  FOR ALL USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Bureau can view leads from own campaigns" ON leads
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'bureau' AND
    campaign_id IN (
      SELECT id FROM campaigns WHERE bureau_id = get_user_bureau_id(auth.uid())
    )
  );

-- CUSTOMERS POLICIES
CREATE POLICY "Admin can do everything on customers" ON customers
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view all customers" ON customers
  FOR SELECT USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Saelger can insert customers" ON customers
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Bureau can view and update own customers" ON customers
  FOR ALL USING (
    get_user_role(auth.uid()) = 'bureau' AND
    bureau_id = get_user_bureau_id(auth.uid())
  );

-- MEETINGS POLICIES
CREATE POLICY "Admin can do everything on meetings" ON meetings
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can manage own meetings" ON meetings
  FOR ALL USING (
    get_user_role(auth.uid()) = 'saelger' AND
    saelger_id = auth.uid()
  );

-- CONTRACTS POLICIES
CREATE POLICY "Admin can do everything on contracts" ON contracts
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can manage contracts" ON contracts
  FOR ALL USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Anyone can view contract by public link" ON contracts
  FOR SELECT USING (public_link IS NOT NULL);

CREATE POLICY "Anyone can update contract signature" ON contracts
  FOR UPDATE USING (status = 'afventer');

-- INVOICES POLICIES
CREATE POLICY "Admin can do everything on invoices" ON invoices
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view invoices" ON invoices
  FOR SELECT USING (get_user_role(auth.uid()) = 'saelger');

CREATE POLICY "Bureau can manage own invoices" ON invoices
  FOR ALL USING (
    get_user_role(auth.uid()) = 'bureau' AND
    bureau_id = get_user_bureau_id(auth.uid())
  );

-- FILES POLICIES
CREATE POLICY "Admin can do everything on files" ON files
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can view intern and offentlig files" ON files
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'saelger' AND
    visibility IN ('intern', 'offentlig')
  );

CREATE POLICY "Bureau can view offentlig files" ON files
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'bureau' AND
    visibility = 'offentlig'
  );

-- CHAT POLICIES
CREATE POLICY "Users can view own chat rooms" ON chat_rooms
  FOR SELECT USING (
    id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
    OR is_team_chat = TRUE
  );

CREATE POLICY "Users can create chat rooms" ON chat_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view participants in own rooms" ON chat_participants
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add participants" ON chat_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view messages in own rooms" ON chat_messages
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages to own rooms" ON chat_messages
  FOR INSERT WITH CHECK (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
    AND sender_id = auth.uid()
  );

-- CALL LOGS POLICIES
CREATE POLICY "Admin can do everything on call_logs" ON call_logs
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Saelger can manage own call logs" ON call_logs
  FOR ALL USING (
    get_user_role(auth.uid()) = 'saelger' AND
    saelger_id = auth.uid()
  );

-- =============================================
-- VIEWS FOR STATISTICS
-- =============================================

-- Bureau statistik view
CREATE OR REPLACE VIEW bureau_stats AS
SELECT
  b.id,
  b.name,
  b.cvr_nr,
  b.logo_url,
  b.contact_person,
  b.phone,
  b.email,
  b.commission_percent,
  b.created_at,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'aktiv') as active_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'opsagt') as churned_customers,
  COUNT(DISTINCT c.id) as total_customers,
  COALESCE(SUM(i.amount), 0) as total_invoiced
FROM bureaus b
LEFT JOIN customers c ON c.bureau_id = b.id
LEFT JOIN invoices i ON i.bureau_id = b.id
GROUP BY b.id;

-- Sælger statistik view
CREATE OR REPLACE VIEW saelger_stats AS
SELECT
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.commission_percent,
  u.created_at,
  COUNT(DISTINCT c.id) as customers_closed,
  COALESCE(SUM(i.amount) FILTER (
    WHERE EXTRACT(MONTH FROM i.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM i.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  ) * u.commission_percent / 100, 0) as salary_this_month,
  COALESCE(SUM(i.amount) FILTER (
    WHERE EXTRACT(MONTH FROM i.created_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
    AND EXTRACT(YEAR FROM i.created_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
  ) * u.commission_percent / 100, 0) as salary_last_month,
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'lead_tabt'
    AND l.updated_at >= CURRENT_DATE - INTERVAL '7 days'
  ) as leads_lost_week,
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'lead_tabt'
    AND EXTRACT(MONTH FROM l.updated_at) = EXTRACT(MONTH FROM CURRENT_DATE)
  ) as leads_lost_month,
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'lead_tabt'
    AND EXTRACT(YEAR FROM l.updated_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  ) as leads_lost_year,
  COUNT(DISTINCT cl.id) as total_calls
FROM users u
LEFT JOIN customers c ON c.saelger_id = u.id
LEFT JOIN invoices i ON i.customer_id = c.id
LEFT JOIN leads l ON l.assigned_saelger_id = u.id
LEFT JOIN call_logs cl ON cl.saelger_id = u.id
WHERE u.role = 'saelger'
GROUP BY u.id;

-- Kampagne statistik view
CREATE OR REPLACE VIEW campaign_stats AS
SELECT
  c.id,
  c.name,
  c.type,
  c.bureau_id,
  c.created_at,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT cu.id) as customers_closed,
  COUNT(DISTINCT cl.id) as total_calls,
  (
    SELECT json_build_object(
      'id', u.id,
      'name', u.full_name,
      'sales_count', COUNT(cu2.id)
    )
    FROM users u
    LEFT JOIN customers cu2 ON cu2.saelger_id = u.id AND cu2.campaign_id = c.id
    WHERE u.role = 'saelger'
    GROUP BY u.id
    ORDER BY COUNT(cu2.id) DESC
    LIMIT 1
  ) as top_saelger
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.id
LEFT JOIN customers cu ON cu.campaign_id = c.id
LEFT JOIN call_logs cl ON cl.lead_id = l.id
GROUP BY c.id;

-- =============================================
-- FUNCTIONS FOR COMMISSION CALCULATION
-- =============================================

-- Beregn Øresund's andel af faktura
CREATE OR REPLACE FUNCTION calculate_oresund_share(
  invoice_amount DECIMAL,
  bureau_commission_percent DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN invoice_amount * (bureau_commission_percent / 100);
END;
$$ LANGUAGE plpgsql;

-- Beregn sælgers løn fra faktura
CREATE OR REPLACE FUNCTION calculate_saelger_salary(
  invoice_amount DECIMAL,
  saelger_commission_percent DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN invoice_amount * (saelger_commission_percent / 100);
END;
$$ LANGUAGE plpgsql;

-- Funktion til at hente sælgers totale løn for en periode
CREATE OR REPLACE FUNCTION get_saelger_salary(
  p_saelger_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  total_invoiced DECIMAL,
  commission_percent DECIMAL,
  total_salary DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(i.amount), 0) as total_invoiced,
    u.commission_percent,
    COALESCE(SUM(i.amount), 0) * u.commission_percent / 100 as total_salary
  FROM users u
  LEFT JOIN customers c ON c.saelger_id = u.id
  LEFT JOIN invoices i ON i.customer_id = c.id
    AND i.month = p_month
    AND i.year = p_year
  WHERE u.id = p_saelger_id
  GROUP BY u.id, u.commission_percent;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;

-- =============================================
-- STORAGE BUCKETS (Run in Supabase Dashboard)
-- =============================================

-- Skal oprettes via Supabase Dashboard eller API:
-- 1. 'logos' - Bureau logoer
-- 2. 'files' - Generelle filer
-- 3. 'invoices' - Faktura filer
-- 4. 'contracts' - Kontrakt PDFer
-- 5. 'avatars' - Bruger avatars
-- 6. 'campaign-csvs' - CSV filer til kampagner

-- =============================================
-- INITIAL DATA - Team Chat Room
-- =============================================

-- Opret team chat for alle medarbejdere (Admin + Sælgere)
INSERT INTO chat_rooms (name, is_group, is_team_chat, created_by)
VALUES ('Øresund Team', TRUE, TRUE, NULL);

-- =============================================
-- HELPFUL COMMENTS FOR SETUP
-- =============================================

/*
EFTER KØRSEL AF DETTE SCRIPT:

1. Opret Storage Buckets i Supabase Dashboard:
   - Gå til Storage > New Bucket
   - Opret: logos, files, invoices, contracts, avatars, campaign-csvs
   - Sæt public = true for logos og avatars

2. Konfigurer Authentication:
   - Gå til Authentication > Providers
   - Aktiver Email provider
   - Konfigurer email templates

3. Opret første admin bruger:
   - Gå til Authentication > Users > Add User
   - Opret bruger med email
   - Kør derefter:

   INSERT INTO users (id, email, full_name, role)
   VALUES ('AUTH_USER_UUID_HER', 'admin@oresundpartners.dk', 'Admin Navn', 'admin');

4. Twilio Setup:
   - Opret TwiML App i Twilio Console
   - Konfigurer Voice URL til din app's API endpoint

*/
