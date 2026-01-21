
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Invoice, HotelSettings } from '../types';
import { HOTEL_INFO } from '../constants';

// Initialize with defaults from constants for Auth purposes
// We track the active URL locally because supabase.supabaseUrl is protected and cannot be accessed directly in newer versions of the SDK.
let activeUrl = HOTEL_INFO.supabaseUrl;
let supabase: SupabaseClient = createClient(activeUrl, HOTEL_INFO.supabaseAnonKey);

export const getSupabaseClient = (settings?: HotelSettings) => {
  if (settings?.supabaseUrl && settings?.supabaseAnonKey) {
    // Fix: Accessing protected property 'supabaseUrl' directly is not allowed. 
    // We use a local variable 'activeUrl' to track the current configuration.
    if (activeUrl !== settings.supabaseUrl) {
      activeUrl = settings.supabaseUrl;
      supabase = createClient(activeUrl, settings.supabaseAnonKey);
    }
  }
  return supabase;
};

// --- Auth Functions ---
export const signUp = async (email: string, pass: string) => {
  return await supabase.auth.signUp({ email, password: pass });
};

export const signIn = async (email: string, pass: string) => {
  return await supabase.auth.signInWithPassword({ email, password: pass });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
};

// --- Storage & Data Functions ---
export const uploadAsset = async (file: File, settings: HotelSettings, folder: string): Promise<string | null> => {
  const client = getSupabaseClient(settings);
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  
  try {
    const { error: uploadError } = await client.storage
      .from('hotel-assets')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = client.storage
      .from('hotel-assets')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (err) {
    console.error('Storage Upload Error:', err);
    return null;
  }
};

export const fetchSettingsFromSupabase = async (settings: HotelSettings): Promise<HotelSettings | null> => {
  const client = getSupabaseClient(settings);
  try {
    const { data, error } = await client
      .from('settings')
      .select('data')
      .eq('id', 'hotel_profile')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? (data.data as HotelSettings) : null;
  } catch (err) {
    return null;
  }
};

export const fetchInvoicesFromSupabase = async (settings: HotelSettings): Promise<Invoice[]> => {
  const client = getSupabaseClient(settings);
  try {
    const { data, error } = await client
      .from('invoices')
      .select('data')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => row.data as Invoice);
  } catch (err) {
    return [];
  }
};

export const upsertInvoiceToSupabase = async (invoice: Invoice, settings: HotelSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  try {
    const { error } = await client
      .from('invoices')
      .upsert({ 
        id: invoice.id, 
        invoice_number: invoice.invoiceNumber, 
        data: invoice,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    return !error;
  } catch (err) {
    return false;
  }
};

export const saveSettingsToSupabase = async (hotelSettings: HotelSettings): Promise<boolean> => {
  const client = getSupabaseClient(hotelSettings);
  try {
    const { error } = await client
      .from('settings')
      .upsert({ 
        id: 'hotel_profile', 
        data: hotelSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    return !error;
  } catch (err) {
    return false;
  }
};
