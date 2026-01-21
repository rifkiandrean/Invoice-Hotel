
import React from 'react';
import { InvoiceItem } from '../types';
import { ROOM_DESCRIPTIONS } from '../constants';

interface Props {
  item: InvoiceItem;
  onUpdate: (id: string, updates: Partial<InvoiceItem>) => void;
  onDelete: (id: string) => void;
}

export const InvoiceItemRow: React.FC<Props> = ({ item, onUpdate, onDelete }) => {
  const datalistId = `desc-options-${item.id}`;
  const formatCurrency = (val: number) => val.toLocaleString('id-ID');

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onUpdate(item.id, { unitPrice: parseInt(rawValue, 10) || 0 });
  };

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center mb-4 sm:mb-2 group bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-slate-100">
      <div className="w-full sm:col-span-4 relative">
        <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block">Deskripsi Layanan</label>
        <input
          type="text"
          list={datalistId}
          value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })}
          placeholder="Layanan"
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
        />
        <datalist id={datalistId}>
          {ROOM_DESCRIPTIONS.map((desc) => <option key={desc} value={desc} />)}
        </datalist>
      </div>
      <div className="w-full grid grid-cols-3 sm:contents gap-2">
        <div className="sm:col-span-1">
          <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block text-center">Qty</label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, { quantity: Number(e.target.value) })}
            className="w-full px-1 py-1.5 border border-slate-200 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            min="1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block text-center">Nights</label>
          <input
            type="number"
            value={item.nights}
            onChange={(e) => onUpdate(item.id, { nights: Number(e.target.value) })}
            className="w-full px-1 py-1.5 border border-slate-200 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            min="1"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="sm:hidden text-[8px] font-bold text-slate-400 uppercase mb-1 block text-right">Harga Unit</label>
          <div className="relative">
            <span className="absolute left-1.5 top-1.5 text-slate-300 text-[9px]">Rp</span>
            <input
              type="text"
              value={formatCurrency(item.unitPrice)}
              onChange={handlePriceChange}
              className="w-full pl-5 pr-1 py-1.5 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>
        </div>
      </div>
      <div className="w-full flex justify-between sm:contents mt-2 sm:mt-0 items-center">
        <div className="sm:col-span-3 text-right font-bold text-slate-700 text-xs flex-1">
          <span className="sm:hidden text-slate-400 font-normal mr-2">Total:</span>
          Rp {formatCurrency(item.quantity * item.nights * item.unitPrice)}
        </div>
        <div className="sm:col-span-1 text-right ml-2">
          <button onClick={() => onDelete(item.id)} className="text-rose-500 sm:text-slate-200 sm:hover:text-red-500 p-2 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all bg-rose-50 sm:bg-transparent rounded-lg">
            <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
