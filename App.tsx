
import React, { useState, useEffect, useCallback } from 'react';
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

        // Auto-create profile for default hotel account if missing
        if (!profile && email === 'hotelpangandaranblueorchid@gmail.com') {
           const newProfile: UserProfile = {
             id: newSession.user.id,
             email: email,
             role: 'receptionist',
             subscription_status: 'active',
             updated_at: new Date().toISOString()
           };
           await upsertProfile(newProfile);
           profile = newProfile;
        }

        if (email && SUPER_ADMIN_EMAILS.includes(email)) {
          setUserProfile({ 
            id: newSession.user.id, 
            email: newSession.user.email, 
            role: 'super-admin',
            subscription_status: 'active',
            subscription_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString()
          });
        } else if (email === 'hotelpangandaranblueorchid@gmail.com') {
          setUserProfile({ 
            id: newSession.user.id, 
            email: newSession.user.email, 
            role: 'receptionist',
            subscription_status: profile?.subscription_status || 'active', 
            subscription_end_date: profile?.subscription_end_date,
            fullName: profile?.fullName
          });
        } else {
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
        setViewMode('list');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      try {
        await signOut();
        setSession(null);
        setUserProfile(null);
        setViewMode('list');
      } catch (err) {
        console.error("Error during sign out:", err);
      }
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

  // --- Subscription Check Logic ---
  const isSuperAdmin = userProfile?.role === 'super-admin' || userProfile?.email === MASTER_ADMIN;
  const hasActiveSubscription = userProfile?.subscription_status === 'active' && 
    (userProfile?.subscription_end_date ? new Date(userProfile.subscription_end_date) > new Date() : false);
  
  if (!isSuperAdmin && !hasActiveSubscription && userProfile) {
    return <SubscriptionBlock user={userProfile} onLogout={handleLogout} />;
  }
  // --------------------------------

  const invoiceCalculations = currentInvoice ? {
    subtotal: calculateSubtotal(currentInvoice),
    total: calculateTotal(currentInvoice),
    paid: calculatePayments(currentInvoice),
    balance: calculateBalance(currentInvoice)
  } : { subtotal: 0, total: 0, paid: 0, balance: 0 };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-14 shrink-0 flex items-center z-50 no-print">
        <div className="max-w-[1600px] w-full mx-auto px-4 lg:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 lg:gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setViewMode('list'); setActiveCategory('hotel'); }}>
              <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                <h1 className="text-base lg:text-lg font-black text-slate-900 hidden xs:block tracking-tighter">HotelFlow</h1>
                <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                <h2 className="text-[11px] lg:text-xs font-bold text-indigo-600 uppercase tracking-widest hidden md:block line-clamp-1 max-w-[200px] lg:max-w-none">
                  {activeSettings.name}
                </h2>
              </div>
            </div>
            <nav className="flex items-center gap-0.5 lg:gap-1">
              <button 
                onClick={() => { setActiveCategory('hotel'); setViewMode('list'); }} 
                className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'list' && activeCategory === 'hotel' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Hotel & Cottage
              </button>
              <button 
                onClick={() => { setActiveCategory('villa'); setViewMode('list'); }} 
                className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${activeCategory === 'villa' && viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Villa
              </button>
              {isSuperAdmin && (
                <button onClick={handleSettingsClick} className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Settings</button>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            {syncStatus !== 'idle' && (
              <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                syncStatus === 'syncing' ? 'bg-slate-100 text-slate-500' :
                syncStatus === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {syncStatus === 'syncing' && <div className="w-2 h-2 border border-slate-400 border-t-transparent animate-spin rounded-full"></div>}
                {syncStatus}
              </div>
            )}
            <div className="hidden md:flex flex-col items-end mr-2">
              <div className="flex items-center gap-2">
                {userProfile?.role && (
                   <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                     userProfile.role === 'super-admin' ? 'bg-amber-100 text-amber-600 border border-amber-200' :
                     userProfile.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                   }`}>{userProfile.role.replace('-', ' ')}</span>
                )}
                <span className="text-[10px] text-slate-600 font-bold">{session?.user?.email}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Keluar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
            <button onClick={createNewInvoice} className="bg-indigo-600 text-white px-3 lg:px-5 py-2 rounded-xl text-xs lg:text-sm font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1 lg:gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">Buat Invoice</span>
              <span className="sm:hidden">Buat</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-[1600px] w-full mx-auto animate-fade-in flex flex-col h-full">
            <div className="flex-1">
              
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
              />

              <MobileDashboardList 
                invoices={filteredInvoices} 
                onSelect={(inv) => { setCurrentInvoice(inv); setViewMode('view'); }}
                formatCurrency={formatCurrency}
                calculateTotal={calculateTotal}
              />
            </div>

            {/* Global Dashboard Footer */}
            <footer className="mt-8 pb-6 text-center">
              <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                Copyright 2026 by <a href="https://www.vell.web.id" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 transition-colors">VELL</a>
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
