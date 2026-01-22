
import React, { useState } from 'react';
import { Invoice, InvoiceItem, Payment } from '../../types';
import { ROOM_TYPES, GUEST_TYPES, PAYMENT_METHODS } from '../../constants';
import { InvoiceItemRow } from '../InvoiceItemRow';
import { PaymentRow } from '../PaymentRow';

interface Props {
  invoice: Invoice;
  setInvoice: (inv: Invoice) => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateItem: (id: string, updates: Partial<InvoiceItem>) => void;
  onDeleteItem: (id: string) => void;
  onUpdatePayment: (id: string, updates: Partial<Payment>) => void;
  onDeletePayment: (id: string) => void;
  onGenerateAINote: () => void;
  isGeneratingNote: boolean;
  formatCurrency: (val: number) => string;
  calculations: {
    subtotal: number;
    total: number;
    paid: number;
    balance: number;
  };
}

const TABS = [
  { label: 'Tamu', icon: '👤' },
  { label: 'Nginap', icon: '🏨' },
  { label: 'Layanan', icon: '🍽️' },
  { label: 'Bayar', icon: '💳' },
  { label: 'Final', icon: '✅' }
];

export const MobileInvoiceForm: React.FC<Props> = ({
  invoice, setInvoice, onSave, onCancel,
  onUpdateItem, onDeleteItem, onUpdatePayment, onDeletePayment,
  onGenerateAINote, isGeneratingNote, formatCurrency, calculations
}) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 md:hidden h-full">
      {/* Tab Navigation Scrollable */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto custom-scrollbar flex shrink-0">
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

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {/* TAB 0: GUEST */}
        {activeTab === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-slide-up">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center text-[10px]">01</span>
              Identitas Tamu
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Nama Lengkap</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.guest.name} onChange={e => setInvoice({...invoice, guest: {...invoice.guest, name: e.target.value.toUpperCase()}})} placeholder="NAMA LENGKAP" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Telepon / WA</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.guest.phone} onChange={e => setInvoice({...invoice, guest: {...invoice.guest, phone: e.target.value}})} placeholder="0812..." />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Email</label>
                <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.guest.email} onChange={e => setInvoice({...invoice, guest: {...invoice.guest, email: e.target.value}})} placeholder="email@tamu.com" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Alamat Domisili</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.guest.address} onChange={e => setInvoice({...invoice, guest: {...invoice.guest, address: e.target.value}})} placeholder="Kota, Negara" />
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: STAY */}
        {activeTab === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-slide-up">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center text-[10px]">02</span>
              Detail Menginap
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Tipe Kamar</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.roomType} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, roomType: e.target.value}})}>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Jenis Tamu</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.guestType} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, guestType: e.target.value}})}>
                  {GUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Nomor RM</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.roomNumber} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, roomNumber: e.target.value}})} placeholder="101" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Pax</label>
                <input type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.guestsCount} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, guestsCount: Number(e.target.value)}})} />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Check In</label>
                <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.checkIn} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, checkIn: e.target.value}})} />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">Check Out</label>
                <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={invoice.stay.checkOut} onChange={e => setInvoice({...invoice, stay: {...invoice.stay, checkOut: e.target.value}})} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ITEMS */}
        {activeTab === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                <span className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center text-[10px]">03</span>
                Layanan & Fasilitas
              </h3>
              <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setInvoice({...invoice, items: [...invoice.items, {id, description:'', quantity:1, nights:1, unitPrice:0, total:0}]}) }} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">+ Tambah</button>
            </div>
            <div className="space-y-2">
              {invoice.items.map(item => <InvoiceItemRow key={item.id} item={item} onUpdate={onUpdateItem} onDelete={onDeleteItem} />)}
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {activeTab === 3 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-slide-up">
             <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                <span className="w-5 h-5 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center text-[10px]">04</span>
                Histori Pembayaran
              </h3>
              <button onClick={() => { const id = Math.random().toString(36).substr(2,9); setInvoice({...invoice, payments: [...invoice.payments, {id, date: new Date().toISOString().split('T')[0], method: PAYMENT_METHODS[0], amount:0}]}) }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all">+ Catat Bayar</button>
            </div>
            <div className="space-y-2">
              {invoice.payments.map(p => <PaymentRow key={p.id} payment={p} onUpdate={onUpdatePayment} onDelete={onDeletePayment} />) || <p className="text-center py-4 text-slate-400 text-[10px] italic">Belum ada pembayaran.</p>}
            </div>
          </div>
        )}

        {/* TAB 4: SUMMARY / FINAL */}
        {activeTab === 4 && (
          <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl animate-slide-up">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Ringkasan Invoice</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Nomor Invoice</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase" value={invoice.invoiceNumber} onChange={e => setInvoice({...invoice, invoiceNumber: e.target.value.toUpperCase()})} placeholder="NOMOR INVOICE" />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Nama Kasir</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase" value={invoice.cashierName || ''} onChange={e => setInvoice({...invoice, cashierName: e.target.value.toUpperCase()})} placeholder="NAMA PETUGAS" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[8px] font-bold text-indigo-300 uppercase">Catatan</label>
                    <button onClick={onGenerateAINote} disabled={isGeneratingNote || !invoice.guest.name} className="text-[8px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 transition-all">{isGeneratingNote ? '...' : '✨ AI'}</button>
                  </div>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px] resize-none leading-tight" value={invoice.remarks || ''} onChange={e => setInvoice({...invoice, remarks: e.target.value})} placeholder="Catatan tambahan..." />
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400"><span>Subtotal</span><span>Rp {formatCurrency(calculations.subtotal)}</span></div>
                  <div className="flex justify-between text-[10px] items-center"><span className="text-slate-400">Diskon</span><input type="text" className="w-20 bg-white/10 text-right px-1.5 py-0.5 rounded text-rose-400 text-[10px] border border-white/5 outline-none font-bold" value={formatCurrency(invoice.discount)} onChange={e => setInvoice({...invoice, discount: parseInt(e.target.value.replace(/\D/g,'')) || 0})} /></div>
                  <div className="flex justify-between text-[10px] text-emerald-400 font-medium"><span>Sudah Bayar</span><span>Rp {formatCurrency(calculations.paid)}</span></div>
                  <div className="h-px bg-white/10"></div>
                  <div className="text-center py-1">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Sisa Tagihan</p>
                    <h4 className="text-xl font-bold text-white tracking-tight">Rp {formatCurrency(calculations.balance)}</h4>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-white/10 space-y-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {(['draft', 'paid', 'cancelled'] as const).map(s => (
                  <button key={s} onClick={() => setInvoice({...invoice, status: s})} className={`py-1.5 rounded-lg text-[8px] font-bold uppercase transition-all ${invoice.status === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>{s}</button>
                ))}
              </div>
              <button onClick={onSave} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-95 text-xs uppercase tracking-wider">Selesaikan & Simpan</button>
              <button onClick={onCancel} className="w-full text-center text-slate-500 text-[9px] font-bold uppercase py-1 hover:text-rose-400 transition-colors">Batal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
