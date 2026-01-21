
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
    <div id="invoice-content" className="page-a4 p-[13mm] shadow-2xl border border-slate-100 flex flex-col print:shadow-none print:border-none print:p-[13mm] relative bg-white overflow-hidden">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-full -translate-y-24 translate-x-24 blur-3xl pointer-events-none print:hidden"></div>

      {/* Header / Kop Invoice */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between gap-6 pb-4">
          {hotel.logo && (
            <img src={hotel.logo} alt="Logo" className="w-24 h-24 object-contain shrink-0" />
          )}
          <div className="flex-1 text-center pr-12">
            <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-800 mb-0.5 uppercase leading-tight">
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
        <div className="border-b-[2px] border-slate-800 w-full mb-[1px]"></div>
        <div className="border-b-[0.5px] border-slate-800 w-full"></div>
      </div>

      {/* Document Title */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-serif font-bold text-slate-800 tracking-[0.3em] uppercase underline underline-offset-4 decoration-indigo-200">
          INVOICE
        </h2>
      </div>

      {/* Guest & Stay Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Kolom Kiri: Informasi Tamu */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-[8px] font-bold uppercase tracking-widest text-indigo-500 mb-2 border-b border-indigo-100 pb-1">Guest</h3>
          <div className="grid grid-cols-[65px_1fr] gap-y-1.5 text-[11px]">
            <span className="text-slate-400 font-medium">Name :</span>
            <span className="text-slate-800 font-bold uppercase">{invoice.guest.name}</span>
            
            <span className="text-slate-400 font-medium">Address :</span>
            <span className="text-slate-500 leading-tight">{invoice.guest.address || '-'}</span>
            
            <span className="text-slate-400 font-medium">Contact :</span>
            <div className="space-y-0.5">
              <p className="text-slate-600 font-medium">{invoice.guest.phone || '-'}</p>
              <p className="text-slate-500 text-[9px]">{invoice.guest.email}</p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Detail Reservasi */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-[8px] font-bold uppercase tracking-widest text-indigo-500 mb-2 border-b border-indigo-100 pb-1">Stay Details</h3>
          <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
            <span className="text-slate-400 font-semibold text-[8px] uppercase tracking-wider">Folio No:</span>
            <span className="text-slate-900 font-mono font-bold text-right">{invoice.invoiceNumber}</span>
            
            <span className="text-slate-400 font-semibold text-[8px] uppercase tracking-wider">Type:</span>
            <span className="text-slate-800 font-bold text-right uppercase">{invoice.stay.guestType || 'FIT'}</span>
            
            <span className="text-slate-400 font-semibold text-[8px] uppercase tracking-wider">Status:</span>
            <div className="text-right">
              <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                invoice.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {invoice.status}
              </span>
            </div>

            <div className="col-span-2 border-t border-slate-200/50 my-0.5"></div>

            <span className="text-slate-400">Room No:</span>
            <span className="text-slate-800 font-bold text-right">{invoice.stay.roomNumber}</span>
            
            <span className="text-slate-400">Arrival :</span>
            <span className="text-slate-800 font-medium text-right">{formatIndonesianDate(invoice.stay.checkIn)}</span>
            
            <span className="text-slate-400">Departure :</span>
            <span className="text-slate-800 font-medium text-right">{formatIndonesianDate(invoice.stay.checkOut)}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 mb-4 shadow-sm bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800">
              <th className="py-2 px-6 text-left text-[8px] font-bold uppercase tracking-wider text-white">Description</th>
              <th className="py-2 px-4 text-center text-[8px] font-bold uppercase tracking-wider text-white">Qty</th>
              <th className="py-2 px-4 text-center text-[8px] font-bold uppercase tracking-wider text-white">Nights</th>
              <th className="py-2 px-6 text-right text-[8px] font-bold uppercase tracking-wider text-white">Unit Price</th>
              <th className="py-2 px-6 text-right text-[8px] font-bold uppercase tracking-wider text-white">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-2 px-6 text-slate-700 font-medium text-[11px]">{item.description}</td>
                <td className="py-2 px-4 text-center text-slate-500 text-[11px]">{item.quantity}</td>
                <td className="py-2 px-4 text-center text-slate-500 text-[11px]">{item.nights}</td>
                <td className="py-2 px-6 text-right text-slate-500 text-[11px]">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-2 px-6 text-right text-slate-900 font-bold text-[11px]">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments History - Compact */}
      {invoice.payments.length > 0 && (
        <div className="mb-4 px-4 py-2 bg-slate-50/30 rounded-lg border border-slate-100">
          <h3 className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1 border-b border-slate-200 pb-0.5">Billing Activity</h3>
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1 text-[9px] text-slate-500">{formatIndonesianDate(p.date)}</td>
                  <td className="py-1 text-[9px] font-bold text-slate-600 uppercase">{p.method}</td>
                  <td className="py-1 text-[10px] text-emerald-600 text-right font-bold"> - Rp {formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Section */}
      <div className="flex justify-between items-start pt-4 border-t border-slate-200 gap-6">
        <div className="flex-1">
          {/* Section Remarks manual tampil jika ada isinya */}
          {invoice.remarks && (
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Remarks</span>
              </div>
              <p className="text-slate-600 text-[10px] leading-relaxed font-medium whitespace-pre-wrap">{invoice.remarks}</p>
            </div>
          )}

          <div className="bg-slate-50/30 p-4 rounded-xl border border-slate-50">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Payment Instructions:</p>
            <p className="text-slate-800 font-bold text-[9px] uppercase leading-tight">{hotel.name}</p>
            <p className="text-indigo-600 font-mono text-[10px] font-bold tracking-tight">BANK MANDIRI : 1770021861510</p>
          </div>
        </div>
        <div className="w-[200px] shrink-0">
          <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex justify-between text-slate-500 text-[9px] font-bold uppercase">
              <span>Subtotal:</span>
              <span>Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-500 text-[9px] font-bold uppercase">
                <span>Discount:</span>
                <span>- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-600 text-[9px] font-bold uppercase">
              <span>Paid/Deposit:</span>
              <span>- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1.5"></div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Balance Due:</span>
              <span className="text-lg font-serif font-bold text-slate-900">Rp {formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-10 grid grid-cols-2 gap-12 px-6 relative">
        <div className="text-center">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-16">Guest Signature</p>
          <div className="border-b border-slate-800 w-36 mx-auto"></div>
          <p className="text-[9px] text-slate-800 mt-1 font-bold uppercase">{invoice.guest.name || '________________'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-16">Receptionist / Cashier</p>
          
          {/* DIGITAL SIGNATURE AND STAMP */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center overflow-visible">
            {hotel.signature && (
               <img src={hotel.signature} alt="Sign" className="absolute w-28 object-contain opacity-95 z-10 translate-y-2" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Stamp" className="absolute w-28 object-contain opacity-70 rotate-[-15deg] -translate-x-6 -translate-y-2" />
            )}
          </div>

          <div className="border-b border-slate-800 w-36 mx-auto"></div>
          <p className="text-[9px] text-slate-800 mt-1 font-bold uppercase">{invoice.cashierName || '________________'}</p>
        </div>
      </div>

      {/* Footer Section */}
      <div className="mt-auto pt-6 text-center border-t border-slate-50">
          <p className="text-slate-400 text-[8px] uppercase font-bold tracking-[0.2em] mb-1">Issue Date: {formatIndonesianDate(invoice.date)}</p>
          <p className="text-slate-300 text-[7px] uppercase tracking-[0.1em]">Thank you for choosing {hotel.name} as your accommodation partner</p>
      </div>
    </div>
  );
};
