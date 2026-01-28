
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

  const formatCurrency = (val: number) => {
    return val.toLocaleString('id-ID');
  };

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      // Matching the format: "Sabtu, 24 Jan 2026"
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

  // Extract unique payment methods
  const paymentMethods = Array.from(new Set((invoice.payments || []).map(p => p.method)));

  return (
    <div id="invoice-content" className="page-a4 p-[12mm] flex flex-col relative bg-white overflow-hidden text-black leading-tight">
      
      {/* 1. Letterhead - Refined padding for better centering when shifted */}
      <div className="relative w-full flex flex-col items-center justify-center pt-1 pb-4 min-h-[110px]">
        {hotel.logo && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <img 
              src={hotel.logo} 
              alt="Hotel Logo" 
              className="w-20 h-20 object-contain" 
            />
          </div>
        )}
        
        <div className="flex flex-col items-center text-center w-full pl-28 pr-12">
          <h1 className="text-[20pt] font-serif font-black tracking-tight text-slate-900 mb-1 uppercase leading-none whitespace-nowrap">
            {hotel.name}
          </h1>
          <p className="text-[8pt] font-bold text-slate-800 uppercase tracking-wide leading-tight mb-1 whitespace-nowrap">
            {hotel.address}
          </p>
          <p className="text-[7.5pt] font-semibold text-slate-700 uppercase tracking-tight whitespace-nowrap">
            PHONE: {hotel.phone} • EMAIL: {hotel.email}
          </p>
        </div>
      </div>

      {/* 2. Double Separator Line */}
      <div className="border-t-[3px] border-black w-full mb-[2px]"></div>
      <div className="border-t border-black w-full mb-6"></div>

      {/* 3. Document Title - Reduced margin */}
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-[16pt] font-serif font-bold tracking-[0.5em] uppercase border-b border-black pb-1 px-12">
          INVOICE
        </h2>
      </div>

      {/* 4. Refined Info Grid Boxes - Reduced padding and margin */}
      <div className="grid grid-cols-2 gap-4 mb-6 items-stretch">
        <div className="border border-slate-300 p-3 rounded-sm flex flex-col">
          <h3 className="text-[7pt] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1.5 mb-3">GUEST</h3>
          <div className="space-y-1.5 text-[9pt]">
            <div className="flex">
              <span className="w-20 shrink-0 font-bold text-slate-500 text-[8pt]">Name</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 font-black uppercase text-slate-900">{invoice.guest.name || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 shrink-0 font-bold text-slate-500 text-[8pt]">Address</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 text-slate-700 leading-snug">{invoice.guest.address || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 shrink-0 font-bold text-slate-500 text-[8pt]">Contact</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 text-slate-700">{invoice.guest.phone || '-'}</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-300 p-3 rounded-sm flex flex-col bg-slate-50/30">
          <h3 className="text-[7pt] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1.5 mb-3">STAY SUMMARY</h3>
          <div className="space-y-1.5 text-[9pt]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
              <span className="text-[7pt] font-bold text-slate-400 uppercase">FOLIO NO.</span>
              <span className="font-mono font-bold text-indigo-600">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex">
              <span className="w-24 shrink-0 font-bold text-slate-500 text-[8pt]">Room No.</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 font-black text-slate-900">{invoice.stay.roomNumber}</span>
            </div>
            <div className="flex">
              <span className="w-24 shrink-0 font-bold text-slate-500 text-[8pt]">Arrival</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 font-bold text-slate-900">{formatIndonesianDate(invoice.stay.checkIn)}</span>
            </div>
            <div className="flex">
              <span className="w-24 shrink-0 font-bold text-slate-500 text-[8pt]">Departure</span>
              <span className="mr-3 text-slate-400">:</span>
              <span className="flex-1 font-bold text-slate-900">{formatIndonesianDate(invoice.stay.checkOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Main Billing Table - Reduced row padding */}
      <div className="flex-1">
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300">
              <th className="py-2 px-4 text-[7.5pt] font-black uppercase border-r border-slate-300">DESCRIPTION</th>
              <th className="py-2 px-4 text-[7.5pt] font-black uppercase text-center border-r border-slate-300">QTY</th>
              <th className="py-2 px-4 text-[7.5pt] font-black uppercase text-center border-r border-slate-300">NIGHTS</th>
              <th className="py-2 px-4 text-[7.5pt] font-black uppercase text-right border-r border-slate-300">UNIT PRICE</th>
              <th className="py-2 px-4 text-[7.5pt] font-black uppercase text-right">TOTAL AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((item) => (
              <tr key={item.id} className="text-[9pt]">
                <td className="py-2 px-4 font-bold text-slate-900 uppercase border-r border-slate-300">{item.description}</td>
                <td className="py-2 px-4 text-center border-r border-slate-300">{item.quantity}</td>
                <td className="py-2 px-4 text-center border-r border-slate-300">{item.nights}</td>
                <td className="py-2 px-4 text-right border-r border-slate-300">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-2 px-4 font-black text-slate-900 text-right">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
            {[...Array(Math.max(0, 3 - invoice.items.length))].map((_, i) => (
              <tr key={`empty-${i}`} className="h-8">
                <td className="border-r border-slate-300"></td>
                <td className="border-r border-slate-300"></td>
                <td className="border-r border-slate-300"></td>
                <td className="border-r border-slate-300"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 6. Totals & Summaries - Reduced margin and tightened internal spacing */}
        <div className="mt-6 flex justify-between gap-10">
          <div className="flex-1">
            {/* Payment Methods */}
            {paymentMethods.length > 0 && (
              <div className="mb-3">
                <p className="text-[7pt] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">METODE PEMBAYARAN</p>
                <div className="flex flex-wrap gap-1.5">
                  {paymentMethods.map(method => (
                    <span key={method} className="text-[8pt] font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm uppercase">
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Account Info */}
            {hotel.bankInfo && (
              <div className="mb-4">
                <p className="text-[7pt] font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 pb-1">REKENING PEMBAYARAN</p>
                <p className="text-[8.5pt] font-bold text-slate-800 uppercase leading-tight">
                  {hotel.bankInfo}
                </p>
              </div>
            )}

            {invoice.remarks && (
              <div className="bg-slate-50/50 p-3 border border-slate-200 rounded-sm">
                <p className="text-[7pt] font-black text-slate-400 uppercase tracking-widest mb-1">NOTES / REMARKS</p>
                <p className="text-[8.5pt] text-slate-700 italic leading-snug whitespace-pre-wrap">{invoice.remarks}</p>
              </div>
            )}
          </div>

          <div className="w-[280px] shrink-0 border border-slate-300 rounded-sm overflow-hidden h-fit">
            <div className="flex justify-between px-3 py-1.5 text-[8.5pt] border-b border-slate-100">
              <span className="font-bold text-slate-500 uppercase">SUBTOTAL</span>
              <span className="font-bold">Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between px-3 py-1.5 text-[8.5pt] border-b border-slate-100">
                <span className="font-bold text-slate-500 uppercase">ADJUSTMENT</span>
                <span className="font-bold text-rose-600">- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-1.5 text-[8.5pt] border-b border-slate-100 text-emerald-700 bg-emerald-50/20">
              <span className="font-bold uppercase">PAID / DEPOSIT</span>
              <span className="font-bold">- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between px-3 py-1.5 text-[8.5pt] border-b border-slate-100">
              <span className="font-bold text-slate-500 uppercase">Total Bayar</span>
              <span className="font-bold text-slate-900">Rp {formatCurrency(totalCharge)}</span>
            </div>
            <div className="flex justify-between px-3 py-3 bg-slate-900 text-white">
              <span className="text-[9pt] font-black uppercase tracking-widest">BALANCE DUE</span>
              <span className="text-[12pt] font-black">Rp {formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Footer Signatures - Reduced margin top and gap */}
      <div className="mt-10 grid grid-cols-2 gap-20">
        <div className="text-center">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-[0.3em] mb-16">GUEST SIGNATURE</p>
          <div className="border-b border-slate-400 w-52 mx-auto mb-1"></div>
          <p className="text-[9pt] font-bold uppercase">{invoice.guest.name || 'GUEST NAME'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-[0.3em] mb-16">RECEPTIONIST / CASHIER</p>
          
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-20 pointer-events-none flex items-center justify-center overflow-visible hide-on-physical-print">
            {hotel.signature && (
               <img src={hotel.signature} alt="Sign" className="absolute w-32 object-contain opacity-95 z-10 translate-y-2" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Stamp" className="absolute w-32 object-contain opacity-30 rotate-[-12deg] -translate-x-8 -translate-y-2 mix-blend-multiply" />
            )}
          </div>

          <div className="border-b border-slate-400 w-52 mx-auto mb-1"></div>
          <p className="text-[9pt] font-bold uppercase">{invoice.cashierName || 'STAFF NAME'}</p>
        </div>
      </div>

      {/* 8. Final Footer Branding - Reduced padding */}
      <div className="mt-auto pt-4 text-center border-t border-slate-100">
        <p className="text-slate-400 text-[7.5pt] font-bold uppercase tracking-[0.6em] mb-0.5">
          Thank you for choosing {hotel.name}
        </p>
        <p className="text-slate-300 text-[6.5pt] uppercase tracking-tighter">
          Generated: {new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  );
};
