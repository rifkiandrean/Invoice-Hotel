
import React from 'react';
import { Invoice } from '../../types';

interface Props {
  invoices: Invoice[];
  onSelect: (invoice: Invoice) => void;
  formatCurrency: (val: number) => string;
  calculateTotal: (inv: Invoice) => number;
}

export const MobileDashboardList: React.FC<Props> = ({ invoices, onSelect, formatCurrency, calculateTotal }) => {
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
            <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider ${
              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
              inv.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
            }`}>{inv.status}</span>
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
