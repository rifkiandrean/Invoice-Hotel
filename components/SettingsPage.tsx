
import React from 'react';
import { HotelSettings } from '../types';

interface Props {
  settings: HotelSettings;
  onSave: (settings: HotelSettings) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onSave }) => {
  const [formData, setFormData] = React.useState<HotelSettings>(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    alert('Pengaturan profil hotel berhasil diperbarui!');
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-bold text-slate-800">Profil Hotel & Sinkronisasi</h2>
          <p className="text-slate-500">Sesuaikan identitas hotel yang akan muncul pada setiap invoice.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Hotel</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                required
              />
            </div>

            <div className="col-span-full">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Alamat Lengkap</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor Telepon</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Bisnis</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19,3H5C3.89,3 3,3.9 3,5V19C3,20.1 3.89,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M19,19H5V5H19V19M16.7,9.3L15.3,7.9L10.7,12.5L8.7,10.5L7.3,11.9L10.7,15.3L16.7,9.3Z"/></svg>
              Cloud Spreadsheet Integration
            </h3>
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
              <label className="block text-sm font-semibold text-emerald-800 mb-2">Google Apps Script Web App URL</label>
              <input
                type="url"
                value={formData.googleSheetUrl || ''}
                onChange={(e) => setFormData({...formData, googleSheetUrl: e.target.value})}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-3 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
              />
              <p className="mt-3 text-[10px] text-emerald-600 leading-relaxed font-medium uppercase tracking-wider">
                Sistem akan menyinkronkan data invoice secara otomatis ke database cloud Anda.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              Simpan Perubahan Profil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
