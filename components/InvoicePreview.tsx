
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

  // Group payments by method
  const groupedPayments = invoice.payments.reduce((acc, p) => {
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
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  if (!hotel) return null;

  return (
    <div id="invoice-content" className="page-a4 p-[12mm] flex flex-col relative bg-white overflow-hidden text-black leading-tight">
      {/* Adjusted Letterhead Header - Shifted Right */}
      <div className="flex items-center mb-1 pb-2">
        {/* Logo Column - Fixed width to push text to the right */}
        <div className="w-32 flex-shrink-0 flex items-center justify-start">
          {hotel.logo && (
            <img src={hotel.logo} alt="Hotel Logo" className="w-24 h-24 object-contain" />
          )}
        </div>
        
        {/* Text Column - Centered in the remaining space */}
        <div className="flex-1 flex flex-col items-center text-center pr-12">
          <h1 className="text-[24pt] font-serif font-black tracking-tight text-slate-900 mb-0.5 uppercase">
            {hotel.name}
          </h1>
          <p className="text-[10pt] font-bold text-slate-800 uppercase tracking-wide max-w-[90%] leading-tight mb-1">
            {hotel.address}
          </p>
          <p className="text-[9pt] font-medium text-slate-700 uppercase tracking-tighter">
            PHONE: {hotel.phone} • EMAIL: {hotel.email}
          </p>
        </div>
      </div>

      {/* Double Separator Line */}
      <div className="border-t-4 border-black mt-1 mb-[1px]"></div>
      <div className="border-t border-black mb-6"></div>

      {/* Document Title */}
      <div className="flex flex-col items-center mb-8">
        <h2 className="text-[16pt] font-serif font-bold tracking-[0.5em] uppercase border-b-2 border-slate-900 pb-1 px-8">
          INVOICE
        </h2>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-2 gap-4 mb-8 items-stretch">
        {/* Guest Information Box */}
        <div className="border border-slate-300 p-4 rounded-sm flex flex-col">
          <h3 className="text-[8pt] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">GUEST</h3>
          <div className="space-y-2 text-[10pt]">
            <div className="flex">
              <span className="w-20 font-bold">Name :</span>
              <span className="flex-1 font-black uppercase text-slate-900">{invoice.guest.name || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold">Address :</span>
              <span className="flex-1 text-slate-700">{invoice.guest.address || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold">Contact :</span>
              <span className="flex-1 text-slate-700">{invoice.guest.phone || '-'}</span>
            </div>
          </div>
        </div>

        {/* Stay Details Box */}
        <div className="border border-slate-300 p-4 rounded-sm flex flex-col">
          <h3 className="text-[8pt] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">STAY DETAILS</h3>
          <div className="space-y-1.5 text-[9pt]">
            <div className="flex justify-between items-center">
              <span className="font-bold uppercase text-[7pt] text-slate-500">FOLIO NO:</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold uppercase text-[7pt] text-slate-500">TYPE:</span>
              <span className="font-bold text-slate-900">{invoice.stay.guestType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold uppercase text-[7pt] text-slate-500">STATUS:</span>
              <span className={`px-2 py-0.5 border border-slate-900 rounded-md font-black text-[7pt] uppercase ${invoice.status === 'paid' ? 'bg-slate-50' : ''}`}>
                {invoice.status}
              </span>
            </div>
            <div className="border-t border-slate-200 my-2"></div>
            <div className="flex justify-between">
              <span className="font-bold">Room No:</span>
              <span className="font-bold">{invoice.stay.roomNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Arrival :</span>
              <span>{formatIndonesianDate(invoice.stay.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Departure :</span>
              <span>{formatIndonesianDate(invoice.stay.checkOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1">
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-black text-white">
              <th className="py-2 px-3 text-[8pt] font-bold uppercase tracking-wider border border-slate-300">DESCRIPTION</th>
              <th className="py-2 px-3 text-[8pt] font-bold uppercase tracking-wider border border-slate-300 text-center">QTY</th>
              <th className="py-2 px-3 text-[8pt] font-bold uppercase tracking-wider border border-slate-300 text-center">NIGHTS</th>
              <th className="py-2 px-3 text-[8pt] font-bold uppercase tracking-wider border border-slate-300 text-right">UNIT PRICE</th>
              <th className="py-2 px-3 text-[8pt] font-bold uppercase tracking-wider border border-slate-300 text-right">TOTAL AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((item) => (
              <tr key={item.id} className="text-[10pt]">
                <td className="py-2.5 px-3 font-bold text-slate-800 uppercase border-x border-slate-300">{item.description}</td>
                <td className="py-2.5 px-3 text-center border-x border-slate-300">{item.quantity}</td>
                <td className="py-2.5 px-3 text-center border-x border-slate-300">{item.nights}</td>
                <td className="py-2.5 px-3 text-right border-x border-slate-300">Rp {formatCurrency(item.unitPrice)}</td>
                <td className="py-2.5 px-3 font-black text-slate-900 text-right border-x border-slate-300">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
              </tr>
            ))}
            {/* Empty Rows for visual space */}
            {[...Array(Math.max(0, 4 - invoice.items.length))].map((_, i) => (
              <tr key={`empty-${i}`} className="h-8">
                <td className="border-x border-slate-300"></td>
                <td className="border-x border-slate-300"></td>
                <td className="border-x border-slate-300"></td>
                <td className="border-x border-slate-300"></td>
                <td className="border-x border-slate-300"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-between gap-8">
          {/* Summarized Payments Section */}
          <div className="flex-1">
            {Object.keys(groupedPayments).length > 0 && (
              <div className="border border-slate-200 rounded-sm p-3 bg-slate-50/50">
                <h3 className="text-[7pt] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200 pb-1">PAYMENT SUMMARY</h3>
                <div className="space-y-1">
                  {Object.entries(groupedPayments).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center text-[9pt]">
                      <span className="font-bold text-slate-600 uppercase tracking-tighter">{method}</span>
                      <span className="font-black text-emerald-700">Rp {formatCurrency(amount as number)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 mt-2 pt-1 flex justify-between items-center text-[9pt] font-black">
                    <span className="text-slate-400 uppercase text-[7pt]">TOTAL RECEIVED</span>
                    <span className="text-emerald-700">Rp {formatCurrency(totalPaid)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Remarks Section */}
            {invoice.remarks && (
              <div className="mt-4">
                <p className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest mb-1">Remarks:</p>
                <p className="text-[9pt] text-slate-700 italic leading-relaxed whitespace-pre-wrap">{invoice.remarks}</p>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="w-[280px] shrink-0 border border-slate-300 rounded-sm overflow-hidden h-fit">
            <div className="flex justify-between px-3 py-2 text-[9pt] border-b border-slate-100">
              <span className="font-bold text-slate-500 uppercase">SUBTOTAL</span>
              <span className="font-bold">Rp {formatCurrency(subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between px-3 py-2 text-[9pt] border-b border-slate-100">
                <span className="font-bold text-slate-500 uppercase">ADJUSTMENT</span>
                <span className="font-bold text-rose-600">- Rp {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-2 text-[9pt] border-b border-slate-100 text-emerald-700 bg-emerald-50/30">
              <span className="font-bold uppercase">PAID / DEPOSIT</span>
              <span className="font-bold">- Rp {formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between px-3 py-3 bg-slate-900 text-white">
              <span className="text-[9pt] font-black uppercase tracking-wider">BALANCE DUE</span>
              <span className="text-[12pt] font-black">Rp {formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-12 grid grid-cols-2 gap-20">
        <div className="text-center">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-widest mb-20">GUEST SIGNATURE</p>
          <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
          <p className="text-[10pt] font-bold uppercase">{invoice.guest.name || '....................................'}</p>
        </div>
        <div className="text-center relative">
          <p className="text-[8pt] font-bold text-slate-400 uppercase tracking-widest mb-20">RECEPTIONIST / CASHIER</p>
          
          {/* Stamps/Signatures Overlays */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-24 pointer-events-none flex items-center justify-center overflow-visible hide-on-physical-print">
            {hotel.signature && (
               <img src={hotel.signature} alt="Digital Sign" className="absolute w-32 object-contain opacity-95 z-10 translate-y-2" />
            )}
            {hotel.stamp && (
               <img src={hotel.stamp} alt="Hotel Stamp" className="absolute w-32 object-contain opacity-40 rotate-[-15deg] -translate-x-10 -translate-y-2 mix-blend-multiply" />
            )}
          </div>

          <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
          <p className="text-[10pt] font-bold uppercase">{invoice.cashierName || '....................................'}</p>
        </div>
      </div>

      {/* Page Footer */}
      <div className="mt-auto pt-8 text-center border-t border-slate-100">
        <p className="text-slate-400 text-[7pt] uppercase font-bold tracking-[0.3em] mb-1">
          Thank you for choosing {hotel.name}
        </p>
        <p className="text-slate-300 text-[6pt]">
          Printed: {new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  );
};
