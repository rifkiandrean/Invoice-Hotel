
import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, ViewMode, InvoiceItem, Payment, HotelSettings } from './types';
import { InvoicePreview } from './components/InvoicePreview';
import { InvoiceItemRow } from './components/InvoiceItemRow';
import { PaymentRow } from './components/PaymentRow';
import { SettingsPage } from './components/SettingsPage';
import { ROOM_TYPES, PAYMENT_METHODS, HOTEL_INFO, TAX_RATE } from './constants';
import { generatePersonalizedNote } from './services/geminiService';

declare var html2pdf: any;

const INITIAL_GUEST = { name: '', email: '', phone: '', address: '' };
const INITIAL_STAY = { roomNumber: '', roomType: ROOM_TYPES[0], checkIn: '', checkOut: '', guestsCount: 1 };

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Initialize settings from localStorage or fallback to HOTEL_INFO
  const [settings, setSettings] = useState<HotelSettings>(() => {
    const saved = localStorage.getItem('hotelflow_settings');
    if (saved) return JSON.parse(saved);
    return {
      ...HOTEL_INFO,
      defaultTaxRate: TAX_RATE,
      googleSheetUrl: HOTEL_INFO.googleSheetUrl
    };
  });

  // Initial load for invoices
  useEffect(() => {
    const savedInvoices = localStorage.getItem('hotelflow_invoices');
    if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
  }, []);

  // Automatic persistence for invoices
  useEffect(() => {
    localStorage.setItem('hotelflow_invoices', JSON.stringify(invoices));
  }, [invoices]);

  // Automatic persistence for settings
  useEffect(() => {
    localStorage.setItem('hotelflow_settings', JSON.stringify(settings));
  }, [settings]);

  const fetchFromCloud = useCallback(async () => {
    if (!settings.googleSheetUrl || !settings.googleSheetUrl.includes('script.google.com')) return;
    
    setSyncStatus('syncing');
    try {
      const url = new URL(settings.googleSheetUrl);
      url.searchParams.set('type', 'fetch');
      url.searchParams.set('cacheBust', Date.now().toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const cloudData = await response.json();
      if (Array.isArray(cloudData)) {
        setInvoices(prev => {
          const combined = [...cloudData];
          prev.forEach(localInv => {
            if (!combined.find(c => c.invoiceNumber === localInv.invoiceNumber)) {
              combined.push(localInv);
            }
          });
          return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        setSyncStatus('success');
      }
    } catch (error) {
      console.error("Cloud Fetch Error:", error);
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [settings.googleSheetUrl]);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchFromCloud();
    }
  }, [viewMode, fetchFromCloud]);

  const syncToCloud = useCallback(async (type: 'settings' | 'invoice', payload: any) => {
    if (!settings.googleSheetUrl || !settings.googleSheetUrl.includes('script.google.com')) return;
    
    setSyncStatus('syncing');
    try {
      await fetch(settings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type, payload })
      });
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error("Cloud Sync Error:", error);
      setSyncStatus('error');
    }
  }, [settings.googleSheetUrl]);

  const handleSaveSettings = (newSettings: HotelSettings) => {
    setSettings(newSettings);
    syncToCloud('settings', newSettings);
  };

  const calculateSubtotal = (inv: Invoice) => inv.items.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0);
  const calculateTotal = (inv: Invoice) => calculateSubtotal(inv) - inv.discount;
  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const handleSaveInvoice = async () => {
    if (!currentInvoice) return;

    // VALIDASI DUPLIKAT NOMOR INVOICE
    const isDuplicateNumber = invoices.some(inv => 
      inv.invoiceNumber === currentInvoice.invoiceNumber && inv.id !== currentInvoice.id
    );

    if (isDuplicateNumber) {
      alert(`Peringatan: Nomor Invoice ${currentInvoice.invoiceNumber} sudah digunakan oleh transaksi lain.`);
      return;
    }

    setIsGeneratingNote(true);
    const aiNote = await generatePersonalizedNote(currentInvoice);
    // Snapshot settings (including base64 logo) into the invoice for permanent local record
    const finalizedInvoice = { ...currentInvoice, aiGreeting: aiNote, hotelSnap: settings };
    
    setInvoices(prev => {
      const exists = prev.find(i => i.id === finalizedInvoice.id);
      return exists ? prev.map(i => i.id === finalizedInvoice.id ? finalizedInvoice : i) : [finalizedInvoice, ...prev];
    });

    setIsGeneratingNote(false);
    setCurrentInvoice(finalizedInvoice);
    setViewMode('view');
    syncToCloud('invoice', finalizedInvoice);
  };

  const downloadPDF = () => {
    if (!currentInvoice) return;
    const element = document.getElementById('invoice-content');
    const opt = {
      margin: 10,
      filename: `Invoice_${currentInvoice.invoiceNumber}_${currentInvoice.guest.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
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

    // Filter invoice yang memiliki prefix tahun ini dan ambil angka urutannya
    const sequenceNumbers = invoices
      .filter(inv => inv.invoiceNumber.startsWith(prefix))
      .map(inv => {
        const parts = inv.invoiceNumber.split('-');
        const sequencePart = parts[parts.length - 1];
        return parseInt(sequencePart, 10);
      })
      .filter(num => !isNaN(num));

    // Ambil angka tertinggi, atau mulai dari 0 jika belum ada
    const maxSequence = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0;
    const nextSequence = maxSequence + 1;
    
    // Format nomor invoice: INV-2024-0001
    const newInvoiceNumber = `${prefix}${nextSequence.toString().padStart(4, '0')}`;
    
    setCurrentInvoice({
      id,
      invoiceNumber: newInvoiceNumber,
      date: new Date().toISOString().split('T')[0],
      guest: { ...INITIAL_GUEST },
      stay: { ...INITIAL_STAY },
      items: [{ id: '1', description: '', quantity: 1, nights: 1, unitPrice: 0, total: 0 }],
      payments: [],
      taxRate: 0, 
      discount: 0,
      status: 'draft',
      notes: '',
      hotelSnap: settings,
      cashierName: lastCashier || ''
    });
    setViewMode('create');
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-14 shrink-0 flex items-center z-50 no-print">
        <div className="max-w-[1600px] w-full mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('list')}>
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">HotelFlow</h1>
            </div>
            <nav className="flex items-center gap-1">
              <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Beranda</button>
              <button onClick={() => setViewMode('settings')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Settings</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {syncStatus !== 'idle' && (
              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${syncStatus === 'error' ? 'text-rose-500' : 'text-indigo-500'}`}>
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Cloud Synced' : 'Sync Failed'}
              </div>
            )}
            <button onClick={createNewInvoice} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Buat Invoice
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-[1600px] w-full mx-auto animate-fade-in">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">Dashboard Tagihan</h2>
                <button onClick={fetchFromCloud} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
                  <svg className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
              <div className="bg-slate-200 px-4 py-1.5 rounded-xl flex shadow-inner text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {invoices.length} Transaksi Tersimpan
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">ID Invoice</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Nama Tamu</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase text-right">Total Bayar</th>
                    <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Belum ada riwayat transaksi. Klik "Buat Invoice" untuk memulai.</td></tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-indigo-600">{inv.invoiceNumber}</td>
                        <td className="px-6 py-3 font-bold">{inv.guest.name}</td>
                        <td className="px-6 py-3 text-right font-bold">Rp {formatCurrency(calculateTotal(inv))}</td>
                        <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{inv.status}</span></td>
                        <td className="px-6 py-3 text-right">
                          <button onClick={() => { setCurrentInvoice(inv); setViewMode('view'); }} className="text-indigo-600 font-bold text-xs hover:underline">Lihat</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'create' && currentInvoice && (
          <div className="flex-1 flex overflow-hidden p-4 gap-4 max-w-[1600px] w-full mx-auto animate-fade-in">
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex gap-4 shrink-0">
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">Identitas Tamu</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Nama Lengkap</label>
                      <input type="text" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold uppercase" value={currentInvoice.guest.name} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, name: e.target.value.toUpperCase()}})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Telepon / WA</label>
                      <input type="text" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" value={currentInvoice.guest.phone} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, phone: e.target.value}})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Email</label>
                      <input type="email" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" value={currentInvoice.guest.email} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, email: e.target.value}})} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Alamat Domisili</label>
                      <input type="text" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" value={currentInvoice.guest.address} onChange={e => setCurrentInvoice({...currentInvoice, guest: {...currentInvoice.guest, address: e.target.value}})} />
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">Detail Menginap</h3>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Tipe Kamar</label>
                      <select className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium" value={currentInvoice.stay.roomType} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, roomType: e.target.value}})}>
                        {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Nomor RM</label>
                      <input type="text" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center font-bold" value={currentInvoice.stay.roomNumber} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, roomNumber: e.target.value}})} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Pax</label>
                      <input type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center" value={currentInvoice.stay.guestsCount} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, guestsCount: Number(e.target.value)}})} />
                    </div>
                    <div className="col-span-6">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Kedatangan</label>
                      <input type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" value={currentInvoice.stay.checkIn} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, checkIn: e.target.value}})} />
                    </div>
                    <div className="col-span-6">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Keberangkatan</label>
                      <input type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" value={currentInvoice.stay.checkOut} onChange={e => setCurrentInvoice({...currentInvoice, stay: {...currentInvoice.stay, checkOut: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm min-h-0">
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase">Inventaris Layanan</h3>
                  <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, items: [...currentInvoice!.items, {id, description:'', quantity:1, nights:1, unitPrice:0, total:0}]}) }} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-lg transition-all">+ Item</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {currentInvoice.items.map(item => <InvoiceItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={id => setCurrentInvoice({...currentInvoice!, items: currentInvoice!.items.filter(i => i.id !== id)})} />)}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl h-32 flex flex-col overflow-hidden shadow-sm shrink-0">
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase">Pembayaran</h3>
                  <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setCurrentInvoice({...currentInvoice!, payments: [...currentInvoice!.payments, {id, date: new Date().toISOString().split('T')[0], method: PAYMENT_METHODS[0], amount:0}]}) }} className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded-lg transition-all">+ Bayar</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {currentInvoice.payments.map(p => <PaymentRow key={p.id} payment={p} onUpdate={handleUpdatePayment} onDelete={id => setCurrentInvoice({...currentInvoice!, payments: currentInvoice!.payments.filter(pay => pay.id !== id)})} />)}
                </div>
              </div>
            </div>

            <div className="w-80 flex flex-col gap-4">
              <div className="bg-slate-900 rounded-3xl p-6 text-white flex-1 flex flex-col justify-between shadow-xl">
                <div>
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center mb-6">Ringkasan</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-slate-400"><span>Subtotal</span><span>Rp {formatCurrency(calculateSubtotal(currentInvoice))}</span></div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Diskon</span>
                      <input type="text" className="w-24 bg-white/10 text-right px-2 py-0.5 rounded text-white text-xs border border-white/10 outline-none" value={formatCurrency(currentInvoice.discount)} onChange={e => setCurrentInvoice({...currentInvoice!, discount: parseInt(e.target.value.replace(/\D/g,'')) || 0})} />
                    </div>
                    <div className="h-px bg-white/10 my-4"></div>
                    
                    <div className="mb-4">
                      <label className="text-[9px] font-bold text-indigo-300 uppercase block mb-1">Nama Kasir</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                        value={currentInvoice.cashierName || ''} 
                        onChange={e => setCurrentInvoice({...currentInvoice!, cashierName: e.target.value.toUpperCase()})}
                        placeholder="NAMA PETUGAS"
                      />
                    </div>

                    <div className="text-center">
                      <p className="text-[9px] font-bold text-indigo-400 uppercase mb-1">Total</p>
                      <h4 className="text-2xl font-serif font-bold">Rp {formatCurrency(calculateTotal(currentInvoice))}</h4>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-1">
                    {(['draft', 'paid', 'cancelled'] as const).map(s => (
                      <button key={s} onClick={() => setCurrentInvoice({...currentInvoice!, status: s})} className={`py-1.5 rounded-lg text-[8px] font-bold uppercase ${currentInvoice!.status === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'}`}>{s}</button>
                    ))}
                  </div>
                  <button onClick={handleSaveInvoice} disabled={isGeneratingNote} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-2xl font-bold shadow-lg disabled:opacity-50 transition-all">
                    {isGeneratingNote ? 'AI Processing...' : 'Save to Cloud'}
                  </button>
                  <button onClick={() => setViewMode('list')} className="w-full text-center text-slate-500 text-[10px] font-bold uppercase py-2">Batal</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'view' && currentInvoice && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center no-print">
              <button onClick={() => setViewMode('list')} className="text-slate-500 font-bold text-xs flex items-center gap-2 hover:text-slate-900">Kembali</button>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('create')} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold">Edit</button>
                <button onClick={() => window.print()} className="bg-slate-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Print</button>
                <button onClick={downloadPDF} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download PDF
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 print:bg-white print:p-0">
              <InvoicePreview invoice={currentInvoice} settings={settings} />
            </div>
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
            <SettingsPage settings={settings} onSave={handleSaveSettings} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
