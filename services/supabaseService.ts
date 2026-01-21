
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Invoice, HotelSettings } from '../types';

let supabase: SupabaseClient | null = null;
let currentSupabaseUrl: string | null = null;

export const getSupabaseClient = (settings: HotelSettings) => {
  if (settings.supabaseUrl && settings.supabaseAnonKey) {
    if (!supabase || currentSupabaseUrl !== settings.supabaseUrl) {
      supabase = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
      currentSupabaseUrl = settings.supabaseUrl;
    }
    return supabase;
  }
  return null;
};

export const uploadAsset = async (file: File, settings: HotelSettings, folder: string): Promise<string | null> => {
  const client = getSupabaseClient(settings);
  if (!client) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  try {
    // 1. Upload file ke bucket 'hotel-assets'
    const { error: uploadError } = await client.storage
      .from('hotel-assets')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Dapatkan URL Publik
    const { data } = client.storage
      .from('hotel-assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Storage Upload Error:', err);
    alert('Gagal mengunggah file ke Supabase Storage. Pastikan bucket "hotel-assets" sudah dibuat dan diset publik.');
    return null;
  }
};

export const fetchSettingsFromSupabase = async (settings: HotelSettings): Promise<HotelSettings | null> => {
  const client = getSupabaseClient(settings);
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('settings')
      .select('data')
      .eq('id', 'hotel_profile')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
    return data ? (data.data as HotelSettings) : null;
  } catch (err) {
    console.error('Supabase Settings Fetch Error:', err);
    return null;
  }
};

export const fetchInvoicesFromSupabase = async (settings: HotelSettings): Promise<Invoice[]> => {
  const client = getSupabaseClient(settings);
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('invoices')
      .select('data')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => row.data as Invoice);
  } catch (err) {
    console.error('Supabase Fetch Error:', err);
    return [];
  }
};

export const upsertInvoiceToSupabase = async (invoice: Invoice, settings: HotelSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client
      .from('invoices')
      .upsert({ 
        id: invoice.id, 
        invoice_number: invoice.invoiceNumber, 
        data: invoice,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase Upsert Error:', err);
    return false;
  }
};

export const saveSettingsToSupabase = async (hotelSettings: HotelSettings): Promise<boolean> => {
  const client = getSupabaseClient(hotelSettings);
  if (!client) return false;

  try {
    const { error } = await client
      .from('settings')
      .upsert({ 
        id: 'hotel_profile', 
        data: hotelSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase Settings Save Error:', err);
    return false;
  }
};
