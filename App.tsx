
import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, ViewMode, InvoiceItem, Payment, HotelSettings, UserProfile } from './types';
import { InvoicePreview } from './components/InvoicePreview';
import { InvoiceItemRow } from './components/InvoiceItemRow';
import { PaymentRow } from './components/PaymentRow';
import { SettingsPage } from './components/SettingsPage';
import { Auth } from './components/Auth';
import { ROOM_TYPES, GUEST_TYPES, PAYMENT_METHODS, HOTEL_INFO, TAX_RATE } from './constants';
import { 
  fetchInvoicesFromSupabase, 
  upsertInvoiceToSupabase, 
  saveSettingsToSupabase, 
  fetchSettingsFromSupabase,
  onAuthStateChange,
  signOut,
  getCurrentUserProfile
} from './services/supabaseService';
import { generatePersonalizedNote } from './services/geminiService';

declare var html2pdf: any;

const INITIAL_GUEST = { name: '', email: '', phone: '', address: '' };
const INITIAL_STAY = { roomNumber: '', roomType: ROOM_TYPES[0], guestType: GUEST_TYPES[0], checkIn: '', checkOut: '', guestsCount: 1 };

const SUPER_ADMIN_EMAILS = ['hotelpangandaranblueorchid@gmail.com', 'rifkiandrean@gmail.com'];

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState(0); 
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [settings, setSettings] = useState<HotelSettings>({
    ...HOTEL_INFO,
    defaultTaxRate: TAX_RATE,
    settingsPin: "1234"
  });

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const profile = await getCurrentUserProfile(newSession.user.id);
        const email = newSession.user.email?.toLowerCase();
        
        if (email && SUPER_ADMIN_EMAILS.includes(email)) {
          setUserProfile({ 
            id: newSession.user.id, 
            email: newSession.user.email, 
            role: 'super-admin' 
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

  const loadCloudSettings = useCallback(async () => {
    if (!session) return;
    setSyncStatus('syncing');
    try {
      const cloudSettings = await fetchSettingsFromSupabase(settings);
      if (cloudSettings) {
        setSettings(prev => ({ 
          ...prev, 
          ...cloudSettings,
          supabaseUrl: HOTEL_INFO.supabaseUrl,
          supabaseAnonKey: HOTEL_INFO.supabaseAnonKey
        }));
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
      loadCloudSettings();
    }
  }, [session, loadCloudSettings]);

  const syncFromSupabase = useCallback(async () => {
    if (!session) return;
    setSyncStatus('syncing');
    try {
      const cloudInvoices = await fetchInvoicesFromSupabase(settings);
      setInvoices(cloudInvoices);
      setSyncStatus('success');
    } catch (error) {
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [session, settings]);

  useEffect(() => {
    if (viewMode === 'list' && session) {
      syncFromSupabase();
    }
  }, [viewMode, syncFromSupabase, session]);

  const handleSaveSettings = async (newSettings: HotelSettings) => {
    if (session) {
      setSyncStatus('syncing');
      const success = await saveSettingsToSupabase(newSettings);
      if (success) {
        setSettings(newSettings);
        setSyncStatus('success');
        alert('Pengaturan berhasil disimpan ke cloud!');
      } else {
        setSyncStatus('error');
        alert('Gagal menyimpan ke cloud. Periksa koneksi atau database.');
        loadCloudSettings(); 
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

    const finalizedInvoice = { ...currentInvoice, hotelSnap: settings };
    
    setCurrentInvoice(finalizedInvoice);
    setViewMode('view');

    if (session) {
      setSyncStatus('syncing');
      const success = await upsertInvoiceToSupabase(finalizedInvoice, settings);
      if (success) {
        setSyncStatus('success');
        syncFromSupabase();
      } else {
        setSyncStatus('error');
        alert('Gagal menyimpan invoice ke cloud.');
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
    
    // Konfigurasi PDF yang dioptimalkan untuk hasil yang presisi dan rata tengah
    const opt = {
      margin: 0,
      filename: `Invoice_${currentInvoice.invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 3, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: '#FFFFFF',
        width: 794, // Standard A4 210mm @ 96 DPI
        windowWidth: 794,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Pastikan scroll berada di atas sebelum capture untuk menghindari misalignment
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

  const handleUpdatePayment = (id: string, updates: Partial<Payment>) => {
    if (!currentInvoice) return;
    setCurrentInvoice({
      ...currentInvoice,
      payments: currentInvoice.payments.map(p => p.id === id ? { ...p, ...updates } : p)
    });
  };

  const createNewInvoice = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const lastCashier = invoices.length > 0 ? invoices[0].cashierName : '';
    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;
    const sequenceNumbers = invoices
      .filter(inv => inv.invoiceNumber.startsWith(prefix))
      .map(inv => parseInt(inv.invoiceNumber.split('-').pop() || '0', 10));
    const nextSequence = (sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0) + 1;
    
    setCurrentInvoice({
      id,
      invoiceNumber: `${prefix}${nextSequence.toString().padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      guest: { ...INITIAL_GUEST },
      stay: { ...INITIAL_STAY },
      items: [{ id: '1', description: '', quantity: 1, nights: 1, unitPrice: 0, total: 0 }],
      payments: [],
      taxRate: 0, discount: 0, status: 'draft', notes: '', remarks: '', hotelSnap: settings,
      cashierName: lastCashier || ''
    });
    setActiveTab(0);
    setViewMode('create');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.guest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
    const matchesStartDate = !startDate || inv.date >= startDate;
    const matchesEndDate = !endDate || inv.date <= endDate;

    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
  });

  const handleSettingsClick = () => {
    setPinValue('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handlePinSubmit = (val: string) => {
    const targetPin = settings.settingsPin || "1234";
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

  const TABS = [
    { label: 'Tamu', icon: '👤' },
    { label: 'Nginap', icon: '🏨' },
    { label: 'Layanan', icon: '🍽️' },
    { label: 'Bayar', icon: '💳' },
    { label: 'Final', icon: '✅' }
  ];

  if (!session) return <Auth hotelName={settings.name} />;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-14 shrink-0 flex items-center z-50 no-print">
        <div className="max-w-[1600px] w-full mx-auto px-4 lg:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 lg:gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('list')}>
              <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                <h1 className="text-base lg:text-lg font-black text-slate-900 hidden xs:block tracking-tighter">HotelFlow</h1>
                <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                <h2 className="text-[11px] lg:text-xs font-bold text-indigo-600 uppercase tracking-widest hidden md:block line-clamp-1 max-w-[200px] lg:max-w-none">
                  {settings.name}
                </h2>
              </div>
            </div>
            <nav className="flex items-center gap-0.5 lg:gap-1">
              <button onClick={() => setViewMode('list')} className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Beranda</button>
              <button onClick={handleSettingsClick} className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Settings</button>
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
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-[1600px] w-full mx-auto animate-fade-in">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl lg:text-2xl font-bold text-slate-900">Dashboard</h2>
                <button onClick={syncFromSupabase} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
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
                      placeholder="Cari nama tamu atau nomor invoice..." 
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
            
            <div className="hidden md:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">ID Invoice</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Nama Tamu</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase text-right">Total Bayar</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase text-center">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInvoices.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada invoice yang sesuai dengan filter.</td></tr>
                  ) : (
                    filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => { setCurrentInvoice(inv); setViewMode('view'); }}>
                        <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-bold">{inv.invoiceNumber}</td>
                        <td className="px-6 py-4 font-bold text-slate-700 uppercase">{inv.guest.name}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">Rp {formatCurrency(calculateTotal(inv))}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                            inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                          }`}>{inv.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={(e) => { e.stopPropagation(); setCurrentInvoice(inv); setViewMode('view'); }} className="text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">Lihat</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filteredInvoices.map(inv => (
                <div key={inv.id} onClick={() => { setCurrentInvoice(inv); setViewMode('view'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <span className="text-[10px] font-mono text-indigo-600 font-bold block mb-0.5 tracking-tight">{inv.invoiceNumber}</span>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight uppercase">{inv.guest.name}</h4>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                      inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>{inv.status}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan</div>
                    <div className="text-sm font-bold text-slate-900">Rp {formatCurrency(calculateTotal(inv))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'create' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in">
            <div className="md:hidden bg-white border-b border-slate-200 overflow-x-auto custom-scrollbar flex shrink-0">
              {TABS.map((tab, idx) => (
                <button 
                  key={tab.label}
                  onClick={() => setActiveTab(idx)}
                  className={`flex-1 min-w-[70px] py-2 flex flex-col items-center gap-0.5 border-b-2 transition-all ${activeTab === idx ? 'border-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400'}`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-tighter ${activeTab === idx ? 'text-indigo-600' : 'text-slate-400'}`}>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 lg:p-4">
              <div className="max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row gap-4 h-full">
                <div className="flex-1 flex flex-col gap-4">
                  <div className={`${activeTab === 0 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center text-[10px]">01</span>
                      Identitas Tamu
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Nama Lengkap</label>
                        <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.guest.name} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, name: e.target.value.toUpperCase()}})} placeholder="NAMA LENGKAP" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Telepon / WA</label>
                        <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.guest.phone} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, phone: e.target.value}})} placeholder="0812..." />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Email</label>
                        <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.guest.email} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, email: e.target.value}})} placeholder="email@tamu.com" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Alamat Domisili</label>
                        <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.guest.address} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, address: e.target.value}})} placeholder="Kota, Negara" />
                      </div>
                    </div>
                  </div>

                  <div className={`${activeTab === 1 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center text-[10px]">02</span>
                      Detail Menginap
                    </h3>
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-6">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Tipe Kamar</label>
                        <select className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.roomType} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, roomType: e.target.value}})}>
                          {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-6">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Jenis Tamu</label>
                        <select className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.guestType} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, guestType: e.target.value}})}>
                          {GUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Nomor RM</label>
                        <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.roomNumber} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, roomNumber: e.target.value}})} placeholder="101" />
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Pax</label>
                        <input type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.guestsCount} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, guestsCount: Number(e.target.value)}})} />
                      </div>
                      <div className="col-span-6">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Check In</label>
                        <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.checkIn} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, checkIn: e.target.value}})} />
                      </div>
                      <div className="col-span-6">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Check Out</label>
                        <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={currentInvoice.stay.checkOut} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, checkOut: e.target.value}})} />
                      </div>
                    </div>
                  </div>

                  <div className={`${activeTab === 2 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <span className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center text-[10px]">03</span>
                        Layanan & Fasilitas
                      </h3>
                      <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, items: [...currentInvoice!.items, {id, description:'', quantity:1, nights:1, unitPrice:0, total:0}]}) }} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">+ Tambah</button>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
                      <div className="col-span-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Layanan</div>
                      <div className="col-span-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">Qty</div>
                      <div className="col-span-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">Malam</div>
                      <div className="col-span-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Harga Unit</div>
                      <div className="col-span-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>
                    <div className="space-y-2">
                      {currentInvoice.items.map(item => <InvoiceItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={id => setCurrentInvoice({...currentInvoice!, items: currentInvoice!.items.filter(i => i.id !== id)})} />)}
                    </div>
                  </div>

                  <div className={`${activeTab === 3 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <span className="w-5 h-5 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center text-[10px]">04</span>
                        Histori Pembayaran
                      </h3>
                      <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, payments: [...currentInvoice!.payments, {id, date: new Date().toISOString().split('T')[0], method: PAYMENT_METHODS[0], amount:0}]}) }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all">+ Catat Bayar</button>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
                      <div className="col-span-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tgl Bayar</div>
                      <div className="col-span-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Metode</div>
                      <div className="col-span-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Jumlah</div>
                      <div className="col-span-1"></div>
                    </div>
                    <div className="space-y-2">
                      {currentInvoice.payments.map(p => <PaymentRow key={p.id} payment={p} onUpdate={handleUpdatePayment} onDelete={id => setCurrentInvoice({...currentInvoice!, payments: currentInvoice!.payments.filter(pay => pay.id !== id)})} />) || <p className="text-center py-4 text-slate-400 text-[10px] italic">Belum ada pembayaran.</p>}
                    </div>
                  </div>
                </div>

                <div className={`${activeTab === 4 ? 'block' : 'hidden lg:block'} w-full lg:w-80 shrink-0`}>
                  <div className="bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 text-white shadow-xl flex flex-col h-full lg:sticky lg:top-0">
                    <div className="flex-1 space-y-3 lg:space-y-4">
                      <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Ringkasan Invoice</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Nomor Invoice</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase" value={currentInvoice.invoiceNumber} onChange={e => setCurrentInvoice({...currentInvoice!, invoiceNumber: e.target.value.toUpperCase()})} placeholder="NOMOR INVOICE" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Nama Kasir</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase" value={currentInvoice.cashierName || ''} onChange={e => setCurrentInvoice({...currentInvoice!, cashierName: e.target.value.toUpperCase()})} placeholder="NAMA PETUGAS" />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[8px] font-bold text-indigo-300 uppercase">Catatan</label>
                            <button onClick={handleGenerateAINote} disabled={isGeneratingNote || !currentInvoice.guest.name} className="text-[8px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 transition-all">{isGeneratingNote ? '...' : '✨ AI'}</button>
                          </div>
                          <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px] resize-none leading-tight" value={currentInvoice.remarks || ''} onChange={e => setCurrentInvoice({...currentInvoice!, remarks: e.target.value})} placeholder="Catatan tambahan..." />
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                          <div className="flex justify-between text-[10px] text-slate-400"><span>Subtotal</span><span>Rp {formatCurrency(calculateSubtotal(currentInvoice))}</span></div>
                          <div className="flex justify-between text-[10px] items-center"><span className="text-slate-400">Diskon</span><input type="text" className="w-20 bg-white/10 text-right px-1.5 py-0.5 rounded text-rose-400 text-[10px] border border-white/5 outline-none font-bold" value={formatCurrency(currentInvoice.discount)} onChange={e => setCurrentInvoice({...currentInvoice!, discount: parseInt(e.target.value.replace(/\D/g,'')) || 0})} /></div>
                          <div className="flex justify-between text-[10px] text-emerald-400 font-medium"><span>Sudah Bayar</span><span>Rp {formatCurrency(calculatePayments(currentInvoice))}</span></div>
                          <div className="h-px bg-white/10"></div>
                          <div className="text-center py-1">
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Sisa Tagihan</p>
                            <h4 className="text-xl font-bold text-white tracking-tight">Rp {formatCurrency(calculateBalance(currentInvoice))}</h4>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-white/10 space-y-2.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['draft', 'paid', 'cancelled'] as const).map(s => (
                          <button key={s} onClick={() => setCurrentInvoice({...currentInvoice!, status: s})} className={`py-1.5 rounded-lg text-[8px] font-bold uppercase transition-all ${currentInvoice!.status === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>{s}</button>
                        ))}
                      </div>
                      <button onClick={handleSaveInvoice} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-95 text-xs uppercase tracking-wider">Selesaikan & Simpan</button>
                      <button onClick={() => setViewMode('list')} className="w-full text-center text-slate-500 text-[9px] font-bold uppercase py-1 hover:text-rose-400 transition-colors">Batal</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'view' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
            <div className="p-3 lg:p-4 bg-white border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center no-print">
              <button onClick={() => setViewMode('list')} className="text-slate-500 font-bold text-xs flex items-center gap-2 hover:text-slate-900">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Kembali
              </button>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('create')} className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] lg:text-xs font-bold">Edit</button>
                <button onClick={() => window.print()} className="bg-slate-500 text-white px-3 py-2 rounded-xl text-[10px] lg:text-xs font-bold">Print</button>
                <button onClick={downloadPDF} className="bg-slate-900 text-white px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download PDF
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto print:bg-white print:p-0 custom-scrollbar bg-slate-100">
              <div className="invoice-preview-container">
                <InvoicePreview invoice={currentInvoice} settings={settings} />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
            <SettingsPage 
              settings={settings} 
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
            <p className="text-sm text-slate-500 mb-8 font-medium">Masukkan 4 digit PIN untuk membuka Pengaturan</p>
            
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
