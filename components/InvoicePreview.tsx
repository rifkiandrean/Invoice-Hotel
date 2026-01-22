
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
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  if (!hotel) return null;

  return (
    <div id="invoice-content" className="page-a4 p-[15mm] flex flex-col relative bg-white overflow-hidden text-black leading-normal">
      {/* Top Header / Letterhead */}
      <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-slate-900">
        <div className="flex gap-6 items-center">
          {hotel.logo && (
            <img src={hotel.logo} alt="Hotel Logo" className="w-24 h-24 object-contain" />
          )}
          <div>
            <h1 className="text-2xl font-serif font-black tracking-tight text-slate-900 mb-1 uppercase">
              {hotel.name}
            </h1>
            <div className="text-[10px] text-slate-700 space-y-0.5 uppercase tracking-wide">
              <p className="font-bold max-w-[400px] leading-relaxed">{hotel.address}</p>
              <p className="pt-1">Phone: <span className="font-bold">{hotel.phone}</span></p>
              <p>Email: <span className="font-bold">{hotel.email}</span></p>
              {hotel.website && hotel.website !== '-' && (
                <p>Web: <span className="font-bold">{hotel.website}</span></p>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="bg-slate-900 text-white px-4 py-2 mb-3">
             <h2 className="text-xl font-serif font-bold tracking-[0.2em] uppercase">INVOICE</h2>
          </div>
          <div className="text-[11px] font-bold text-slate-900 flex flex-col gap-1">
             <div className="flex justify-end gap-2">
               <span className="text-slate-400 font-normal uppercase tracking-widest text-[8px]">Invoice No:</span>
               <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
             </div>
             <div className="flex justify-end gap-2">
               <span className="text-slate-400 font-normal uppercase tracking-widest text-[8px]">Date:</span>
               <span>{formatIndonesianDate(invoice.date)}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Guest Info */}
        <div className="border-l-2 border-slate-100 pl-4">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Guest Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Guest Name</p>
              <p className="text-[13px] font-bold text-slate-900 uppercase tracking-tight">{invoice.guest.name || '-'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Contact / Address</p>
              <p className="text-[11px] font-medium text-slate-700 leading-tight">
                {invoice.guest.phone || '-'}<br/>
                {invoice.guest.email && <span className="text-[10px] lowercase text-slate-500">{invoice.guest.email}</span>}
              </p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-[250px] italic">{invoice.guest.address || '-'}</p>
            </div>
          </div>
        </div>

        {/* Stay Details */}
        <div className="border-l-2 border-slate-100 pl-4">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Stay Details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Room Details</p>
              <p className="text-[11px] font-bold text-slate-900">{invoice.stay.roomNumber} - {invoice.stay.roomType}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Booking Type</p>
              <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{invoice.stay.guestType}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Check-In</p>
              <p className="text-[11px] font-bold text-slate-900">{formatIndonesianDate(invoice.stay.checkIn)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Check-Out</p>
              <p className="text-[11px] font-bold text-slate-900">{formatIndonesianDate(invoice.stay.checkOut)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1">
        <div className="mb-2">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Charges & Services</h3>
        </div>
        <table className="w-full text-left border-collapse border-y border-slate-900 mb-6">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-3 px-2 text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-900">Description</th>
              <th className="py-3 px-2 text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-900 text-center">Qty</th>
              <th className="py-3 px-2 text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-900 text-center">Nights</th>
              <th className="py-3 px-2 text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-900 text-right">Unit Price</th>
              <th className="py-3 px-2 text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-900 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 px-2 text-[11px] font-bold text-slate-800 uppercase tracking-tight">{item.description}</td>
                <td className="py-3 px-2 text-[11px] font-medium text-slate-800 text-center">{item.quantity}</td>
                <td className="py-3 px-2 text-[11px] font-medium text-slate-800 text-center">{item.nights}</td>
                <td className="py-3 px-2 text-[11px] font-medium text-slate-800 text-right">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-2 text-[11px] font-black text-slate-900 text-right">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Payments Section if any */}
        {invoice.payments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Payment / Deposit History</h3>
            <table className="w-full text-left text-[10px] border-b border-slate-100">
              <tbody className="divide-y divide-slate-50">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-slate-600 italic">{formatIndonesianDate(p.date)}</td>
                    <td className="py-2 font-bold text-slate-800 uppercase tracking-wider">{p.method}</td>
                    <td className="py-2 text-right font-black text-emerald-600">- Rp {formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer Area */}
      <div className="mt-8 border-t border-slate-900 pt-8 flex justify-between gap-12">
        {/* Remarks & Instructions */}
        <div className="flex-1">
          {invoice.remarks && (
            <div className="mb-6">
              <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Remarks:</h4>
              <p className="text-[10px] text-slate-800 font-medium italic leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                {invoice.remarks}
              </p>
            </div>
          )}
          <div className="text-[9px] text-slate-500 leading-tight">
            <p className="font-bold text-slate-900 uppercase mb-1">Transfer Instructions:</p>
            <p className="font-black text-slate-900 text-[10px]">BANK MANDIRI : 1770021861510</p>
            <p className="font-bold">A/N: {hotel.name}</p>
          </div>
        </div>

        {/* Totals */}
        <div className="w-[280px] space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase">
            <span>Subtotal Charge</span>
            <span>Rp {formatCurrency(subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-[11px] font-bold text-rose-600 uppercase">
              <span>Adjustment / Discount</span>
              <span>- Rp {formatCurrency(invoice.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] font-bold text-emerald-600 uppercase">
            <span>Total Paid / Deposit</span>
            <span>- Rp {formatCurrency(totalPaid)}</span>
          </div>
          <div className="h-0.5 bg-slate-900 my-2"></div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">Balance Due</span>
            <span className="text-xl font-serif font-black text-slate-900">Rp {formatCurrency(balanceDue)}</span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-16 grid grid-cols-2 gap-20">
        <div className="text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-20">Guest Signature</p>
          <div className="border-b border-slate-300 w-48 mx-auto mb-1"></div>
          <p className="text-[11px] font-bold text-slate-900 uppercase">{invoice.guest.name || '(....................................)'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-20">Receptionist / Cashier</p>
          
          {/* Stamps/Signatures Overlays */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-24 pointer-events-none flex items-center justify-center overflow-visible hide-on-physical-print">
            {hotel.signature && (
               <img src={hotel.signature} alt="Digital Sign" className="absolute w-32 object-contain opacity-95 z-10 translate-y-4" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Hotel Stamp" className="absolute w-32 object-contain opacity-40 rotate-[-15deg] -translate-x-10 -translate-y-2 mix-blend-multiply" />
            )}
          </div>

          <div className="border-b border-slate-300 w-48 mx-auto mb-1"></div>
          <p className="text-[11px] font-bold text-slate-900 uppercase">{invoice.cashierName || '(....................................)'}</p>
        </div>
      </div>

      {/* Fine Print / Footer */}
      <div className="mt-auto pt-8 text-center">
        <div className="h-px bg-slate-100 w-full mb-4"></div>
        <p className="text-slate-400 text-[8px] uppercase font-black tracking-[0.3em] mb-1">
          Printed On: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-slate-900 text-[9px] font-bold uppercase tracking-widest">
          Thank you for staying at {hotel.name}
        </p>
      </div>
    </div>
  );
};
