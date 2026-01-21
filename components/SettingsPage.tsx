
import React, { useState } from 'react';
import { HotelSettings } from '../types';
import { uploadAsset } from '../services/supabaseService';

interface Props {
  settings: HotelSettings;
  onSave: (settings: HotelSettings) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onSave }) => {
  const [formData, setFormData] = React.useState<HotelSettings>(settings);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    alert('Pengaturan berhasil diperbarui!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'signature' | 'stamp' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(field);
      
      // Jika data supabase sudah ada, upload ke storage
      if (formData.supabaseUrl && formData.supabaseAnonKey) {
        const publicUrl = await uploadAsset(file, formData, field);
        if (publicUrl) {
          if (field === 'logo') {
            setFormData({ ...formData, logo: publicUrl, stamp: publicUrl });
          } else {
            setFormData({ ...formData, [field]: publicUrl });
          }
        }
      } else {
        // Fallback ke Base64 jika belum setting supabase
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (field === 'logo') {
            setFormData({ ...formData, logo: result, stamp: result });
          } else {
            setFormData({ ...formData, [field]: result });
          }
        };
        reader.readAsDataURL(file);
      }
      setIsUploading(null);
    }
  };

  const resetToLocalDefault = () => {
    if (confirm('Gunakan logo default dari folder lokal (logo.png)?')) {
      setFormData({ ...formData, logo: './logo.png', stamp: './logo.png' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-bold text-slate-800">Profil Hotel & Sinkronisasi</h2>
          <p className="text-slate-500">Sesuaikan identitas hotel dan konfigurasi database Supabase.</p>
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
                rows={2}
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                Logo & Verifikasi Cloud
              </h3>
              <button 
                type="button" 
                onClick={resetToLocalDefault}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all"
              >
                Gunakan logo.png Lokal
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Logo Hotel</label>
                  <div className="relative group">
                    <div className="w-full h-32 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center overflow-hidden bg-indigo-50/30 group-hover:border-indigo-400 transition-all">
                      {isUploading === 'logo' ? (
                        <div className="animate-pulse text-indigo-500 font-bold text-xs">Uploading...</div>
                      ) : formData.logo ? (
                        <img src={formData.logo} className="w-full h-full object-contain" alt="Logo" />
                      ) : (
                        <div className="text-center p-4">
                          <svg className="w-8 h-8 text-indigo-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-[10px] text-indigo-400 font-bold">Pilih Logo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={isUploading !== null} />
                  </div>
                  <p className="mt-2 text-[9px] text-slate-400 italic">Disimpan otomatis di bucket 'hotel-assets'</p>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanda Tangan</label>
                  <div className="relative group">
                    <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50 group-hover:border-indigo-300 transition-all">
                      {isUploading === 'signature' ? (
                        <div className="animate-pulse text-indigo-500 font-bold text-xs">Uploading...</div>
                      ) : formData.signature ? (
                        <img src={formData.signature} className="w-full h-full object-contain" alt="Signature" />
                      ) : (
                        <span className="text-[10px] text-slate-400">Pilih File</span>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={isUploading !== null} />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cap Hotel</label>
                  <div className="relative group">
                    <div className="w-full h-32 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50 shadow-inner">
                      {formData.stamp ? (
                        <img src={formData.stamp} className="w-full h-full object-contain opacity-60 grayscale-[0.5]" alt="Stamp" />
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Otomatis dari Logo</span>
                      )}
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/></svg>
              Supabase Configuration
            </h3>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Supabase Project URL</label>
                <input
                  type="url"
                  value={formData.supabaseUrl || ''}
                  onChange={(e) => setFormData({...formData, supabaseUrl: e.target.value})}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Supabase Anon Key</label>
                <input
                  type="password"
                  value={formData.supabaseAnonKey || ''}
                  onChange={(e) => setFormData({...formData, supabaseAnonKey: e.target.value})}
                  placeholder="your-anon-key"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-sm"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium uppercase tracking-wider">
                Konfigurasi ini diperlukan untuk mengunggah gambar ke Storage dan sinkronisasi data.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
