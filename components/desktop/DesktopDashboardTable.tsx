import React from 'react';
import { Invoice } from '../../types';

interface Props {
  invoices: Invoice[];
  onSelect: (invoice: Invoice) => void;
  formatCurrency: (val: number) => string;
  calculateTotal: (inv: Invoice) => number;
  canDelete?: boolean;
  onDelete?: (invoice: Invoice) => void;
}

export const DesktopDashboardTable: React.FC<Props> = ({ 
  invoices, 
  onSelect, 
  formatCurrency, 
  calculateTotal,
  canDelete = false,
  onDelete 
}) => {
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
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(inv); }} 
                      className="text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Lihat
                    </button>
                    {canDelete && onDelete && (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onDelete(inv); 
                        }} 
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                        title="Hapus Invoice (Khusus Admin)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
