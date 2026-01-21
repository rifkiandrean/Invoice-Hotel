
import React from 'react';
import { Invoice, HotelSettings } from '../types';

interface Props {
  invoice: Invoice;
  settings?: HotelSettings;
}

export const InvoicePreview: React.FC<Props> = ({ invoice, settings }) => {
  const hotel = invoice.hotelSnap || settings;
  
  const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0);
  const totalCharge = subtotal - invoice.discount;
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = totalCharge - totalPaid;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('id-ID');
  };

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  if (!hotel) return null;

  return (
    <div id="invoice-content" className="bg-white p-12 shadow-xl border border-slate-100 max-w-4xl mx-auto rounded-xl print:shadow-none print:border-none print:p-0">
      {/* Hotel Identity - Logo di Kiri, Identitas Rata Tengah, Seluruh Blok Terpusat */}
      <div className="flex justify-center items-center gap-8 mb-12 border-b-2 border-slate-200 pb-8">
        {hotel.logo && (
          <img src={hotel.logo} alt="Logo" className="w-24 h-24 rounded-2xl object-cover shadow-sm border border-slate-50 shrink-0" />
        )}
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-800 mb-2 uppercase">{hotel.name}</h1>
          <div className="text-sm text-slate-500 leading-relaxed max-w-lg">
            <p className="font-medium text-slate-600">{hotel.address}</p>
            <p className="mt-1">{hotel.phone} • {hotel.email}</p>
            {hotel.website !== '-' && <p className="text-indigo-600">{hotel.website}</p>}
          </div>
        </div>
      </div>

      {/* Guest & Stay Details */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        {/* Kolom Kiri: Informasi Tamu dengan Label Eksplisit */}
        <div className="bg-white p-6 rounded-2xl border border-slate-50">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Informasi Tamu</h3>
          <div className="grid grid-cols-[80px_1fr] gap-y-3 text-sm">
            <span className="text-slate-400 font-medium">Nama :</span>
            <span className="text-slate-800 font-bold">{invoice.guest.name}</span>
            
            <span className="text-slate-400 font-medium">Alamat :</span>
            <span className="text-slate-500 leading-relaxed">{invoice.guest.address}</span>
            
            <span className="text-slate-400 font-medium">Kontak :</span>
            <div className="space-y-0.5">
              <p className="text-slate-600 font-medium">{invoice.guest.phone}</p>
              <p className="text-slate-500 text-xs">{invoice.guest.email}</p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Detail Reservasi (Termasuk Nomor & Status) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-50">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Detail Reservasi</h3>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">No. Invoice:</span>
            <span className="text-indigo-600 font-mono font-bold text-right">{invoice.invoiceNumber}</span>
            
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Status:</span>
            <div className="text-right">
              <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                invoice.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {invoice.status}
              </span>
            </div>

            <div className="col-span-2 border-t border-slate-50 my-1"></div>

            <span className="text-slate-400">Nomor Kamar:</span>
            <span className="text-slate-800 font-bold text-right">{invoice.stay.roomNumber}</span>
            
            <span className="text-slate-400">Tipe Kamar:</span>
            <span className="text-slate-800 font-medium text-right">{invoice.stay.roomType}</span>
            
            <span className="text-slate-400">Kedatangan :</span>
            <span className="text-slate-800 font-medium text-right">{formatIndonesianDate(invoice.stay.checkIn)}</span>
            
            <span className="text-slate-400">Keberangkatan :</span>
            <span className="text-slate-800 font-medium text-right">{formatIndonesianDate(invoice.stay.checkOut)}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 mb-8">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Deskripsi Layanan</th>
              <th className="py-4 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty</th>
              <th className="py-4 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Malam</th>
              <th className="py-4 px-6 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Harga Satuan</th>
              <th className="py-4 px-6 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoice.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="py-4 px-6 text-slate-700 font-medium text-sm">{item.description}</td>
                <td className="py-4 px-4 text-center text-slate-500 text-sm">{item.quantity}</td>
                <td className="py-4 px-4 text-center text-slate-500 text-sm">{item.nights}</td>
                <td className="py-4 px-6 text-right text-slate-500 text-sm">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-4 px-6 text-right text-slate-900 font-bold text-sm">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <div className="mb-8 px-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-50 pb-1">Riwayat Transaksi Masuk</h3>
          <table className="w-full">
            <tbody className="divide-y divide-slate-50">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-xs text-slate-400">{formatIndonesianDate(p.date)}</td>
                  <td className="py-2 text-xs font-bold text-slate-500 uppercase">{p.method}</td>
                  <td className="py-2 text-sm text-emerald-600 text-right font-medium">- Rp {formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Section */}
      <div className="flex justify-between items-start pt-8 border-t border-slate-100">
        <div className="w-1/2 pr-12">
          <div className="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Pesan Layanan Tamu</span>
            </div>
            
            {invoice.aiGreeting && (
              <p className="text-slate-600 italic text-sm leading-relaxed mb-6">&ldquo;{invoice.aiGreeting}&rdquo;</p>
            )}

            <div className="pt-4 border-t border-indigo-100/40">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Informasi Rekening Bank:</p>
              <p className="text-slate-700 font-bold text-xs uppercase">BLUE ORCHID HOSPITAL</p>
              <p className="text-indigo-600 font-mono text-xs font-bold">BANK MANDIRI : 1770021861510</p>
            </div>
          </div>
        </div>
        <div className="w-1/3">
          <div className="space-y-3">
            <div className="flex justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
              <span>Subtotal:</span>
              <span className="text-slate-600">Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-400 text-xs font-medium uppercase tracking-wider">
                <span>Diskon:</span>
                <span>- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-500 text-xs font-medium uppercase tracking-wider">
              <span>Total Deposit:</span>
              <span>- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="h-px bg-slate-100 my-4"></div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1">Sisa Tagihan:</span>
              <span className="text-2xl font-serif font-bold text-indigo-600">Rp {formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-16 grid grid-cols-2 gap-20 px-6 relative">
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-20">Tanda Tangan Tamu</p>
          <div className="border-b border-slate-200 w-48 mx-auto"></div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-wider">( {invoice.guest.name} )</p>
        </div>
        <div className="text-center relative">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-20">Resepsionis / Kasir</p>
          
          {/* DIGITAL SIGNATURE AND STAMP */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center">
            {hotel.signature && (
               <img src={hotel.signature} alt="Sign" className="absolute w-32 object-contain opacity-90 z-10" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Stamp" className="absolute w-32 object-contain opacity-70 rotate-[-12deg] translate-x-10 -translate-y-4" />
            )}
          </div>

          <div className="border-b border-slate-200 w-48 mx-auto"></div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-wider">( {invoice.cashierName || '____________________'} )</p>
        </div>
      </div>

      {/* Footer Section */}
      <div className="mt-16 text-center text-slate-300 text-[10px] uppercase tracking-[0.2em]">
        <p className="mb-4 text-slate-400 font-bold tracking-widest">DITERBITKAN PADA: {formatIndonesianDate(invoice.date)}</p>
        <p className="mb-2">Terima kasih atas kunjungan Anda di {hotel.name}</p>
        <p>Sistem Billing Otomatis • Tanpa Tanda Tangan Fisik Diperlukan</p>
      </div>
    </div>
  );
};
