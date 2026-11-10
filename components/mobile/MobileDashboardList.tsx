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

export const MobileDashboardList: React.FC<Props> = ({ 
  invoices, 
  onSelect, 
  formatCurrency, 
  calculateTotal,
  canDelete = false,
  onDelete
}) => {
  return (
    <div className="space-y-3 md:hidden">
      {invoices.map(inv => (
        <div key={inv.id} onClick={() => onSelect(inv)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <span className="text-[10px] font-mono text-indigo-600 font-bold block mb-0.5 tracking-tight">{inv.invoiceNumber}</span>
              <h4 className="font-bold text-slate-900 text-sm leading-tight uppercase">{inv.guest.name}</h4>
              {inv.guest.company && <div className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{inv.guest.company}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider ${
                inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}>{inv.status}</span>
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(inv);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Hapus Invoice"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-50">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan</div>
            <div className="text-sm font-bold text-slate-900">Rp {formatCurrency(calculateTotal(inv))}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
