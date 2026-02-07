
import React from 'react';
import { Invoice } from '../../types';

interface Props {
  invoices: Invoice[];
  onSelect: (invoice: Invoice) => void;
  formatCurrency: (val: number) => string;
  calculateTotal: (inv: Invoice) => number;
}

export const DesktopDashboardTable: React.FC<Props> = ({ invoices, onSelect, formatCurrency, calculateTotal }) => {
  return (
    <div className="hidden md:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">ID Invoice</th>
            <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Nama Tamu</th>
            <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase text-right">Total Bayar</th>
            <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase text-center">Status</th>
            <th className="px-6 py-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {invoices.length === 0 ? (
            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada invoice yang sesuai dengan filter.</td></tr>
          ) : (
            invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => onSelect(inv)}>
                <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-bold">{inv.invoiceNumber}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700 uppercase">{inv.guest.name}</div>
                  {inv.guest.company && <div className="text-[10px] text-slate-500 font-semibold uppercase">{inv.guest.company}</div>}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">Rp {formatCurrency(calculateTotal(inv))}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                    inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                  }`}>{inv.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={(e) => { e.stopPropagation(); onSelect(inv); }} className="text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">Lihat</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
