import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { Invoice, HotelSettings, UserProfile, UserRole } from '../types';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Connection check on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline or connecting...");
    }
  }
}
testConnection();

// --- Auth Functions ---
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    if (user) {
      // Check if profile exists, if not initialize profile
      const existing = await getCurrentUserProfile(user.uid);
      if (!existing) {
        const isMaster = user.email?.toLowerCase() === 'rifkiandrean@gmail.com';
        await upsertProfile({
          id: user.uid,
          email: user.email || '',
          fullName: user.displayName || '',
          role: isMaster ? 'super-admin' : 'receptionist',
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        });
      }
    }
    return { data: { user }, error: null };
  } catch (err: any) {
    console.error("Google Sign-In Error:", err);
    return { data: null, error: err };
  }
};

export const signIn = async (email: string, pass: string) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return { data: { user: cred.user }, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
};

export const signUpNewUser = async (email: string, pass: string, role: UserRole) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await upsertProfile({
        id: cred.user.uid,
        email: email,
        role: role,
        updated_at: new Date().toISOString()
      });
    }
    return { data: { user: cred.user }, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
};

export const signOut = async () => {
  return await firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (session: { user: { id: string; email?: string | null; displayName?: string | null; photoURL?: string | null } } | null) => void) => {
  const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      callback({
        user: {
          id: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      });
    } else {
      callback(null);
    }
  });

  return {
    data: {
      subscription: {
        unsubscribe
      }
    }
  };
};

// --- User Profile Functions ---
export const fetchProfiles = async (): Promise<UserProfile[]> => {
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    const list: UserProfile[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as UserProfile);
    });
    return list;
  } catch (err) {
    console.error("Fetch Profiles Error:", err);
    return [];
  }
};

export const upsertProfile = async (profile: UserProfile) => {
  try {
    const userRef = doc(db, 'users', profile.id);
    await setDoc(userRef, {
      ...profile,
      updated_at: new Date().toISOString()
    }, { merge: true });
    return { data: profile, error: null };
  } catch (err: any) {
    console.error("Firestore upsertProfile Error:", err);
    return { data: null, error: err };
  }
};

export const getCurrentUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error("getCurrentUserProfile Error:", err);
    return null;
  }
};

export const deleteProfile = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    return true;
  } catch (err: any) {
    console.error("deleteProfile Error:", err);
    return false;
  }
};

// --- Storage Upload ---
export const uploadAsset = async (file: File, _settings: HotelSettings, folder: string): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  
  try {
    const fileRef = ref(storage, `hotel-assets/${fileName}`);
    const uploadResult = await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return downloadUrl;
  } catch (err) {
    console.warn('Firebase Storage upload notice (falling back to Base64 data URL):', err);
    // Reliable fallback: Data URL if storage bucket is not configured with public rules
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
};

// --- Settings Functions ---
export const fetchSettingsFromFirebase = async (category: string): Promise<HotelSettings | null> => {
  try {
    const profileId = category === 'villa' ? 'villa_profile' : 'hotel_profile';
    const settingsRef = doc(db, 'settings', profileId);
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
      return snap.data() as HotelSettings;
    }
    return null;
  } catch (err) {
    console.error("Fetch Settings from Firebase Error:", err);
    return null;
  }
};

export const saveSettingsToFirebase = async (category: string, hotelSettings: HotelSettings): Promise<boolean> => {
  try {
    const profileId = category === 'villa' ? 'villa_profile' : 'hotel_profile';
    const settingsRef = doc(db, 'settings', profileId);
    await setDoc(settingsRef, {
      ...hotelSettings,
      updated_at: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("Save Settings to Firebase Error:", err);
    return false;
  }
};

// --- Invoices Functions ---
export const fetchInvoicesFromFirebase = async (): Promise<Invoice[]> => {
  try {
    const invoicesCol = collection(db, 'invoices');
    const q = query(invoicesCol, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const list: Invoice[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as Invoice;
      list.push({
        ...data,
        id: docSnap.id,
        category: data.category || 'hotel'
      });
    });
    return list;
  } catch (err) {
    console.error("Fetch Invoices from Firebase Error:", err);
    // Fallback: simple getDocs without ordering in case index or timestamp issue
    try {
      const invoicesCol = collection(db, 'invoices');
      const snap = await getDocs(invoicesCol);
      const list: Invoice[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Invoice;
        list.push({
          ...data,
          id: docSnap.id,
          category: data.category || 'hotel'
        });
      });
      return list;
    } catch (fallbackErr) {
      console.error("Fetch Invoices Fallback Error:", fallbackErr);
      return [];
    }
  }
};

export const upsertInvoiceToFirebase = async (invoice: Invoice): Promise<boolean> => {
  try {
    const invoiceRef = doc(db, 'invoices', invoice.id);
    await setDoc(invoiceRef, {
      ...invoice,
      updated_at: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("Upsert Invoice to Firebase Error:", err);
    return false;
  }
};

export const deleteInvoiceFromFirebase = async (invoiceId: string): Promise<boolean> => {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    await deleteDoc(invoiceRef);
    return true;
  } catch (err) {
    console.error("Delete Invoice from Firebase Error:", err);
    return false;
  }
};

// --- Migration Tool: Clone from Supabase to Firebase ---
export const cloneSupabaseToFirebase = async (
  supabaseUrl: string, 
  supabaseAnonKey: string,
  onProgress?: (status: string) => void
): Promise<{ success: boolean; message: string; count: { invoices: number; profiles: number } }> => {
  try {
    onProgress?.("Menghubungkan ke Supabase...");
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Clone Settings
    onProgress?.("Menyalin pengaturan Hotel & Villa...");
    const { data: settingsData } = await supabaseClient.from('settings').select('*');
    if (settingsData && settingsData.length > 0) {
      for (const item of settingsData) {
        if (item.id && item.data) {
          const docRef = doc(db, 'settings', item.id);
          await setDoc(docRef, item.data, { merge: true });
        }
      }
    }

    // 2. Clone Invoices
    onProgress?.("Mengambil data tagihan/invoices dari Supabase...");
    const { data: invoicesData, error: invErr } = await supabaseClient.from('invoices').select('*');
    if (invErr) {
      console.warn("Supabase fetch invoices warning:", invErr);
    }
    let invoiceCount = 0;
    if (invoicesData && invoicesData.length > 0) {
      for (const row of invoicesData) {
        const inv = row.data as Invoice;
        const targetId = row.id || inv?.id;
        if (targetId && inv) {
          const docRef = doc(db, 'invoices', targetId);
          await setDoc(docRef, {
            ...inv,
            id: targetId,
            category: inv.category || 'hotel',
            updated_at: row.updated_at || new Date().toISOString()
          }, { merge: true });
          invoiceCount++;
        }
      }
    }

    // 3. Clone Akun / Profiles
    onProgress?.("Menyalin data akun pengguna...");
    const { data: akunData, error: akunErr } = await supabaseClient.from('akun').select('*');
    if (akunErr) {
      console.warn("Supabase fetch akun warning:", akunErr);
    }
    let profileCount = 0;
    if (akunData && akunData.length > 0) {
      for (const user of akunData) {
        if (user.id) {
          const docRef = doc(db, 'users', user.id);
          await setDoc(docRef, user, { merge: true });
          profileCount++;
        }
      }
    }

    onProgress?.("Migrasi selesai!");
    return {
      success: true,
      message: `Berhasil migrasi ${invoiceCount} invoices dan ${profileCount} akun ke Firebase!`,
      count: { invoices: invoiceCount, profiles: profileCount }
    };
  } catch (err: any) {
    console.error("Migration error:", err);
    return {
      success: false,
      message: `Gagal migrasi: ${err.message || 'Terjadi kesalahan'}`,
      count: { invoices: 0, profiles: 0 }
    };
  }
};
