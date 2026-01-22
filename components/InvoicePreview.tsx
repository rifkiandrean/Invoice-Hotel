
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
            {[...Array(Math.max(0, 5 - invoice.items.