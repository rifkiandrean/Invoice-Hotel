
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { Invoice, HotelSettings, UserProfile, UserRole } from '../types';
import { HOTEL_INFO } from '../constants';

let activeUrl = HOTEL_INFO.supabaseUrl;
let supabase: SupabaseClient = createClient(activeUrl, HOTEL_INFO.supabaseAnonKey);

export const getSupabaseClient = (settings?: HotelSettings) => {
  if (settings?.supabaseUrl && settings?.supabaseAnonKey) {
    if (activeUrl !== settings.supabaseUrl) {
      activeUrl = settings.supabaseUrl;
      supabase = createClient(activeUrl, settings.supabaseAnonKey);
    }
  }
  return supabase;
};

// --- Auth & Profile Functions ---
export const signIn = async (email: string, pass: string) => {
  return await supabase.auth.signInWithPassword({ email, password: pass });
};

export const signUpNewUser = async (email: string, pass: string, role: UserRole) => {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password: pass,
    options: {
      data: { role }
    }
  });
  
  if (error) return { error };
  
  if (data.user) {
    await upsertProfile({
      id: data.user.id,
      email: email,
      role: role,
      updated_at: new Date().toISOString()
    });
  }
  
  return { data };
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
};

export const fetchProfiles = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Fetch Profiles Error:", err);
    return [];
  }
};

export const upsertProfile = async (profile: UserProfile) => {
  return await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });
};

export const getCurrentUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data;
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

export const fetchSettingsFromSupabase = async (category: string, settings: HotelSettings): Promise<HotelSettings | null> => {
  const client = getSupabaseClient(settings);
  try {
    const profileId = category === 'villa' ? 'villa_profile' : 'hotel_profile';
    const { data, error } = await client
      .from('settings')
      .select('data')
      .eq('id', profileId)
      .maybeSingle();

    if (error) throw error;
    return data ? (data.data as HotelSettings) : null;
  } catch (err) {
    console.error("Fetch Settings Error:", err);
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
    // Map existing data and ensure 'category' exists, defaulting to 'hotel' for legacy records
    return (data || []).map((row: any) => {
      const invoiceData = row.data as Invoice;
      return {
        ...invoiceData,
        category: invoiceData.category || 'hotel'
      };
    });
  } catch (err) {
    console.error("Fetch Invoices Error:", err);
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

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Upsert Invoice Error:", err);
    return false;
  }
};

export const saveSettingsToSupabase = async (category: string, hotelSettings: HotelSettings): Promise<boolean> => {
  const client = getSupabaseClient(hotelSettings);
  try {
    const profileId = category === 'villa' ? 'villa_profile' : 'hotel_profile';
    const { error } = await client
      .from('settings')
      .upsert({ 
        id: profileId, 
        data: hotelSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Save Settings Error:", err);
    return false;
  }
};
