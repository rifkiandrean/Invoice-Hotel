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
  const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = totalCharge - totalPaid;

  // Group payments by method for a unified summary
  const groupedPayments = (invoice.payments || []).reduce((acc, p) => {
    const method = p.method || 'Other';
    acc[method] = (acc[method] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

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
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  if (!hotel) return null;

  return (
    <div id="invoice-content" className="page-a4 p-[15mm] flex flex-col relative bg-white overflow-hidden text-black leading-tight">
      {/* Centered Letterhead with Absolute Logo */}
      <div className="relative w-full flex flex-col items-center pt-2 pb-5">
        {hotel.logo && (
          <div className="absolute left-0 top-0 h-full flex items-center">
            <img src={hotel.logo} alt="Hotel Logo" className="w-24 h-24 object-contain" />
          </div>
        )}
        
        <div className="flex flex-col items-center text-center">
          <h1 className="text-[26pt] font-serif font-black tracking-tight text-slate-900 mb-1 uppercase">
            {hotel.name}
          </h1>
          <p className="text-[9.5pt] font-bold text-slate-800 uppercase tracking-wide max-w-[85%] leading-snug mb-1">
            {hotel.address}
          </p>
          <p className="text-[8.5pt] font-semibold text-slate-700 uppercase tracking-tight">
            PHONE: {hotel.phone} • EMAIL: {hotel.email}
          </p>
        </div>
      </div>

      {/* Double Separator Line */}
      <div className="border-t-[2.5px] border-black w-full mb-[1.5px]"></div>
      <div className="border-t-[0.5px] border-black w-full mb-8"></div>

      {/* Document Header */}
      <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[18pt] font-serif font-bold tracking-[0.4em] uppercase text-slate-900">
            INVOICE
          </h2>
          <p className="text-[8pt] text-slate-400 font-bold uppercase tracking-widest mt-1">Guest Folio</p>
        </div>
        <div className="text-right">
          <p className="text-[9pt] font-bold text-slate-400 uppercase tracking-tighter">Folio Number</p>
          <p className="text-[14pt] font-mono font-black text-slate-900">{invoice.invoiceNumber}</p>
        </div>
      </div>

      {/* Primary Info Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Guest Details */}
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/30">
          <h3 className="text-[7pt] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 border-b border-slate-100 pb-1">GUEST INFORMATION</h3>
          <div className="space-y-1.5 text-[10pt]">
            <div className="flex"><span className="w-20 font-bold text-slate-500">Name</span><span className="flex-1 font-black text-slate-900 uppercase">{invoice.guest.name || '-'}</span></div>
            <div className="flex"><span className="w-20 font-bold text-slate-500">Contact</span><span className="flex-1 text-slate-700">{invoice.guest.phone || '-'}</span></div>
            <div className="flex"><span className="w-20 font-bold text-slate-500">Address</span><span className="flex-1 text-slate-700 text-[9pt] leading-tight">{invoice.guest.address || '-'}</span></div>
          </div>
        </div>

        {/* Stay Details */}
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/30">
          <h3 className="text-[7pt] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 border-b border-slate-100 pb-1">STAY DETAILS</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9pt]">
            <div><span className="block text-[7pt] font-bold text-slate-400 uppercase">Room No</span><span className="font-black text-slate-900">{invoice.stay.roomNumber}</span></div>
            <div><span className="block text-[7pt] font-bold text-slate-400 uppercase">Type</span><span className="font-bold text-slate-800">{invoice.stay.roomType}</span></div>
            <div className="col-span-2 mt-1 border-t border-slate-100 pt-1 flex justify-between">
              <div><span className="block text-[7pt] font-bold text-slate-400 uppercase">Arrival</span><span>{formatIndonesianDate(invoice.stay.checkIn)}</span></div>
              <div className="text-right"><span className="block text-[7pt] font-bold text-slate-400 uppercase">Departure</span><span>{formatIndonesianDate(invoice.stay.checkOut)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="flex-1">
        <table className="w-full text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="py-2.5 px-4 text-[8pt] font-bold uppercase tracking-wider">Description</th>
              <th className="py-2.5 px-4 text-[8pt] font-bold uppercase tracking-wider text-center">Qty</th>
              <th className="py-2.5 px-4 text-[8pt] font-bold uppercase tracking-wider text-center">Nights</th>
              <th className="py-2.5 px-4 text-[8pt] font-bold uppercase tracking-wider text-right">Unit Price</th>
              <th className="py-2.5 px-4 text-[8pt] font-bold uppercase tracking-wider text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="text-[10pt] hover:bg-slate-50/50">
                <td className="py-3 px-4 font-bold text-slate-800 uppercase leading-tight">{item.description}</td>
                <td className="py-3 px-4 text-center text-slate-600">{item.quantity}</td>
                <td className="py-3 px-4 text-center text-slate-600">{item.nights}</td>
                <td className="py-3 px-4 text-right text-slate-600">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-4 font-black text-slate-900 text-right whitespace-nowrap">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
            {/* Visual filler rows */}
            {[...Array(Math.max(0, 5 - invoice.items.length))].map((_, i) => (
              <tr key={`filler-${i}`} className="h-10">
                <td className="px-4"></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between gap-10">
          {/* Grouped Payments Column */}
          <div className="flex-1">
            {Object.keys(groupedPayments).length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <h4 className="text-[7pt] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">Payment Summary</h4>
                <div className="space-y-2">
                  {Object.entries(groupedPayments).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center text-[9pt]">
                      <span className="font-bold text-slate-500 uppercase tracking-tighter">{method}</span>
                      <span className="font-black text-emerald-700">Rp {formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                    <span className="text-[8pt] font-black text-slate-400 uppercase">Total Received</span>
                    <span className="text-[10pt] font-black text-emerald-700">Rp {formatCurrency(totalPaid)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {invoice.remarks && (
              <div className="mt-4 px-2">
                <p className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest mb-1">Remarks & Notes</p>
                <p className="text-[9pt] text-slate-600 italic leading-relaxed whitespace-pre-wrap">{invoice.remarks}</p>
              </div>
            )}
          </div>

          {/* Totals Summary Column */}
          <div className="w-[280px] shrink-0 space-y-1">
            <div className="flex justify-between px-4 py-2 text-[9pt] border-b border-slate-50">
              <span className="font-bold text-slate-400 uppercase">Subtotal</span>
              <span className="font-bold text-slate-700">Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between px-4 py-2 text-[9pt] border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase">Adjustment</span>
                <span className="font-bold text-rose-600">- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2 text-[9pt] border-b border-slate-50 bg-emerald-50/20 text-emerald-700">
              <span className="font-bold uppercase">Total Payments</span>
              <span className="font-bold">- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between px-4 py-4 bg-slate-900 text-white rounded-xl shadow-lg mt-2">
              <span className="text-[10pt] font-black uppercase tracking-widest">Balance Due</span>
              <span className="text-[13pt] font-black">Rp {formatCurrency(balanceDue)}</span>
            </div>
            {balanceDue <= 0 && (
               <div className="text-center pt-2">
                 <span className="inline-block border-2 border-emerald-500 text-emerald-500 px-4 py-1 rounded text-[10pt] font-black uppercase tracking-[0.3em] rotate-[-5deg]">SETTLED</span>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature & Authentication Section */}
      <div className="mt-16 grid grid-cols-2 gap-20">
        <div className="text-center">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-[0.3em] mb-20">GUEST SIGNATURE</p>
          <div className="border-b border-slate-300 w-52 mx-auto mb-1"></div>
          <p className="text-[10pt] font-bold uppercase text-slate-900">{invoice.guest.name || 'Guest'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-[0.3em] mb-20">CASHIER / RECEPTIONIST</p>
          
          {/* Authenticity Stamps & Digital Signatures */}
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-24 pointer-events-none flex items-center justify-center overflow-visible hide-on-physical-print">
            {hotel.signature && (
               <img src={hotel.signature} alt="Sign" className="absolute w-36 object-contain opacity-90 z-10 translate-y-3" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Stamp" className="absolute w-36 object-contain opacity-30 rotate-[-12deg] -translate-x-8 -translate-y-2 mix-blend-multiply" />
            )}
          </div>

          <div className="border-b border-slate-300 w-52 mx-auto mb-1"></div>
          <p className="text-[10pt] font-bold uppercase text-slate-900">{invoice.cashierName || 'Staff Member'}</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-auto pt-8 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-[8pt] font-bold uppercase tracking-[0.5em] mb-1">Thank You For Your Visit</p>
        <div className="flex justify-center gap-4 text-[7pt] text-slate-300 uppercase font-medium">
          <span>{hotel.website !== '-' ? hotel.website : ''}</span>
          <span>Printed: {new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
      </div>
    </div>
  );
};