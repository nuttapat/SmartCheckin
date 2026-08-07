import React, { useState, useEffect, useMemo } from 'react';
import { MasterDepartment, MasterCurriculum, MasterPrefix } from '../../types';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchMasterDepartments,
  saveMasterDepartment,
  deleteMasterDepartment,
  fetchMasterCurriculums,
  saveMasterCurriculum,
  deleteMasterCurriculum,
  fetchMasterPrefixes,
  saveMasterPrefix,
  deleteMasterPrefix,
} from '../../services/api';
import {
  Sliders,
  Globe,
  Radio,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  BookOpen,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Layers,
  MapPin,
  Clock,
  Mail,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  X,
  FileText,
  UserPlus,
  Pencil,
  Smartphone,
  ShieldCheck,
  CheckSquare,
  Square,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';

interface AdminSystemTabProps {
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  setDeleteConfirmItem: (item: any) => void;
}

interface CustomSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: 'purple' | 'emerald' | 'amber' | 'rose';
  isDarkMode?: boolean;
}

function CustomSwitch({ checked, onChange, activeColor = 'purple', isDarkMode = false }: CustomSwitchProps) {
  const activeBg = {
    purple: 'bg-purple-600 shadow-md shadow-purple-600/30',
    emerald: 'bg-emerald-500 shadow-md shadow-emerald-500/30',
    amber: 'bg-amber-500 shadow-md shadow-amber-500/30',
    rose: 'bg-rose-500 shadow-md shadow-rose-500/30',
  }[activeColor];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 ${
        checked ? activeBg : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export const AdminSystemTab: React.FC<AdminSystemTabProps> = ({
  isDarkMode,
  showToast,
  setDeleteConfirmItem,
}) => {
  const [loadingSystemSettings, setLoadingSystemSettings] = useState<boolean>(false);
  const [savingSystemSettings, setSavingSystemSettings] = useState<boolean>(false);

  // System Settings Form
  const [systemForm, setSystemForm] = useState({
    maintenanceMode: false,
    announcementMessage: '',
    gpsCheckinRequired: true,
    gpsRadiusMeters: 50,
    dynamicQrRotationSeconds: 15,
    singleDeviceLockEnabled: true,
    maxDevicesPerUser: 1,
    allowTeacherSelfRegister: true,
    allowStudentSelfRegister: true,
    allowOtherDomainsSelfRegister: false,
    teacherDomains: ['mahidol.ac.th', 'mahidol.edu'],
    studentDomains: ['student.mahidol.ac.th', 'student.mahidol.edu'],
  });

  // Domain Management Inputs
  const [newTeacherDomainInput, setNewTeacherDomainInput] = useState<string>('');
  const [newStudentDomainInput, setNewStudentDomainInput] = useState<string>('');

  // Master Data State
  const [masterDeps, setMasterDeps] = useState<MasterDepartment[]>([]);
  const [masterCurrs, setMasterCurrs] = useState<MasterCurriculum[]>([]);
  const [masterPrefixes, setMasterPrefixes] = useState<MasterPrefix[]>([]);
  const [loadingMasterData, setLoadingMasterData] = useState<boolean>(false);

  // Master Data Sorting & Selection State
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedCurrIds, setSelectedCurrIds] = useState<string[]>([]);
  const [selectedPrefixIds, setSelectedPrefixIds] = useState<string[]>([]);

  const [deptSortField, setDeptSortField] = useState<'code' | 'nameTh' | null>(null);
  const [deptSortDir, setDeptSortDir] = useState<'asc' | 'desc'>('asc');

  const [currSortField, setCurrSortField] = useState<'code' | 'titleTh' | null>(null);
  const [currSortDir, setCurrSortDir] = useState<'asc' | 'desc'>('asc');

  const [prefixSortField, setPrefixSortField] = useState<'titleTh' | 'category' | null>(null);
  const [prefixSortDir, setPrefixSortDir] = useState<'asc' | 'desc'>('asc');

  // Column Visibility State for Departments Table
  const [deptVisibleCols, setDeptVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    code: true,
    nameTh: true,
    actions: true,
  });
  const [showDeptColPicker, setShowDeptColPicker] = useState<boolean>(false);
  const DEPT_COLUMN_CONFIG = [
    { key: 'select', label: 'กล่องเลือก' },
    { key: 'index', label: 'ลำดับ' },
    { key: 'code', label: 'รหัสสาขา' },
    { key: 'nameTh', label: 'ชื่อสาขา' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Visibility State for Curriculum Table
  const [currVisibleCols, setCurrVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    code: true,
    titleTh: true,
    actions: true,
  });
  const [showCurrColPicker, setShowCurrColPicker] = useState<boolean>(false);
  const CURR_COLUMN_CONFIG = [
    { key: 'select', label: 'กล่องเลือก' },
    { key: 'index', label: 'ลำดับ' },
    { key: 'code', label: 'รหัสหลักสูตร' },
    { key: 'titleTh', label: 'ชื่อหลักสูตร' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Visibility State for Prefix Table
  const [prefixVisibleCols, setPrefixVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    prefixTh: true,
    prefixEn: true,
    actions: true,
  });
  const [showPrefixColPicker, setShowPrefixColPicker] = useState<boolean>(false);
  const PREFIX_COLUMN_CONFIG = [
    { key: 'select', label: 'กล่องเลือก' },
    { key: 'index', label: 'ลำดับ' },
    { key: 'prefixTh', label: 'คำนำหน้า (TH)' },
    { key: 'prefixEn', label: 'คำนำหน้า (EN)' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Widths for Department Table
  const [deptColWidths, setDeptColWidths] = useState<{ [key: string]: number }>({
    select: 32,
    index: 35,
    code: 65,
    nameTh: 130,
    actions: 60,
  });

  const handleMouseDownResizeDept = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = deptColWidths[colKey] || 60;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(25, startWidth + deltaX);
      setDeptColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
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

  // Column Widths for Curriculum Table
  const [currColWidths, setCurrColWidths] = useState<{ [key: string]: number }>({
    select: 32,
    index: 35,
    code: 65,
    titleTh: 130,
    actions: 60,
  });

  const handleMouseDownResizeCurr = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = currColWidths[colKey] || 60;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(25, startWidth + deltaX);
      setCurrColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
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

  // Column Widths for Prefix Table
  const [prefixColWidths, setPrefixColWidths] = useState<{ [key: string]: number }>({
    select: 32,
    index: 35,
    prefixTh: 90,
    prefixEn: 90,
    actions: 60,
  });

  const handleMouseDownResizePrefix = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = prefixColWidths[colKey] || 60;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(25, startWidth + deltaX);
      setPrefixColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
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

  // Sorted Master Collections
  const sortedDeps = useMemo(() => {
    return [...masterDeps].sort((a, b) => {
      if (!deptSortField) return 0;
      const valA = (a[deptSortField] || '').toLowerCase();
      const valB = (b[deptSortField] || '').toLowerCase();
      if (valA < valB) return deptSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return deptSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [masterDeps, deptSortField, deptSortDir]);

  const sortedCurrs = useMemo(() => {
    return [...masterCurrs].sort((a, b) => {
      if (!currSortField) return 0;
      let valA = '';
      let valB = '';
      if (currSortField === 'code') {
        valA = (a.code || '').toLowerCase();
        valB = (b.code || '').toLowerCase();
      } else {
        valA = (a.nameTh || a.titleTh || a.code || '').toLowerCase();
        valB = (b.nameTh || b.titleTh || b.code || '').toLowerCase();
      }
      if (valA < valB) return currSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return currSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [masterCurrs, currSortField, currSortDir]);

  const sortedPrefixes = useMemo(() => {
    return [...masterPrefixes].sort((a, b) => {
      if (!prefixSortField) return 0;
      const valA = (a[prefixSortField] || '').toLowerCase();
      const valB = (b[prefixSortField] || '').toLowerCase();
      if (valA < valB) return prefixSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return prefixSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [masterPrefixes, prefixSortField, prefixSortDir]);

  // Export handlers
  const handleExportDeptCSV = () => {
    const depsToExport = selectedDeptIds.length > 0
      ? sortedDeps.filter((d) => selectedDeptIds.includes(d.id))
      : sortedDeps;
    if (depsToExport.length === 0) return showToast('ไม่มีข้อมูลสาขาที่จะส่งออก');

    const headers = ['ลำดับ', 'ID', 'รหัสสาขา', 'ชื่อสาขา (TH)', 'ชื่อสาขา (EN)'];
    const rows = depsToExport.map((d, idx) => [idx + 1, d.id, d.code, d.nameTh, d.nameEn || '']);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_departments_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast(`ส่งออก CSV สาขาสำเร็จ (${depsToExport.length} รายการ)`);
  };

  const handleExportCurrCSV = () => {
    const currsToExport = selectedCurrIds.length > 0
      ? sortedCurrs.filter((c) => selectedCurrIds.includes(c.id))
      : sortedCurrs;
    if (currsToExport.length === 0) return showToast('ไม่มีข้อมูลหลักสูตรที่จะส่งออก');

    const headers = ['ลำดับ', 'ID', 'รหัสหลักสูตร', 'ชื่อหลักสูตร (TH)'];
    const rows = currsToExport.map((c, idx) => [idx + 1, c.id, c.code, c.nameTh || c.titleTh || c.code]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_curriculums_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast(`ส่งออก CSV หลักสูตรสำเร็จ (${currsToExport.length} รายการ)`);
  };

  const handleExportPrefixCSV = () => {
    const prefixesToExport = selectedPrefixIds.length > 0
      ? sortedPrefixes.filter((p) => selectedPrefixIds.includes(p.id))
      : sortedPrefixes;
    if (prefixesToExport.length === 0) return showToast('ไม่มีข้อมูลคำนำหน้าชื่อที่จะส่งออก');

    const headers = ['ลำดับ', 'ID', 'คำนำหน้าชื่อ (TH)', 'คำนำหน้าชื่อ (EN)', 'หมวดหมู่'];
    const rows = prefixesToExport.map((p, idx) => [idx + 1, p.id, p.titleTh, p.titleEn || '', p.category || '']);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_prefixes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast(`ส่งออก CSV คำนำหน้าชื่อสำเร็จ (${prefixesToExport.length} รายการ)`);
  };

  // Modals / New Item Forms for Master Data
  const [editingDept, setEditingDept] = useState<Partial<MasterDepartment> | null>(null);
  const [editingCurr, setEditingCurr] = useState<Partial<MasterCurriculum> | null>(null);
  const [editingPrefix, setEditingPrefix] = useState<Partial<MasterPrefix> | null>(null);

  const loadSystemSettingsData = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingSystemSettings(true);
        setLoadingMasterData(true);
      }
      const [sysRes, depsData, currsData, prefixesData] = await Promise.all([
        fetchSystemSettings().catch(() => ({})),
        fetchMasterDepartments().catch(() => []),
        fetchMasterCurriculums().catch(() => []),
        fetchMasterPrefixes().catch(() => []),
      ]);

      const sysData = sysRes.settings || sysRes.document || sysRes || {};
      if (sysData) {
        setSystemForm({
          maintenanceMode: sysData.maintenanceMode ?? false,
          announcementMessage: sysData.announcementMessage || '',
          gpsCheckinRequired: sysData.gpsCheckinRequired ?? true,
          gpsRadiusMeters: sysData.gpsRadiusMeters || 50,
          dynamicQrRotationSeconds: sysData.dynamicQrRotationSeconds || 15,
          singleDeviceLockEnabled: sysData.singleDeviceLockEnabled ?? true,
          maxDevicesPerUser: sysData.maxDevicesPerUser ?? 1,
          allowTeacherSelfRegister: sysData.allowTeacherSelfRegister ?? true,
          allowStudentSelfRegister: sysData.allowStudentSelfRegister ?? true,
          allowOtherDomainsSelfRegister: sysData.allowOtherDomainsSelfRegister ?? false,
          teacherDomains: sysData.teacherDomains || ['mahidol.ac.th', 'mahidol.edu'],
          studentDomains: sysData.studentDomains || ['student.mahidol.ac.th', 'mail.kmutt.ac.th'],
        });
      }

      setMasterDeps(depsData);
      setMasterCurrs(currsData);
      setMasterPrefixes(prefixesData);
    } catch (err) {
      console.error('Failed to load system settings and master data:', err);
    } finally {
      if (!silent) {
        setLoadingSystemSettings(false);
        setLoadingMasterData(false);
      }
    }
  };

  useEffect(() => {
    loadSystemSettingsData();
  }, []);

  const handleSaveSystemSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSystemSettings(true);
    try {
      await updateSystemSettings(systemForm);
      showToast('บันทึกการตั้งค่าระบบและกฎความปลอดภัยเรียบร้อยแล้ว');
      loadSystemSettingsData(true);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setSavingSystemSettings(false);
    }
  };

  // Domain add/remove handlers
  const handleAddTeacherDomain = () => {
    const trimmed = newTeacherDomainInput.trim().toLowerCase();
    if (!trimmed) return;
    if (systemForm.teacherDomains.includes(trimmed)) {
      alert('Domain นี้มีอยู่ในรายการอาจารย์แล้ว');
      return;
    }
    setSystemForm({
      ...systemForm,
      teacherDomains: [...systemForm.teacherDomains, trimmed],
    });
    setNewTeacherDomainInput('');
  };

  const handleRemoveTeacherDomain = (domain: string) => {
    setSystemForm({
      ...systemForm,
      teacherDomains: systemForm.teacherDomains.filter((d) => d !== domain),
    });
  };

  const handleAddStudentDomain = () => {
    const trimmed = newStudentDomainInput.trim().toLowerCase();
    if (!trimmed) return;
    if (systemForm.studentDomains.includes(trimmed)) {
      alert('Domain นี้มีอยู่ในรายการนักศึกษาแล้ว');
      return;
    }
    setSystemForm({
      ...systemForm,
      studentDomains: [...systemForm.studentDomains, trimmed],
    });
    setNewStudentDomainInput('');
  };

  const handleRemoveStudentDomain = (domain: string) => {
    setSystemForm({
      ...systemForm,
      studentDomains: systemForm.studentDomains.filter((d) => d !== domain),
    });
  };

  // Master Department CRUD
  const handleSaveDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept?.code || !editingDept?.nameTh) {
      alert('กรุณากรอกรหัสสาขาและชื่อสาขาภาษาไทย');
      return;
    }
    try {
      await saveMasterDepartment({
        id: editingDept.id || `dept_${Date.now()}`,
        code: editingDept.code.trim(),
        nameTh: editingDept.nameTh.trim(),
        nameEn: editingDept.nameEn?.trim() || '',
      });
      showToast('บันทึกสาขา/ภาควิชาสำเร็จ');
      setEditingDept(null);
      loadSystemSettingsData(true);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกสาขา/ภาควิชา');
    }
  };

  const handleDeleteDeptSubmit = (id: string, name: string) => {
    setDeleteConfirmItem({
      title: `ลบสาขา/ภาควิชา "${name}"`,
      subtitle: 'การลบสาขา/ภาควิชานี้จะลบรายการออกจากตัวเลือกในระบบ',
      action: async () => {
        await deleteMasterDepartment(id);
        showToast(`ลบสาขา ${name} เรียบร้อยแล้ว`);
        loadSystemSettingsData(true);
      },
    });
  };

  // Master Curriculum CRUD
  const handleSaveCurrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currTitle = (editingCurr?.titleTh || editingCurr?.nameTh || '').trim();
    if (!editingCurr?.code || !currTitle) {
      alert('กรุณากรอกรหัสหลักสูตรและชื่อหลักสูตรภาษาไทย');
      return;
    }
    try {
      await saveMasterCurriculum({
        id: editingCurr.id || `curr_${Date.now()}`,
        code: editingCurr.code.trim(),
        titleTh: currTitle,
        nameTh: currTitle,
        departmentCode: editingCurr.departmentCode || '',
        academicYears: editingCurr.academicYears || [2567, 2568, 2569],
      });
      showToast('บันทึกข้อมูลหลักสูตรสำเร็จ');
      setEditingCurr(null);
      loadSystemSettingsData(true);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกหลักสูตร');
    }
  };

  const handleDeleteCurrSubmit = (id: string, title: string) => {
    setDeleteConfirmItem({
      title: `ลบหลักสูตร "${title}"`,
      subtitle: 'การลบหลักสูตรนี้จะลบรายการออกจากระบบ',
      action: async () => {
        await deleteMasterCurriculum(id);
        showToast(`ลบหลักสูตร ${title} เรียบร้อยแล้ว`);
        loadSystemSettingsData(true);
      },
    });
  };

  // Master Prefix CRUD
  const handleSavePrefixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrefix?.titleTh) {
      alert('กรุณากรอกคำนำหน้าชื่อ');
      return;
    }
    try {
      await saveMasterPrefix({
        id: editingPrefix.id || `prefix_${Date.now()}`,
        titleTh: editingPrefix.titleTh.trim(),
        titleEn: editingPrefix.titleEn?.trim() || '',
        category: editingPrefix.category || 'ACADEMIC',
      });
      showToast('บันทึกคำนำหน้าชื่อสำเร็จ');
      setEditingPrefix(null);
      loadSystemSettingsData(true);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกคำนำหน้าชื่อ');
    }
  };

  const handleDeletePrefixSubmit = (id: string, title: string) => {
    setDeleteConfirmItem({
      title: `ลบคำนำหน้าชื่อ "${title}"`,
      subtitle: 'การลบคำนำหน้าชื่อนี้จะลบรายการออกจากระบบ',
      action: async () => {
        await deleteMasterPrefix(id);
        showToast(`ลบคำนำหน้าชื่อ ${title} เรียบร้อยแล้ว`);
        loadSystemSettingsData(true);
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: GLOBAL SYSTEM CONFIGURATION */}
      <form onSubmit={handleSaveSystemSettingsSubmit} className="space-y-6">
        <div className={`p-6 rounded-3xl border shadow-xl ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-500 shrink-0">
                <Sliders className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ส่วนที่ 1: ตั้งค่าระบบหลัก & กฎความปลอดภัย (System Configuration)
                </h2>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  กำหนดโหมดบำรุงรักษา, ข้อประกาศแจ้งเตือน และ นโยบายโดเมนอีเมล
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSystemSettings}
              className="px-6 py-2.5 rounded-2xl font-extrabold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-600/30 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {savingSystemSettings ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่าระบบ'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
            {/* 1.1 Maintenance & Announcement */}
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex items-center space-x-2 font-extrabold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-purple-400' : 'text-purple-700'
              }`}>
                <Radio className="w-4 h-4" />
                <span>1.1 สถานะระบบ & ประกาศข่าวสาร</span>
              </div>

              <div className="space-y-3">
                <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                  systemForm.maintenanceMode
                    ? (isDarkMode ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50/80 border-rose-200')
                    : (isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-white border-slate-200/80')
                }`}>
                  <div>
                    <label className={`text-xs font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>โหมดปิดปรับปรุงระบบ (Maintenance)</label>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>ไม่อนุญาตให้ผู้ใช้อื่นเข้าใช้งาน</span>
                  </div>
                  <CustomSwitch
                    checked={systemForm.maintenanceMode}
                    onChange={(checked) => setSystemForm({ ...systemForm, maintenanceMode: checked })}
                    activeColor="rose"
                    isDarkMode={isDarkMode}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>ข้อความประกาศบนหน้าจอหลัก (Banner Message)</label>
                  <textarea
                    rows={3}
                    value={systemForm.announcementMessage}
                    onChange={(e) => setSystemForm({ ...systemForm, announcementMessage: e.target.value })}
                    placeholder="พิมพ์ข้อความประกาศระบบที่จะแสดงให้ผู้ใช้ทุกคนเห็น..."
                    className={`w-full p-2.5 rounded-xl border text-xs font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 1.2 Self-Registration & Allowed Domains */}
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex items-center space-x-2 font-extrabold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-purple-400' : 'text-purple-700'
              }`}>
                <Globe className="w-4 h-4" />
                <span>1.2 การลงทะเบียน & โดเมนที่อนุญาต</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-white border-slate-200/80'
                }`}>
                  <div>
                    <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>อนุญาตให้ลงทะเบียนเปิดบัญชีอาจารย์</label>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>เฉพาะโดเมนอาจารย์ที่กำหนด</span>
                  </div>
                  <CustomSwitch
                    checked={systemForm.allowTeacherSelfRegister}
                    onChange={(checked) => setSystemForm({ ...systemForm, allowTeacherSelfRegister: checked })}
                    activeColor="purple"
                    isDarkMode={isDarkMode}
                  />
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-white border-slate-200/80'
                }`}>
                  <div>
                    <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>อนุญาตให้ลงทะเบียนเปิดบัญชีนักศึกษา</label>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>เฉพาะโดเมนนักศึกษาที่กำหนด</span>
                  </div>
                  <CustomSwitch
                    checked={systemForm.allowStudentSelfRegister}
                    onChange={(checked) => setSystemForm({ ...systemForm, allowStudentSelfRegister: checked })}
                    activeColor="purple"
                    isDarkMode={isDarkMode}
                  />
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50/80 border-amber-200'
                }`}>
                  <div>
                    <label className={`font-extrabold block ${isDarkMode ? 'text-amber-400' : 'text-amber-800'}`}>ขอยกเว้นลงทะเบียนโดเมนอื่นๆ</label>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-amber-400/80' : 'text-amber-700/90'}`}>
                      {systemForm.allowOtherDomainsSelfRegister
                        ? '🟢 เปิดใช้งาน: อนุญาตให้อีเมลภายนอกทุกโดเมน (เช่น @gmail.com) สมัครได้'
                        : '🔴 ปิดใช้งาน (แนะนำ): สมัครได้เฉพาะโดเมนสถาบัน'}
                    </span>
                  </div>
                  <CustomSwitch
                    checked={systemForm.allowOtherDomainsSelfRegister}
                    onChange={(checked) => setSystemForm({ ...systemForm, allowOtherDomainsSelfRegister: checked })}
                    activeColor="amber"
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
            </div>

            {/* 1.3 Device Limits & Anti-Proxy Policy */}
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex items-center space-x-2 font-extrabold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-purple-400' : 'text-purple-700'
              }`}>
                <Smartphone className="w-4 h-4" />
                <span>1.3 นโยบายจำกัดอุปกรณ์ (Device Policy)</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Single Device Lock Toggle */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-white border-slate-200/80'
                }`}>
                  <div>
                    <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      ล็อกการใช้งานอุปกรณ์ประจำตัว
                    </label>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      เปิดการตรวจฮาร์ดแวร์เพื่อป้องกันการฝากเช็คชื่อ
                    </span>
                  </div>
                  <CustomSwitch
                    checked={systemForm.singleDeviceLockEnabled}
                    onChange={(checked) => setSystemForm({ ...systemForm, singleDeviceLockEnabled: checked })}
                    activeColor="purple"
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* Max Devices Input */}
                <div className={`p-3 rounded-xl border space-y-2.5 transition-opacity ${
                  systemForm.singleDeviceLockEnabled
                    ? (isDarkMode ? 'bg-purple-500/10 border-purple-500/25' : 'bg-purple-50/80 border-purple-200')
                    : (isDarkMode ? 'bg-slate-800/20 border-slate-700/40 opacity-50' : 'bg-white border-slate-200/80 opacity-50')
                }`}>
                  <div className="flex items-center justify-between">
                    <label className={`font-extrabold text-xs block ${isDarkMode ? 'text-purple-300' : 'text-purple-900'}`}>
                      จำนวนอุปกรณ์สูงสุดที่ผูกได้
                    </label>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-600 text-white shrink-0">
                      {systemForm.maxDevicesPerUser} เครื่อง / คน
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      disabled={!systemForm.singleDeviceLockEnabled}
                      value={systemForm.maxDevicesPerUser}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                        setSystemForm({ ...systemForm, maxDevicesPerUser: val });
                      }}
                      className={`w-20 p-2 rounded-xl border text-center font-extrabold text-xs ${
                        isDarkMode ? 'bg-slate-900 border-purple-500/40 text-purple-300' : 'bg-white border-purple-300 text-purple-900'
                      }`}
                    />

                    {/* Quick selection preset buttons */}
                    <div className="flex items-center gap-1 flex-1">
                      {[1, 2, 3, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={!systemForm.singleDeviceLockEnabled}
                          onClick={() => setSystemForm({ ...systemForm, maxDevicesPerUser: num })}
                          className={`flex-1 py-1.5 rounded-lg font-extrabold text-[10px] border transition cursor-pointer ${
                            systemForm.maxDevicesPerUser === num
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : isDarkMode
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {num} เครื่อง
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`p-2 rounded-lg text-[10px] leading-relaxed border ${
                    isDarkMode ? 'bg-purple-950/40 border-purple-800/40 text-purple-200' : 'bg-purple-100/50 border-purple-200 text-purple-900'
                  }`}>
                    <span className="font-bold block mb-0.5">📌 ขอบเขตการบังคับใช้นโยบายอุปกรณ์:</span>
                    • <span className="font-semibold text-purple-600 dark:text-purple-300">นักศึกษา (Student):</span> จำกัดสูงสุด <b>{systemForm.maxDevicesPerUser} เครื่อง</b><br />
                    • <span className="font-semibold text-emerald-600 dark:text-emerald-400">อาจารย์ & Admin:</span> <b>ไม่จำกัดจำนวนอุปกรณ์ (Unlimited)</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email Domain Rules Editor */}
          <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Teacher Email Domains */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-slate-50/60 border-slate-200'
            }`}>
              <label className={`text-xs font-bold block ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                👨‍🏫 โดเมนอีเมลสำหรับอาจารย์ (Teacher Email Domains)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="เช่น mahidol.ac.th"
                  value={newTeacherDomainInput}
                  onChange={(e) => setNewTeacherDomainInput(e.target.value)}
                  className={`flex-1 p-2 rounded-xl border text-xs font-mono ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleAddTeacherDomain}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-purple-600/20"
                >
                  เพิ่ม
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {systemForm.teacherDomains.map((dom) => (
                  <span
                    key={dom}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border gap-1.5 ${
                      isDarkMode ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-800 border-purple-300'
                    }`}
                  >
                    <span>@{dom}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeacherDomain(dom)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Student Email Domains */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDarkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-slate-50/60 border-slate-200'
            }`}>
              <label className={`text-xs font-bold block ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                👨‍🎓 โดเมนอีเมลสำหรับนักศึกษา (Student Email Domains)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="เช่น student.mahidol.ac.th"
                  value={newStudentDomainInput}
                  onChange={(e) => setNewStudentDomainInput(e.target.value)}
                  className={`flex-1 p-2 rounded-xl border text-xs font-mono ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleAddStudentDomain}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-purple-600/20"
                >
                  เพิ่ม
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {systemForm.studentDomains.map((dom) => (
                  <span
                    key={dom}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border gap-1.5 ${
                      isDarkMode ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-800 border-purple-300'
                    }`}
                  >
                    <span>@{dom}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStudentDomain(dom)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* SECTION 2: MASTER DATA MANAGEMENT */}
      <div className={`p-6 rounded-3xl border shadow-xl space-y-6 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center space-x-3 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-500 shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              ส่วนที่ 2: จัดการ Master Data (สาขา, หลักสูตร, คำนำหน้าชื่อ)
            </h2>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              กำหนดข้อมูลมาตรฐานของสถาบัน เพื่อให้ผู้ใช้นำไปเลือกใช้งานในระบบ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 2.1 Master Departments */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                <Building2 className="w-4 h-4" />
                <span>สาขา / ภาควิชา ({sortedDeps.length})</span>
              </span>
              <div className="flex items-center space-x-1">
                {/* Column Settings Button for Departments */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDeptColPicker(!showDeptColPicker)}
                    className={`p-1 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center space-x-1 ${
                      showDeptColPicker
                        ? 'bg-purple-600 text-white border-purple-600'
                        : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="ตั้งค่าคอลัมน์"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>

                  {showDeptColPicker && (
                    <div
                      className={`absolute right-0 mt-2 w-52 p-2.5 rounded-xl shadow-xl border z-30 transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="text-[11px] font-black flex items-center space-x-1">
                          <Sliders className="w-3 h-3 text-purple-500" />
                          <span>คอลัมน์สาขา</span>
                        </span>
                        <button
                          onClick={() => setShowDeptColPicker(false)}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {DEPT_COLUMN_CONFIG.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-[11px] font-bold"
                          >
                            <span>{col.label}</span>
                            <input
                              type="checkbox"
                              checked={!!deptVisibleCols[col.key]}
                              onChange={(e) =>
                                setDeptVisibleCols((prev) => ({
                                  ...prev,
                                  [col.key]: e.target.checked,
                                }))
                              }
                              className="w-3.5 h-3.5 rounded text-purple-600"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExportDeptCSV}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                  title="ส่งออก CSV สาขา"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setEditingDept({ code: '', nameTh: '', nameEn: '' })}
                  className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full table-fixed text-left text-[11px] border-collapse">
                <colgroup>
                  {deptVisibleCols.select && <col style={{ width: `${deptColWidths.select}px` }} />}
                  {deptVisibleCols.index && <col style={{ width: `${deptColWidths.index}px` }} />}
                  {deptVisibleCols.code && <col style={{ width: `${deptColWidths.code}px` }} />}
                  {deptVisibleCols.nameTh && <col style={{ width: `${deptColWidths.nameTh}px` }} />}
                  {deptVisibleCols.actions && <col style={{ width: `${deptColWidths.actions}px` }} />}
                </colgroup>
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                    {deptVisibleCols.select && (
                      <th className="p-1.5 text-center relative group select-none">
                        <button
                          onClick={() => {
                            if (selectedDeptIds.length === sortedDeps.length) setSelectedDeptIds([]);
                            else setSelectedDeptIds(sortedDeps.map(d => d.id));
                          }}
                        >
                          {selectedDeptIds.length > 0 && selectedDeptIds.length === sortedDeps.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                        <div
                          onMouseDown={(e) => handleMouseDownResizeDept('select', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {deptVisibleCols.index && (
                      <th className="p-1.5 text-center font-bold text-slate-400 relative group select-none">
                        #
                        <div
                          onMouseDown={(e) => handleMouseDownResizeDept('index', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {deptVisibleCols.code && (
                      <th
                        onClick={() => {
                          if (deptSortField === 'code') setDeptSortDir(deptSortDir === 'asc' ? 'desc' : 'asc');
                          else { setDeptSortField('code'); setDeptSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        รหัส
                        <div
                          onMouseDown={(e) => handleMouseDownResizeDept('code', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {deptVisibleCols.nameTh && (
                      <th
                        onClick={() => {
                          if (deptSortField === 'nameTh') setDeptSortDir(deptSortDir === 'asc' ? 'desc' : 'asc');
                          else { setDeptSortField('nameTh'); setDeptSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        ชื่อสาขา
                        <div
                          onMouseDown={(e) => handleMouseDownResizeDept('nameTh', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {deptVisibleCols.actions && (
                      <th className="p-1.5 text-right font-extrabold relative group select-none">
                        จัดการ
                        <div
                          onMouseDown={(e) => handleMouseDownResizeDept('actions', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {sortedDeps.map((d, idx) => {
                    const isSelected = selectedDeptIds.includes(d.id);
                    return (
                      <tr key={d.id} className={isSelected ? (isDarkMode ? 'bg-purple-950/20' : 'bg-purple-50') : ''}>
                        {deptVisibleCols.select && (
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => {
                                setSelectedDeptIds(prev => prev.includes(d.id) ? prev.filter(i => i !== d.id) : [...prev, d.id]);
                              }}
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-purple-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                          </td>
                        )}
                        {deptVisibleCols.index && (
                          <td className="p-1.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        )}
                        {deptVisibleCols.code && (
                          <td className="p-1.5 font-mono font-bold text-purple-500">{d.code}</td>
                        )}
                        {deptVisibleCols.nameTh && (
                          <td className={`p-1.5 font-bold truncate max-w-[120px] ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{d.nameTh}</td>
                        )}
                        {deptVisibleCols.actions && (
                          <td className="p-1.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditingDept({ id: d.id, code: d.code, nameTh: d.nameTh, nameEn: d.nameEn })}
                              className="p-1 rounded text-purple-600 hover:bg-purple-500/10 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteDeptSubmit(d.id, d.nameTh)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2.2 Master Curriculums */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                <BookOpen className="w-4 h-4" />
                <span>หลักสูตร ({sortedCurrs.length})</span>
              </span>
              <div className="flex items-center space-x-1">
                {/* Column Settings Button for Curriculums */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCurrColPicker(!showCurrColPicker)}
                    className={`p-1 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center space-x-1 ${
                      showCurrColPicker
                        ? 'bg-purple-600 text-white border-purple-600'
                        : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="ตั้งค่าคอลัมน์"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>

                  {showCurrColPicker && (
                    <div
                      className={`absolute right-0 mt-2 w-52 p-2.5 rounded-xl shadow-xl border z-30 transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="text-[11px] font-black flex items-center space-x-1">
                          <Sliders className="w-3 h-3 text-purple-500" />
                          <span>คอลัมน์หลักสูตร</span>
                        </span>
                        <button
                          onClick={() => setShowCurrColPicker(false)}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {CURR_COLUMN_CONFIG.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-[11px] font-bold"
                          >
                            <span>{col.label}</span>
                            <input
                              type="checkbox"
                              checked={!!currVisibleCols[col.key]}
                              onChange={(e) =>
                                setCurrVisibleCols((prev) => ({
                                  ...prev,
                                  [col.key]: e.target.checked,
                                }))
                              }
                              className="w-3.5 h-3.5 rounded text-purple-600"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExportCurrCSV}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                  title="ส่งออก CSV หลักสูตร"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setEditingCurr({ code: '', titleTh: '', departmentCode: '' })}
                  className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full table-fixed text-left text-[11px] border-collapse">
                <colgroup>
                  {currVisibleCols.select && <col style={{ width: `${currColWidths.select}px` }} />}
                  {currVisibleCols.index && <col style={{ width: `${currColWidths.index}px` }} />}
                  {currVisibleCols.code && <col style={{ width: `${currColWidths.code}px` }} />}
                  {currVisibleCols.titleTh && <col style={{ width: `${currColWidths.titleTh}px` }} />}
                  {currVisibleCols.actions && <col style={{ width: `${currColWidths.actions}px` }} />}
                </colgroup>
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                    {currVisibleCols.select && (
                      <th className="p-1.5 text-center relative group select-none">
                        <button
                          onClick={() => {
                            if (selectedCurrIds.length === sortedCurrs.length) setSelectedCurrIds([]);
                            else setSelectedCurrIds(sortedCurrs.map(c => c.id));
                          }}
                        >
                          {selectedCurrIds.length > 0 && selectedCurrIds.length === sortedCurrs.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                        <div
                          onMouseDown={(e) => handleMouseDownResizeCurr('select', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {currVisibleCols.index && (
                      <th className="p-1.5 text-center font-bold text-slate-400 relative group select-none">
                        #
                        <div
                          onMouseDown={(e) => handleMouseDownResizeCurr('index', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {currVisibleCols.code && (
                      <th
                        onClick={() => {
                          if (currSortField === 'code') setCurrSortDir(currSortDir === 'asc' ? 'desc' : 'asc');
                          else { setCurrSortField('code'); setCurrSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        รหัส
                        <div
                          onMouseDown={(e) => handleMouseDownResizeCurr('code', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {currVisibleCols.titleTh && (
                      <th
                        onClick={() => {
                          if (currSortField === 'titleTh') setCurrSortDir(currSortDir === 'asc' ? 'desc' : 'asc');
                          else { setCurrSortField('titleTh'); setCurrSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        ชื่อหลักสูตร
                        <div
                          onMouseDown={(e) => handleMouseDownResizeCurr('titleTh', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {currVisibleCols.actions && (
                      <th className="p-1.5 text-right font-extrabold relative group select-none">
                        จัดการ
                        <div
                          onMouseDown={(e) => handleMouseDownResizeCurr('actions', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {sortedCurrs.map((c, idx) => {
                    const title = c.nameTh || c.titleTh || c.code;
                    const isSelected = selectedCurrIds.includes(c.id);
                    return (
                      <tr key={c.id} className={isSelected ? (isDarkMode ? 'bg-purple-950/20' : 'bg-purple-50') : ''}>
                        {currVisibleCols.select && (
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => {
                                setSelectedCurrIds(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id]);
                              }}
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-purple-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                          </td>
                        )}
                        {currVisibleCols.index && (
                          <td className="p-1.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        )}
                        {currVisibleCols.code && (
                          <td className="p-1.5 font-mono font-bold text-purple-500">{c.code}</td>
                        )}
                        {currVisibleCols.titleTh && (
                          <td className={`p-1.5 font-bold truncate max-w-[120px] ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{title}</td>
                        )}
                        {currVisibleCols.actions && (
                          <td className="p-1.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditingCurr({ id: c.id, code: c.code, titleTh: title, nameTh: title })}
                              className="p-1 rounded text-purple-600 hover:bg-purple-500/10 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteCurrSubmit(c.id, title)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2.3 Master Prefixes */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                <UserCheck className="w-4 h-4" />
                <span>คำนำหน้าชื่อ ({sortedPrefixes.length})</span>
              </span>
              <div className="flex items-center space-x-1">
                {/* Column Settings Button for Prefixes */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPrefixColPicker(!showPrefixColPicker)}
                    className={`p-1 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center space-x-1 ${
                      showPrefixColPicker
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="ตั้งค่าคอลัมน์"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>

                  {showPrefixColPicker && (
                    <div
                      className={`absolute right-0 mt-2 w-52 p-2.5 rounded-xl shadow-xl border z-30 transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="text-[11px] font-black flex items-center space-x-1">
                          <Sliders className="w-3 h-3 text-emerald-500" />
                          <span>คอลัมน์คำนำหน้าชื่อ</span>
                        </span>
                        <button
                          onClick={() => setShowPrefixColPicker(false)}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {PREFIX_COLUMN_CONFIG.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center justify-between p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-[11px] font-bold"
                          >
                            <span>{col.label}</span>
                            <input
                              type="checkbox"
                              checked={!!prefixVisibleCols[col.key]}
                              onChange={(e) =>
                                setPrefixVisibleCols((prev) => ({
                                  ...prev,
                                  [col.key]: e.target.checked,
                                }))
                              }
                              className="w-3.5 h-3.5 rounded text-emerald-600"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExportPrefixCSV}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                  title="ส่งออก CSV คำนำหน้าชื่อ"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setEditingPrefix({ titleTh: '', titleEn: '', category: 'ACADEMIC' })}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full table-fixed text-left text-[11px] border-collapse">
                <colgroup>
                  {prefixVisibleCols.select && <col style={{ width: `${prefixColWidths.select}px` }} />}
                  {prefixVisibleCols.index && <col style={{ width: `${prefixColWidths.index}px` }} />}
                  {prefixVisibleCols.prefixTh && <col style={{ width: `${prefixColWidths.prefixTh}px` }} />}
                  {prefixVisibleCols.prefixEn && <col style={{ width: `${prefixColWidths.prefixEn}px` }} />}
                  {prefixVisibleCols.actions && <col style={{ width: `${prefixColWidths.actions}px` }} />}
                </colgroup>
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                    {prefixVisibleCols.select && (
                      <th className="p-1.5 text-center relative group select-none">
                        <button
                          onClick={() => {
                            if (selectedPrefixIds.length === sortedPrefixes.length) setSelectedPrefixIds([]);
                            else setSelectedPrefixIds(sortedPrefixes.map(p => p.id));
                          }}
                        >
                          {selectedPrefixIds.length > 0 && selectedPrefixIds.length === sortedPrefixes.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                        <div
                          onMouseDown={(e) => handleMouseDownResizePrefix('select', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {prefixVisibleCols.index && (
                      <th className="p-1.5 text-center font-bold text-slate-400 relative group select-none">
                        #
                        <div
                          onMouseDown={(e) => handleMouseDownResizePrefix('index', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {prefixVisibleCols.prefixTh && (
                      <th
                        onClick={() => {
                          if (prefixSortField === 'titleTh') setPrefixSortDir(prefixSortDir === 'asc' ? 'desc' : 'asc');
                          else { setPrefixSortField('titleTh'); setPrefixSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        ชื่อ (TH)
                        <div
                          onMouseDown={(e) => handleMouseDownResizePrefix('prefixTh', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {prefixVisibleCols.prefixEn && (
                      <th
                        onClick={() => {
                          if (prefixSortField === 'category') setPrefixSortDir(prefixSortDir === 'asc' ? 'desc' : 'asc');
                          else { setPrefixSortField('category'); setPrefixSortDir('asc'); }
                        }}
                        className="p-1.5 font-extrabold cursor-pointer hover:opacity-80 select-none relative group pr-2 truncate"
                      >
                        หมวด
                        <div
                          onMouseDown={(e) => handleMouseDownResizePrefix('prefixEn', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                    {prefixVisibleCols.actions && (
                      <th className="p-1.5 text-right font-extrabold relative group select-none">
                        จัดการ
                        <div
                          onMouseDown={(e) => handleMouseDownResizePrefix('actions', e)}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10"
                        />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {sortedPrefixes.map((p, idx) => {
                    const isSelected = selectedPrefixIds.includes(p.id);
                    return (
                      <tr key={p.id} className={isSelected ? (isDarkMode ? 'bg-emerald-950/20' : 'bg-emerald-50') : ''}>
                        {prefixVisibleCols.select && (
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => {
                                setSelectedPrefixIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id]);
                              }}
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                          </td>
                        )}
                        {prefixVisibleCols.index && (
                          <td className="p-1.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        )}
                        {prefixVisibleCols.prefixTh && (
                          <td className={`p-1.5 font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{p.titleTh}</td>
                        )}
                        {prefixVisibleCols.prefixEn && (
                          <td className="p-1.5 font-mono text-[10px] text-slate-400">{p.category}</td>
                        )}
                        {prefixVisibleCols.actions && (
                          <td className="p-1.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditingPrefix({ id: p.id, titleTh: p.titleTh, titleEn: p.titleEn, category: p.category })}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePrefixSubmit(p.id, p.titleTh)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT/ADD DEPT MODAL */}
      {editingDept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative ${
            isDarkMode ? 'bg-slate-900 border-purple-500/30 text-slate-100' : 'bg-white border-purple-200 text-slate-900'
          }`}>
            <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
              เพิ่ม/แก้ไข สาขา/ภาควิชา
            </h3>
            <form onSubmit={handleSaveDeptSubmit} className="space-y-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>รหัสสาขา (Code) *</label>
                <input
                  type="text"
                  required
                  value={editingDept.code || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value })}
                  placeholder="เช่น CPE"
                  className={`w-full p-2.5 rounded-xl border font-mono ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>ชื่อสาขา (ภาษาไทย) *</label>
                <input
                  type="text"
                  required
                  value={editingDept.nameTh || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, nameTh: e.target.value })}
                  placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                  className={`w-full p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className={`px-4 py-2 rounded-xl font-bold border cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-extrabold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT/ADD CURR MODAL */}
      {editingCurr && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setEditingCurr(null)}
        >
          <div
            className={`border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative ${
              isDarkMode ? 'bg-slate-900 border-purple-500/30 text-slate-100' : 'bg-white border-purple-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
              เพิ่ม/แก้ไข หลักสูตร
            </h3>
            <form onSubmit={handleSaveCurrSubmit} className="space-y-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>รหัสหลักสูตร (Code) *</label>
                <input
                  type="text"
                  required
                  value={editingCurr.code || ''}
                  onChange={(e) => setEditingCurr({ ...editingCurr, code: e.target.value })}
                  placeholder="เช่น B.Eng. CPE"
                  className={`w-full p-2.5 rounded-xl border font-mono ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>ชื่อหลักสูตร (ภาษาไทย) *</label>
                <input
                  type="text"
                  required
                  value={editingCurr.titleTh || editingCurr.nameTh || ''}
                  onChange={(e) => setEditingCurr({ ...editingCurr, titleTh: e.target.value, nameTh: e.target.value })}
                  placeholder="เช่น วิศวกรรมศาสตร์บัณฑิต สาขาวิชาวิศวกรรมคอมพิวเตอร์"
                  className={`w-full p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCurr(null);
                  }}
                  className={`px-4 py-2 rounded-xl font-bold border cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-extrabold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT/ADD PREFIX MODAL */}
      {editingPrefix && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative ${
            isDarkMode ? 'bg-slate-900 border-emerald-500/30 text-slate-100' : 'bg-white border-emerald-200 text-slate-900'
          }`}>
            <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
              เพิ่ม/แก้ไข คำนำหน้าชื่อ
            </h3>
            <form onSubmit={handleSavePrefixSubmit} className="space-y-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>คำนำหน้าชื่อ (ภาษาไทย) *</label>
                <input
                  type="text"
                  required
                  value={editingPrefix.titleTh || ''}
                  onChange={(e) => setEditingPrefix({ ...editingPrefix, titleTh: e.target.value })}
                  placeholder="เช่น ผศ.ดร."
                  className={`w-full p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>คำนำหน้าชื่อ (ภาษาอังกฤษ)</label>
                <input
                  type="text"
                  value={editingPrefix.titleEn || ''}
                  onChange={(e) => setEditingPrefix({ ...editingPrefix, titleEn: e.target.value })}
                  placeholder="เช่น Asst. Prof. Dr."
                  className={`w-full p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>หมวดหมู่</label>
                <select
                  value={editingPrefix.category || 'ACADEMIC'}
                  onChange={(e) => setEditingPrefix({ ...editingPrefix, category: e.target.value as any })}
                  className={`w-full p-2.5 rounded-xl border font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="GENERAL">ทั่วไป (นาย, นาง, นางสาว)</option>
                  <option value="ACADEMIC">ทางวิชาการ (ผศ., รศ., ศ., ดร.)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPrefix(null)}
                  className="px-4 py-2 rounded-xl font-bold border"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-extrabold text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
