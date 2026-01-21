
export interface HotelSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  signature?: string; // Base64 string for signature
  stamp?: string;     // Base64 string for hotel stamp
  defaultTaxRate: number;
  supabaseUrl?: string; // Supabase Project URL
  supabaseAnonKey?: string; // Supabase Anonymous Key
}

export interface InvoiceItem {
  id: string;
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
