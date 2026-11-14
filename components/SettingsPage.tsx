
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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HOTEL_INFO } from '../constants';
import { SubscriptionBillingModal, InvoiceStatsSummary } from './SubscriptionBillingModal';

interface Props {
  settings: HotelSettings;
  onSave: (settings: HotelSettings) => void;
  currentUserRole?: UserRole;
  onCurrentUserProfileUpdated?: (profile: UserProfile) => void;
}

// Configuration for Special Accounts
const MASTER_ADMIN = 'rifkiandrean@gmail.com';
const LOCKED_ACCOUNTS: Record<string, UserRole> = {
  'rifkiandrean@gmail.com': 'super-admin',
  'hotelpangandaranblueorchid@gmail.com': 'receptionist'
};

const SESSION_HOUR_PRESETS = [1, 2, 4, 6, 8, 12, 24, 48, 72, 168];

export const SettingsPage: React.FC<Props> = ({ settings, onSave, currentUserRole, onCurrentUserProfileUpdated }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'backup'>('profile');
  const [formData, setFormData] = React.useState<HotelSettings>(settings);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  
  // Account Management States
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'receptionist' as UserRole,
    session_duration_hours: 24
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [customSessionEdit, setCustomSessionEdit] = useState<{ id: string; hours: string } | null>(null);

  // Billing & Invoice Stats States
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStatsSummary>({
    totalInvoices: 0,
    totalItems: 0,
    hotelInvoices: 0,
    villaInvoices: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [billingProfile, setBillingProfile] = useState<UserProfile | null>(null);

  // Sync local form state when settings prop changes (e.g., after cloud sync)
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const loadInvoiceStats = async () => {
    setIsLoadingStats(true);
    try {
      const allInvoices = await fetchInvoicesFromFirebase();
      const totalInvoices = allInvoices.length;
      const totalItems = allInvoices.reduce((sum, inv) => sum + (inv.items?.length || 0), 0);
      const hotelInvoices = allInvoices.filter(inv => (inv.category || 'hotel') === 'hotel').length;
      const villaInvoices = allInvoices.filter(inv => inv.category === 'villa').length;
      setInvoiceStats({ totalInvoices, totalItems, hotelInvoices, villaInvoices });
    } catch (err) {
      console.error('Error fetching invoice stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accounts' && (currentUserRole === 'admin' || currentUserRole === 'super-admin')) {
      loadProfiles();
      loadInvoiceStats();
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
        session_duration_hours: newUser.session_duration_hours || 24,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert(`Email ${emailLower} berhasil diotorisasi! Staf dapat langsung login dengan akun Google mereka.`);
      setNewUser({ email: '', password: '', role: 'receptionist', session_duration_hours: 24 });
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
      const updated = { ...profile, role: newRole };
      const { error } = await upsertProfile(updated);
      if (error) {
        alert("Gagal mengubah role: " + error.message);
      } else {
        onCurrentUserProfileUpdated?.(updated);
        loadProfiles();
      }
    }
  };

  const handleChangeSessionDuration = async (userId: string, hours: number) => {
    const clampedHours = Math.max(1, Math.min(720, Math.round(hours)));
    const profile = profiles.find(p => p.id === userId);
    if (!profile) return;

    const updated: UserProfile = {
      ...profile,
      session_duration_hours: clampedHours,
      updated_at: new Date().toISOString()
    };

    const { error } = await upsertProfile(updated);
    if (error) {
      alert("Gagal memperbarui durasi sesi: " + error.message);
    } else {
      setCustomSessionEdit(null);
      onCurrentUserProfileUpdated?.(updated);
      loadProfiles();
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

  const handleExportToPdfFull = async () => {
    setIsExportingPdf(true);
    setExportStatus('Mengambil seluruh data invoice & item dari database...');
    try {
      const allInvoices = await fetchInvoicesFromFirebase();
      const totalItemsCount = allInvoices.reduce((sum, inv) => sum + (inv.items?.length || 0), 0);
      setExportStatus(`Menyusun dokumen PDF (${allInvoices.length} invoice, ${totalItemsCount} item)...`);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 10;
      const contentWidth = pageWidth - marginX * 2;
      const fmt = (n: number) => Math.round(n || 0).toLocaleString('id-ID');

      const grandRevenue = allInvoices
        .filter((i) => i.status !== 'cancelled')
        .reduce((s, inv) => {
          const sub = (inv.items || []).reduce((x, it) => x + (it.quantity || 0) * (it.nights || 0) * (it.unitPrice || 0), 0);
          return s + (sub - (inv.discount || 0));
        }, 0);
      const grandPaid = allInvoices
        .filter((i) => i.status !== 'cancelled')
        .reduce((s, inv) => s + (inv.payments || []).reduce((x, p) => x + (p.amount || 0), 0), 0);
      const grandBalance = Math.max(0, grandRevenue - grandPaid);

      const now = new Date();
      const dateLabel = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeLabel = now.toLocaleTimeString('id-ID');

      // 1. Kop Laporan Backup
      let y = 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(67, 56, 202); // indigo
      doc.text('VELL HOTEL  |  Blue Orchid Hotel', marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Tanggal Ekspor: ${dateLabel}`, pageWidth - marginX, y, { align: 'right' });

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('ARSIP BACKUP FULL DATA & ITEM INVOICE', marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Waktu: ${timeLabel}  |  Penyedia: VELL STUDIO`, pageWidth - marginX, y, { align: 'right' });

      y += 4.5;
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const hotelHeader = `${formData.name || settings.name || 'Blue Orchid Hotel'} - ${formData.address || settings.address || '-'}`;
      const hotelHeaderLines = doc.splitTextToSize(hotelHeader, contentWidth);
      doc.text(hotelHeaderLines, marginX, y);
      y += hotelHeaderLines.length * 3.8 + 1.5;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;

      // 2. Ringkasan Eksekutif
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        head: [['Total Invoice', 'Total Item Invoice', 'Total Tagihan Aktif', 'Total Terbayar', 'Sisa Tagihan']],
        body: [[
          `${allInvoices.length} Dokumen`,
          `${totalItemsCount} Item`,
          `Rp ${fmt(grandRevenue)}`,
          `Rp ${fmt(grandPaid)}`,
          `Rp ${fmt(grandBalance)}`,
        ]],
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [51, 65, 85],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8.5,
          fontStyle: 'bold',
          textColor: [15, 23, 42],
          halign: 'center',
        },
        styles: {
          cellPadding: 2.2,
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
        },
      });

      y = ((doc as any).lastAutoTable?.finalY ?? y + 14) + 6;

      // 3. Bagian 1: Rincian Lengkap Per Invoice & Semua Item
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`BAGIAN 1 - RINCIAN LENGKAP SELURUH INVOICE (${allInvoices.length} Invoice)`, marginX, y);
      y += 2;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;

      if (allInvoices.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Belum ada data invoice tersimpan di database.', marginX, y + 4);
        y += 10;
      }

      const flatItems: {
        invoiceNumber: string;
        category: string;
        guestName: string;
        itemDate: string;
        description: string;
        quantity: number;
        nights: number;
        unitPrice: number;
        total: number;
      }[] = [];

      allInvoices.forEach((inv, invIdx) => {
        const sub = (inv.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.nights || 0) * (it.unitPrice || 0), 0);
        const total = sub - (inv.discount || 0);
        const paid = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
        const balance = total - paid;

        (inv.items || []).forEach((it) => {
          flatItems.push({
            invoiceNumber: inv.invoiceNumber || '-',
            category: inv.category === 'villa' ? 'Villa' : 'Hotel',
            guestName: inv.guest?.name || '-',
            itemDate: it.date || inv.date || '-',
            description: it.description || '-',
            quantity: it.quantity || 0,
            nights: it.nights || 0,
            unitPrice: it.unitPrice || 0,
            total: (it.quantity || 0) * (it.nights || 0) * (it.unitPrice || 0),
          });
        });

        // Pastikan cukup ruang minimal untuk header invoice + info + minimal 1 baris item
        if (y > pageHeight - 52) {
          doc.addPage();
          y = 14;
        }

        const catLabel = inv.category === 'villa' ? 'VILLA' : 'HOTEL';
        const statusLabel = (inv.status || 'draft').toUpperCase();

        // Header bar invoice
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginX, y, contentWidth, 6.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`#${invIdx + 1}  ${inv.invoiceNumber || '-'}  [${catLabel}]  |  Tgl: ${inv.date || '-'}`, marginX + 2.5, y + 4.4);
        doc.setFontSize(7.5);
        doc.setTextColor(67, 56, 202);
        doc.text(`STATUS: ${statusLabel}`, pageWidth - marginX - 2.5, y + 4.4, { align: 'right' });
        y += 6.5;

        // Tabel Info Tamu & Menginap
        autoTable(doc, {
          startY: y,
          margin: { left: marginX, right: marginX },
          theme: 'grid',
          body: [[
            `Tamu: ${inv.guest?.name || '-'}\nPerusahaan: ${inv.guest?.company || '-'}\nHP/Email: ${inv.guest?.phone || '-'} / ${inv.guest?.email || '-'}`,
            `Kamar: ${inv.stay?.roomNumber || '-'} (${inv.stay?.roomType || '-'})\nTipe Tamu: ${inv.stay?.guestType || '-'} (${inv.stay?.guestsCount || 1} org)\nCheck-In/Out: ${inv.stay?.checkIn || '-'} s/d ${inv.stay?.checkOut || '-'}`,
            `Kasir: ${inv.cashierName || '-'}\nTotal: Rp ${fmt(total)}\nTerbayar: Rp ${fmt(paid)} | Sisa: Rp ${fmt(balance)}`,
          ]],
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
            lineColor: [203, 213, 225],
            lineWidth: 0.2,
            valign: 'top',
          },
          columnStyles: {
            0: { cellWidth: contentWidth * 0.35 },
            1: { cellWidth: contentWidth * 0.36 },
            2: { cellWidth: contentWidth * 0.29 },
          },
        });
        y = (doc as any).lastAutoTable?.finalY ?? y + 14;

        // Tabel Item Invoice
        const itemTableRows = (inv.items || []).length === 0
          ? [['-', '-', 'Tidak ada item tercatat.', '-', '-', '-', '-']]
          : (inv.items || []).map((item, idx) => [
              String(idx + 1),
              item.date || '-',
              item.description || '-',
              String(item.quantity ?? 0),
              String(item.nights ?? 0),
              `Rp ${fmt(item.unitPrice || 0)}`,
              `Rp ${fmt((item.quantity || 0) * (item.nights || 0) * (item.unitPrice || 0))}`,
            ]);

        autoTable(doc, {
          startY: y,
          margin: { left: marginX, right: marginX },
          theme: 'grid',
          head: [['No', 'Tanggal', 'Deskripsi Item', 'Qty', 'Mlm', 'Harga Satuan', 'Subtotal']],
          body: itemTableRows,
          headStyles: {
            fillColor: [248, 250, 252],
            textColor: [71, 85, 105],
            fontSize: 7.2,
            fontStyle: 'bold',
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 1.7,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 9 },
            1: { cellWidth: 21 },
            2: { cellWidth: 'auto' },
            3: { halign: 'center', cellWidth: 10 },
            4: { halign: 'center', cellWidth: 10 },
            5: { halign: 'right', cellWidth: 26 },
            6: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
          },
        });
        y = (doc as any).lastAutoTable?.finalY ?? y + 10;

        // Keterangan Diskon, Pembayaran, Catatan, Remarks
        const extraLines: string[] = [];
        if (inv.discount > 0) {
          extraLines.push(`Diskon: -Rp ${fmt(inv.discount)}`);
        }
        if (inv.payments && inv.payments.length > 0) {
          const payText = inv.payments
            .map((p) => `${p.date || '-'} (${p.method}: Rp ${fmt(p.amount)})`)
            .join(' | ');
          extraLines.push(`Riwayat Pembayaran: ${payText}`);
        }
        if (inv.notes) extraLines.push(`Catatan: ${inv.notes}`);
        if (inv.remarks) extraLines.push(`Remarks: ${inv.remarks}`);

        if (extraLines.length > 0) {
          autoTable(doc, {
            startY: y,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            body: [[extraLines.join('\n')]],
            styles: {
              fontSize: 7.2,
              cellPadding: 2,
              fillColor: [248, 250, 252],
              textColor: [71, 85, 105],
              lineColor: [203, 213, 225],
              lineWidth: 0.2,
            },
          });
          y = (doc as any).lastAutoTable?.finalY ?? y + 6;
        }

        y += 4.5;
      });

      // 4. Bagian 2: Rekapitulasi Master Semua Item Invoice (Halaman Baru)
      doc.addPage();
      y = 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`BAGIAN 2 - REKAPITULASI FULL SELURUH ITEM INVOICE (${flatItems.length} Item)`, marginX, y);
      y += 2;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 3.5;

      const grandFlatTotal = flatItems.reduce((s, r) => s + r.total, 0);

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX, bottom: 14 },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        head: [['No', 'No. Invoice', 'Kat', 'Tamu', 'Tgl Item', 'Deskripsi Item', 'Qty', 'Mlm', 'Tarif (Rp)', 'Total (Rp)']],
        body: flatItems.length === 0
          ? [['-', '-', '-', '-', '-', 'Belum ada data item invoice.', '-', '-', '-', '-']]
          : flatItems.map((row, idx) => [
              String(idx + 1),
              row.invoiceNumber,
              row.category,
              row.guestName,
              row.itemDate,
              row.description,
              String(row.quantity),
              String(row.nights),
              fmt(row.unitPrice),
              fmt(row.total),
            ]),
        foot: [[
          '',
          '',
          '',
          '',
          '',
          `GRAND TOTAL SELURUH ITEM (${flatItems.length} ITEM)`,
          '',
          '',
          '',
          `Rp ${fmt(grandFlatTotal)}`,
        ]],
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 7.2,
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontSize: 7.8,
          fontStyle: 'bold',
          halign: 'right',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        styles: {
          fontSize: 7,
          cellPadding: 1.6,
          textColor: [15, 23, 42],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 26, fontStyle: 'bold' },
          2: { halign: 'center', cellWidth: 10 },
          3: { cellWidth: 24 },
          4: { cellWidth: 18 },
          5: { cellWidth: 'auto' },
          6: { halign: 'center', cellWidth: 8 },
          7: { halign: 'center', cellWidth: 8 },
          8: { halign: 'right', cellWidth: 21 },
          9: { halign: 'right', cellWidth: 23, fontStyle: 'bold' },
        },
      });

      // 5. Tambahkan nomor halaman pada setiap halaman
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'VELL HOTEL | Blue Orchid Hotel - Arsip Backup Full Invoice (VELL STUDIO)',
          marginX,
          pageHeight - 5
        );
        doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
      }

      const dateStr = now.toISOString().split('T')[0];
      const fileName = `Backup_Full_Item_Invoice_${dateStr}.pdf`;
      doc.save(fileName);

      setExportStatus(null);
      alert(`Backup PDF lengkap (${allInvoices.length} invoice, ${totalItemsCount} item, ${totalPages} halaman) berhasil diunduh: "${fileName}"`);
    } catch (e: any) {
      console.error('Export PDF error:', e);
      alert('Gagal mengekspor file PDF: ' + (e?.message || 'Terjadi kesalahan'));
    } finally {
      setIsExportingPdf(false);
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
              Backup Data (Excel & PDF) 📊
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
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
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
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Durasi Sesi Login</label>
                  <select
                    value={newUser.session_duration_hours}
                    onChange={e => setNewUser({...newUser, session_duration_hours: parseInt(e.target.value, 10)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value={1}>1 Jam</option>
                    <option value={2}>2 Jam</option>
                    <option value={4}>4 Jam</option>
                    <option value={6}>6 Jam</option>
                    <option value={8}>8 Jam (1 Shift)</option>
                    <option value={12}>12 Jam</option>
                    <option value={24}>24 Jam (1 Hari)</option>
                    <option value={48}>48 Jam (2 Hari)</option>
                    <option value={72}>72 Jam (3 Hari)</option>
                    <option value={168}>168 Jam (7 Hari)</option>
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
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                 <h3 className="text-lg font-bold text-slate-800">Daftar Akun Terdaftar</h3>
                 <div className="flex flex-wrap items-center gap-2 text-[11px]">
                   <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                     Hotel: {formData.name || settings.name}
                   </span>
                   <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                     {isLoadingStats
                       ? 'Menghitung item invoice...'
                       : `${invoiceStats.totalInvoices} Invoice • ${invoiceStats.totalItems} Item Invoice`}
                   </span>
                   <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                     VELL STUDIO: Rp 30.000/bln + Admin Rp 3.000
                   </span>
                 </div>
               </div>
               <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm text-[11px] text-slate-400 mb-2 p-2 bg-slate-50 flex gap-2 items-center">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Subscription hanya dikelola oleh <strong>{MASTER_ADMIN}</strong>. Gunakan tombol <strong>Download Billing</strong> untuk mengunduh tagihan bulanan resmi dari <strong>VELL STUDIO</strong>.
               </div>
               <div className="border border-slate-200 rounded-2xl overflow-auto shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">User Email</th>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Role</th>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Ganti Role</th>
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Durasi Sesi</th>
                        {canManageSubscriptions && (
                          <>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Status</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Tgl Jatuh Tempo</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Toleransi (Hari)</th>
                            <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase">Aksi Langganan</th>
                          </>
                        )}
                        <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase text-center">Billing</th>
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
                            <td className="px-4 py-4">
                              {(() => {
                                const currentHours = profile.session_duration_hours ?? 24;
                                const isCustomEditing = customSessionEdit?.id === profile.id;
                                const isPreset = SESSION_HOUR_PRESETS.includes(currentHours);

                                if (isCustomEditing) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={720}
                                        value={customSessionEdit.hours}
                                        onChange={(e) => setCustomSessionEdit({ id: profile.id, hours: e.target.value })}
                                        className="w-16 text-[10px] font-bold border border-indigo-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Jam"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const parsed = parseInt(customSessionEdit.hours, 10);
                                          if (!isNaN(parsed) && parsed >= 1) {
                                            handleChangeSessionDuration(profile.id, parsed);
                                          } else {
                                            alert('Masukkan durasi sesi minimal 1 jam.');
                                          }
                                        }}
                                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700"
                                        title="Simpan durasi sesi"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCustomSessionEdit(null)}
                                        className="px-1.5 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold hover:bg-slate-200"
                                        title="Batal"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <select
                                    value={currentHours}
                                    onChange={(e) => {
                                      if (e.target.value === 'custom') {
                                        setCustomSessionEdit({ id: profile.id, hours: String(currentHours) });
                                      } else {
                                        handleChangeSessionDuration(profile.id, parseInt(e.target.value, 10));
                                      }
                                    }}
                                    className="text-[10px] font-bold border border-slate-200 rounded px-2 py-1.5 outline-none bg-white text-slate-700 hover:border-indigo-300 w-32"
                                    title="Atur batas waktu sesi login akun ini"
                                  >
                                    {!isPreset && (
                                      <option value={currentHours}>{currentHours} Jam (Custom)</option>
                                    )}
                                    <option value={1}>1 Jam</option>
                                    <option value={2}>2 Jam</option>
                                    <option value={4}>4 Jam</option>
                                    <option value={6}>6 Jam</option>
                                    <option value={8}>8 Jam (1 Shift)</option>
                                    <option value={12}>12 Jam</option>
                                    <option value={24}>24 Jam (1 Hari)</option>
                                    <option value={48}>48 Jam (2 Hari)</option>
                                    <option value={72}>72 Jam (3 Hari)</option>
                                    <option value={168}>168 Jam (7 Hari)</option>
                                    <option value="custom">Custom (Jam)...</option>
                                  </select>
                                );
                              })()}
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
                              <button
                                type="button"
                                onClick={async () => {
                                  setBillingProfile(profile);
                                  await loadInvoiceStats();
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-sm"
                                title="Download Billing Subscription Bulanan (VELL STUDIO)"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download Billing</span>
                              </button>
                            </td>
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
                  <h3 className="text-base font-bold text-emerald-900">Backup Data Tagihan ke Excel (.xlsx) & PDF Full (.pdf)</h3>
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    Unduh seluruh arsip data operasional hotel dan villa Anda ke file Microsoft Excel atau dokumen <strong>PDF Full Semua Data & Item Invoice</strong> yang terstruktur dan siap arsip.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cakupan Data Backup Lengkap</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold mb-2">1</div>
                  <span className="font-bold text-slate-800 block text-sm">Daftar Invoice</span>
                  <p className="text-[11px] text-slate-500 mt-1">Nomor invoice, data tamu, kamar, tanggal, total transaksi, pembayaran, dan sisa saldo.</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold mb-2">2</div>
                  <span className="font-bold text-slate-800 block text-sm">Full Rincian Item</span>
                  <p className="text-[11px] text-slate-500 mt-1">Seluruh item tagihan per baris: kamar, extra bed, room service, quantity, malam, dan tarif.</p>
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

              <div className="pt-2 flex flex-col sm:flex-row flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={isExporting || isExportingPdf}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 text-sm"
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

                <button
                  type="button"
                  onClick={handleExportToPdfFull}
                  disabled={isExporting || isExportingPdf}
                  className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-rose-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 text-sm"
                >
                  {isExportingPdf ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Sedang Membuat File PDF Full...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Download Backup PDF Full (.pdf)
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

      <SubscriptionBillingModal
        isOpen={!!billingProfile}
        onClose={() => setBillingProfile(null)}
        profile={billingProfile}
        hotelSettings={formData}
        invoiceStats={invoiceStats}
      />
    </div>
  );
};
