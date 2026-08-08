import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminCollection,
  saveAdminDocument,
  deleteAdminDocument,
  fetchSystemBackups,
  createSystemBackup,
  restoreSystemBackup,
  deleteSystemBackup,
  triggerAutoHealDatabase,
} from '../../services/api';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Edit3,
  Copy,
  RefreshCw,
  ArrowUpDown,
  X,
  FileText,
  AlertCircle,
  CheckSquare,
  Square,
  Download,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShieldCheck,
  Archive,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminDatabaseTabProps {
  isDarkMode: boolean;
  overview: any;
  showToast: (msg: string) => void;
  setDeleteConfirmItem: (item: any) => void;
  onRefreshOverview: () => void;
}

export const AdminDatabaseTab: React.FC<AdminDatabaseTabProps> = ({
  isDarkMode,
  overview,
  showToast,
  setDeleteConfirmItem,
  onRefreshOverview,
}) => {
  const [selectedCollection, setSelectedCollection] = useState<string>('users');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // System Backup & Security State
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [autoHealing, setAutoHealing] = useState<boolean>(false);
  const [confirmRestoreBackupId, setConfirmRestoreBackupId] = useState<string | null>(null);
  const [confirmDeleteBackupId, setConfirmDeleteBackupId] = useState<string | null>(null);

  const loadBackupsList = async () => {
    try {
      setLoadingBackups(true);
      const res = await fetchSystemBackups();
      setBackups(res.backups || []);
    } catch (err) {
      console.error('Failed to load system backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackupsList();
  }, []);

  const manualBackupsCount = backups.filter((b) => b.type === 'manual').length;
  const autoBackupsCount = backups.filter((b) => b.type !== 'manual').length;

  const handleCreateManualBackup = async () => {
    if (manualBackupsCount >= 5) {
      showToast('คุณมี Manual Snapshot ครบโควต้า 5 จุดแล้ว กรุณาลบ Snapshot ที่ไม่ต้องการออกก่อนสร้างใหม่');
      return;
    }
    try {
      setCreatingBackup(true);
      const res = await createSystemBackup('Admin Manual Backup Point');
      showToast(res.message || 'สร้างจุดสำรองข้อมูลสำเร็จ');
      await loadBackupsList();
      onRefreshOverview();
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการสร้าง Backup');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteSnapshot = async (backupId: string) => {
    try {
      setDeletingBackupId(backupId);
      const res = await deleteSystemBackup(backupId);
      showToast(res.message || 'ลบจุดสำรองข้อมูลสำเร็จ');
      await loadBackupsList();
      setConfirmDeleteBackupId(null);
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบจุดสำรองข้อมูล');
    } finally {
      setDeletingBackupId(null);
    }
  };

  const handleRestoreSnapshot = async (backupId: string) => {
    try {
      setRestoringBackupId(backupId);
      const res = await restoreSystemBackup(backupId);
      showToast(res.message || 'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว');
      await loadBackupsList();
      await loadCollectionDocs(selectedCollection);
      onRefreshOverview();
      setShowBackupModal(false);
      setConfirmRestoreBackupId(null);
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล');
    } finally {
      setRestoringBackupId(null);
    }
  };

  const handleTriggerAutoHeal = async () => {
    try {
      setAutoHealing(true);
      const res = await triggerAutoHealDatabase();
      showToast(res.message || 'ตรวจสอบและกู้คืนความสมบูรณ์สำเร็จ');
      await loadBackupsList();
      await loadCollectionDocs(selectedCollection);
      onRefreshOverview();
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการ Auto-Heal');
    } finally {
      setAutoHealing(false);
    }
  };

  // Dynamic Column Widths & Column Visibility for Database Collection Table
  const [dbColWidths, setDbColWidths] = useState<{ [key: string]: number }>({});
  const [dbVisibleCols, setDbVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    actions: true,
  });
  const [showDbColPicker, setShowDbColPicker] = useState<boolean>(false);

  const getColWidth = (key: string) => {
    if (dbColWidths[key]) return dbColWidths[key];
    if (key === 'select') return 40;
    if (key === 'index') return 45;
    if (key === 'actions') return 120;
    return 150;
  };

  const handleMouseDownResizeDb = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = getColWidth(colKey);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(35, startWidth + deltaX);
      setDbColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // JSON Edit Modal state
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  const loadCollectionDocs = async (collName: string, silent = false) => {
    try {
      if (!silent) setLoadingDocs(true);
      const res = await fetchAdminCollection(collName);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error(`Failed to load collection ${collName}:`, err);
    } finally {
      if (!silent) setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadCollectionDocs(selectedCollection);
  }, [selectedCollection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getCollectionColumns = (coll: string, docs: any[]): string[] => {
    const predefinedMap: Record<string, string[]> = {
      users: ['id', 'firstNameTh', 'lastNameTh', 'universityId', 'role', 'email'],
      courses: ['id', 'courseCode', 'courseName', 'academicYear', 'semester'],
      courseMembers: ['id', 'courseId', 'userId', 'role', 'status'],
      sessions: ['id', 'courseId', 'date', 'startTime', 'endTime', 'status'],
      attendanceRecords: ['id', 'studentNameTh', 'studentUniversityId', 'status', 'timestamp', 'checkinMethod'],
      teacherAttendanceRecords: ['id', 'teacherNameTh', 'status', 'timestamp'],
      leaveRequests: ['id', 'studentNameTh', 'leaveType', 'status', 'startDate', 'endDate'],
      quickEvents: ['id', 'title', 'code', 'status', 'checkinCount'],
      activeQRCodes: ['id', 'courseId', 'sessionId', 'expiresAt'],
    };

    if (predefinedMap[coll]) {
      return predefinedMap[coll];
    }

    const keySet = new Set<string>();
    keySet.add('id');
    docs.forEach((doc) => {
      if (doc && typeof doc === 'object') {
        Object.keys(doc).forEach((k) => {
          if (!['password', 'createdAt', 'updatedAt'].includes(k)) keySet.add(k);
        });
      }
    });
    return Array.from(keySet).slice(0, 6);
  };

  const renderTableCell = (doc: any, key: string) => {
    let val = doc[key];

    if (val === undefined || val === null || val === '') {
      if (key === 'code' || key === 'courseCode') val = doc.courseCode || doc.code;
      else if (key === 'nameTh' || key === 'courseName') val = doc.courseName || doc.nameTh || doc.name || doc.title;
      else if (key === 'firstNameTh') val = doc.firstNameTh || doc.firstName || doc.name;
      else if (key === 'lastNameTh') val = doc.lastNameTh || doc.lastName;
    }

    if (val === undefined || val === null || val === '') {
      return <span className={`italic text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>;
    }

    if (key === 'id') {
      return (
        <div className="flex items-center space-x-1.5 font-mono font-bold">
          <span className={`truncate max-w-[120px] ${isDarkMode ? 'text-purple-400' : 'text-purple-700 font-bold'}`}>{String(val)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(String(val));
              showToast('คัดลอก ID แล้ว');
            }}
            className={`transition shrink-0 cursor-pointer p-0.5 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}
            title="คัดลอก ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      );
    }

    if (key === 'role') {
      const roleStr = String(val);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${
          roleStr === 'ADMIN'
            ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
            : roleStr === 'TEACHER'
            ? isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-100 text-sky-900 border-sky-300'
            : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
        }`}>
          {roleStr === 'ADMIN' ? '🛠️ ADMIN' : roleStr === 'TEACHER' ? '👨‍🏫 TEACHER' : '👨‍🎓 STUDENT'}
        </span>
      );
    }

    if (key === 'status') {
      const stStr = String(val);
      let badgeClass = isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-200 text-slate-900 border-slate-300 font-bold';
      if (['PRESENT', 'APPROVED', 'ACTIVE'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
      } else if (['LATE', 'PENDING'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-950 border-amber-300 font-bold';
      } else if (['ABSENT', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300 font-bold';
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
          {stStr}
        </span>
      );
    }

    if (typeof val === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          val
            ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300'
            : isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300'
        }`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }

    if (typeof val === 'object') {
      return (
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border block truncate max-w-[140px] ${
          isDarkMode ? 'text-slate-400 bg-slate-800/60 border-slate-700/50' : 'text-slate-900 bg-slate-100 border-slate-300 font-bold'
        }`} title={JSON.stringify(val)}>
          {JSON.stringify(val)}
        </span>
      );
    }

    return <span className={`truncate max-w-[180px] block ${isDarkMode ? 'text-slate-200 font-medium' : 'text-slate-900 font-bold'}`}>{String(val)}</span>;
  };

  const handleOpenEditDoc = (doc: any) => {
    setEditingDoc(doc);
    setRawJsonText(JSON.stringify(doc, null, 2));
    setJsonError('');
    setIsCreatingNew(false);
  };

  const handleOpenCreateDoc = () => {
    const templateDoc = {
      id: `${selectedCollection.slice(0, 3)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(templateDoc);
    setRawJsonText(JSON.stringify(templateDoc, null, 2));
    setJsonError('');
    setIsCreatingNew(true);
  };

  const handleSaveDoc = async () => {
    try {
      setJsonError('');
      const parsed = JSON.parse(rawJsonText);
      if (!parsed.id) {
        setJsonError('เอกสารต้องมี field "id" ที่ไม่เป็นค่าว่าง');
        return;
      }
      await saveAdminDocument(selectedCollection, parsed);
      showToast(`บันทึกข้อมูลใน ${selectedCollection} สำเร็จ`);
      setEditingDoc(null);
      await loadCollectionDocs(selectedCollection);
      onRefreshOverview();
    } catch (err: any) {
      setJsonError(err.message || 'รูปแบบ JSON ไม่ถูกต้อง');
    }
  };

  const handleDeleteDoc = (docId: string) => {
    setDeleteConfirmItem({
      type: 'document',
      id: docId,
      title: `คุณต้องการลบเอกสาร ID "${docId}" ใช่หรือไม่?`,
      subtitle: `การลบเอกสารออกจากคอลเลกชัน ${selectedCollection} ถาวร`,
      action: async () => {
        await deleteAdminDocument(selectedCollection, docId);
        showToast(`ลบเอกสาร ${docId} เรียบร้อยแล้ว`);
        await loadCollectionDocs(selectedCollection);
        onRefreshOverview();
      },
    });
  };

  const handleExecuteBulkDeleteDocs = () => {
    if (selectedDocIds.length === 0) return;
    setDeleteConfirmItem({
      type: 'bulk_documents',
      title: `ยืนยันการลบเอกสารแบบกลุ่ม (${selectedDocIds.length} รายการ)`,
      subtitle: `คุณกำลังจะลบเอกสารจำนวน ${selectedDocIds.length} รายการออกจากคอลเลกชัน ${selectedCollection} อย่างถาวร`,
      action: async () => {
        for (const docId of selectedDocIds) {
          await deleteAdminDocument(selectedCollection, docId);
        }
        showToast(`ลบเอกสารจำนวน ${selectedDocIds.length} รายการเรียบร้อยแล้ว`);
        setSelectedDocIds([]);
        await loadCollectionDocs(selectedCollection);
        onRefreshOverview();
      },
    });
  };

  const columns = getCollectionColumns(selectedCollection, documents);

  const sortedAndFilteredDocs = documents
    .filter((doc) => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return JSON.stringify(doc).toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [lastSelectedDocIndex, setLastSelectedDocIndex] = useState<number | null>(null);

  // Reset selection and current page on collection or search change
  useEffect(() => {
    setSelectedDocIds([]);
    setLastSelectedDocIndex(null);
    setCurrentPage(1);
  }, [selectedCollection, searchQuery]);

  const totalDocItems = sortedAndFilteredDocs.length;
  const totalDocPages = pageSize === -1 ? 1 : Math.ceil(totalDocItems / pageSize) || 1;

  const paginatedDocs = useMemo(() => {
    if (pageSize === -1) return sortedAndFilteredDocs;
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredDocs.slice(start, start + pageSize);
  }, [sortedAndFilteredDocs, currentPage, pageSize]);

  const allVisibleDocsSelected = paginatedDocs.length > 0 && paginatedDocs.every((doc) => selectedDocIds.includes(doc.id));

  const handleToggleSelectDoc = (id: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedDocIndex !== null && index !== undefined && lastSelectedDocIndex !== index) {
      const start = Math.min(lastSelectedDocIndex, index);
      const end = Math.max(lastSelectedDocIndex, index);
      const rangeIds = paginatedDocs.slice(start, end + 1).map((doc) => doc.id);

      const isTargetSelected = selectedDocIds.includes(id);

      setSelectedDocIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedDocIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
    if (index !== undefined) {
      setLastSelectedDocIndex(index);
    }
  };

  const handleSelectAllVisibleDocs = () => {
    if (allVisibleDocsSelected) {
      const pageIds = paginatedDocs.map((doc) => doc.id);
      setSelectedDocIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedDocs.map((doc) => doc.id);
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleExportCSV = () => {
    const docsToExport = selectedDocIds.length > 0
      ? sortedAndFilteredDocs.filter((doc) => selectedDocIds.includes(doc.id))
      : sortedAndFilteredDocs;

    if (docsToExport.length === 0) {
      showToast('ไม่มีข้อมูลที่จะส่งออก');
      return;
    }

    const headers = ['ลำดับ', ...columns];
    const rows = docsToExport.map((doc, idx) => [
      idx + 1,
      ...columns.map((col) => {
        const val = doc[col];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      })
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admin_db_${selectedCollection}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`ส่งออก CSV สำเร็จ (${docsToExport.length} รายการ)`);
  };

  return (
    <div className="space-y-4">
      {/* 🛡️ System Security & Backup Control Banner */}
      <div className={`p-4 sm:p-5 lg:p-6 rounded-2xl sm:rounded-3xl border transition-all duration-300 shadow-xs ${
        isDarkMode
          ? 'bg-slate-900/90 border-sky-800/40 shadow-sky-950/20'
          : 'bg-white border-sky-100 shadow-sky-100/50'
      }`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-5">
          {/* Main Info Header */}
          <div className="flex items-start space-x-3 sm:space-x-4">
            <div className={`p-2.5 sm:p-3 rounded-2xl border shrink-0 transition-transform hover:scale-105 ${
              isDarkMode
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-gradient-to-br from-sky-500 to-sky-600 text-white border-sky-400 shadow-md shadow-sky-500/20'
            }`}>
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <div className="space-y-1 sm:space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-sm sm:text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ศูนย์ความปลอดภัยและการสำรองข้อมูล (Data Protection & Security)
                </h3>
                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border whitespace-nowrap ${
                  isDarkMode
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Protected & Auto-Synced</span>
                </span>
              </div>

              <p className={`text-[11px] sm:text-xs leading-relaxed max-w-3xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ระบบเปิดใช้งานนโยบายคุ้มครองประวัติการเช็กชื่อ (Cascade Delete Protection) และบันทึก Snapshot สำรองข้อมูลอัตโนมัติ Real-time เพื่อความปลอดภัยสูงสุด
              </p>

              {/* Security Metrics Cards (Responsive Grid for Mobile / Tablet / PC) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 w-full">
                {/* Attendance Metric */}
                <div className={`p-3 rounded-2xl border transition-all duration-200 flex items-center space-x-3 ${
                  isDarkMode
                    ? 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/40'
                    : 'bg-slate-50/90 border-slate-200/90 hover:border-emerald-300 shadow-xs'
                }`}>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      ประวัติเช็กชื่อ
                    </div>
                    <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
                      {overview?.collections?.attendanceRecords || 0} รายการ
                    </div>
                  </div>
                </div>

                {/* Snapshots Count Metric */}
                <div className={`p-3 rounded-2xl border transition-all duration-200 flex items-center space-x-3 ${
                  isDarkMode
                    ? 'bg-slate-950/60 border-slate-800 hover:border-sky-500/40'
                    : 'bg-slate-50/90 border-slate-200/90 hover:border-sky-300 shadow-xs'
                }`}>
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Snapshots สำรอง
                    </div>
                    <div className="text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400 truncate">
                      {backups.length} จุด
                    </div>
                  </div>
                </div>

                {/* Latest Snapshot Time Metric */}
                <div className={`p-3 rounded-2xl border transition-all duration-200 flex items-center space-x-3 sm:col-span-1 ${
                  isDarkMode
                    ? 'bg-slate-950/60 border-slate-800 hover:border-purple-500/40'
                    : 'bg-slate-50/90 border-slate-200/90 hover:border-purple-300 shadow-xs'
                }`}>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Snapshot ล่าสุด
                    </div>
                    <div className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400 truncate">
                      {backups.length > 0 && backups[0]?.timestamp
                        ? `${new Date(backups[0].timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.`
                        : 'ยังไม่มี Snapshot'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Buttons (Responsive Grid on Mobile / Tablet) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex xl:items-center gap-2 sm:gap-2.5 shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-200 dark:border-slate-800 w-full xl:w-auto">
            <button
              onClick={handleCreateManualBackup}
              disabled={creatingBackup}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 border shadow-xs cursor-pointer active:scale-95 whitespace-nowrap ${
                isDarkMode
                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500/40 shadow-sky-600/20'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-600/20'
              }`}
            >
              <Archive className={`w-4 h-4 shrink-0 ${creatingBackup ? 'animate-bounce' : ''}`} />
              <span>{creatingBackup ? 'กำลังสร้าง...' : 'สร้างจุดสำรองข้อมูล'}</span>
            </button>

            <button
              onClick={handleTriggerAutoHeal}
              disabled={autoHealing}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 border cursor-pointer active:scale-95 whitespace-nowrap ${
                isDarkMode
                  ? 'bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border-emerald-800/60'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              <Sparkles className={`w-4 h-4 text-emerald-500 shrink-0 ${autoHealing ? 'animate-spin' : ''}`} />
              <span>{autoHealing ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ & Auto-Heal'}</span>
            </button>

            <button
              onClick={() => {
                setShowBackupModal(true);
                loadBackupsList();
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 border cursor-pointer active:scale-95 whitespace-nowrap ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs'
              }`}
            >
              <History className="w-4 h-4 text-purple-500 shrink-0" />
              <span>ประวัติ Snapshot ({backups.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collection Toolbar & Controls (Mobile & Tablet Optimized) */}
      <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto">
          <div className="flex items-center space-x-2 w-full">
            <label className={`text-xs font-bold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Collection:</label>
            <select
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                setSortField(null);
              }}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="users">👤 users ({overview?.collections?.users || 0})</option>
              <option value="courses">📚 courses ({overview?.collections?.courses || 0})</option>
              <option value="courseMembers">🎓 courseMembers ({overview?.collections?.courseMembers || 0})</option>
              <option value="sessions">🗓️ sessions ({overview?.collections?.sessions || 0})</option>
              <option value="attendanceRecords">✅ attendanceRecords ({overview?.collections?.attendanceRecords || 0})</option>
              <option value="teacherAttendanceRecords">👨‍🏫 teacherAttendanceRecords ({overview?.collections?.teacherAttendanceRecords || 0})</option>
              <option value="leaveRequests">📄 leaveRequests ({overview?.collections?.leaveRequests || 0})</option>
              <option value="quickEvents">⚡ quickEvents ({overview?.collections?.quickEvents || 0})</option>
              <option value="activeQRCodes">🔐 activeQRCodes ({overview?.collections?.activeQRCodes || 0})</option>
            </select>
          </div>

          {/* Document Search Filter */}
          <div className="relative w-full">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="ค้นหาข้อมูลทุก Field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-medium border transition focus:outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons Toolbar Grid for Mobile/Tablet */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          {/* Column Settings Button */}
          <div className="relative w-full">
            <button
              type="button"
              onClick={() => setShowDbColPicker(!showDbColPicker)}
              className={`w-full py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                showDbColPicker
                  ? 'bg-purple-600 text-white border-purple-600'
                  : isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="ตั้งค่าคอลัมน์"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>ตั้งค่าคอลัมน์</span>
            </button>

            {showDbColPicker && (
              <div
                className={`absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 sm:w-64 p-3 rounded-2xl shadow-2xl border z-30 transition-all ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <span className="text-xs font-black flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-500" />
                    <span>แสดงคอลัมน์ ({selectedCollection})</span>
                  </span>
                  <button
                    onClick={() => setShowDbColPicker(false)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  <label className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold">
                    <span>กล่องเลือก</span>
                    <input
                      type="checkbox"
                      checked={dbVisibleCols.select !== false}
                      onChange={(e) => setDbVisibleCols(prev => ({ ...prev, select: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-purple-600"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold">
                    <span>ลำดับ (#)</span>
                    <input
                      type="checkbox"
                      checked={dbVisibleCols.index !== false}
                      onChange={(e) => setDbVisibleCols(prev => ({ ...prev, index: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-purple-600"
                    />
                  </label>

                  {columns.map((col) => (
                    <label
                      key={col}
                      className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold"
                    >
                      <span className="truncate max-w-[140px]">{col}</span>
                      <input
                        type="checkbox"
                        checked={dbVisibleCols[col] !== false}
                        onChange={(e) => setDbVisibleCols(prev => ({ ...prev, [col]: e.target.checked }))}
                        className="w-3.5 h-3.5 rounded text-purple-600"
                      />
                    </label>
                  ))}

                  <label className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold">
                    <span>จัดการ</span>
                    <input
                      type="checkbox"
                      checked={dbVisibleCols.actions !== false}
                      onChange={(e) => setDbVisibleCols(prev => ({ ...prev, actions: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-purple-600"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="w-full py-2 px-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            title="ส่งออกข้อมูลคอลเลกชันนี้เป็น CSV"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>ส่งออก CSV</span>
          </button>

          <button
            onClick={() => loadCollectionDocs(selectedCollection)}
            disabled={loadingDocs}
            className={`w-full py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap active:scale-95 ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loadingDocs ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleOpenCreateDoc}
            className="w-full py-2 px-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-xs shadow-purple-600/30 transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>เพิ่มเอกสารใหม่</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar for Database Documents */}
      {selectedDocIds.length > 0 && (
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-600 dark:text-purple-300">
            <CheckSquare className="w-4 h-4" />
            <span>เลือกไว้แล้ว {selectedDocIds.length} เอกสาร</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center space-x-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออกเอกสารที่เลือก (CSV)</span>
            </button>
            <button
              onClick={handleExecuteBulkDeleteDocs}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center space-x-1 cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบเอกสารที่เลือก ({selectedDocIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[700px] text-left text-xs border-collapse">
            <colgroup>
              {dbVisibleCols.select !== false && <col style={{ width: `${getColWidth('select')}px` }} />}
              {dbVisibleCols.index !== false && <col style={{ width: `${getColWidth('index')}px` }} />}
              {columns.map((col) => (
                dbVisibleCols[col] !== false && <col key={col} style={{ width: `${getColWidth(col)}px` }} />
              ))}
              {dbVisibleCols.actions !== false && <col style={{ width: `${getColWidth('actions')}px` }} />}
            </colgroup>
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 font-extrabold'}`}>
                {dbVisibleCols.select !== false && (
                  <th className="p-3.5 text-center relative group select-none">
                    <button
                      onClick={handleSelectAllVisibleDocs}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      {allVisibleDocsSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeDb('select', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {dbVisibleCols.index !== false && (
                  <th className="p-3.5 text-center font-extrabold uppercase tracking-wider text-slate-400 relative group select-none">
                    #
                    <div
                      onMouseDown={(e) => handleMouseDownResizeDb('index', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {columns.map((col) => (
                  dbVisibleCols[col] !== false && (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4"
                    >
                      <div className="flex items-center space-x-1 truncate">
                        <span>{col}</span>
                        {sortField === col ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeDb(col, e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )
                ))}
                {dbVisibleCols.actions !== false && (
                  <th className="p-3.5 font-extrabold text-right relative group select-none">
                    จัดการ
                    <div
                      onMouseDown={(e) => handleMouseDownResizeDb('actions', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {loadingDocs ? (
                <tr>
                  <td colSpan={columns.filter(c => dbVisibleCols[c] !== false).length + (dbVisibleCols.select !== false ? 1 : 0) + (dbVisibleCols.index !== false ? 1 : 0) + (dbVisibleCols.actions !== false ? 1 : 0)} className="p-8 text-center text-slate-400 font-semibold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                    กำลังโหลดข้อมูลในคอลเลกชัน {selectedCollection}...
                  </td>
                </tr>
              ) : sortedAndFilteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter(c => dbVisibleCols[c] !== false).length + (dbVisibleCols.select !== false ? 1 : 0) + (dbVisibleCols.index !== false ? 1 : 0) + (dbVisibleCols.actions !== false ? 1 : 0)} className="p-8 text-center text-slate-400 font-semibold">
                    ไม่พบข้อมูลเอกสารใน {selectedCollection}
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc, idx) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`transition ${
                        isSelected
                          ? isDarkMode ? 'bg-purple-950/20' : 'bg-purple-50'
                          : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      {dbVisibleCols.select !== false && (
                        <td className="p-3.5 text-center">
                          <button
                            onClick={(e) => handleToggleSelectDoc(doc.id, idx, e)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                          </button>
                        </td>
                      )}
                      {dbVisibleCols.index !== false && (
                        <td className="p-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                          {(currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1}
                        </td>
                      )}
                      {columns.map((col) => (
                        dbVisibleCols[col] !== false && (
                          <td key={col} className="p-3.5 whitespace-nowrap">
                            {renderTableCell(doc, col)}
                          </td>
                        )
                      ))}
                      {dbVisibleCols.actions !== false && (
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenEditDoc(doc)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                              }`}
                              title="แก้ไข Raw JSON"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-rose-700'
                              }`}
                              title="ลบเอกสาร"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span>แสดงจำนวน:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value={10}>10 รายการ</option>
              <option value={15}>15 รายการ</option>
              <option value={30}>30 รายการ</option>
              <option value={50}>50 รายการ</option>
              <option value={-1}>ทั้งหมด ({totalDocItems})</option>
            </select>
          </div>

          {pageSize !== -1 && totalDocPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold px-2">
                หน้า {currentPage} จาก {totalDocPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalDocPages, p + 1))}
                disabled={currentPage === totalDocPages}
                className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* JSON Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-purple-500/30 text-slate-100' : 'bg-white border-purple-200 text-slate-900'
          }`}>
            <button
              onClick={() => setEditingDoc(null)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-purple-500">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-purple-600 dark:text-purple-400">
                  {isCreatingNew ? `สร้างเอกสารใหม่ใน ${selectedCollection}` : `แก้ไข Raw JSON (${editingDoc.id})`}
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  แก้ไขข้อมูลฟีลด์รูปแบบ JSON โดยตรงและบันทึกไปยังฐานข้อมูล
                </p>
              </div>
            </div>

            <div>
              <textarea
                rows={14}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className={`w-full p-4 rounded-2xl font-mono text-xs border leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-800 text-emerald-300'
                }`}
              />
            </div>

            {jsonError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 font-bold text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-700/30">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveDoc}
                className="px-5 py-2 rounded-xl font-extrabold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                บันทึกเอกสาร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup History & 1-Click Restore Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col ${
            isDarkMode ? 'bg-slate-900 border-sky-500/30 text-slate-100' : 'bg-white border-sky-200 text-slate-900'
          }`}>
            <button
              onClick={() => setShowBackupModal(false)}
              className={`absolute right-4 top-4 p-2 rounded-full transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-sky-500">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                <History className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-sky-600 dark:text-sky-400">
                  ประวัติจุดสำรองข้อมูลและการกู้คืน (System Backup Snapshots)
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ระบบแยกการจัดการระหว่าง Manual Snapshot (ผู้ใช้สร้างเอง) และ Automatic Snapshot (ระบบบันทึกอัตโนมัติ)
                </p>
              </div>
            </div>

            {/* Quota & Capacity Summary */}
            <div className={`p-3 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-xl font-black text-[11px] bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 shrink-0">
                  📌 Manual Snapshot: {manualBackupsCount} / 5
                </span>
                <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  (ถาวร - ลบออกเองเมื่อต้องการ)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-xl font-black text-[11px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                  ⚡ Automatic Snapshot: {autoBackupsCount} / 20
                </span>
                <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  (หมุนเวียน 20 จุดล่าสุด เคลียร์ออโต้)
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-2">
              {loadingBackups ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-2" />
                  <p className="text-xs font-bold text-slate-500">กำลังโหลดจุดสำรองข้อมูล...</p>
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-2xl">
                  <Archive className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-500">ยังไม่มีจุดสำรองข้อมูลย้อนหลัง</p>
                </div>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isDarkMode ? 'bg-slate-800/80 border-slate-700/80 hover:border-sky-500/50' : 'bg-slate-50 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        {b.type === 'manual' ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40">
                            📌 Manual
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                            ⚡ Auto
                          </span>
                        )}
                        <span className="font-extrabold text-xs text-sky-600 dark:text-sky-400">{b.label || 'System Backup'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-600'
                        }`}>
                          {b.id}
                        </span>
                      </div>
                      <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        ⏰ {new Date(b.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} น. | ผู้สร้าง: {b.creator || 'System'}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ✅ เช็กชื่อ: {b.counts?.attendanceRecords ?? 0}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          👤 ผู้ใช้: {b.counts?.users ?? 0}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                          📚 รายวิชา: {b.counts?.courses ?? 0}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          🗓️ คาบเรียน: {b.counts?.sessions ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Delete Action */}
                      {confirmDeleteBackupId === b.id ? (
                        <div className="flex items-center space-x-1.5 shrink-0 bg-rose-500/10 p-1.5 rounded-xl border border-rose-500/30">
                          <span className="text-[11px] font-extrabold text-rose-500">ลบจุดนี้?</span>
                          <button
                            onClick={() => handleDeleteSnapshot(b.id)}
                            disabled={deletingBackupId === b.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm transition"
                          >
                            {deletingBackupId === b.id ? 'กำลังลบ...' : 'ยืนยัน'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteBackupId(null)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                              isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
                            }`}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmRestoreBackupId(null);
                            setConfirmDeleteBackupId(b.id);
                          }}
                          title="ลบจุดสำรองข้อมูลนี้"
                          className={`p-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            isDarkMode
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Restore Action */}
                      {confirmRestoreBackupId === b.id ? (
                        <div className="flex items-center space-x-1.5 shrink-0 bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/30">
                          <span className="text-[11px] font-extrabold text-amber-500">กู้คืนจุดนี้?</span>
                          <button
                            onClick={() => handleRestoreSnapshot(b.id)}
                            disabled={restoringBackupId === b.id}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-sm flex items-center space-x-1 transition"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${restoringBackupId === b.id ? 'animate-spin' : ''}`} />
                            <span>{restoringBackupId === b.id ? 'กำลังกู้คืน...' : 'ยืนยัน'}</span>
                          </button>
                          <button
                            onClick={() => setConfirmRestoreBackupId(null)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                              isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
                            }`}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmDeleteBackupId(null);
                            setConfirmRestoreBackupId(b.id);
                          }}
                          disabled={restoringBackupId === b.id}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shrink-0 border shadow-sm cursor-pointer ${
                            isDarkMode
                              ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500/40 shadow-sky-600/20'
                              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600 shadow-sky-600/20'
                          }`}
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${restoringBackupId === b.id ? 'animate-spin' : ''}`} />
                          <span>{restoringBackupId === b.id ? 'กำลังกู้คืน...' : 'กู้คืน (Restore)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-700/30 text-xs">
              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                * การกู้คืนข้อมูลจะปรับปรุงทั้งใน Memory Cache และ Firestore Database ทันที
              </span>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className={`px-4 py-2 rounded-xl font-bold transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
