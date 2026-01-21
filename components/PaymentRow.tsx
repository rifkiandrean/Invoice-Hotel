
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
    <div className="grid grid-cols-12 gap-2 items-center mb-2 group">
      <div className="col-span-3">
        <input
          type="date"
          value={payment.date}
          onChange={(e) => onUpdate(payment.id, { date: e.target.value })}
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
        />
      </div>
      <div className="col-span-4">
        <select
          value={payment.method}
          onChange={(e) => onUpdate(payment.id, { method: e.target.value })}
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
        >
          {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
      </div>
      <div className="col-span-4">
        <div className="relative">
          <span className="absolute left-1.5 top-1.5 text-slate-300 text-[9px]">Rp</span>
          <input
            type="text"
            value={formatCurrency(payment.amount)}
            onChange={handleAmountChange}
            className="w-full pl-5 pr-1 py-1.5 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>
      <div className="col-span-1 text-right">
        <button onClick={() => onDelete(payment.id)} className="text-slate-200 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
};
