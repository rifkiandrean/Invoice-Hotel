
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
      // Validasi konfigurasi Supabase sebelum upload
      if (!formData.supabaseUrl || !formData.supabaseAnonKey) {
        alert('Mohon lengkapi konfigurasi Supabase Project URL dan Anon Key terlebih dahulu sebelum mengunggah gambar.');
        return;
      }

      setIsUploading(field);
      
      try {
        const publicUrl = await uploadAsset(file, formData, field);
        if (publicUrl) {
          if (field === 'logo') {
            // Set logo dan otomatis update stamp jika logo diubah
            setFormData({ ...formData, logo: publicUrl, stamp: publicUrl });
          } else {
            setFormData({ ...formData, [field]: publicUrl });
          }
        }
      } catch (error) {
        console.error("Upload error:", error);
      } finally {
        setIsUploading(null);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-bold text-slate-800">Profil Hotel & Sinkronisasi Cloud</h2>
          <p className="text-slate-500">Sesuaikan identitas hotel. Semua aset (Logo/TTD) akan disimpan secara permanen di Supabase Storage.</p>
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
                Media & Aset Digital
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Logo Hotel</label>
                  <div className="relative group">
                    <div className="w-full h-32 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center overflow-hidden bg-indigo-50/30 group-hover:border-indigo-400 transition-all">
                      {isUploading === 'logo' ? (
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full mb-2"></div>
                          <span className="text-indigo-500 font-bold text-[10px]">Uploading...</span>
                        </div>
                      ) : formData.logo ? (
                        <img src={formData.logo} className="w-full h-full object-contain" alt="Logo" />
                      ) : (
                        <div className="text-center p-4">
                          <svg className="w-8 h-8 text-indigo-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Klik Unggah</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, 'logo')} 
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                      disabled={isUploading !== null} 
                    />
                  </div>
                  <p className="mt-2 text-[9px] text-slate-400 italic">Format: PNG/JPG (Cloud Storage)</p>
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
                        <div className="text-center">
                          <svg className="w-6 h-6 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Unggah TTD</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, 'signature')} 
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                      disabled={isUploading !== null} 
                    />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Pratinjau Cap</label>
                  <div className="relative">
                    <div className="w-full h-32 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50 shadow-inner">
                      {formData.stamp ? (
                        <img src={formData.stamp} className="w-full h-full object-contain opacity-60 grayscale-[0.5] rotate-[-5deg]" alt="Stamp" />
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
              Konfigurasi Supabase
            </h3>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4 shadow-inner">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Supabase Project URL</label>
                <input
                  type="url"
                  value={formData.supabaseUrl || ''}
                  onChange={(e) => setFormData({...formData, supabaseUrl: e.target.value})}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Supabase Anon Key</label>
                <input
                  type="password"
                  value={formData.supabaseAnonKey || ''}
                  onChange={(e) => setFormData({...formData, supabaseAnonKey: e.target.value})}
                  placeholder="your-anon-key"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-sm"
                />
              </div>
              <div className="flex gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[10px] text-indigo-600 leading-relaxed font-semibold uppercase tracking-wider">
                  Data ini wajib diisi agar sistem dapat mengunggah media ke bucket 'hotel-assets'.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              Update Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
