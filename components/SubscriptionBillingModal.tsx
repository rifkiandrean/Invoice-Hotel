import React, { useState, useEffect } from 'react';
import { HotelSettings, UserProfile } from '../types';

declare var html2pdf: any;

export interface InvoiceStatsSummary {
  totalInvoices: number;
  totalItems: number;
  hotelInvoices: number;
  villaInvoices: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  hotelSettings: HotelSettings;
  invoiceStats: InvoiceStatsSummary;
}

const MONTHLY_PRICE = 30000;
const ADMIN_FEE = 3000;

export const SubscriptionBillingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profile,
  hotelSettings,
  invoiceStats,
}) => {
  const [months, setMonths] = useState<number>(1);
  const [hotelNameInput, setHotelNameInput] = useState<string>(hotelSettings.name || '');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMonths(1);
      setHotelNameInput(hotelSettings.name || 'BLUE ORCHID FAMILY HOTEL');
    }
  }, [isOpen, hotelSettings.name]);

  if (!isOpen || !profile) return null;

  const now = new Date();
  const yyyymm = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const shortRef = (profile.id || profile.email).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0001';
  const billingNumber = `BILL-VELL-${yyyymm}-${shortRef}`;

  const subscriptionTotal = MONTHLY_PRICE * months;
  const grandTotal = subscriptionTotal + ADMIN_FEE;

  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const formattedToday = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const periodLabel = now.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const dueDateLabel = profile.subscription_end_date
    ? new Date(profile.subscription_end_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : (() => {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + months);
        return nextMonth.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      })();

  const handleDownloadPDF = async () => {
    const element = document.getElementById('subscription-billing-pdf');
    if (!element) return;

    setIsDownloading(true);
    try {
      const safeHotel = (hotelNameInput || 'Hotel').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeEmail = profile.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      const opt = {
        margin: 8,
        filename: `Billing_Subscription_VELL_STUDIO_${safeHotel}_${safeEmail}_${yyyymm}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#FFFFFF',
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.error('Gagal membuat PDF Billing:', err);
      alert('Gagal mengunduh PDF Billing: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-100 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-white/20 flex flex-col max-h-[94vh]">
        {/* Top Action Toolbar (Not captured in PDF) */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase">
                VELL STUDIO
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                Billing Pembelian Subscription Bulanan
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tagihan resmi untuk akun <strong className="text-slate-700">{profile.email}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Hotel:</span>
              <input
                type="text"
                value={hotelNameInput}
                onChange={(e) => setHotelNameInput(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none w-36 sm:w-44"
                placeholder="Nama Hotel"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Durasi:</span>
              <select
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-indigo-700 bg-transparent outline-none cursor-pointer"
              >
                <option value={1}>1 Bulan (Rp 33.000)</option>
                <option value={2}>2 Bulan (Rp 63.000)</option>
                <option value={3}>3 Bulan (Rp 93.000)</option>
                <option value={6}>6 Bulan (Rp 183.000)</option>
                <option value={12}>12 Bulan (Rp 363.000)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div
            id="subscription-billing-pdf"
            className="w-full max-w-[760px] bg-white border border-slate-200 shadow-lg rounded-sm p-8 sm:p-10 text-slate-900 leading-snug"
          >
            {/* 1. Header Penyedia Jasa VELL STUDIO */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-900">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base tracking-wider">
                    VS
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      VELL STUDIO
                    </h1>
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      Penyedia Jasa Sistem & Layanan Cloud HotelFlow
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 mt-2">
                  <p>Website Resmi: <strong>www.vellstudio.my.id</strong></p>
                  <p>Layanan Dukungan & Konfirmasi: <strong>082115123431 (WhatsApp)</strong></p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded">
                  BILLING SUBSCRIPTION
                </span>
                <div className="mt-3 text-xs space-y-1">
                  <p className="text-slate-500">
                    No. Billing: <strong className="text-slate-900 font-mono">{billingNumber}</strong>
                  </p>
                  <p className="text-slate-500">
                    Tanggal Terbit: <strong className="text-slate-900">{formattedToday}</strong>
                  </p>
                  <p className="text-slate-500">
                    Periode Tagihan: <strong className="text-slate-900">{periodLabel} ({months} Bulan)</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Keterangan Hotel & Akun Penerima Tagihan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Ditagihkan Kepada (Nama Hotel)
                </p>
                <h2 className="text-sm font-black text-slate-900 uppercase">
                  {hotelNameInput || hotelSettings.name}
                </h2>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {hotelSettings.address || '-'}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                  <p>Telp: {hotelSettings.phone || '-'}</p>
                  <p>Email Hotel: {hotelSettings.email || '-'}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Detail Akun Pengguna
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Email Akun:</span>
                    <span className="font-bold text-slate-900 break-all text-right">{profile.email}</span>
                  </div>
                  {profile.fullName && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nama Akun:</span>
                      <span className="font-bold text-slate-900 text-right">{profile.fullName}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Role / Akses:</span>
                    <span className="font-bold uppercase text-indigo-700 text-right">
                      {profile.role.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Status Layanan:</span>
                    <span className={`font-black uppercase text-right ${
                      profile.subscription_status === 'active' ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {profile.subscription_status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Jatuh Tempo:</span>
                    <span className="font-bold text-slate-900 text-right">{dueDateLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Statistik Penggunaan (Nama Hotel & Total Item Invoice yang Sudah Dibuat) */}
            <div className="mb-6 bg-indigo-50/70 border border-indigo-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">
                Ringkasan Aktivitas & Total Item Invoice yang Sudah Dibuat
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Nama Hotel</p>
                  <p className="text-xs font-black text-slate-900 mt-1 leading-tight">
                    {hotelNameInput || hotelSettings.name}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invoice Dibuat</p>
                  <p className="text-base font-black text-indigo-700 mt-0.5">
                    {invoiceStats.totalInvoices} <span className="text-[11px] font-bold text-slate-500">Invoice</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Hotel: {invoiceStats.hotelInvoices} • Villa: {invoiceStats.villaInvoices}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Item Invoice Dibuat</p>
                  <p className="text-base font-black text-emerald-700 mt-0.5">
                    {invoiceStats.totalItems} <span className="text-[11px] font-bold text-slate-500">Item</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Seluruh baris transaksi tercatat
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Tabel Rincian Biaya Subscription Perbulan & Biaya Admin */}
            <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">No</th>
                    <th className="py-3 px-4">Keterangan Layanan Subscription</th>
                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                    <th className="py-3 px-4 text-center">Jumlah</th>
                    <th className="py-3 px-4 text-right">Total (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  <tr>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-500">1</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">
                        Pembelian Subscription Aplikasi HotelFlow (Per Bulan)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Layanan sistem manajemen invoice & operasional untuk <strong>{hotelNameInput || hotelSettings.name}</strong> ({invoiceStats.totalItems} item invoice tercatat).
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                      Rp {formatCurrency(MONTHLY_PRICE)} / bln
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 whitespace-nowrap">
                      {months} Bulan
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      Rp {formatCurrency(subscriptionTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-500">2</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">Biaya Admin Layanan</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Biaya administrasi tagihan & pemeliharaan server cloud oleh VELL STUDIO.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                      Rp {formatCurrency(ADMIN_FEE)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 whitespace-nowrap">
                      1x
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      Rp {formatCurrency(ADMIN_FEE)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="bg-slate-50 border-t border-slate-300 px-4 py-4">
                <div className="flex flex-col items-end space-y-1.5 text-xs">
                  <div className="flex justify-between w-full sm:w-72 text-slate-600">
                    <span>Subtotal Subscription ({months} Bulan):</span>
                    <span className="font-bold text-slate-800">Rp {formatCurrency(subscriptionTotal)}</span>
                  </div>
                  <div className="flex justify-between w-full sm:w-72 text-slate-600">
                    <span>Biaya Admin:</span>
                    <span className="font-bold text-slate-800">Rp {formatCurrency(ADMIN_FEE)}</span>
                  </div>
                  <div className="flex justify-between w-full sm:w-72 pt-2 border-t border-slate-300 text-sm">
                    <span className="font-black text-slate-900 uppercase">Total Tagihan:</span>
                    <span className="font-black text-indigo-700 text-base">
                      Rp {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Keterangan Penyedia Jasa VELL STUDIO & Pengesahan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-200 items-end">
              <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-1.5">
                <p className="font-black text-slate-900 uppercase tracking-wider text-[10px]">
                  Keterangan Penyedia Jasa — VELL STUDIO
                </p>
                <p className="leading-relaxed">
                  Layanan aplikasi manajemen invoice dan operasional <strong>{hotelNameInput || hotelSettings.name}</strong> disediakan, dikembangkan, dan dikelola secara resmi oleh <strong>VELL STUDIO</strong> (<em>www.vellstudio.my.id</em>).
                </p>
                <p className="leading-relaxed">
                  Tarif langganan bulanan sebesar <strong>Rp 30.000/bulan</strong> dan biaya admin <strong>Rp 3.000</strong>. Untuk konfirmasi pembayaran atau perpanjangan masa aktif, silakan hubungi layanan dukungan <strong>VELL STUDIO</strong> di WhatsApp <strong>082115123431</strong>.
                </p>
              </div>

              <div className="text-center sm:text-right flex flex-col items-center sm:items-end justify-end">
                <p className="text-[11px] text-slate-500">Diterbitkan secara resmi oleh,</p>
                <div className="my-3 px-4 py-2 border-2 border-slate-900 rounded-lg inline-block">
                  <p className="text-sm font-black tracking-widest text-slate-900 uppercase">
                    VELL STUDIO
                  </p>
                  <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
                    Official Service Provider
                  </p>
                </div>
                <p className="text-[10px] font-bold text-slate-700">Divisi Billing & Subscription</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
