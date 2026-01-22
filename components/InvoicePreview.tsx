
import React, { useMemo } from 'react';
import { Invoice, HotelSettings, InvoiceItem, Payment } from '../types';

interface Props {
  invoice: Invoice;
  settings?: HotelSettings;
}

interface PageData {
  pageNumber: number;
  isFirst: boolean;
  isLast: boolean;
  items: InvoiceItem[];
  payments: Payment[];
  showSummary: boolean;
  showGuestInfo: boolean;
}

// Kapasitas baris per tipe halaman (estimasi visual agar pas di A4)
const LIMITS = {
  FIRST_PAGE_ITEMS: 10,       // Lebih sedikit karena ada Header + Guest Info
  MIDDLE_PAGE_ITEMS: 22,      // Maksimal karena hanya tabel
  LAST_PAGE_COMBINED: 12,     // Sisa item + Payments + Summary
  PAYMENTS_PER_PAGE: 25       // Jika pembayaran saja yang banyak
};

export const InvoicePreview: React.FC<Props> = ({ invoice, settings }) => {
  const hotel = invoice.hotelSnap || settings;
  
  const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0);
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = subtotal - invoice.discount - totalPaid;

  const formatCurrency = (val: number) => val.toLocaleString('id-ID');
  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  // --- LOGIKA PAGINATION LANJUTAN ---
  const pages = useMemo(() => {
    const allItems = [...invoice.items];
    const allPayments = [...invoice.payments];
    const generatedPages: PageData[] = [];
    let currentPage = 1;

    // 1. Tentukan apakah semuanya muat di SATU halaman
    const singlePageWeight = allItems.length + (allPayments.length > 0 ? allPayments.length + 3 : 0);
    if (singlePageWeight <= LIMITS.FIRST_PAGE_ITEMS + 2) {
      generatedPages.push({
        pageNumber: 1,
        isFirst: true,
        isLast: true,
        items: allItems,
        payments: allPayments,
        showSummary: true,
        showGuestInfo: true
      });
      return generatedPages;
    }

    // 2. Jika tidak muat, mulai proses multi-halaman
    // Halaman Pertama
    const firstPageItems = allItems.splice(0, LIMITS.FIRST_PAGE_ITEMS);
    generatedPages.push({
      pageNumber: currentPage++,
      isFirst: true,
      isLast: false,
      items: firstPageItems,
      payments: [],
      showSummary: false,
      showGuestInfo: true
    });

    // Halaman Tengah (Item)
    while (allItems.length > LIMITS.LAST_PAGE_COMBINED) {
      generatedPages.push({
        pageNumber: currentPage++,
        isFirst: false,
        isLast: false,
        items: allItems.splice(0, LIMITS.MIDDLE_PAGE_ITEMS),
        payments: [],
        showSummary: false,
        showGuestInfo: false
      });
    }

    // Halaman Terakhir (Sisa Item + Payments + Summary)
    // Cek apakah sisa item + sisa pembayaran muat di satu halaman terakhir
    const lastPageWeight = allItems.length + (allPayments.length > 0 ? allPayments.length + 4 : 0);
    
    if (lastPageWeight <= LIMITS.LAST_PAGE_COMBINED + 5) {
      generatedPages.push({
        pageNumber: currentPage++,
        isFirst: false,
        isLast: true,
        items: allItems.splice(0),
        payments: allPayments.splice(0),
        showSummary: true,
        showGuestInfo: false
      });
    } else {
      // Jika sisa pembayaran terlalu banyak, pecah lagi
      if (allItems.length > 0) {
        generatedPages.push({
          pageNumber: currentPage++,
          isFirst: false,
          isLast: false,
          items: allItems.splice(0),
          payments: [],
          showSummary: false,
          showGuestInfo: false
        });
      }

      while (allPayments.length > 0) {
        const isActuallyLast = allPayments.length <= LIMITS.PAYMENTS_PER_PAGE;
        generatedPages.push({
          pageNumber: currentPage++,
          isFirst: false,
          isLast: isActuallyLast,
          items: [],
          payments: allPayments.splice(0, LIMITS.PAYMENTS_PER_PAGE),
          showSummary: isActuallyLast,
          showGuestInfo: false
        });
      }
    }

    return generatedPages;
  }, [invoice.items, invoice.payments]);

  if (!hotel) return null;

  return (
    <div id="invoice-content">
      {pages.map((page) => (
        <div key={page.pageNumber} className="page-a4 p-[13mm] flex flex-col relative bg-white overflow-hidden text-black">
          
          {/* HEADER SECTION */}
          {page.isFirst ? (
            <div className="relative mb-4">
              <div className="flex items-center justify-between gap-6 pb-4">
                {hotel.logo && (
                  <img src={hotel.logo} alt="Logo" className="w-24 h-24 object-contain shrink-0" />
                )}
                <div className="flex-1 text-center pr-12">
                  <h1 className="text-2xl font-serif font-bold tracking-tight text-black mb-0.5 uppercase leading-tight">
                    {hotel.name}
                  </h1>
                  <div className="text-[10px] text-black leading-relaxed uppercase tracking-wide">
                    <p className="font-bold">{hotel.address}</p>
                    <p className="mt-0.5">Phone: {hotel.phone} • Email: {hotel.email}</p>
                  </div>
                </div>
              </div>
              <div className="border-b-[2px] border-black w-full mb-[1px]"></div>
              <div className="border-b-[0.5px] border-black w-full"></div>
              <div className="text-center my-6">
                <h2 className="text-lg font-serif font-bold text-black tracking-[0.3em] uppercase underline underline-offset-4 decoration-black">
                  INVOICE
                </h2>
              </div>
            </div>
          ) : (
            <div className="mb-6 border-b border-black/20 pb-2 flex justify-between items-end">
               <div className="opacity-30 grayscale">
                 {hotel.logo && <img src={hotel.logo} alt="Logo" className="w-8 h-8 object-contain" />}
               </div>
               <div className="text-right">
                 <p className="text-[8px] font-bold text-black uppercase">{hotel.name}</p>
                 <p className="text-[8px] text-slate-500 italic">Folio: {invoice.invoiceNumber} — Hal {page.pageNumber} dari {pages.length}</p>
               </div>
            </div>
          )}

          {/* GUEST INFO SECTION */}
          {page.showGuestInfo && (
            <div className="grid grid-cols-2 gap-6 mb-6 animate-fade-in">
              <div className="bg-white p-4 border border-black/10">
                <h3 className="text-[8px] font-black uppercase tracking-widest text-black mb-2 border-b border-black pb-1">Guest</h3>
                <div className="grid grid-cols-[65px_1fr] gap-y-1.5 text-[11px]">
                  <span className="text-black font-medium">Name :</span>
                  <span className="text-black font-bold uppercase">{invoice.guest.name}</span>
                  <span className="text-black font-medium">Address :</span>
                  <span className="text-black leading-tight">{invoice.guest.address || '-'}</span>
                  <span className="text-black font-medium">Contact :</span>
                  <div className="space-y-0.5">
                    <p className="text-black font-bold">{invoice.guest.phone || '-'}</p>
                    <p className="text-black text-[9px] font-medium">{invoice.guest.email}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 border border-black/10">
                <h3 className="text-[8px] font-black uppercase tracking-widest text-black mb-2 border-b border-black pb-1">Stay Details</h3>
                <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                  <span className="text-black font-bold text-[8px] uppercase tracking-wider">Folio No:</span>
                  <span className="text-black font-mono font-bold text-right">{invoice.invoiceNumber}</span>
                  <span className="text-black font-bold text-[8px] uppercase tracking-wider">Type:</span>
                  <span className="text-black font-bold text-right uppercase">{invoice.stay.guestType || 'FIT'}</span>
                  <span className="text-black font-bold text-[8px] uppercase tracking-wider">Status:</span>
                  <div className="text-right">
                    <span className="inline-block border border-black px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                      {invoice.status}
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-black my-0.5"></div>
                  <span className="text-black font-medium">Room No:</span>
                  <span className="text-black font-bold text-right">{invoice.stay.roomNumber}</span>
                  <span className="text-black font-medium">Arrival :</span>
                  <span className="text-black font-bold text-right">{formatIndonesianDate(invoice.stay.checkIn)}</span>
                  <span className="text-black font-medium">Departure :</span>
                  <span className="text-black font-bold text-right">{formatIndonesianDate(invoice.stay.checkOut)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ITEMS TABLE */}
          <div className="flex-1">
            {page.items.length > 0 && (
              <div className="overflow-x-auto border border-black mb-4 shadow-sm bg-white">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-black">
                      <th className="py-2 px-6 text-left text-[8px] font-bold uppercase tracking-wider text-white">Description</th>
                      <th className="py-2 px-4 text-center text-[8px] font-bold uppercase tracking-wider text-white">Qty</th>
                      <th className="py-2 px-4 text-center text-[8px] font-bold uppercase tracking-wider text-white">Nights</th>
                      <th className="py-2 px-6 text-right text-[8px] font-bold uppercase tracking-wider text-white">Unit Price</th>
                      <th className="py-2 px-6 text-right text-[8px] font-bold uppercase tracking-wider text-white">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20">
                    {page.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-6 text-black font-bold text-[11px]">{item.description}</td>
                        <td className="py-2 px-4 text-center text-black font-bold text-[11px]">{item.quantity}</td>
                        <td className="py-2 px-4 text-center text-black font-bold text-[11px]">{item.nights}</td>
                        <td className="py-2 px-6 text-right text-black font-bold text-[11px]">Rp {formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 px-6 text-right text-black font-black text-[11px]">Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}</td>
                      </tr>
                    ))}
                    {!page.isLast && page.items.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="py-2 px-6 text-center text-[9px] italic text-slate-500 font-bold uppercase tracking-widest">
                          --- bersambung ke halaman {page.pageNumber + 1} ---
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAYMENTS HISTORY */}
            {page.payments.length > 0 && (
              <div className="mb-4 px-4 py-2 bg-white border border-black/10">
                <h3 className="text-[8px] font-black uppercase tracking-widest text-black mb-1 border-b border-black pb-0.5">Billing Activity / Payment History</h3>
                <table className="w-full">
                  <tbody className="divide-y divide-black/10">
                    {page.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1 text-[9px] text-black font-medium">{formatIndonesianDate(p.date)}</td>
                        <td className="py-1 text-[9px] font-black text-black uppercase">{p.method}</td>
                        <td className="py-1 text-[10px] text-black text-right font-black"> - Rp {formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                    {!page.isLast && page.payments.length > 0 && (
                      <tr>
                        <td colSpan={3} className="py-1 text-center text-[8px] text-slate-400 italic">... pembayaran lainnya di halaman berikutnya ...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SUMMARY & SIGNATURES (Only on the very last page) */}
          {page.showSummary && (
            <div className="mt-auto border-t border-black pt-4">
              <div className="flex flex-row justify-between items-start gap-6">
                <div className="flex-1 w-full">
                  {invoice.remarks && (
                    <div className="bg-white p-4 border border-black/10 shadow-sm mb-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                        <span className="text-[8px] font-black text-black uppercase tracking-widest">Remarks</span>
                      </div>
                      <p className="text-black text-[10px] leading-relaxed font-bold whitespace-pre-wrap">{invoice.remarks}</p>
                    </div>
                  )}
                  <div className="bg-white p-4 border border-black/5">
                    <p className="text-[7px] font-black text-black uppercase tracking-widest mb-0.5">Payment Instructions:</p>
                    <p className="text-black font-black text-[9px] uppercase leading-tight">{hotel.name}</p>
                    <p className="text-black font-mono text-[10px] font-bold tracking-tight">BANK MANDIRI : 1770021861510</p>
                  </div>
                </div>
                
                <div className="w-[200px] shrink-0">
                  <div className="space-y-1.5 p-2">
                    <div className="flex justify-between text-black text-[9px] font-bold uppercase">
                      <span>Subtotal:</span>
                      <span>Rp {formatCurrency(subtotal)}</span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-black text-[9px] font-bold uppercase">
                        <span>Discount:</span>
                        <span>- Rp {formatCurrency(invoice.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-black text-[9px] font-bold uppercase">
                      <span>Paid/Deposit:</span>
                      <span>- Rp {formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="h-px bg-black my-1.5"></div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-black uppercase tracking-widest mb-0.5">Balance Due:</span>
                      <span className="text-lg font-serif font-black text-black">Rp {formatCurrency(balanceDue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-12 px-6 relative">
                <div className="text-center">
                  <p className="text-[8px] font-black text-black uppercase tracking-widest mb-16">Guest Signature</p>
                  <div className="border-b border-black w-36 mx-auto"></div>
                  <p className="text-[9px] text-black mt-1 font-black uppercase">{invoice.guest.name || '________________'}</p>
                </div>
                <div className="text-center relative">
                  <p className="text-[8px] font-black text-black uppercase tracking-widest mb-16">Receptionist / Cashier</p>
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center overflow-visible hide-on-physical-print">
                    {hotel.signature && (
                       <img src={hotel.signature} alt="Sign" className="absolute w-28 object-contain opacity-95 z-10 translate-y-2" />
                    )}
                    {hotel.stamp && (
                       <img src={hotel.stamp} alt="Stamp" className="absolute w-28 object-contain opacity-70 rotate-[-15deg] -translate-x-6 -translate-y-2" />
                    )}
                  </div>
                  <div className="border-b border-black w-36 mx-auto"></div>
                  <p className="text-[9px] text-black mt-1 font-black uppercase">{invoice.cashierName || '________________'}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 text-center border-t border-black/20">
                  <p className="text-black text-[8px] uppercase font-black tracking-[0.2em] mb-1">Issue Date: {formatIndonesianDate(invoice.date)}</p>
                  <p className="text-black text-[7px] uppercase font-bold tracking-[0.1em]">Thank you for choosing {hotel.name} as your accommodation partner</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
