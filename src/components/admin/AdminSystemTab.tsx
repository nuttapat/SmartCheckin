import React, { useState, useEffect } from 'react';
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
            <div className="flex items-center justify-between">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                <Building2 className="w-4 h-4" />
                <span>สาขา / ภาควิชา ({masterDeps.length})</span>
              </span>
              <button
                onClick={() => setEditingDept({ code: '', nameTh: '', nameEn: '' })}
                className="p-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {masterDeps.map((d) => (
                <div
                  key={d.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="pr-2 min-w-0">
                    <div className={`font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{d.nameTh}</div>
                    <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{d.code}</div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => setEditingDept({ id: d.id, code: d.code, nameTh: d.nameTh, nameEn: d.nameEn })}
                      className="p-1 rounded-lg text-purple-600 hover:bg-purple-500/10 cursor-pointer transition"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDeptSubmit(d.id, d.nameTh)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2.2 Master Curriculums */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                <BookOpen className="w-4 h-4" />
                <span>หลักสูตร ({masterCurrs.length})</span>
              </span>
              <button
                onClick={() => setEditingCurr({ code: '', titleTh: '', departmentCode: '' })}
                className="p-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {masterCurrs.map((c) => {
                const title = c.nameTh || c.titleTh || c.code;
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                      isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="pr-2 min-w-0">
                      <div className={`font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{title}</div>
                      <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{c.code}</div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => setEditingCurr({ id: c.id, code: c.code, titleTh: title, nameTh: title })}
                        className="p-1 rounded-lg text-purple-600 hover:bg-purple-500/10 cursor-pointer transition"
                        title="แก้ไข"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCurrSubmit(c.id, title)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                        title="ลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2.3 Master Prefixes */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-extrabold text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                <UserCheck className="w-4 h-4" />
                <span>คำนำหน้าชื่อ ({masterPrefixes.length})</span>
              </span>
              <button
                onClick={() => setEditingPrefix({ titleTh: '', titleEn: '', category: 'ACADEMIC' })}
                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {masterPrefixes.map((p) => (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="pr-2 min-w-0">
                    <div className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{p.titleTh} ({p.titleEn || '-'})</div>
                    <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{p.category}</div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => setEditingPrefix({ id: p.id, titleTh: p.titleTh, titleEn: p.titleEn, category: p.category })}
                      className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer transition"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePrefixSubmit(p.id, p.titleTh)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
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
