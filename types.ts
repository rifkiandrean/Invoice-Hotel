
export interface HotelSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  defaultTaxRate: number;
  googleSheetUrl?: string; // URL dari Google Apps Script Web App
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
  aiGreeting?: string;
  hotelSnap?: HotelSettings;
}

export type ViewMode = 'list' | 'create' | 'view' | 'settings';
