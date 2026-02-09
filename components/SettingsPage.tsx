
import React, { useState, useEffect } from 'react';
import { HotelSettings, UserProfile, UserRole } from '../types';
import { uploadAsset, fetchProfiles, signUpNewUser, upsertProfile } from '../services/supabaseService';

interface Props {
  settings: HotelSettings;
  onSave: (settings: HotelSettings) => void;
  currentUserRole?: UserRole;
}

// Configuration for Special Accounts
const MASTER_ADMIN = 'rifkiandrean@gmail.com';
const LOCKED_ACCOUNTS: Record<string, UserRole> = {
  'rifkiandrean@gmail.com': 'super-admin',
  'hotelpangandaranblueorchid@gmail.com': 'receptionist'
};

export const SettingsPage: React.FC<Props> = ({ settings, onSave, currentUserRole }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts'>('profile');
  const [formData, setFormData] = React.useState<HotelSettings>(settings);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  
  // Account Management States
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'receptionist' as UserRole });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Sync local form state when settings prop changes (e.g., after cloud sync)
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (activeTab === 'accounts' && (currentUserRole === 'admin' || currentUserRole === 'super-admin')) {
      loadProfiles();
    }
  }, [activeTab, currentUserRole]);

  const loadProfiles = async () => {
    const data = await fetchProfiles();
    
    const processedData = data.map(p => {
      const emailLower = p.email.toLowerCase();
      
      // Enforce strict roles for specific emails based on LOCKED_ACCOUNTS config
      if (LOCKED_ACCOUNTS[emailLower]) {
        return { 
          ...p, 
          role: LOCKED_ACCOUNTS[emailLower],
          // Master admin always active
          ...(emailLower === MASTER_ADMIN ? { subscription_status: 'active' } : {})
        };
      }
      return p;
    });

    // Sort: Master Admin first, then alphabetical
    processedData.sort((a, b) => {
      if (a.email.toLowerCase() === MASTER_ADMIN) return -1;
      if (b.email.toLowerCase() === MASTER_ADMIN) return 1;
      return a.email.localeCompare(b.email);
    });

    setProfiles(processedData as UserProfile[]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) return;
    setIsCreatingUser(true);
    try {
      const { error } = await signUpNewUser(newUser.email, newUser.password, newUser.role);
      if (error) throw error;
      alert('Akun baru berhasil didaftarkan!');
      setNewUser({ email: '', password: '', role: 'receptionist' });
      loadProfiles();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!confirm(`Ubah role pengguna ini menjadi ${newRole}?`)) return;
    const profile = profiles.find(p => p.id === userId);
    if (profile) {
      await upsertProfile({ ...profile, role: newRole });
      loadProfiles();
    }
  };

  const handleUpdateSubscription = async (userId: string, status: 'active' | 'inactive', date?: string) => {
    const profile = profiles.find(p => p.id === userId);
    if (profile) {
      const updates: Partial<UserProfile> = { subscription_status: status };
      if (date !== undefined) updates.subscription_end_date = date;
      
      await upsertProfile({ ...profile, ...updates });
      loadProfiles();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'signature' | 'stamp' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(field);
      try {
        const publicUrl = await uploadAsset(file, formData, field);
        if (publicUrl) {
          const updatedData = { ...formData, [field]: publicUrl };
          if (field === 'logo') updatedData.stamp = publicUrl;
          setFormData(updatedData);
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert("Gagal mengunggah gambar. Pastikan bucket 'hotel-assets' tersedia.");
      } finally {
        setIsUploading(null);
      }
    }
  };

  const canManageAccounts = currentUserRole === 'admin' || currentUserRole === 'super-admin';
  const canManageSubscriptions = currentUserRole === 'super-admin';

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'profile' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
          >
            Profil Hotel
          </button>
          {canManageAccounts && (
            <button 
              onClick={() => setActiveTab('accounts')}
              className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'accounts' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
            >
              Manajemen Akun
            </button>
          )}
        </div>

        {activeTab === 'profile' ? (
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

              <div className="col-span-full">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor Rekening Hotel</label>
                <input
                  type="text"
                  value={formData.bankInfo || ''}
                  placeholder="Contoh: Bank BCA - 1234567890 a/n BLUE ORCHID"
                  onChange={(e) => setFormData({...formData, bankInfo: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {canManageAccounts && (
                <div className="col-span-full border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Keamanan Akses Settings
                  </h3>
                  <div className="max-w-xs">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">PIN Akses (4 Digit)</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="1234"
                      value={formData.settingsPin || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({...formData, settingsPin: val});
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-mono font-bold tracking-[0.5em]"
                    />
                    <p className="mt-2 text-[10px] text-slate-400 italic">PIN ini digunakan untuk membuka halaman Pengaturan.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                Media & Aset Digital
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Logo Hotel</label>
                    <div className="relative group">
                      <div className="w-full h-32 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center overflow-hidden bg-indigo-50/30 group-hover:border-indigo-400 transition-all">
                        {isUploading === 'logo' ? (
                          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        ) : formData.logo ? (
                          <img src={formData.logo} className="w-full h-full object-contain" alt="Logo" />
                        ) : (
                          <span className="text-[10px] text-indigo-400 font-bold uppercase">Unggah</span>
                        )}
                      </div>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading !== null} />
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanda Tangan</label>
                    <div className="relative group">
                      <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50 group-hover:border-indigo-300 transition-all">
                        {isUploading === 'signature' ? (
                          <div className="animate-pulse text-indigo-500 font-bold text-xs">...</div>
                        ) : formData.signature ? (
                          <img src={formData.signature} className="w-full h-full object-contain" alt="Signature" />
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Unggah</span>
                        )}
                      </div>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading !== null} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Pratinjau Cap</label>
                    <div className="w-full h-32 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50">
                      {formData.stamp ? (
                        <img src={formData.stamp} className="w-full h-full object-contain opacity-60 grayscale-[0.5] rotate-[-5deg]" alt="Stamp" />
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Otomatis dari Logo</span>
                      )}
                    </div>
                 </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Update Profil Hotel</button>
            </div>
          </form>
        ) : (
          <div className="p-8 space-y-8 animate-fade-in">
            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Tambah Akun Staf Baru
              </h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Staf</label>
                  <input 
                    type="email" 
                    value={newUser.email} 
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    placeholder="email@hotel.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                  <input 
                    type="password" 
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role Jabatan</label>
                  <select 
                    value={newUser.role} 
                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    type="submit" 
                    disabled={isCreatingUser}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isCreatingUser ? 'Mendaftarkan...' : 'Daftar Akun'}
                  </button>
                </div>
              </form>
            </section>

            <section>
               <h3 className="text-lg font-bold text-slate-800 mb-4">Daftar Akun Terdaftar</h3>
               <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm text-[11px] text-slate-400 mb-2 p-2 bg-slate-50 flex gap-2 items-center">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Subscription hanya dikelola oleh <strong>{MASTER_ADMIN}</strong>.
               </div>
               <div className="border border-slate-200 rounded-2xl overflow-auto shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">User Email</th>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Role</th>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Change Role</th>
                        {canManageSubscriptions && (
                          <>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Subscription Status</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Expiry Date</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profiles.map(profile => {
                        const emailLower = profile.email.toLowerCase();
                        const isMasterAdmin = emailLower === MASTER_ADMIN;
                        const isLockedAccount = LOCKED_ACCOUNTS.hasOwnProperty(emailLower);
                        const isLockedRole = LOCKED_ACCOUNTS[emailLower] || isMasterAdmin;

                        return (
                          <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 font-medium text-slate-700">
                              {profile.email}
                              {isMasterAdmin && <span className="ml-2 text-[9px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">MASTER</span>}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                profile.role === 'super-admin' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                profile.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 
                                profile.role === 'manager' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {profile.role.replace('-', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <select 
                                onChange={(e) => handleChangeRole(profile.id, e.target.value as UserRole)}
                                value={profile.role}
                                disabled={!!isLockedRole}
                                className={`text-[10px] font-bold border border-slate-200 rounded px-2 py-1.5 outline-none bg-white w-32 ${!!isLockedRole ? 'opacity-50 cursor-not-allowed text-slate-400 bg-slate-100' : 'text-slate-600 hover:border-indigo-300'}`}
                              >
                                {!!isLockedRole ? (
                                   <option value={profile.role}>Fixed Role</option>
                                ) : (
                                  <>
                                    <option value="receptionist">Receptionist</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                  </>
                                )}
                              </select>
                            </td>
                            {canManageSubscriptions && (
                              <>
                                <td className="px-4 py-4">
                                  {!isMasterAdmin ? (
                                    <select 
                                      value={profile.subscription_status || 'inactive'} 
                                      onChange={(e) => handleUpdateSubscription(profile.id, e.target.value as 'active' | 'inactive')}
                                      className={`text-[10px] font-bold border rounded px-2 py-1.5 outline-none w-28 uppercase transition-colors ${
                                        profile.subscription_status === 'active' 
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                                          : 'border-rose-200 bg-rose-50 text-rose-700'
                                      }`}
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                      <span className="text-[10px] font-black text-emerald-700">LIFETIME</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {!isMasterAdmin ? (
                                    <input 
                                      type="date"
                                      value={profile.subscription_end_date ? new Date(profile.subscription_end_date).toISOString().split('T')[0] : ''}
                                      onChange={(e) => handleUpdateSubscription(profile.id, profile.subscription_status || 'inactive', e.target.value)}
                                      className="text-[10px] border border-slate-200 rounded px-2 py-1.5 w-32 text-slate-600 focus:border-indigo-500 outline-none"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">∞</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
