import React, { useMemo, useState } from 'react';
import { Invoice, HotelSettings } from '../types';

interface Props {
  invoices: Invoice[];
  hotelSettings: HotelSettings;
  villaSettings: HotelSettings;
  onSelectInvoice: (invoice: Invoice) => void;
  onRefresh: () => Promise<void>;
}

type CategoryFilter = 'all' | 'hotel' | 'villa';
type PeriodFilter = 'all' | 'this_month' | 'last_30_days' | 'this_year' | 'custom';

export const HotelStatisticsPage: React.FC<Props> = ({
  invoices,
  hotelSettings,
  villaSettings,
  onSelectInvoice,
  onRefresh,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (val: number) => Math.round(val).toLocaleString('id-ID');

  const getInvoiceSubtotal = (inv: Invoice) =>
    (inv.items || []).reduce((sum, item) => sum + item.quantity * item.nights * item.unitPrice, 0);

  const getInvoiceTotal = (inv: Invoice) => getInvoiceSubtotal(inv) - (inv.discount || 0);

  const getInvoicePaid = (inv: Invoice) =>
    (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return invoices.filter((inv) => {
      const cat = inv.category || 'hotel';
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;

      if (periodFilter === 'all') return true;
      if (!inv.date) return false;

      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return false;

      if (periodFilter === 'this_month') {
        return invDate.getFullYear() === currentYear && invDate.getMonth() === currentMonth;
      }
      if (periodFilter === 'last_30_days') {
        return invDate >= thirtyDaysAgo && invDate <= now;
      }
      if (periodFilter === 'this_year') {
        return invDate.getFullYear() === currentYear;
      }
      if (periodFilter === 'custom') {
        if (customStart && inv.date < customStart) return false;
        if (customEnd && inv.date > customEnd) return false;
        return true;
      }
      return true;
    });
  }, [invoices, categoryFilter, periodFilter, customStart, customEnd]);

  const stats = useMemo(() => {
    const activeInvoices = filteredInvoices.filter((inv) => inv.status !== 'cancelled');
    const paidInvoices = filteredInvoices.filter((inv) => inv.status === 'paid');
    const draftInvoices = filteredInvoices.filter((inv) => inv.status === 'draft');
    const cancelledInvoices = filteredInvoices.filter((inv) => inv.status === 'cancelled');

    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    const totalPaidAmount = activeInvoices.reduce((sum, inv) => sum + getInvoicePaid(inv), 0);
    const totalOutstanding = Math.max(0, totalRevenue - totalPaidAmount);
    const totalDiscount = activeInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);

    const totalItems = filteredInvoices.reduce((sum, inv) => sum + (inv.items?.length || 0), 0);
    const totalGuests = activeInvoices.reduce((sum, inv) => sum + (inv.stay?.guestsCount || 1), 0);
    const totalNights = activeInvoices.reduce((sum, inv) => {
      const nightsFromItems = (inv.items || []).reduce((n, item) => Math.max(n, item.nights || 0), 0);
      return sum + (nightsFromItems || 1);
    }, 0);

    const collectionRate = totalRevenue > 0 ? Math.min(100, (totalPaidAmount / totalRevenue) * 100) : 0;
    const avgInvoiceValue = activeInvoices.length > 0 ? totalRevenue / activeInvoices.length : 0;

    // Hotel vs Villa split
    const hotelList = activeInvoices.filter((inv) => (inv.category || 'hotel') === 'hotel');
    const villaList = activeInvoices.filter((inv) => inv.category === 'villa');
    const hotelRevenue = hotelList.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    const villaRevenue = villaList.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    const hotelPaid = hotelList.reduce((sum, inv) => sum + getInvoicePaid(inv), 0);
    const villaPaid = villaList.reduce((sum, inv) => sum + getInvoicePaid(inv), 0);

    // Monthly trend (last 6-12 months present or last 6 months)
    const monthlyMap = new Map<string, { label: string; revenue: number; paid: number; count: number }>();
    activeInvoices.forEach((inv) => {
      if (!inv.date) return;
      const monthKey = inv.date.slice(0, 7); // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
      const [y, m] = monthKey.split('-');
      const labelDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      const label = labelDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      const prev = monthlyMap.get(monthKey) || { label, revenue: 0, paid: 0, count: 0 };
      prev.revenue += getInvoiceTotal(inv);
      prev.paid += getInvoicePaid(inv);
      prev.count += 1;
      monthlyMap.set(monthKey, prev);
    });
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => ({ key, ...value }));

    // Payment methods breakdown
    const paymentMethodMap = new Map<string, { count: number; amount: number }>();
    activeInvoices.forEach((inv) => {
      (inv.payments || []).forEach((p) => {
        const method = (p.method || 'Lainnya').trim() || 'Lainnya';
        const prev = paymentMethodMap.get(method) || { count: 0, amount: 0 };
        prev.count += 1;
        prev.amount += p.amount || 0;
        paymentMethodMap.set(method, prev);
      });
    });
    const paymentMethods = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.amount - a.amount);

    // Guest type segmentation
    const guestTypeMap = new Map<string, { count: number; revenue: number }>();
    activeInvoices.forEach((inv) => {
      const gType = (inv.stay?.guestType || 'Umum').trim() || 'Umum';
      const prev = guestTypeMap.get(gType) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += getInvoiceTotal(inv);
      guestTypeMap.set(gType, prev);
    });
    const guestTypes = Array.from(guestTypeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Room types performance
    const roomTypeMap = new Map<string, { count: number; revenue: number }>();
    activeInvoices.forEach((inv) => {
      const rType = (inv.stay?.roomType || 'Lainnya').trim() || 'Lainnya';
      const prev = roomTypeMap.get(rType) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += getInvoiceTotal(inv);
      roomTypeMap.set(rType, prev);
    });
    const roomTypes = Array.from(roomTypeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Cashier stats
    const cashierMap = new Map<string, { count: number; revenue: number }>();
    activeInvoices.forEach((inv) => {
      const cashier = (inv.cashierName || 'Tanpa Nama Kasir').trim() || 'Tanpa Nama Kasir';
      const prev = cashierMap.get(cashier) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += getInvoiceTotal(inv);
      cashierMap.set(cashier, prev);
    });
    const cashiers = Array.from(cashierMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top invoices by amount
    const topInvoices = [...activeInvoices]
      .sort((a, b) => getInvoiceTotal(b) - getInvoiceTotal(a))
      .slice(0, 6);

    return {
      totalCount: filteredInvoices.length,
      activeCount: activeInvoices.length,
      paidCount: paidInvoices.length,
      draftCount: draftInvoices.length,
      cancelledCount: cancelledInvoices.length,
      totalRevenue,
      totalPaidAmount,
      totalOutstanding,
      totalDiscount,
      totalItems,
      totalGuests,
      totalNights,
      collectionRate,
      avgInvoiceValue,
      hotelCount: hotelList.length,
      villaCount: villaList.length,
      hotelRevenue,
      villaRevenue,
      hotelPaid,
      villaPaid,
      monthlyTrend,
      paymentMethods,
      guestTypes,
      roomTypes,
      cashiers,
      topInvoices,
    };
  }, [filteredInvoices]);

  const maxMonthlyRevenue = Math.max(1, ...stats.monthlyTrend.map((m) => m.revenue));
  const maxPaymentAmount = Math.max(1, ...stats.paymentMethods.map((p) => p.amount));
  const maxRoomRevenue = Math.max(1, ...stats.roomTypes.map((r) => r.revenue));
  const totalCategoryRevenue = Math.max(1, stats.hotelRevenue + stats.villaRevenue);

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Header & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Statistik Seluruh Data Hotel & Villa
              </h2>
              <p className="text-xs text-slate-500">
                Rekapitulasi transaksi, omzet, pembayaran, kamar, dan tamu secara real-time
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Kategori */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: 'all', label: 'Semua Properti' },
              { id: 'hotel', label: 'Hotel & Cottage' },
              { id: 'villa', label: 'Villa' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as CategoryFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === tab.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter Periode */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">Semua Waktu</option>
            <option value="this_month">Bulan Ini</option>
            <option value="last_30_days">30 Hari Terakhir</option>
            <option value="this_year">Tahun Ini</option>
            <option value="custom">Rentang Tanggal Custom</option>
          </select>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Pendapatan (Omzet)
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black">
              Rp
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            Rp {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Rata-rata <strong>Rp {formatCurrency(stats.avgInvoiceValue)}</strong> / invoice aktif
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pembayaran Masuk
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">
              {stats.collectionRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">
            Rp {formatCurrency(stats.totalPaidAmount)}
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.collectionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sisa Tagihan / Piutang
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100">
              {stats.draftCount} Draft
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 tracking-tight">
            Rp {formatCurrency(stats.totalOutstanding)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Total diskon diberikan: <strong>Rp {formatCurrency(stats.totalDiscount)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Volume Data Operasional
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
              {stats.totalCount} Invoice
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.totalItems} <span className="text-sm font-bold text-slate-500">Item Invoice</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            <strong>{stats.totalGuests}</strong> Total Tamu • <strong>{stats.totalNights}</strong> Total Malam
          </p>
        </div>
      </div>

      {/* Row 2: Monthly Revenue Trend & Property Comparison + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Tren Pendapatan Bulanan
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Perbandingan omzet & jumlah invoice hingga 12 bulan terakhir
              </p>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {stats.monthlyTrend.length} Periode
            </span>
          </div>

          {stats.monthlyTrend.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-xs text-slate-400 italic">
              Belum ada data transaksi pada filter yang dipilih.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-end">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end pt-4">
                {stats.monthlyTrend.map((m) => {
                  const barHeight = Math.max(8, Math.round((m.revenue / maxMonthlyRevenue) * 140));
                  return (
                    <div key={m.key} className="flex flex-col items-center group">
                      <span className="text-[10px] font-bold text-slate-600 mb-1 opacity-90 group-hover:text-indigo-700 transition-colors">
                        {m.revenue >= 1000000
                          ? `${(m.revenue / 1000000).toFixed(1)}jt`
                          : `${Math.round(m.revenue / 1000)}rb`}
                      </span>
                      <div className="w-full max-w-[44px] h-[148px] bg-slate-50 rounded-xl flex items-end justify-center p-1 border border-slate-100">
                        <div
                          className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-lg transition-all duration-500 group-hover:from-indigo-700 group-hover:to-violet-600"
                          style={{ height: `${barHeight}px` }}
                          title={`${m.label}: Rp ${formatCurrency(m.revenue)} (${m.count} invoice)`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 mt-2">{m.label}</span>
                      <span className="text-[10px] text-slate-400">{m.count} inv</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Property Split & Invoice Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">
              Perbandingan Properti
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">{hotelSettings.name}</span>
                  <span className="text-indigo-700">Rp {formatCurrency(stats.hotelRevenue)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${(stats.hotelRevenue / totalCategoryRevenue) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {stats.hotelCount} Invoice • Masuk: Rp {formatCurrency(stats.hotelPaid)}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">{villaSettings.name}</span>
                  <span className="text-emerald-700">Rp {formatCurrency(stats.villaRevenue)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(stats.villaRevenue / totalCategoryRevenue) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {stats.villaCount} Invoice • Masuk: Rp {formatCurrency(stats.villaPaid)}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">
              Status Seluruh Invoice
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Paid</p>
                <p className="text-lg font-black text-emerald-800 mt-0.5">{stats.paidCount}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Draft</p>
                <p className="text-lg font-black text-amber-800 mt-0.5">{stats.draftCount}</p>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-rose-700 uppercase">Cancel</p>
                <p className="text-lg font-black text-rose-800 mt-0.5">{stats.cancelledCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Payment Methods, Room Types, Guest Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metode Pembayaran */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">
            Metode Pembayaran
          </h3>
          {stats.paymentMethods.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada catatan pembayaran.</p>
          ) : (
            <div className="space-y-3.5">
              {stats.paymentMethods.map((pm) => (
                <div key={pm.method}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">
                      {pm.method} <span className="text-slate-400 font-normal">({pm.count}x)</span>
                    </span>
                    <span className="font-bold text-slate-900">Rp {formatCurrency(pm.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(pm.amount / maxPaymentAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tipe Kamar Terlaris */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">
            Performa Tipe Kamar / Unit
          </h3>
          {stats.roomTypes.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada data kamar.</p>
          ) : (
            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {stats.roomTypes.map((rt) => (
                <div key={rt.type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">
                      {rt.type} <span className="text-slate-400 font-normal">({rt.count} inv)</span>
                    </span>
                    <span className="font-bold text-indigo-700">Rp {formatCurrency(rt.revenue)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(rt.revenue / maxRoomRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Segmentasi Tamu & Kasir */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">
              Segmentasi Tipe Tamu
            </h3>
            {stats.guestTypes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada data tamu.</p>
            ) : (
              <div className="space-y-2">
                {stats.guestTypes.map((gt) => (
                  <div
                    key={gt.type}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"
                  >
                    <span className="font-bold text-slate-700">
                      {gt.type} <span className="text-slate-400 font-normal">({gt.count})</span>
                    </span>
                    <span className="font-bold text-slate-900">Rp {formatCurrency(gt.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">
              Rekap Kasir / Petugas
            </h3>
            {stats.cashiers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada data kasir.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {stats.cashiers.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"
                  >
                    <span className="font-bold text-slate-700 truncate max-w-[150px]">
                      {c.name} <span className="text-slate-400 font-normal">({c.count})</span>
                    </span>
                    <span className="font-bold text-emerald-700">Rp {formatCurrency(c.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Top Value Invoices */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            Transaksi Nilai Tertinggi
          </h3>
          <span className="text-[11px] text-slate-400">Klik baris untuk membuka detail invoice</span>
        </div>

        {stats.topInvoices.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada transaksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3">No. Invoice</th>
                  <th className="px-4 py-3">Properti</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Tamu</th>
                  <th className="px-4 py-3">Kamar / Unit</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Total Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.topInvoices.map((inv) => {
                  const total = getInvoiceTotal(inv);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onSelectInvoice(inv)}
                      className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inv.category === 'villa' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {inv.category === 'villa' ? 'Villa' : 'Hotel'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{inv.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{inv.guest?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {inv.stay?.roomType || '-'} {inv.stay?.roomNumber ? `(${inv.stay.roomNumber})` : ''}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : inv.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        Rp {formatCurrency(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
