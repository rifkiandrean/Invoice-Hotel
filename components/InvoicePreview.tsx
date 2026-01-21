
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
    <div id="invoice-content" className="page-a4 p-[20mm] shadow-2xl border border-slate-100 flex flex-col print:shadow-none print:border-none print:p-[15mm] relative overflow-hidden">
      {/* Background Decor (Optional Subtle Watermark) */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none"></div>

      {/* Header / Kop Invoice */}
      <div className="relative mb-6">
        <div className="flex items-center justify-between gap-6 pb-4">
          {hotel.logo && (
            <img src={hotel.logo} alt="Logo" className="w-20 h-20 object-contain shrink-0" />
          )}
          <div className="flex-1 text-center pr-10">
            <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-800 mb-1 uppercase leading-tight">
              {hotel.name}
            </h1>
            <div className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wide">
              <p className="font-semibold text-slate-600">{hotel.address}</p>
              <p className="mt-0.5">Phone: {hotel.phone} • Email: {hotel.email}</p>
              {hotel.website && hotel.website !== '-' && (
                <p className="text-indigo-500 font-bold">{hotel.website}</p>
              )}
            </div>
          </div>
        </div>
        {/* Double Line Border Style for Kop Surat */}
        <div className="border-b-[2.5px] border-slate-800 w-full mb-0.5"></div>
        <div className="border-b border-slate-800 w-full"></div>
      </div>

      {/* Document Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-serif font-bold text-slate-800 tracking-[0.25em] uppercase">
          Guest Folio
        </h2>
        <div className="w-12 h-0.5 bg-indigo-500 mx-auto mt-2"></div>
      </div>

      {/* Guest & Stay Details */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        {/* Kolom Kiri: Informasi Tamu */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100">
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-3 border-b border-indigo-100 pb-1.5">Informasi Tamu</h3>
          <div className="grid grid-cols-[70px_1fr] gap-y-2 text-xs">
            <span className="text-slate-400 font-medium">Nama :</span>
            <span className="text-slate-800 font-bold">{invoice.guest.name}</span>
            
            <span className="text-slate-400 font-medium">Alamat :</span>
            <span className="text-slate-500 leading-relaxed">{invoice.guest.address || '-'}</span>
            
            <span className="text-slate-400 font-medium">Kontak :</span>
            <div className="space-y-0.5">
              <p className="text-slate-600 font-medium">{invoice.guest.phone || '-'}</p>
              <p className="text-slate-500 text-[10px]">{invoice.guest.email}</p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Detail Reservasi */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100">
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-3 border-b border-indigo-100 pb-1.5">Detail Reservasi</h3>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">No. Invoice:</span>
            <span className="text-slate-900 font-mono font-bold text-right">{invoice.invoiceNumber}</span>
            
            <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">Status:</span>
            <div className="text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                invoice.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {invoice.status}
              </span>
            </div>

            <div className="col-span-2 border-t border-slate-200/50 my-1"></div>

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
      <div className="overflow-hidden rounded-lg border border-slate-200 mb-6 shadow-sm flex-grow">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-800">
              <th className="py-2.5 px-6 text-left text-[9px] font-bold uppercase tracking-wider text-white">Layanan</th>
              <th className="py-2.5 px-4 text-center text-[9px] font-bold uppercase tracking-wider text-white">Qty</th>
              <th className="py-2.5 px-4 text-center text-[9px] font-bold uppercase tracking-wider text-white">Mlm</th>
              <th className="py-2.5 px-6 text-right text-[9px] font-bold uppercase tracking-wider text-white">Harga</th>
              <th className="py-2.5 px-6 text-right text-[9px] font-bold uppercase tracking-wider text-white">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-6 text-slate-700 font-medium text-xs">{item.description}</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">{item.quantity}</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">{item.nights}</td>
                <td className="py-3 px-6 text-right text-slate-500 text-xs">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-6 text-right text-slate-900 font-bold text-xs">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
            {/* Empty space to fill A4 if items are few */}
            {[...Array(Math.max(0, 5 - invoice.items.length))].map((_, i) => (
              <tr key={`empty-${i}`} className="h-10">
                <td colSpan={5}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments History */}
      {invoice.payments.length > 0 && (
        <div className="mb-6 px-4 bg-slate-50/30 py-3 rounded-lg border border-slate-100">
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-200 pb-1">Detail Transaksi Masuk</h3>
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-[10px] text-slate-500">{formatIndonesianDate(p.date)}</td>
                  <td className="py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{p.method}</td>
                  <td className="py-1.5 text-[11px] text-emerald-600 text-right font-bold">- Rp {formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Section */}
      <div className="flex justify-between items-start pt-6 border-t border-slate-200">
        <div className="w-1/2 pr-10">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Catatan Layanan</span>
            </div>
            
            {invoice.aiGreeting ? (
              <p className="text-slate-600 italic text-[11px] leading-relaxed mb-4 font-medium">"{invoice.aiGreeting}"</p>
            ) : (
              <p className="text-slate-400 italic text-[10px] mb-4">Terima kasih atas kunjungan Anda.</p>
            )}

            <div className="pt-3 border-t border-slate-50">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Informasi Pembayaran:</p>
              <p className="text-slate-800 font-bold text-[10px] uppercase leading-tight">{hotel.name}</p>
              <p className="text-indigo-600 font-mono text-[11px] font-bold tracking-tight">BANK MANDIRI : 1770021861510</p>
            </div>
          </div>
        </div>
        <div className="w-1/3">
          <div className="space-y-2 bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Subtotal:</span>
              <span>Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-500 text-[10px] font-bold uppercase tracking-wider">
                <span>Diskon:</span>
                <span>- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
              <span>Deposit:</span>
              <span>- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="h-px bg-slate-200 my-3"></div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Sisa Pembayaran:</span>
              <span className="text-xl font-serif font-bold text-slate-900">Rp {formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-12 grid grid-cols-2 gap-16 px-8 relative">
        <div className="text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-20">Tanda Tangan Tamu</p>
          <div className="border-b-[1.5px] border-slate-800 w-40 mx-auto"></div>
          <p className="text-[9px] text-slate-800 mt-2 font-bold uppercase tracking-wider">{invoice.guest.name || '( ________________ )'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-20">Resepsionis / Kasir</p>
          
          {/* DIGITAL SIGNATURE AND STAMP */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center">
            {hotel.signature && (
               <img src={hotel.signature} alt="Sign" className="absolute w-32 object-contain opacity-90 z-10 translate-y-2" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Stamp" className="absolute w-32 object-contain opacity-70 rotate-[-12deg] -translate-x-8 -translate-y-2" />
            )}
          </div>

          <div className="border-b-[1.5px] border-slate-800 w-40 mx-auto"></div>
          <p className="text-[9px] text-slate-800 mt-2 font-bold uppercase tracking-wider">{invoice.cashierName || '( ________________ )'}</p>
        </div>
      </div>

      {/* Footer Section */}
      <div className="mt-auto pt-10 text-center">
        <div className="inline-block border-y border-slate-100 py-3 px-10">
          <p className="text-slate-400 text-[9px] uppercase font-bold tracking-[0.25em] mb-1.5">Diterbitkan: {formatIndonesianDate(invoice.date)}</p>
          <p className="text-slate-300 text-[8px] uppercase tracking-[0.2em]">Terima kasih telah memilih {hotel.name}</p>
        </div>
      </div>
    </div>
  );
};
