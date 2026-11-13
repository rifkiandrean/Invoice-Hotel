
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Invoice, ViewMode, InvoiceItem, Payment, HotelSettings, UserProfile } from './types';
import { InvoicePreview } from './components/InvoicePreview';
import { SettingsPage } from './components/SettingsPage';
import { Auth } from './components/Auth';
import { SubscriptionBlock } from './components/SubscriptionBlock';
import { MobileDashboardList } from './components/mobile/MobileDashboardList';
import { DesktopDashboardTable } from './components/desktop/DesktopDashboardTable';
import { MobileInvoiceForm } from './components/mobile/MobileInvoiceForm';
import { DesktopInvoiceForm } from './components/desktop/DesktopInvoiceForm';
import { ROOM_TYPES, VILLA_ROOM_TYPES, GUEST_TYPES, HOTEL_INFO, VILLA_INFO, TAX_RATE } from './constants';
import { 
  fetchInvoicesFromFirebase, 
  upsertInvoiceToFirebase, 
  deleteInvoiceFromFirebase,
  saveSettingsToFirebase, 
  fetchSettingsFromFirebase,
  onAuthStateChange,
  signOut,
  getCurrentUserProfile,
  upsertProfile,
  fetchProfiles
} from './services/firebaseService';
import { generatePersonalizedNote } from './services/geminiService';

declare var html2pdf: any;

const INITIAL_GUEST = { name: '', company: '', email: '', phone: '', address: '' };
const INITIAL_STAY = { roomNumber: '', roomType: '', guestType: GUEST_TYPES[0], checkIn: '', checkOut: '', guestsCount: 1 };

// Updated: Super Admin restricted strictly to rifkiandrean@gmail.com
const SUPER_ADMIN_EMAILS = ['rifkiandrean@gmail.com'];
const MASTER_ADMIN = 'rifkiandrean@gmail.com';

const DASHBOARD_BANNERS = [
  {
    id: 1,
    title: "Selamat Datang di Hotel Invoice by VELL",
    subtitle: "Sistem manajemen operasional hotel & villa yang efisien, modern, dan terintegrasi AI.",
    gradient: "bg-gradient-to-r from-indigo-600 to-violet-600",
    pattern: "opacity-20",
    icon: "🏨"
  },
  {
    id: 2,
    title: "Kelola Tamu Lebih Mudah",
    subtitle: "Catat transaksi, cetak invoice, dan pantau status pembayaran dalam satu dashboard.",
    gradient: "bg-gradient-to-r from-emerald-500 to-teal-600",
    pattern: "opacity-20",
    icon: "✨"
  },
  {
    id: 3,
    title: "Fitur AI Personal Assistant",
    subtitle: "Gunakan AI untuk membuat catatan personal yang hangat bagi setiap tamu Anda.",
    gradient: "bg-gradient-to-r from-rose-500 to-orange-500",
    pattern: "opacity-20",
    icon: "🤖"
  }
];

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeCategory, setActiveCategory] = useState<'hotel' | 'villa'>('hotel');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  // Sesi Login Dinamis per Akun (Default 24 Jam jika belum diatur di Manajemen Akun)
  const DEFAULT_SESSION_HOURS = 24;
  const activeSessionHours =
    userProfile?.session_duration_hours && userProfile.session_duration_hours > 0
      ? userProfile.session_duration_hours
      : DEFAULT_SESSION_HOURS;
  const activeSessionDurationSeconds = activeSessionHours * 3600;
  const activeSessionDurationMs = activeSessionDurationSeconds * 1000;
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number>(DEFAULT_SESSION_HOURS * 3600);

  // Slide Side Menu State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Profile Popover Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside & close sidebar on Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileMenu]);

  // Banner State
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [hotelSettings, setHotelSettings] = useState<HotelSettings>({
    ...HOTEL_INFO,
    defaultTaxRate: TAX_RATE,
    settingsPin: "1234"
  });

  const [villaSettings, setVillaSettings] = useState<HotelSettings>({
    ...VILLA_INFO,
    defaultTaxRate: TAX_RATE,
    settingsPin: "1234"
  });

  const activeSettings = activeCategory === 'villa' ? villaSettings : hotelSettings;
  const activeRoomTypes = activeCategory === 'villa' ? VILLA_ROOM_TYPES : ROOM_TYPES;

  // Banner Auto Slide Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % DASHBOARD_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        let profile = await getCurrentUserProfile(newSession.user.id);
        const email = newSession.user.email?.toLowerCase();
        
        // If not found by UID, check if email was pre-authorized in profiles
        if (!profile && email) {
          const allProfiles = await fetchProfiles();
          const matchedByEmail = allProfiles.find(p => p.email.toLowerCase() === email);
          if (matchedByEmail) {
            // Adopt existing permissions and link with the actual Google UID
            profile = {
              ...matchedByEmail,
              id: newSession.user.id,
              updated_at: new Date().toISOString()
            };
            await upsertProfile(profile);
          }
        }

        // Auto-create profile for Super Admin or default hotel account if missing
        if (!profile && email && SUPER_ADMIN_EMAILS.includes(email)) {
          const newSuperProfile: UserProfile = {
            id: newSession.user.id,
            email: newSession.user.email || email,
            role: 'super-admin',
            subscription_status: 'active',
            session_duration_hours: DEFAULT_SESSION_HOURS,
            fullName: newSession.user.displayName || 'Super Admin',
            photoURL: newSession.user.photoURL || undefined,
            updated_at: new Date().toISOString()
          };
          await upsertProfile(newSuperProfile);
          profile = newSuperProfile;
        } else if (!profile && email === 'hotelpangandaranblueorchid@gmail.com') {
           const newProfile: UserProfile = {
             id: newSession.user.id,
             email: email,
             role: 'receptionist',
             subscription_status: 'active',
             session_duration_hours: DEFAULT_SESSION_HOURS,
             updated_at: new Date().toISOString()
           };
           await upsertProfile(newProfile);
           profile = newProfile;
        }

        // Validasi batas waktu sesi dinamis berdasarkan pengaturan masing-masing akun
        const resolvedSessionHours =
          profile?.session_duration_hours && profile.session_duration_hours > 0
            ? profile.session_duration_hours
            : DEFAULT_SESSION_HOURS;
        const resolvedDurationMs = resolvedSessionHours * 3600 * 1000;

        const storedLoginTime = localStorage.getItem('hotelflow_login_timestamp');
        const now = Date.now();
        if (!storedLoginTime) {
          localStorage.setItem('hotelflow_login_timestamp', now.toString());
        } else {
          const elapsed = now - parseInt(storedLoginTime, 10);
          if (elapsed >= resolvedDurationMs) {
            await performSignOut(`Waktu sesi login (${resolvedSessionHours} jam) telah berakhir demi alasan keamanan. Silakan login kembali.`);
            return;
          }
        }

        if (email && SUPER_ADMIN_EMAILS.includes(email)) {
          setUserProfile({ 
            id: newSession.user.id, 
            email: newSession.user.email, 
            role: 'super-admin',
            subscription_status: 'active',
            subscription_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString(),
            fullName: newSession.user.displayName || 'Super Admin',
            photoURL: newSession.user.photoURL || undefined,
            session_duration_hours: resolvedSessionHours
          });
        } else if (email === 'hotelpangandaranblueorchid@gmail.com') {
          setUserProfile({ 
            id: newSession.user.id, 
            email: newSession.user.email, 
            role: 'receptionist',
            subscription_status: profile?.subscription_status || 'active', 
            subscription_end_date: profile?.subscription_end_date,
            fullName: profile?.fullName || newSession.user.displayName || 'Hotel Pangandaran',
            photoURL: newSession.user.photoURL || profile?.photoURL || undefined,
            session_duration_hours: resolvedSessionHours
          });
        } else {
          if (profile) {
            setUserProfile({
              ...profile,
              fullName: profile.fullName || newSession.user.displayName || undefined,
              photoURL: newSession.user.photoURL || profile.photoURL || undefined,
              session_duration_hours: resolvedSessionHours
            });
          } else {
            setUserProfile(profile);
          }
        }
      } else {
        localStorage.removeItem('hotelflow_login_timestamp');
        setUserProfile(null);
        setViewMode('list');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Timer Interval Pengecekan Sesi Dinamis per Akun (Setiap Detik)
  useEffect(() => {
    if (!session || !userProfile) return;

    const updateRemaining = () => {
      const storedLoginTime = localStorage.getItem('hotelflow_login_timestamp');
      if (storedLoginTime) {
        const elapsed = Date.now() - parseInt(storedLoginTime, 10);
        const remainingMs = Math.max(0, activeSessionDurationMs - elapsed);
        const remainingSec = Math.floor(remainingMs / 1000);
        setSessionRemainingSeconds(remainingSec);

        if (elapsed >= activeSessionDurationMs) {
          performSignOut(`Waktu sesi login Anda (${activeSessionHours} jam) telah habis demi keamanan. Silakan login kembali.`);
          return true;
        }
      }
      return false;
    };

    if (updateRemaining()) return;

    const checkInterval = setInterval(() => {
      if (updateRemaining()) {
        clearInterval(checkInterval);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [session, userProfile, activeSessionDurationMs, activeSessionHours]);

  const loadCloudSettings = useCallback(async (category: 'hotel' | 'villa') => {
    if (!session) return;
    setSyncStatus('syncing');
    try {
      const cloudSettings = await fetchSettingsFromFirebase(category);
      if (cloudSettings) {
        if (category === 'hotel') {
          setHotelSettings(prev => ({ 
            ...prev, 
            ...cloudSettings
          }));
        } else {
          setVillaSettings(prev => ({ 
            ...prev, 
            ...cloudSettings
          }));
        }
        setSyncStatus('success');
      }
    } catch (error) {
      console.error("Failed to load cloud settings:", error);
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadCloudSettings('hotel');
      loadCloudSettings('villa');
    }
  }, [session, loadCloudSettings]);

  const syncFromCloud = useCallback(async () => {
    if (!session) return;
    setSyncStatus('syncing');
    try {
      const cloudInvoices = await fetchInvoicesFromFirebase();
      setInvoices(cloudInvoices);
      setSyncStatus('success');
    } catch (error) {
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [session]);

  useEffect(() => {
    if (viewMode === 'list' && session) {
      syncFromCloud();
    }
  }, [viewMode, syncFromCloud, session, activeCategory]);

  const handleSaveSettings = async (newSettings: HotelSettings) => {
    if (session) {
      setSyncStatus('syncing');
      const success = await saveSettingsToFirebase(activeCategory, newSettings);
      if (success) {
        if (activeCategory === 'hotel') setHotelSettings(newSettings);
        else setVillaSettings(newSettings);
        setSyncStatus('success');
        alert('Pengaturan berhasil disimpan ke Firebase!');
      } else {
        setSyncStatus('error');
        alert('Gagal menyimpan ke Firebase. Periksa koneksi atau database.');
        loadCloudSettings(activeCategory); 
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const performSignOut = async (message?: string) => {
    try {
      localStorage.removeItem('hotelflow_login_timestamp');
      await signOut();
      setSession(null);
      setUserProfile(null);
      setViewMode('list');
      if (message) {
        alert(message);
      }
    } catch (err) {
      console.error("Error during sign out:", err);
    }
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      await performSignOut();
    }
  };

  const calculateSubtotal = (inv: Invoice) => inv.items.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0);
  const calculateTotal = (inv: Invoice) => calculateSubtotal(inv) - inv.discount;
  const calculatePayments = (inv: Invoice) => inv.payments.reduce((sum, p) => sum + p.amount, 0);
  const calculateBalance = (inv: Invoice) => calculateTotal(inv) - calculatePayments(inv);
  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const handleSaveInvoice = async () => {
    if (!currentInvoice) return;

    const isDuplicate = invoices.some(inv => 
      inv.invoiceNumber === currentInvoice.invoiceNumber && inv.id !== currentInvoice.id
    );

    if (isDuplicate) {
      alert(`Gagal menyimpan: Nomor Invoice "${currentInvoice.invoiceNumber}" sudah digunakan oleh data lain. Silakan perbarui nomor invoice.`);
      return;
    }

    const finalizedInvoice = { ...currentInvoice, hotelSnap: activeSettings };
    
    setCurrentInvoice(finalizedInvoice);
    setViewMode('view');

    if (session) {
      setSyncStatus('syncing');
      const success = await upsertInvoiceToFirebase(finalizedInvoice);
      if (success) {
        setSyncStatus('success');
        syncFromCloud();
      } else {
        setSyncStatus('error');
        alert('Gagal menyimpan invoice ke Firebase.');
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const canDeleteInvoice = userProfile?.role === 'admin' || userProfile?.role === 'super-admin' || userProfile?.email === MASTER_ADMIN;

  const handleDeleteInvoice = async (invoiceToDelete: Invoice) => {
    if (!canDeleteInvoice) {
      alert('Akses Ditolak: Hanya Admin atau Super Admin yang berhak menghapus invoice.');
      return;
    }

    const confirmMessage = `Apakah Anda yakin ingin MENGHAPUS PERMANEN invoice "${invoiceToDelete.invoiceNumber}" atas nama "${invoiceToDelete.guest.name || 'Tamu'}"?\n\nTindakan ini tidak dapat dibatalkan.`;
    if (!confirm(confirmMessage)) return;

    setSyncStatus('syncing');
    try {
      const success = await deleteInvoiceFromFirebase(invoiceToDelete.id);
      if (success) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
        if (currentInvoice?.id === invoiceToDelete.id) {
          setCurrentInvoice(null);
          setViewMode('list');
        }
        setSyncStatus('success');
        alert(`Invoice "${invoiceToDelete.invoiceNumber}" berhasil dihapus.`);
      } else {
        setSyncStatus('error');
        alert('Gagal menghapus invoice dari database. Pastikan koneksi internet stabil.');
      }
    } catch (err: any) {
      setSyncStatus('error');
      alert('Terjadi kesalahan saat menghapus invoice: ' + (err.message || ''));
    } finally {
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const handleGenerateAINote = async () => {
    if (!currentInvoice || !currentInvoice.guest.name) return;
    setIsGeneratingNote(true);
    try {
      const aiNote = await generatePersonalizedNote(currentInvoice);
      setCurrentInvoice({ ...currentInvoice, remarks: aiNote });
    } catch (error) {
      console.error("Failed to generate AI note:", error);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const downloadPDF = () => {
    if (!currentInvoice) return;
    const element = document.getElementById('invoice-content');
    if (!element) return;
    
    const opt = {
      margin: 0,
      filename: `Invoice ${currentInvoice.invoiceNumber} - ${currentInvoice.guest.name || 'GUEST'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: '#FFFFFF',
        scrollY: 0, 
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    const container = document.querySelector('.invoice-preview-container');
    if (container) container.scrollTop = 0;

    html2pdf().set(opt).from(element).save();
  };

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    if (!currentInvoice) return;
    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.map(item => item.id === id ? { ...item, ...updates } : item)
    });
  };

  const handleDeleteItem = (id: string) => {
    if (!currentInvoice) return;
    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.filter(i => i.id !== id)
    });
  };

  const handleUpdatePayment = (id: string, updates: Partial<Payment>) => {
    if (!currentInvoice) return;
    setCurrentInvoice({
      ...currentInvoice,
      payments: currentInvoice.payments.map(p => p.id === id ? { ...p, ...updates } : p)
    });
  };

  const handleDeletePayment = (id: string) => {
    if (!currentInvoice) return;
    setCurrentInvoice({
      ...currentInvoice,
      payments: currentInvoice.payments.filter(p => p.id !== id)
    });
  };

  const createNewInvoice = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const lastCashier = invoices.length > 0 ? invoices[0].cashierName : '';
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];
    const prefix = `${activeCategory === 'villa' ? 'VIL' : 'INV'}-${currentYear}-`;
    const sequenceNumbers = invoices
      .filter(inv => inv.category === activeCategory && inv.invoiceNumber.startsWith(prefix))
      .map(inv => parseInt(inv.invoiceNumber.split('-').pop() || '0', 10));
    const nextSequence = (sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0) + 1;
    
    setCurrentInvoice({
      id,
      category: activeCategory,
      invoiceNumber: `${prefix}${nextSequence.toString().padStart(4, '0')}`,
      date: today,
      guest: { ...INITIAL_GUEST },
      stay: { ...INITIAL_STAY, roomType: activeRoomTypes[0] },
      items: [{ id: '1', date: today, description: '', quantity: 1, nights: 1, unitPrice: 0, total: 0 }],
      payments: [],
      taxRate: 0, discount: 0, status: 'draft', notes: '', remarks: '', hotelSnap: activeSettings,
      cashierName: lastCashier || ''
    });
    setViewMode('create');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesCategory = inv.category === activeCategory;
    const matchesSearch = 
      inv.guest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.guest.company || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
    const matchesStartDate = !startDate || inv.date >= startDate;
    const matchesEndDate = !endDate || inv.date <= endDate;

    return matchesCategory && matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
  });

  const handleSettingsClick = () => {
    setPinValue('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handlePinSubmit = (val: string) => {
    const targetPin = activeSettings.settingsPin || "1234";
    if (val === targetPin) {
      setShowPinModal(false);
      setViewMode('settings');
    } else {
      setPinError(true);
      setPinValue('');
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handlePinDigit = (digit: string) => {
    const newVal = pinValue + digit;
    if (newVal.length <= 4) {
      setPinValue(newVal);
      if (newVal.length === 4) {
        setTimeout(() => handlePinSubmit(newVal), 100);
      }
    }
  };

  if (!session) return <Auth hotelName={activeSettings.name} />;

  // --- Subscription Check Logic with Grace Period (Waktu Jatuh Tempo) ---
  const isSuperAdmin = userProfile?.role === 'super-admin' || userProfile?.email === MASTER_ADMIN;
  
  const isSubscriptionValid = (() => {
    if (!userProfile) return false;
    if (userProfile.subscription_status !== 'active') return false;
    if (!userProfile.subscription_end_date) return false;

    const endDate = new Date(userProfile.subscription_end_date);
    const graceDays = typeof userProfile.grace_period_days === 'number' ? userProfile.grace_period_days : 3;
    const finalDeadline = new Date(endDate);
    finalDeadline.setDate(finalDeadline.getDate() + graceDays);

    return new Date() <= finalDeadline;
  })();
  
  if (!isSuperAdmin && !isSubscriptionValid && userProfile) {
    return <SubscriptionBlock user={userProfile} onLogout={handleLogout} />;
  }
  // ----------------------------------------------------------------------

  const invoiceCalculations = currentInvoice ? {
    subtotal: calculateSubtotal(currentInvoice),
    total: calculateTotal(currentInvoice),
    paid: calculatePayments(currentInvoice),
    balance: calculateBalance(currentInvoice)
  } : { subtotal: 0, total: 0, paid: 0, balance: 0 };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 h-16 shrink-0 flex items-center z-50 no-print shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-5 lg:px-6 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Tombol Ikon Menu untuk Slide Side Menu */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95 shrink-0"
              title="Buka Menu Navigasi"
              aria-label="Buka Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo & Judul Header: VELL HOTEL & Blue Orchid Hotel */}
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
              onClick={() => { setViewMode('list'); setActiveCategory('hotel'); }}
            >
              <img
                src="/assets/aistudio/IMG_20261113_124524_aaac2894.jpg"
                alt="VELL Logo"
                className="h-5 sm:h-6 w-auto object-contain mix-blend-multiply shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5 min-w-0">
                <h1 className="text-xs sm:text-base font-black text-slate-900 tracking-tight uppercase italic leading-tight whitespace-nowrap">
                  VELL HOTEL
                </h1>
                <div className="w-px h-4 bg-slate-200 hidden sm:block shrink-0"></div>
                <h2 className="text-[10px] sm:text-xs font-bold text-indigo-600 tracking-wide leading-tight truncate">
                  Blue Orchid Hotel
                </h2>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            {syncStatus !== 'idle' && (
              <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                syncStatus === 'syncing' ? 'bg-slate-100 text-slate-500' :
                syncStatus === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {syncStatus === 'syncing' && <div className="w-2 h-2 border border-slate-400 border-t-transparent animate-spin rounded-full"></div>}
                {syncStatus}
              </div>
            )}

            <button onClick={createNewInvoice} className="bg-indigo-600 text-white px-3 lg:px-4 py-2 rounded-xl text-xs lg:text-sm font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">Buat Invoice</span>
              <span className="sm:hidden">Buat</span>
            </button>

            {/* Foto Profil Akun Google (Tombol Profil Login & Sesi) */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(prev => !prev)}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 ${
                  showProfileMenu 
                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
                title="Lihat Profil Akun Google & Sisa Waktu Sesi"
                aria-label="Profil Akun"
              >
                {/* Avatar Foto Profil Google / Fallback Inisial */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white shrink-0">
                  {session?.user?.photoURL || userProfile?.photoURL ? (
                    <img
                      src={session?.user?.photoURL || userProfile?.photoURL}
                      alt={session?.user?.displayName || 'Avatar'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>
                      {((session?.user?.displayName || userProfile?.fullName || session?.user?.email || 'U')[0] || 'U').toUpperCase()}
                    </span>
                  )}
                  {/* Status dot online */}
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-1 ring-white"></span>
                </div>

                {/* Nama Ringkas & Role di Desktop */}
                <div className="hidden md:flex flex-col items-start text-left leading-none">
                  <span className="text-[11px] font-bold text-slate-800 max-w-[110px] truncate">
                    {session?.user?.displayName || userProfile?.fullName || session?.user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 capitalize mt-0.5">
                    {userProfile?.role ? userProfile.role.replace('-', ' ') : 'User'}
                  </span>
                </div>

                {/* Arrow Icon */}
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    showProfileMenu ? 'rotate-180 text-indigo-600' : 'group-hover:text-slate-600'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Popover / Dropdown Menu Profil Login */}
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-fade-in">
                  {/* Header Profil */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-md ring-2 ring-indigo-50 shrink-0">
                      {session?.user?.photoURL || userProfile?.photoURL ? (
                        <img
                          src={session?.user?.photoURL || userProfile?.photoURL}
                          alt={session?.user?.displayName || 'Google Avatar'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>
                          {((session?.user?.displayName || userProfile?.fullName || session?.user?.email || 'U')[0] || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {session?.user?.displayName || userProfile?.fullName || 'Pengguna Akun Google'}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5" title={session?.user?.email}>
                        {session?.user?.email}
                      </p>
                      {userProfile?.role && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          userProfile.role === 'super-admin' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          userProfile.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {userProfile.role.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sisa Waktu Sesi Dinamis */}
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[11px] font-bold">Sisa Sesi Login</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-extrabold ${
                        sessionRemainingSeconds < 300 
                          ? 'bg-rose-100 text-rose-700 animate-pulse' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {Math.floor(sessionRemainingSeconds / 3600).toString().padStart(2, '0')}:
                        {Math.floor((sessionRemainingSeconds % 3600) / 60).toString().padStart(2, '0')}:
                        {(sessionRemainingSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          sessionRemainingSeconds < 300 ? 'bg-rose-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, (sessionRemainingSeconds / activeSessionDurationSeconds) * 100))}%` }}
                      ></div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1.5 leading-snug">
                      {sessionRemainingSeconds < 300 
                        ? '⚠️ Sesi akan segera berakhir dalam beberapa menit demi keamanan.'
                        : `Batas sesi akun ini: ${activeSessionHours} jam (diatur di Manajemen Akun).`}
                    </p>
                  </div>

                  {/* Status Langganan & Jatuh Tempo */}
                  <div className="mt-2.5 px-3 py-2 bg-slate-50/70 rounded-xl border border-slate-100 text-[10px] space-y-1">
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Status Langganan</span>
                      <span className={`font-bold capitalize ${
                        userProfile?.subscription_status === 'active' ? 'text-emerald-600' :
                        userProfile?.subscription_status === 'trial' ? 'text-indigo-600' : 'text-amber-600'
                      }`}>
                        {userProfile?.subscription_status || 'Aktif'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Jatuh Tempo Pembayaran</span>
                      <span className="font-bold text-slate-700">
                        {isSuperAdmin
                          ? 'Permanen (Super Admin)'
                          : userProfile?.subscription_end_date
                          ? new Date(userProfile.subscription_end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Belum diatur'}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Logout di Dalam Menu Profil */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
                    >
                      <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Keluar Akun (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop Overlay untuk Slide Side Menu */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] no-print transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide Side Menu Drawer (Tersembunyi hingga ikon menu ditekan) */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-72 max-w-[85vw] bg-white shadow-2xl border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-out no-print ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu Navigasi Samping"
      >
        {/* Drawer Header */}
        <div className="px-5 h-16 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/IMG_20261113_124524_aaac2894.jpg"
              alt="VELL Logo"
              className="h-5 w-auto object-contain mix-blend-multiply shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight leading-none">
                VELL HOTEL
              </span>
              <span className="text-[10px] font-bold text-indigo-600 tracking-wide mt-0.5 truncate">
                Blue Orchid Hotel
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            title="Tutup Menu"
            aria-label="Tutup Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Menu Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Menu Utama
            </p>
            <nav className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('hotel');
                  setViewMode('list');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list' && activeCategory === 'hotel'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Hotel & Cottage</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('villa');
                  setViewMode('list');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list' && activeCategory === 'villa'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Villa</span>
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    handleSettingsClick();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    viewMode === 'settings'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                </button>
              )}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Aksi Cepat
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                createNewInvoice();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Buat Invoice Baru</span>
            </button>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 space-y-2 shrink-0">
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 text-[11px]">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Properti Aktif</p>
            <p className="font-bold text-slate-800 truncate mt-0.5">{activeSettings.name}</p>
            <p className="text-[10px] text-slate-500 truncate mt-1">{session?.user?.email}</p>
          </div>
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            VELL STUDIO • www.vellstudio.my.id
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-[1600px] w-full mx-auto animate-fade-in flex flex-col h-full">
            <div className="flex-1">
              
              {/* Grace Period / Expiration Notice */}
              {(() => {
                if (!userProfile || isSuperAdmin || !userProfile.subscription_end_date) return null;
                const now = new Date();
                const endDate = new Date(userProfile.subscription_end_date);
                const graceDays = userProfile.grace_period_days ?? 3;
                const finalDeadline = new Date(endDate);
                finalDeadline.setDate(finalDeadline.getDate() + graceDays);

                const isPastEnd = now > endDate;
                const isWithinGrace = isPastEnd && now <= finalDeadline;
                const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const daysLeftInGrace = Math.ceil((finalDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                if (isWithinGrace) {
                  return (
                    <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-pulse">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                            Masa Jatuh Tempo Langganan Telah Tiba (Masa Toleransi Aktif)
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Langganan berakhir pada <strong>{endDate.toLocaleDateString('id-ID')}</strong>. Anda memiliki waktu toleransi <strong>{daysLeftInGrace} hari lagi</strong> (hingga {finalDeadline.toLocaleDateString('id-ID')}) sebelum sistem dikunci.
                          </p>
                        </div>
                      </div>
                      <a 
                        href="https://wa.me/6282115123431?text=Halo%20Admin,%20saya%20ingin%20konfirmasi%20pembayaran%20langganan%20bulanan%20HotelFlow."
                        target="_blank"
                        rel="noreferrer"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shrink-0 text-center transition-all shadow"
                      >
                        Perpanjang Sekarang
                      </a>
                    </div>
                  );
                } else if (daysUntilEnd <= 5 && daysUntilEnd > 0) {
                  return (
                    <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📅</span>
                        <div>
                          <p className="text-xs font-bold text-indigo-900">
                            Pengingat Langganan Bulanan: Jatuh tempo dalam {daysUntilEnd} hari ({endDate.toLocaleDateString('id-ID')})
                          </p>
                          <p className="text-[11px] text-indigo-600">
                            Toleransi pembayaran tersedia {graceDays} hari setelah tanggal jatuh tempo.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Banner Slider */}
              <div className="mb-8 rounded-3xl overflow-hidden relative shadow-lg shadow-indigo-100 group h-40 lg:h-48 transition-all">
                {DASHBOARD_BANNERS.map((banner, index) => (
                  <div 
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    } ${banner.gradient}`}
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                    <div className="relative z-20 h-full flex items-center px-6 lg:px-10">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl lg:text-3xl mr-4 lg:mr-6 shrink-0 shadow-inner border border-white/20">
                        {banner.icon}
                      </div>
                      <div className="text-white max-w-2xl">
                        <h3 className="text-lg lg:text-2xl font-black mb-1 lg:mb-2 tracking-tight">{banner.title}</h3>
                        <p className="text-xs lg:text-sm font-medium text-white/90 leading-relaxed max-w-xl">{banner.subtitle}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Dots Navigation */}
                <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-2">
                  {DASHBOARD_BANNERS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentBannerIndex(idx)}
                      className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full transition-all duration-300 ${
                        idx === currentBannerIndex ? 'bg-white w-6 lg:w-8' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-end mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-900">Dashboard {activeCategory === 'villa' ? 'Villa' : 'Hotel'}</h2>
                  <button onClick={syncFromCloud} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
                    <svg className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                  </button>
                </div>
                <div className="bg-slate-200 px-3 py-1 rounded-lg flex shadow-inner text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {filteredInvoices.length} Items
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Cari Tamu / Invoice</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input 
                        type="text" 
                        placeholder="Cari nama, company, atau invoice..." 
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Filter Status</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all bg-white"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Semua Status</option>
                      <option value="draft">Draft</option>
                      <option value="paid">Paid (Lunas)</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="md:col-span-4 flex justify-end">
                     <button 
                      onClick={() => { setSearchQuery(''); setStatusFilter('all'); setStartDate(''); setEndDate(''); }}
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2"
                     >
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                       Atur Ulang Filter
                     </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Dari Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Sampai Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <DesktopDashboardTable 
                invoices={filteredInvoices} 
                onSelect={(inv) => { setCurrentInvoice(inv); setViewMode('view'); }}
                formatCurrency={formatCurrency}
                calculateTotal={calculateTotal}
                canDelete={canDeleteInvoice}
                onDelete={handleDeleteInvoice}
              />

              <MobileDashboardList 
                invoices={filteredInvoices} 
                onSelect={(inv) => { setCurrentInvoice(inv); setViewMode('view'); }}
                formatCurrency={formatCurrency}
                calculateTotal={calculateTotal}
                canDelete={canDeleteInvoice}
                onDelete={handleDeleteInvoice}
              />
            </div>

            {/* Global Dashboard Footer */}
            <footer className="mt-8 pb-6 text-center">
              <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                Copyright 2026 by <a href="https://www.vellstudio.my.id" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 transition-colors">VELL STUDIO</a>
              </p>
            </footer>
          </div>
        )}

        {viewMode === 'create' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in">
             <MobileInvoiceForm 
               invoice={currentInvoice}
               setInvoice={setCurrentInvoice}
               onSave={handleSaveInvoice}
               onCancel={() => setViewMode('list')}
               onUpdateItem={handleUpdateItem}
               onDeleteItem={handleDeleteItem}
               onUpdatePayment={handleUpdatePayment}
               onDeletePayment={handleDeletePayment}
               onGenerateAINote={handleGenerateAINote}
               isGeneratingNote={isGeneratingNote}
               formatCurrency={formatCurrency}
               calculations={invoiceCalculations}
               roomTypes={activeRoomTypes}
             />
             <DesktopInvoiceForm 
               invoice={currentInvoice}
               setInvoice={setCurrentInvoice}
               onSave={handleSaveInvoice}
               onCancel={() => setViewMode('list')}
               onUpdateItem={handleUpdateItem}
               onDeleteItem={handleDeleteItem}
               onUpdatePayment={handleUpdatePayment}
               onDeletePayment={handleDeletePayment}
               onGenerateAINote={handleGenerateAINote}
               isGeneratingNote={isGeneratingNote}
               formatCurrency={formatCurrency}
               calculations={invoiceCalculations}
               roomTypes={activeRoomTypes}
             />
          </div>
        )}

        {viewMode === 'view' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
            <div className="p-3 lg:p-4 bg-white border-b border-slate-200 flex flex-wrap gap-3 justify-between items-center no-print">
              <button onClick={() => setViewMode('list')} className="text-slate-500 font-bold text-xs flex items-center gap-2 hover:text-slate-900 bg-slate-100 px-3 py-2 rounded-xl">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Kembali
              </button>
              <div className="flex gap-2 flex-1 sm:flex-none justify-end">
                {canDeleteInvoice && (
                  <button 
                    onClick={() => handleDeleteInvoice(currentInvoice)} 
                    className="px-3 py-2 border border-rose-200 text-rose-600 rounded-xl text-[10px] lg:text-xs font-bold hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
                    title="Hapus Invoice (Khusus Admin)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus
                  </button>
                )}
                <button onClick={() => setViewMode('create')} className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] lg:text-xs font-bold text-slate-600 hover:bg-slate-50">Edit</button>
                <button onClick={() => window.print()} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[10px] lg:text-xs font-bold hover:bg-slate-300">Print</button>
                <button onClick={downloadPDF} className="bg-slate-900 text-white px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                  <span className="hidden xs:inline">Simpan PDF</span>
                  <span className="xs:hidden">PDF</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto print:bg-white print:p-0 print:overflow-visible print:h-auto custom-scrollbar bg-slate-200/50">
              <div className="invoice-preview-container">
                <InvoicePreview invoice={currentInvoice} settings={activeSettings} />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
            <div className="max-w-4xl mx-auto mb-4 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between">
              <h2 className="text-indigo-900 font-black text-sm uppercase tracking-widest">
                Pengaturan {activeCategory === 'villa' ? 'Villa' : 'Hotel'}
              </h2>
              <span className="text-[10px] text-indigo-400 font-bold uppercase italic">Ubah Profil & Nomor Rekening Sesuai Kategori</span>
            </div>
            <SettingsPage 
              settings={activeSettings} 
              onSave={handleSaveSettings} 
              currentUserRole={userProfile?.role} 
              onCurrentUserProfileUpdated={(updated) => {
                if (
                  updated.id === userProfile?.id ||
                  updated.email.toLowerCase() === userProfile?.email?.toLowerCase()
                ) {
                  setUserProfile(prev =>
                    prev
                      ? { ...prev, session_duration_hours: updated.session_duration_hours }
                      : prev
                  );
                }
              }}
            />
          </div>
        )}
      </main>

      {showPinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className={`bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs text-center border border-white/20 transition-all ${pinError ? 'animate-shake' : 'animate-slide-up'}`}>
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Akses Terbatas</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Masukkan PIN untuk {activeSettings.name}</p>
            
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                    pinValue.length > i 
                      ? 'bg-indigo-600 border-indigo-600 scale-125' 
                      : 'bg-transparent border-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'C') setPinValue('');
                    else if (key === '←') setPinValue(prev => prev.slice(0, -1));
                    else handlePinDigit(key.toString());
                  }}
                  className="h-14 flex items-center justify-center rounded-2xl text-lg font-bold hover:bg-slate-50 active:bg-slate-100 transition-all text-slate-700"
                >
                  {key}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowPinModal(false)}
              className="mt-6 text-xs font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
