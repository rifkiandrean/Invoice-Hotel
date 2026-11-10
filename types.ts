
export type UserRole = 'super-admin' | 'admin' | 'manager' | 'receptionist';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  updated_at?: string;
  subscription_status?: 'active' | 'inactive';
  subscription_end_date?: string;
  grace_period_days?: number; // Toleransi waktu jatuh tempo (misal: 3 hari, 7 hari)
  billing_cycle?: 'monthly' | 'yearly' | 'custom';
}

export interface HotelSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  bankInfo?: string;
  signature?: string;
  stamp?: string;
  defaultTaxRate: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  settingsPin?: string;
}

export interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  quantity: number;
  nights: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  date: string;
  method: string;
  amount: number;
}

export interface GuestInfo {
  name: string;
  company?: string;
  email: string;
  phone: string;
  address: string;
}

export interface StayDetails {
  roomNumber: string;
  roomType: string;
  guestType: string; 
  checkIn: string;
  checkOut: string;
  guestsCount: number;
}

export interface Invoice {
  id: string;
  category: 'hotel' | 'villa';
  invoiceNumber: string;
  date: string;
  guest: GuestInfo;
  stay: StayDetails;
  items: InvoiceItem[];
  payments: Payment[];
  taxRate: number;
  discount: number;
  status: 'draft' | 'paid' | 'cancelled';
  notes: string;
  remarks?: string;
  hotelSnap?: HotelSettings;
  cashierName?: string;
}

export type ViewMode = 'list' | 'create' | 'view' | 'settings';
