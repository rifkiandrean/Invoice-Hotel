
import React, { useState, useEffect } from 'react';
import { HotelSettings, UserProfile, UserRole } from '../types';
import { 
  uploadAsset, 
  fetchProfiles, 
  signUpNewUser, 
  upsertProfile,
  deleteProfile,
  fetchInvoicesFromFirebase 
} from '../services/firebaseService';
import * as XLSX from 'xlsx';
import { HOTEL_INFO } from '../constants';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'backup'>('profile');
  const [formData, setFormData] = React.useState<HotelSettings>(settings);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  
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
    if (!newUser.email) return;
    setIsCreatingUser(true);
    try {
      const emailLower = newUser.email.trim().toLowerCase();
      // Use email as document ID placeholder or hash if they haven't logged in yet
      const tempId = `google_${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const { error } = await upsertProfile({
        id: tempId,
        email: emailLower,
        role: newUser.role,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert(`Email ${emailLower} berhasil diotorisasi! Staf dapat langsung login dengan akun Google mereka.`);
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
      const { error } = await upsertProfile({ ...profile, role: newRole });
      if (error) {
        alert("Gagal mengubah role: " + error.message);
      } else {
        loadProfiles();
      }
    }
  };

  const handleUpdateSubscription = async (
    userId: string, 
    status: 'active' | 'inactive', 
    date?: string,
    graceDays?: number
  ) => {
    const profile = profiles.find(p => p.id === userId);
    if (profile) {
      const updates: Partial<UserProfile> = { 
        subscription_status: status,
        updated_at: new Date().toISOString()
      };
      if (date !== undefined) {
        // If date is in YYYY-MM-DD format from HTML input, set to end of that day (23:59:59)
        const dateObj = date.includes('T') ? new Date(date) : new Date(`${date}T23:59:59.999Z`);
        updates.subscription_end_date = isNaN(dateObj.getTime()) ? date : dateObj.toISOString();
      }
      if (graceDays !== undefined) updates.grace_period_days = graceDays;
      
      try {
        const { error } = await upsertProfile({ ...profile, ...updates });
        if (error) {
          console.error("Error updating subscription:", error);
          alert("Gagal memperbarui subscription: " + error.message);
        } else {
          loadProfiles();
        }
      } catch (err) {
        console.error("Error updating subscription:", err);
        alert("Terjadi kesalahan saat memperbarui subscription.");
      }
    }
  };

  const handleExtendMonthly = async (userId: string, monthsToAdd: number = 1) => {
    const profile = profiles.find(p => p.id === userId);
    if (!profile) return;

    const baseDate = profile.subscription_end_date && new Date(profile.subscription_end_date) > new Date()
      ? new Date(profile.subscription_end_date)
      : new Date();
    
    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

    await handleUpdateSubscription(userId, 'active', newEnd.toISOString(), profile.grace_period_days ?? 3);
  };

  const handleDeleteAccount = async (profile: UserProfile) => {
    const emailLower = profile.email.toLowerCase();
    if (emailLower === MASTER_ADMIN) {
      alert("Akun MASTER (" + MASTER_ADMIN + ") dilindungi dan tidak dapat dihapus!");
      return;
    }

    const confirmDelete = confirm(
      `Apakah Anda yakin ingin MENGHAPUS AKUN "${profile.email}"?\n\nPengguna ini tidak akan dapat login lagi dan hak aksesnya akan dicabut permanen.`
    );
    if (!confirmDelete) return;

    try {
      const success = await deleteProfile(profile.id);
      if (success) {
        alert(`Akun "${profile.email}" berhasil dihapus.`);
        loadProfiles();
      } else {
        alert(`Gagal menghapus akun. Pastikan Anda memiliki hak akses.`);
      }
    } catch (err: any) {
      console.error("Delete account error:", err);
      alert("Terjadi kesalahan saat menghapus akun: " + (err.message || ''));
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

  const handleExportToExcel = async () => {
    setIsExporting(true);
    setExportStatus('Mengambil data dari database...');
    try {
      // 1. Fetch Invoices from Firebase
      const invoices = await fetchInvoicesFromFirebase();
      setExportStatus(`Memproses ${invoices.length} data tagihan...`);

      // 2. Prepare Invoices Sheet Data
      const invoiceRows = invoices.map(inv => {
        const subtotal = inv.items?.reduce((sum, item) => sum + (item.quantity * item.nights * item.unitPrice), 0) || 0;
        const total = subtotal - (inv.discount || 0);
        const paymentsTotal = inv.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const balance = total - paymentsTotal;

        return {
          'No. Invoice': inv.invoiceNumber,
          'Kategori': inv.category === 'villa' ? 'Villa' : 'Hotel',
          'Tanggal': inv.date,
          'Status': inv.status?.toUpperCase() || 'DRAFT',
          'Nama Tamu': inv.guest?.name || '-',
          'Perusahaan': inv.guest?.company || '-',
          'Email Tamu': inv.guest?.email || '-',
          'No. HP Tamu': inv.guest?.phone || '-',
          'No. Kamar': inv.stay?.roomNumber || '-',
          'Tipe Kamar': inv.stay?.roomType || '-',
          'Tipe Tamu': inv.stay?.guestType || '-',
          'Check-In': inv.stay?.checkIn || '-',
          'Check-Out': inv.stay?.checkOut || '-',
          'Jumlah Tamu': inv.stay?.guestsCount || 1,
          'Subtotal (Rp)': subtotal,
          'Diskon (Rp)': inv.discount || 0,
          'Total Tagihan (Rp)': total,
          'Total Pembayaran (Rp)': paymentsTotal,
          'Sisa Tagihan (Rp)': balance,
          'Kasir': inv.cashierName || '-',
          'Catatan': inv.notes || '',
          'Remarks': inv.remarks || ''
        };
      });

      // 3. Prepare Item Details Sheet Data
      const itemRows: any[] = [];
      invoices.forEach(inv => {
        (inv.items || []).forEach((item, idx) => {
          itemRows.push({
            'No. Invoice': inv.invoiceNumber,
            'Kategori': inv.category === 'villa' ? 'Villa' : 'Hotel',
            'Item #': idx + 1,
            'Tanggal': item.date,
            'Deskripsi': item.description,
            'Jumlah': item.quantity,
            'Malam': item.nights,
            'Harga Satuan (Rp)': item.unitPrice,
            'Total (Rp)': item.total
          });
        });
      });

      // 4. Prepare Payment History Sheet Data
      const paymentRows: any[] = [];
      invoices.forEach(inv => {
        (inv.payments || []).forEach((pay, idx) => {
          paymentRows.push({
            'No. Invoice': inv.invoiceNumber,
            'Pembayaran #': idx + 1,
            'Tanggal': pay.date,
            'Metode': pay.method,
            'Jumlah (Rp)': pay.amount
          });
        });
      });

      // 5. Build Workbook
      setExportStatus('Menyusun file Excel (.xlsx)...');
      const workbook = XLSX.utils.book_new();

      const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
      XLSX.utils.book_append_sheet(workbook, wsInvoices, 'Daftar Invoice');

      if (itemRows.length > 0) {
        const wsItems = XLSX.utils.json_to_sheet(itemRows);
        XLSX.utils.book_append_sheet(workbook, wsItems, 'Rincian Item');
      }

      if (paymentRows.length > 0) {
        const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
        XLSX.utils.book_append_sheet(workbook, wsPayments, 'Riwayat Pembayaran');
      }

      // 6. Generate filename with timestamp and trigger download
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Backup_Data_HotelFlow_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setExportStatus(null);
      alert(`Backup berhasil diekspor! File "${fileName}" siap diunduh.`);
    } catch (e: any) {
      console.error("Export error:", e);
      alert('Gagal mengekspor file Excel: ' + (e.message || 'Terjadi kesalahan'));
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  };

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
          {canManageAccounts && (
            <button 
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'backup' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
            >
              Backup File Excel 📊
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
        ) : activeTab === 'accounts' ? (
          <div className="p-8 space-y-8 animate-fade-in">
            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Otorisasi Akun Google Staf Baru
              </h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Akun Google</label>
                  <input 
                    type="email" 
                    value={newUser.email} 
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    placeholder="staf@gmail.com"
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
                    {isCreatingUser ? 'Menyimpan...' : 'Otorisasi Akun'}
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
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Ganti Role</th>
                        {canManageSubscriptions && (
                          <>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Status</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Tgl Jatuh Tempo</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Toleransi (Hari)</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Aksi Langganan</th>
                          </>
                        )}
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profiles.map(profile => {
                        const emailLower = profile.email.toLowerCase();
                        const isMasterAdmin = emailLower === MASTER_ADMIN;
                        const isLockedAccount = LOCKED_ACCOUNTS.hasOwnProperty(emailLower);
                        const isLockedRole = LOCKED_ACCOUNTS[emailLower] || isMasterAdmin;

                        const now = new Date();
                        const endDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;
                        const graceDays = profile.grace_period_days ?? 3;
                        let finalDeadline: Date | null = null;
                        if (endDate) {
                          finalDeadline = new Date(endDate);
                          finalDeadline.setDate(finalDeadline.getDate() + graceDays);
                        }

                        const isPastEnd = endDate ? now > endDate : true;
                        const isPastGrace = finalDeadline ? now > finalDeadline : true;
                        const isInGrace = isPastEnd && !isPastGrace;

                        return (
                          <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 font-medium text-slate-700">
                              <div>{profile.email}</div>
                              {isMasterAdmin && <span className="text-[9px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">MASTER</span>}
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
                                className={`text-[10px] font-bold border border-slate-200 rounded px-2 py-1.5 outline-none bg-white w-28 ${!!isLockedRole ? 'opacity-50 cursor-not-allowed text-slate-400 bg-slate-100' : 'text-slate-600 hover:border-indigo-300'}`}
                              >
                                {!!isLockedRole ? (
                                   <option value={profile.role}>Fixed</option>
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
                                    <div className="flex flex-col gap-1">
                                      <select 
                                        value={profile.subscription_status || 'inactive'} 
                                        onChange={(e) => handleUpdateSubscription(profile.id, e.target.value as 'active' | 'inactive')}
                                        className={`text-[10px] font-bold border rounded px-2 py-1 outline-none w-24 uppercase transition-colors ${
                                          profile.subscription_status === 'active' 
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                                            : 'border-rose-200 bg-rose-50 text-rose-700'
                                        }`}
                                      >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                      </select>
                                      {isInGrace && (
                                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse text-center">
                                          TOLERANSI
                                        </span>
                                      )}
                                      {isPastGrace && profile.subscription_status === 'active' && (
                                        <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-center">
                                          EXPIRED
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                      <span className="text-[10px] font-black text-emerald-700">LIFETIME</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {!isMasterAdmin ? (
                                    <div className="flex flex-col gap-0.5">
                                      <input 
                                        type="date"
                                        value={profile.subscription_end_date ? new Date(profile.subscription_end_date).toISOString().split('T')[0] : ''}
                                        onChange={(e) => handleUpdateSubscription(profile.id, profile.subscription_status || 'inactive', e.target.value, profile.grace_period_days)}
                                        className="text-[10px] border border-slate-200 rounded px-2 py-1 w-32 text-slate-600 focus:border-indigo-500 outline-none"
                                      />
                                      {finalDeadline && (
                                        <span className="text-[9px] text-slate-400">
                                          Batas: {finalDeadline.toISOString().split('T')[0]}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">∞</span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {!isMasterAdmin ? (
                                    <select
                                      value={profile.grace_period_days ?? 3}
                                      onChange={(e) => handleUpdateSubscription(
                                        profile.id, 
                                        profile.subscription_status || 'inactive', 
                                        profile.subscription_end_date, 
                                        parseInt(e.target.value, 10)
                                      )}
                                      className="text-[10px] font-bold border border-slate-200 rounded px-2 py-1 outline-none bg-white text-slate-700"
                                    >
                                      <option value={0}>0 Hari (Langsung Blokir)</option>
                                      <option value={1}>1 Hari</option>
                                      <option value={3}>3 Hari (Standar)</option>
                                      <option value={5}>5 Hari</option>
                                      <option value={7}>7 Hari (1 Minggu)</option>
                                      <option value={14}>14 Hari</option>
                                    </select>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {!isMasterAdmin ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleExtendMonthly(profile.id, 1)}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded border border-indigo-200 transition-all active:scale-95"
                                        title="Perpanjang 1 Bulan"
                                      >
                                        +1 Bulan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleExtendMonthly(profile.id, 12)}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200 transition-all active:scale-95"
                                        title="Perpanjang 1 Tahun"
                                      >
                                        +1 Thn
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-bold">Aktif Permanen</span>
                                  )}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-4 text-center">
                              {!isMasterAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAccount(profile)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Hapus Akun Ini"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-mono" title="Master Admin tidak dapat dihapus">🔒</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </section>
          </div>
        ) : (
          <div className="p-8 space-y-6 animate-fade-in">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-900">Backup Data Tagihan ke File Excel (.xlsx)</h3>
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    Unduh seluruh arsip data operasional hotel dan villa Anda ke dalam satu file Microsoft Excel yang rapi, terstruktur, dan siap dibuka di Excel / Google Sheets.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Struktur Lembar Kerja (Worksheet)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold mb-2">1</div>
                  <span className="font-bold text-slate-800 block text-sm">Daftar Invoice</span>
                  <p className="text-[11px] text-slate-500 mt-1">Nomor invoice, data tamu, kamar, tanggal, total transaksi, pembayaran, dan sisa saldo.</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold mb-2">2</div>
                  <span className="font-bold text-slate-800 block text-sm">Rincian Item</span>
                  <p className="text-[11px] text-slate-500 mt-1">Breakdown item tagihan per baris: kamar, extra bed, room service, quantity, dan tarif.</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center font-bold mb-2">3</div>
                  <span className="font-bold text-slate-800 block text-sm">Riwayat Pembayaran</span>
                  <p className="text-[11px] text-slate-500 mt-1">Catatan tanggal, nominal bayar, dan metode pembayaran (Cash, Transfer, EDC, dll).</p>
                </div>
              </div>

              {exportStatus && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full"></div>
                  <span className="font-medium">{exportStatus}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={isExporting}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 text-sm"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Sedang Membuat File Excel...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Backup Excel (.xlsx)
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-400 italic">
                  Data diambil secara real-time langsung dari database cloud.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
