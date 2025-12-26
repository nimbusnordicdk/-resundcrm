export type UserRole = 'admin' | 'saelger' | 'bureau';

export type LeadStatus =
  | 'nyt_lead'
  | 'kvalifikationskald_booket'
  | 'discoverykald_booket'
  | 'salgskald_booket'
  | 'onboarding_booket'
  | 'kontrakt_sendt'
  | 'kontrakt_underskrevet'
  | 'lead_tabt'
  | 'bureau_afvist';

export type ContractStatus = 'afventer' | 'underskrevet' | 'afvist';

export type FileVisibility = 'admin' | 'intern' | 'offentlig';

export type CustomerStatus = 'aktiv' | 'opsagt' | 'afventer_bekraeftelse';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  cpr_nr?: string;
  commission_percent?: number;
  bureau_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Bureau {
  id: string;
  name: string;
  cvr_nr: string;
  logo_url?: string;
  contact_person: string;
  phone: string;
  email: string;
  website?: string;
  commission_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  cvr_nr?: string;
  email?: string;
  phone?: string;
  bureau_id: string;
  saelger_id: string;
  campaign_id?: string;
  status: CustomerStatus;
  lead_status: LeadStatus;
  notes?: string;
  lead_lost_reason?: string;
  contract_signed_at?: string;
  terminated_at?: string;
  termination_reason?: string;
  termination_document_url?: string;
  termination_declared_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'kold' | 'bureau';
  bureau_id?: string;
  created_by: string;
  csv_file_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  campaign_id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  notes?: string;
  note1?: string;
  note2?: string;
  note3?: string;
  note4?: string;
  note5?: string;
  status: LeadStatus;
  assigned_saelger_id?: string;
  lost_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  duration_minutes?: number;
  google_meet_link?: string;
  saelger_id: string;
  lead_id?: string;
  customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  name: string;
  content: string;
  parties: ContractParty[];
  status: ContractStatus;
  created_by: string;
  public_link: string;
  signed_at?: string;
  signature_data?: string;
  signer_ip?: string;
  signer_name?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractParty {
  name: string;
  identifier?: string;
  identifier_type?: 'cvr' | 'cpr';
  user_id?: string;
}

export interface Invoice {
  id: string;
  bureau_id: string;
  customer_id: string;
  amount: number;
  file_url: string;
  month: string;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  visibility: FileVisibility;
  uploaded_by: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name?: string;
  is_group: boolean;
  is_team_chat: boolean;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface CallLog {
  id: string;
  saelger_id: string;
  phone_number: string;
  country_code: string;
  duration_seconds: number;
  direction: 'outbound' | 'inbound';
  status: 'completed' | 'no_answer' | 'busy' | 'failed';
  lead_id?: string;
  twilio_call_sid?: string;
  recording_url?: string;
  created_at: string;
}

// Computed/derived types
export interface BureauWithStats extends Bureau {
  total_customers: number;
  active_customers: number;
  churned_customers: number;
  total_invoiced: number;
}

export interface SaelgerWithStats extends User {
  customers_closed: number;
  salary_this_month: number;
  salary_last_month: number;
  leads_lost_week: number;
  leads_lost_month: number;
  leads_lost_year: number;
  total_calls: number;
}

export interface CampaignWithStats extends Campaign {
  total_leads: number;
  customers_closed: number;
  total_calls: number;
  top_saelger?: {
    id: string;
    name: string;
    sales_count: number;
  };
}

export interface CustomerWithDetails extends Customer {
  bureau: Bureau;
  saelger: User;
  invoices: Invoice[];
  total_invoiced: number;
}

export interface DashboardStats {
  total_customers: number;
  customers_this_month: number;
  customers_today: number;
  active_leads: number;
  close_rate: number;
  total_revenue: number;
  revenue_this_month: number;
}
