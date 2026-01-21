
import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, ViewMode, InvoiceItem, Payment, HotelSettings } from './types';
import { InvoicePreview } from './components/InvoicePreview';
import { InvoiceItemRow } from './components/InvoiceItemRow';
import { PaymentRow } from './components/PaymentRow';
import { SettingsPage } from './components/SettingsPage';
import { ROOM_TYPES, GUEST_TYPES, PAYMENT_METHODS, HOTEL_INFO, TAX_RATE } from './constants';
import { fetchInvoicesFromSupabase, upsertInvoiceToSupabase, saveSettingsToSupabase, fetchSettingsFromSupabase } from './services/supabaseService';
import { generatePersonalizedNote } from './services/geminiService';

declare var html2pdf: any;

const INITIAL_GUEST = { name: '', email: '', phone: '', address: '' };
const INITIAL_STAY = { roomNumber: '', roomType: ROOM_TYPES[0], guestType: GUEST_TYPES[0], checkIn: '', checkOut: '', guestsCount: 1 };

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState(0); // For tabbed mobile view
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  
  const [settings, setSettings] = useState<HotelSettings>(() => {
    const saved = localStorage.getItem('hotelflow_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...HOTEL_INFO, ...parsed, defaultTaxRate: parsed.defaultTaxRate ?? TAX_RATE };
    }
    return {
      ...HOTEL_INFO,
      defaultTaxRate: TAX_RATE,
    };
  });

  const loadCloudSettings = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    try {
      const cloudSettings = await fetchSettingsFromSupabase(settings);
      if (cloudSettings) {
        setSettings(prev => ({ ...prev, ...cloudSettings }));
      }
    } catch (error) {
      console.error("Failed to load cloud settings:", error);
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  useEffect(() => {
    loadCloudSettings();
  }, [loadCloudSettings]);

  useEffect(() => {
    const savedInvoices = localStorage.getItem('hotelflow_invoices');
    if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
  }, []);

  useEffect(() => {
    localStorage.setItem('hotelflow_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('hotelflow_settings', JSON.stringify(settings));
  }, [settings]);

  const syncFromSupabase = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    setSyncStatus('syncing');
    try {
      const cloudInvoices = await fetchInvoicesFromSupabase(settings);
      setInvoices(prev => {
        const combined = [...cloudInvoices];
        prev.forEach(localInv => {
          const alreadyExists = combined.some(c => c.id === localInv.id);
          if (!alreadyExists) combined.push(localInv);
        });
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
      setSyncStatus('success');
    } catch (error) {
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [settings]);

  useEffect(() => {
    if (viewMode === 'list') syncFromSupabase();
  }, [viewMode, syncFromSupabase]);

  const handleSaveSettings = async (newSettings: HotelSettings) => {
    setSettings(newSettings);
    if (newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
      setSyncStatus('syncing');
      const success = await saveSettingsToSupabase(newSettings);
      setSyncStatus(success ? 'success' : 'error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleGenerateAINote = async () => {
    if (!currentInvoice) return;
    setIsGeneratingNote(true);
    try {
      const note = await generatePersonalizedNote(currentInvoice);
      setCurrentInvoice({ ...currentInvoice, remarks: note });
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const calculateSubtotal = (inv: Invoice) => inv.items.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0);
  const calculateTotal = (inv: Invoice) => calculateSubtotal(inv) - inv.discount;
  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const handleSaveInvoice = async () => {
    if (!currentInvoice) return;
    const isDuplicateNumber = invoices.some(inv => inv.invoiceNumber === currentInvoice.invoiceNumber && inv.id !== currentInvoice.id);
    if (isDuplicateNumber) {
      alert(`Peringatan: Nomor Invoice ${currentInvoice.invoiceNumber} sudah digunakan.`);
      return;
    }
    const finalizedInvoice = { ...currentInvoice, hotelSnap: settings };
    setInvoices(prev => {
      const index = prev.findIndex(i => i.id === finalizedInvoice.id);
      if (index !== -1) {
        const newList = [...prev];
        newList[index] = finalizedInvoice;
        return newList;
      }
      return [finalizedInvoice, ...prev];
    });
    setCurrentInvoice(finalizedInvoice);
    setViewMode('view');
    if (settings.supabaseUrl && settings.supabaseAnonKey) {
      setSyncStatus('syncing');
      const success = await upsertInvoiceToSupabase(finalizedInvoice, settings);
      setSyncStatus(success ? 'success' : 'error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const downloadPDF = () => {
    if (!currentInvoice) return;
    const element = document.getElementById('invoice-content');
    if (!element) return;
    const opt = {
      margin: 0,
      filename: `Invoice_${currentInvoice.invoiceNumber}_${currentInvoice.guest.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, backgroundColor: '#FFFFFF' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
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

  const TABS = [
    { label: 'Tamu', icon: '👤' },
    { label: 'Nginap', icon: '🏨' },
    { label: 'Layanan', icon: '🍽️' },
    { label: 'Bayar', icon: '💳' },
    { label: 'Final', icon: '✅' }
  ];

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-14 shrink-0 flex items-center z-50 no-print">
        <div className="max-w-[1600px] w-full mx-auto px-4 lg:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 lg:gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('list')}>
              <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h1 className="text-base lg:text-lg font-bold text-slate-900 hidden xs:block">HotelFlow</h1>
            </div>
            <nav className="flex items-center gap-0.5 lg:gap-1">
              <button onClick={() => setViewMode('list')} className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Beranda</button>
              <button onClick={() => setViewMode('settings')} className={`px-2 lg:px-4 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold ${viewMode === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Settings</button>
            </nav>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            {syncStatus !== 'idle' && (
              <div className={`hidden sm:flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest ${syncStatus === 'error' ? 'text-rose-500' : 'text-indigo-500'}`}>
                {syncStatus === 'syncing' ? 'Syncing...' : 'Connected'}
              </div>
            )}
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
                  <svg className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
              <div className="bg-slate-200 px-3 py-1 rounded-lg flex shadow-inner text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {invoices.length} Items
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
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Belum ada riwayat transaksi.</td></tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => { setCurrentInvoice(inv); setViewMode('view'); }}>
                        <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-bold">{inv.invoiceNumber}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{inv.guest.name}</td>
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
              {invoices.map(inv => (
                <div key={inv.id} onClick={() => { setCurrentInvoice(inv); setViewMode('view'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <span className="text-[10px] font-mono text-indigo-600 font-bold block mb-0.5 tracking-tight">{inv.invoiceNumber}</span>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1 uppercase">{inv.guest.name}</h4>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider ml-2 ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                      inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>{inv.status}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Tagihan</div>
                    <div className="text-sm font-bold text-slate-900">Rp {formatCurrency(calculateTotal(inv))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'create' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in">
            {/* Tab Navigation for Mobile */}
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
                {/* Form Sections (Desktop uses grid, Mobile uses activeTab logic) */}
                <div className="flex-1 flex flex-col gap-4">
                  
                  {/* TAB 0: Guest Identity */}
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

                  {/* TAB 1: Stay Details */}
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

                  {/* TAB 2: Services & Items */}
                  <div className={`${activeTab === 2 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <span className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center text-[10px]">03</span>
                        Layanan & Fasilitas
                      </h3>
                      <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, items: [...currentInvoice!.items, {id, description:'', quantity:1, nights:1, unitPrice:0, total:0}]}) }} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">+ Tambah</button>
                    </div>
                    <div className="space-y-2">
                      {currentInvoice.items.map(item => <InvoiceItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={id => setCurrentInvoice({...currentInvoice!, items: currentInvoice!.items.filter(i => i.id !== id)})} />)}
                    </div>
                  </div>

                  {/* TAB 3: Payments */}
                  <div className={`${activeTab === 3 ? 'block animate-slide-up' : 'hidden md:block'} bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <span className="w-5 h-5 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center text-[10px]">04</span>
                        Histori Pembayaran
                      </h3>
                      <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, payments: [...currentInvoice!.payments, {id, date: new Date().toISOString().split('T')[0], method: PAYMENT_METHODS[0], amount:0}]}) }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all">+ Catat Bayar</button>
                    </div>
                    <div className="space-y-2">
                      {currentInvoice.payments.map(p => <PaymentRow key={p.id} payment={p} onUpdate={handleUpdatePayment} onDelete={id => setCurrentInvoice({...currentInvoice!, payments: currentInvoice!.payments.filter(pay => pay.id !== id)})} />) || <p className="text-center py-4 text-slate-400 text-[10px] italic">Belum ada pembayaran.</p>}
                    </div>
                  </div>

                  {/* Mobile Navigation Buttons (For Tabs 0-3) */}
                  <div className={`${activeTab < 4 ? 'flex' : 'hidden'} md:hidden justify-between gap-3 mt-4 mb-20`}>
                    <button 
                      onClick={() => setActiveTab(prev => Math.max(0, prev - 1))}
                      disabled={activeTab === 0}
                      className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold disabled:opacity-30"
                    >
                      Kembali
                    </button>
                    <button 
                      onClick={() => setActiveTab(prev => Math.min(4, prev + 1))}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold"
                    >
                      Lanjut
                    </button>
                  </div>
                </div>

                {/* TAB 4 (Mobile) / Summary Section (Desktop) - COMPACT OPTIMIZED */}
                <div className={`${activeTab === 4 ? 'block animate-slide-up' : 'hidden lg:block'} w-full lg:w-80 shrink-0`}>
                  <div className="bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 text-white shadow-xl flex flex-col h-full lg:sticky lg:top-0">
                    <div className="flex-1 space-y-3 lg:space-y-4">
                      <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Ringkasan Invoice</h3>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {/* Compact Cashier */}
                        <div>
                          <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Nama Kasir</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase" value={currentInvoice.cashierName || ''} onChange={e => setCurrentInvoice({...currentInvoice!, cashierName: e.target.value.toUpperCase()})} placeholder="NAMA PETUGAS" />
                        </div>

                        {/* Compact Remarks */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[8px] font-bold text-indigo-300 uppercase">Catatan</label>
                            <button onClick={handleGenerateAINote} disabled={isGeneratingNote || !currentInvoice.guest.name} className="text-[8px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 transition-all">
                              {isGeneratingNote ? '...' : '✨ AI'}
                            </button>
                          </div>
                          <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px] lg:min-h-[100px] resize-none leading-tight" value={currentInvoice.remarks || ''} onChange={e => setCurrentInvoice({...currentInvoice!, remarks: e.target.value})} placeholder="Catatan tambahan..." />
                        </div>

                        {/* Compact Numbers Area */}
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Subtotal</span>
                            <span>Rp {formatCurrency(calculateSubtotal(currentInvoice))}</span>
                          </div>
                          <div className="flex justify-between text-[10px] items-center">
                            <span className="text-slate-400">Diskon</span>
                            <input type="text" className="w-20 bg-white/10 text-right px-1.5 py-0.5 rounded text-rose-400 text-[10px] border border-white/5 outline-none font-bold" value={formatCurrency(currentInvoice.discount)} onChange={e => setCurrentInvoice({...currentInvoice!, discount: parseInt(e.target.value.replace(/\D/g,'')) || 0})} />
                          </div>
                          <div className="h-px bg-white/10"></div>
                          <div className="text-center py-1">
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Total Tagihan</p>
                            <h4 className="text-xl font-bold text-white tracking-tight">Rp {formatCurrency(calculateTotal(currentInvoice))}</h4>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compact Actions Area */}
                    <div className="pt-3 mt-3 border-t border-white/10 space-y-2.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['draft', 'paid', 'cancelled'] as const).map(s => (
                          <button key={s} onClick={() => setCurrentInvoice({...currentInvoice!, status: s})} className={`py-1.5 rounded-lg text-[8px] font-bold uppercase transition-all ${currentInvoice!.status === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>{s}</button>
                        ))}
                      </div>
                      <button onClick={handleSaveInvoice} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-95 text-xs uppercase tracking-wider">
                        Selesaikan & Simpan
                      </button>
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
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-100/50 print:bg-white print:p-0">
              <div className="flex justify-center">
                <InvoicePreview invoice={currentInvoice} settings={settings} />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
            <SettingsPage settings={settings} onSave={handleSaveSettings} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
