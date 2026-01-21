
import React from 'react';
import { Payment } from '../types';
import { PAYMENT_METHODS } from '../constants';

interface Props {
  payment: Payment;
  onUpdate: (id: string, updates: Partial<Payment>) => void;
  onDelete: (id: string) => void;
}

export const PaymentRow: React.FC<Props> = ({ payment, onUpdate, onDelete }) => {
  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onUpdate(payment.id, { amount: parseInt(rawValue, 10) || 0 });
  };

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center mb-4 sm:mb-2 group bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-slate-100">
      <div className="w-full sm:col-span-3">
        <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block">Tgl Bayar</label>
        <input
          type="date"
          value={payment.date}
          onChange={(e) => onUpdate(payment.id, { date: e.target.value })}
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
        />
      </div>
      <div className="w-full grid grid-cols-2 sm:contents gap-2 mt-2 sm:mt-0">
        <div className="sm:col-span-4">
          <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block">Metode</label>
          <select
            value={payment.method}
            onChange={(e) => onUpdate(payment.id, { method: e.target.value })}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
        </div>
        <div className="sm:col-span-4">
          <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block">Jumlah</label>
          <div className="relative">
            <span className="absolute left-1.5 top-1.5 text-slate-300 text-[9px]">Rp</span>
            <input
              type="text"
              value={formatCurrency(payment.amount)}
              onChange={handleAmountChange}
              className="w-full pl-5 pr-1 py-1.5 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>
        </div>
      </div>
      <div className="w-full sm:col-span-1 text-right mt-2 sm:mt-0">
        <button onClick={() => onDelete(payment.id)} className="text-rose-500 sm:text-slate-200 sm:hover:text-red-500 p-2 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all bg-rose-50 sm:bg-transparent rounded-lg">
          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
};
