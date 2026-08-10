import React, { useState, useEffect } from 'react';
import { User, UserRole, UserDevice, MasterUniversity, MasterFaculty, MasterDepartment, MasterCurriculum } from '../types';
import {
  updateUserProfile,
  getUserDevices,
  bindUserDeviceApi,
  deleteUserDeviceApi,
  resetUserDevice,
  fetchMasterUniversities,
  fetchMasterFaculties,
  fetchMasterDepartments,
  fetchMasterCurriculums,
} from '../services/api';
import { getDeviceInfo, DeviceInfo } from '../utils/deviceHelper';
import { X, User as UserIcon, Lock, Shield, ShieldCheck, CheckCircle2, ShieldAlert, Eye, EyeOff, KeyRound, Smartphone, Mail, MapPin, Globe, Tablet, Monitor, Sun, Moon, Trash2, Plus, RefreshCw, AlertCircle, Check, Info, Maximize2, Minimize2, Building2 } from 'lucide-react';
import { MapPicker } from './MapPicker';
import { useTheme } from '../context/ThemeContext';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  isDarkMode?: boolean;
  initialTab?: 'profile' | 'password' | 'device' | 'gps';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  isDarkMode: propIsDarkMode,
  initialTab = 'profile',
}) => {
  const { themeMode, setThemeMode, isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'device' | 'gps'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Form states
  const [titleOption, setTitleOption] = useState<string>(currentUser.title || 'นาย');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [firstNameTh, setFirstNameTh] = useState<string>(currentUser.firstNameTh || '');
  const [lastNameTh, setLastNameTh] = useState<string>(currentUser.lastNameTh || '');
  const [firstNameEn, setFirstNameEn] = useState<string>(currentUser.firstNameEn || '');
  const [lastNameEn, setLastNameEn] = useState<string>(currentUser.lastNameEn || '');
  const [universityId, setUniversityId] = useState<string>(currentUser.universityId || '');

  // Master Data State
  const [universities, setUniversities] = useState<MasterUniversity[]>([]);
  const [faculties, setFaculties] = useState<MasterFaculty[]>([]);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [curriculums, setCurriculums] = useState<MasterCurriculum[]>([]);

  // Selected Organization Hierarchy State
  const [universityCode, setUniversityCode] = useState<string>(currentUser.universityCode || 'MU');
  const [facultyCode, setFacultyCode] = useState<string>(currentUser.facultyCode || 'MT');
  const [departmentCode, setDepartmentCode] = useState<string>(currentUser.departmentCode || '');
  const [programCode, setProgramCode] = useState<string>(currentUser.programCode || '');
  const [branchName, setBranchName] = useState<string>(currentUser.branchName || '');
  const [affiliatedPrograms, setAffiliatedPrograms] = useState<string[]>(currentUser.affiliatedPrograms || []);

  // GPS state
  const [userLat, setUserLat] = useState<number>(13.7988363);
  const [userLng, setUserLng] = useState<number>(100.322944);
  const [savedPlaceName, setSavedPlaceName] = useState<string>('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Device Management State
  const [boundDevices, setBoundDevices] = useState<UserDevice[]>(currentUser.devices || []);
  const [maxDevicesLimit, setMaxDevicesLimit] = useState<number | null>(null);
  const [fetchingDevices, setFetchingDevices] = useState<boolean>(false);
  const [deviceActionLoading, setDeviceActionLoading] = useState<boolean>(false);
  const [currentDevInfo, setCurrentDevInfo] = useState<DeviceInfo>(getDeviceInfo());
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; deviceId: string; name: string } | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState<boolean>(false);

  // Status
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const isTeacherOrAdmin = currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.ADMIN;

  const loadDevices = async () => {
    try {
      setFetchingDevices(true);
      const data = await getUserDevices(currentUser.id);
      setBoundDevices(data.devices || []);
      setMaxDevicesLimit(data.maxDevices);
    } catch (err) {
      console.error('Failed to load user devices', err);
    } finally {
      setFetchingDevices(false);
    }
  };

  const prevIsOpenRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Modal was just opened: reset error and success messages
      setErrorMsg('');
      setSuccessMsg('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
    prevIsOpenRef.current = isOpen;

    if (isOpen && currentUser) {
      setCurrentDevInfo(getDeviceInfo());

      // Fetch Master Lists
      Promise.all([
        fetchMasterUniversities().catch(() => []),
        fetchMasterFaculties().catch(() => []),
        fetchMasterDepartments().catch(() => []),
        fetchMasterCurriculums().catch(() => []),
      ]).then(([univRes, facRes, depRes, currRes]) => {
        setUniversities(Array.isArray(univRes) ? univRes : (univRes.universities || []));
        setFaculties(Array.isArray(facRes) ? facRes : (facRes.faculties || []));
        setDepartments(Array.isArray(depRes) ? depRes : (depRes.departments || []));
        setCurriculums(Array.isArray(currRes) ? currRes : (currRes.curriculums || []));
      });

      const knownTitles = currentUser.role === UserRole.STUDENT 
        ? ['นาย', 'นางสาว', 'นาง'] 
        : ['อ.', 'ดร.', 'ผศ.', 'ผศ.ดร.', 'รศ.', 'รศ.ดร.', 'ศ.', 'ศ.ดร.', 'นาย', 'นางสาว'];
      
      if (knownTitles.includes(currentUser.title)) {
        setTitleOption(currentUser.title);
        setCustomTitle('');
      } else {
        setTitleOption('OTHER');
        setCustomTitle(currentUser.title || '');
      }

      setFirstNameTh(currentUser.firstNameTh || '');
      setLastNameTh(currentUser.lastNameTh || '');
      setFirstNameEn(currentUser.firstNameEn || '');
      setLastNameEn(currentUser.lastNameEn || '');
      setUniversityId(currentUser.universityId || '');

      setUniversityCode(currentUser.universityCode || 'MU');
      setFacultyCode(currentUser.facultyCode || 'MT');
      setDepartmentCode(currentUser.departmentCode || '');
      setProgramCode(currentUser.programCode || '');
      setBranchName(currentUser.branchName || '');
      setAffiliatedPrograms(currentUser.affiliatedPrograms || []);

      loadDevices();
    }
  }, [currentUser, isOpen]);

  const modalBodyRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const finalTitle = titleOption === 'OTHER' ? customTitle.trim() : titleOption;
    if (!finalTitle) {
      setErrorMsg('กรุณาระบุคำนำหน้าชื่อ');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!firstNameTh.trim() || !lastNameTh.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุลภาษาไทย');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentUser.role === UserRole.STUDENT) {
      if (!universityId.trim()) {
        setErrorMsg('กรุณากรอกรหัสนักศึกษา');
        modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!programCode) {
        setErrorMsg('กรุณาเลือกหลักสูตรการศึกษาจากรายการในระบบ');
        modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Resolve Names from Master Lists
    const currentUnivObj = universities.find((u) => u.code === universityCode);
    const currentFacultyObj = faculties.find((f) => f.code === facultyCode);
    const currentDeptObj = departments.find((d) => d.code === departmentCode);
    const currentProgObj = curriculums.find((c) => c.code === programCode);

    try {
      setLoading(true);
      const res = await updateUserProfile(currentUser.id, {
        title: finalTitle,
        firstNameTh: firstNameTh.trim(),
        lastNameTh: lastNameTh.trim(),
        firstNameEn: firstNameEn.trim() || firstNameTh.trim(),
        lastNameEn: lastNameEn.trim() || lastNameTh.trim(),
        universityId: universityId.trim(),
        universityCode,
        universityName: currentUnivObj ? currentUnivObj.nameTh : (currentUser.universityName || 'มหาวิทยาลัยมหิดล'),
        facultyCode,
        facultyName: currentFacultyObj ? currentFacultyObj.nameTh : (currentUser.facultyName || 'คณะเทคนิคการแพทย์'),
        departmentCode,
        departmentName: currentDeptObj ? currentDeptObj.nameTh : '',
        branchName: branchName.trim(),
        programCode: currentUser.role === UserRole.STUDENT ? programCode : '',
        programName: currentUser.role === UserRole.STUDENT && currentProgObj ? currentProgObj.nameTh : '',
        affiliatedPrograms: isTeacherOrAdmin ? affiliatedPrograms : [],
      });

      onUpdateUser(res.user);
      setSuccessMsg('อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const isPasswordNotRequired = currentUser.authProvider === 'google' || !currentUser.password || currentUser.password === '123456';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isPasswordNotRequired && !currentPassword) {
      setErrorMsg('กรุณากรอกรหัสผ่านปัจจุบัน');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setLoading(true);
      const res = await updateUserProfile(currentUser.id, {
        currentPassword: isPasswordNotRequired ? undefined : currentPassword,
        newPassword,
        isGoogleOrFirstPasswordSet: isPasswordNotRequired,
      });

      onUpdateUser(res.user);
      setSuccessMsg(isPasswordNotRequired ? 'กำหนดรหัสผ่านใหม่สำหรับเข้าใช้งานสำเร็จ' : 'เปลี่ยนรหัสผ่านสำเร็จ');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setErrorMsg(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านปัจจุบัน');
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleBindCurrentDevice = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setDeviceActionLoading(true);
      const res = await bindUserDeviceApi(currentUser.id, {
        deviceId: currentDevInfo.deviceId,
        deviceName: currentDevInfo.deviceName,
        deviceType: currentDevInfo.deviceType,
        browser: currentDevInfo.browser,
        os: currentDevInfo.os,
      });
      setBoundDevices(res.devices || []);
      if (res.user) onUpdateUser(res.user);
      setSuccessMsg('ผูกอุปกรณ์ปัจจุบันเข้ากับบัญชีเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถผูกอุปกรณ์ได้');
    } finally {
      setDeviceActionLoading(false);
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return;
    const targetId = deviceToDelete.id || deviceToDelete.deviceId;
    if (!targetId) {
      setErrorMsg('ไม่พบรหัสอุปกรณ์ที่ต้องการยกเลิกการผูก');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setDeviceActionLoading(true);
      const res = await deleteUserDeviceApi(currentUser.id, targetId);
      setBoundDevices(res.devices || []);
      if (res.user) onUpdateUser(res.user);
      setSuccessMsg(`ยกเลิกการผูกอุปกรณ์ "${deviceToDelete.name}" เรียบร้อยแล้ว`);
      setDeviceToDelete(null);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadDevices();
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถยกเลิกการผูกอุปกรณ์ได้');
    } finally {
      setDeviceActionLoading(false);
    }
  };

  const confirmResetAllDevices = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setDeviceActionLoading(true);
      const res = await resetUserDevice(currentUser.id);
      setBoundDevices([]);
      setShowResetAllConfirm(false);
      if (res.user) onUpdateUser(res.user);
      setSuccessMsg('รีเซ็ตการผูกอุปกรณ์ทั้งหมดเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadDevices();
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถรีเซ็ตอุปกรณ์ได้');
    } finally {
      setDeviceActionLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full border shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ${
        isMaximized
          ? 'w-full h-full max-w-none max-h-none rounded-none'
          : 'max-w-2xl max-h-[90vh] rounded-3xl'
      } ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">ตั้งค่าบัญชีผู้ใช้ (User Settings)</h3>
              <p className={`text-[11px] sm:text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentUser.title} {currentUser.firstNameTh} {currentUser.lastNameTh} ({currentUser.email})
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-2 rounded-xl transition ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex items-center border-b px-2 sm:px-4 pt-2.5 gap-1 shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 min-w-0 py-2.5 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition border-b-2 flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ข้อมูลส่วนตัว</span>
          </button>
          <button
            onClick={() => { setActiveTab('password'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 min-w-0 py-2.5 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition border-b-2 flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              activeTab === 'password'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">รหัสผ่าน</span>
          </button>
          <button
            onClick={() => { setActiveTab('device'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 min-w-0 py-2.5 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition border-b-2 flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              activeTab === 'device'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">อุปกรณ์ & ความปลอดภัย</span>
          </button>
          <button
            onClick={() => { setActiveTab('gps'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 min-w-0 py-2.5 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition border-b-2 flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              activeTab === 'gps'
                ? 'border-teal-500 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ตำแหน่ง GPS</span>
          </button>
        </div>

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl flex items-center space-x-3 text-emerald-400 dark:text-emerald-300 text-xs font-bold animate-in fade-in duration-200 shadow-md">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm">{successMsg}</span>
            </div>
          )}

          {/* Tab 1: Personal Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
              {/* Account Provider Badge */}
              <div className={`p-3 border rounded-2xl flex items-center justify-between text-xs ${
                currentUser.authProvider === 'google' || currentUser.avatarUrl?.includes('google')
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                <div className="flex items-center space-x-2">
                  {currentUser.authProvider === 'google' || currentUser.avatarUrl?.includes('google') ? (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  ) : (
                    <Mail className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="font-semibold">
                    {currentUser.authProvider === 'google' || currentUser.avatarUrl?.includes('google')
                      ? 'บัญชีผู้ใช้งานเชื่อมต่อผ่าน Google Account'
                      : 'บัญชีผู้ใช้งานลงทะเบียนด้วย Email & Password'}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {currentUser.authProvider === 'google' ? 'Google' : 'Email/Password'}
                </span>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  อีเมลประจำบัญชี (Email)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={currentUser.email}
                    disabled
                    className={`w-full border rounded-xl px-3 py-2 pl-9 text-xs opacity-70 cursor-not-allowed ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  />
                  <Mail className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    คำนำหน้าชื่อ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={titleOption}
                    onChange={(e) => setTitleOption(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  >
                    {currentUser.role === UserRole.STUDENT ? (
                      <>
                        <option value="นาย">นาย</option>
                        <option value="นางสาว">นางสาว</option>
                        <option value="นาง">นาง</option>
                        <option value="OTHER">อื่นๆ (กรอกเอง)</option>
                      </>
                    ) : (
                      <>
                        <option value="อ.">อ.</option>
                        <option value="ดร.">ดร.</option>
                        <option value="ผศ.">ผศ.</option>
                        <option value="ผศ.ดร.">ผศ.ดร.</option>
                        <option value="รศ.">รศ.</option>
                        <option value="รศ.ดร.">รศ.ดร.</option>
                        <option value="ศ.">ศ.</option>
                        <option value="ศ.ดร.">ศ.ดร.</option>
                        <option value="นาย">นาย</option>
                        <option value="นางสาว">นางสาว</option>
                        <option value="OTHER">อื่นๆ (กรอกเอง)</option>
                      </>
                    )}
                  </select>
                </div>

                {titleOption === 'OTHER' && (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      ระบุคำนำหน้าชื่อ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                  </div>
                )}

                {currentUser.role === UserRole.STUDENT && (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      รหัสนักศึกษา <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={universityId}
                      onChange={(e) => setUniversityId(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ชื่อ (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstNameTh}
                    onChange={(e) => setFirstNameTh(e.target.value)}
                    required
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    นามสกุล (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastNameTh}
                    onChange={(e) => setLastNameTh(e.target.value)}
                    required
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Organization Hierarchy Section */}
              <div className={`p-3.5 border rounded-2xl space-y-3 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center space-x-2 text-xs font-bold text-sky-500">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {currentUser.role === UserRole.STUDENT
                      ? 'สังกัดและหลักสูตรการศึกษา (เลือกจากรายการในระบบ)'
                      : 'สังกัดการทำงานและหลักสูตรที่รับผิดชอบ'}
                  </span>
                </div>

                {/* University & Faculty */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      1. มหาวิทยาลัย <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={universityCode}
                      onChange={(e) => setUniversityCode(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    >
                      {universities.map((u) => (
                        <option key={u.id || u.code} value={u.code}>
                          {u.nameTh} ({u.code})
                        </option>
                      ))}
                      {universities.length === 0 && (
                        <option value="MU">มหาวิทยาลัยมหิดล (MU)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      2. คณะ / หน่วยงาน <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={facultyCode}
                      onChange={(e) => setFacultyCode(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    >
                      {faculties
                        .filter((f) => !f.universityCode || f.universityCode === universityCode)
                        .map((f) => (
                          <option key={f.id || f.code} value={f.code}>
                            {f.nameTh} ({f.code})
                          </option>
                        ))}
                      {faculties.length === 0 && (
                        <option value="MT">คณะเทคนิคการแพทย์ (MT)</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    3. ภาควิชา (Department)
                  </label>
                  <select
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  >
                    <option value="">-- ไม่ระบุ / ไม่สังกัดภาควิชา --</option>
                    {departments
                      .filter((d) => !d.facultyCode || d.facultyCode === facultyCode)
                      .map((d) => (
                        <option key={d.id || d.code} value={d.code}>
                          {d.nameTh} ({d.code})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Role Specific */}
                {currentUser.role === UserRole.STUDENT ? (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      4. หลักสูตรการศึกษา (Curriculum / Program) <span className="text-rose-500">* (เลือกจากระบบ)</span>
                    </label>
                    <select
                      value={programCode}
                      onChange={(e) => setProgramCode(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-sky-300' : 'bg-white border-slate-300 text-sky-800 shadow-sm'
                      }`}
                    >
                      <option value="">-- กรุณาเลือกหลักสูตรที่กำลังศึกษา --</option>
                      {curriculums
                        .filter((c) => !facultyCode || !c.facultyCode || c.facultyCode === facultyCode)
                        .map((c) => (
                          <option key={c.id || c.code} value={c.code}>
                            {c.nameTh} ({c.code}) - {c.degreeLevel || 'ปริญญาตรี'}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        4. แขนงวิชา (Branch / Major - optional)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น เทคนิคการแพทย์, รังสีเทคนิค"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        5. หลักสูตรที่สังกัด / รับผิดชอบ (เลือกได้มากกว่า 1 หลักสูตร)
                      </label>
                      <div className={`p-2.5 border rounded-xl max-h-36 overflow-y-auto space-y-1.5 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        {curriculums.map((c) => {
                          const isChecked = affiliatedPrograms.includes(c.code) || affiliatedPrograms.includes(c.nameTh);
                          return (
                            <label
                              key={c.id || c.code}
                              className={`flex items-center space-x-2 text-xs p-1.5 rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-50 text-sky-900 font-bold'
                                  : isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAffiliatedPrograms([...affiliatedPrograms, c.code]);
                                  } else {
                                    setAffiliatedPrograms(affiliatedPrograms.filter((p) => p !== c.code && p !== c.nameTh));
                                  }
                                }}
                                className="rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                              />
                              <span>{c.nameTh} ({c.code})</span>
                            </label>
                          );
                        })}
                        {curriculums.length === 0 && (
                          <p className={`text-[11px] italic p-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            ไม่พบรายการหลักสูตรในระบบ
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    First Name (English)
                  </label>
                  <input
                    type="text"
                    value={firstNameEn}
                    onChange={(e) => setFirstNameEn(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Last Name (English)
                  </label>
                  <input
                    type="text"
                    value={lastNameEn}
                    onChange={(e) => setLastNameEn(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Theme Preference Selection */}
              <div className={`p-3.5 border rounded-2xl ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  โหมดการแสดงผล (Display Theme Mode)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      themeMode === 'light'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                        : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>สว่าง (Light)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      themeMode === 'dark'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                        : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-sky-400" />
                    <span>มืด (Dark)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      themeMode === 'system'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                        : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Monitor className="w-4 h-4 text-slate-400" />
                    <span>ตามอุปกรณ์ (Auto)</span>
                  </button>
                </div>
                <p className={`text-[10px] mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {themeMode === 'system'
                    ? 'โหมดตามอุปกรณ์จะปรับเปลี่ยนเป็นสว่างหรือมืดโดยอัตโนมัติตามการตั้งค่าเครื่องของคุณ (Auto System)'
                    : `ล็อกธีมไว้ที่โหมด ${themeMode === 'light' ? 'สว่าง (Light)' : 'มืด (Dark)'} โดยไม่ขึ้นกับธีมเครื่อง`}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {successMsg ? (
                  <div className="flex items-center space-x-1.5 text-emerald-500 dark:text-emerald-400 font-bold text-xs bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                ) : errorMsg ? (
                  <div className="flex items-center space-x-1.5 text-rose-500 dark:text-rose-400 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30 animate-in fade-in">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center space-x-2 shrink-0"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                  <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab GPS & Maps Picker */}
          {activeTab === 'gps' && (
            <div className="space-y-4">
              <div className={`p-4 border rounded-2xl ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center space-x-2 font-bold text-teal-400 text-xs mb-1">
                  <MapPin className="w-4 h-4" />
                  <span>ค้นหาและเลือกตำแหน่ง GPS ประจำตัวผู้สอน / สถานศึกษา</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  อาจารย์สามารถค้นหาชื่อสถานที่ มหาวิทยาลัย หรือเลื่อนปรับหมุดด้วยตัวเองในแผนที่เพื่อใช้เป็นพิกัดอ้างอิงในการเช็คชื่อได้
                </p>
              </div>

              <MapPicker
                initialLat={userLat}
                initialLng={userLng}
                isDarkMode={isDarkMode}
                onSelectLocation={(selectedLat, selectedLng, addressName) => {
                  setUserLat(selectedLat);
                  setUserLng(selectedLng);
                  if (addressName) setSavedPlaceName(addressName);
                  setSuccessMsg(`บันทึกตำแหน่ง GPS สำเร็จ (${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)})`);
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
              />
            </div>
          )}

          {/* Tab 2: Change Password */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {isPasswordNotRequired ? (
                <div className={`p-3.5 border rounded-2xl flex items-start space-x-3 text-xs ${
                  isDarkMode ? 'bg-sky-950/40 border-sky-800/50 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}>
                  <ShieldCheck className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      {currentUser.authProvider === 'google'
                        ? 'บัญชีเชื่อมต่อผ่าน Google Account (Google SSO)'
                        : 'บัญชียังไม่ได้กำหนดรหัสผ่านประจำตัว'}
                    </span>
                    <p className="opacity-90 leading-relaxed text-[11px]">
                      {currentUser.authProvider === 'google'
                        ? `คุณเข้าสู่ระบบผ่าน Google Account อย่างปลอดภัย สามารถกำหนดรหัสผ่านใหม่เพื่อใช้เข้าสู่ระบบด้วยอีเมล (${currentUser.email}) ได้โดยตรง โดยไม่ต้องระบุรหัสผ่านเดิม`
                        : 'คุณสามารถกำหนดรหัสผ่านใหม่สำหรับเข้าใช้งานบัญชีนี้ได้โดยตรง'}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    รหัสผ่านปัจจุบัน (Current Password) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านเดิม"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 pl-9 pr-9 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                    <Lock className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className={`absolute right-3 top-2.5 transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    รหัสผ่านใหม่ (New Password) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 pl-9 pr-9 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                    <Lock className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className={`absolute right-3 top-2.5 transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ยืนยันรหัสผ่านใหม่ (Confirm Password) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3 py-2 pl-9 pr-9 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                    <Lock className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3 top-2.5 transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center space-x-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'กำลังอัปเดต...' : 'อัปเดตรหัสผ่านใหม่'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Device & Security */}
          {activeTab === 'device' && (
            <div className="space-y-4 text-xs">
              {/* Role & Device Limit Status Header */}
              <div className={`p-4 border rounded-2xl space-y-3 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-emerald-500">
                    <Shield className="w-4 h-4" />
                    <span>สิทธิ์และการผูกอุปกรณ์ (Device Binding Policy)</span>
                  </div>
                  <button
                    onClick={loadDevices}
                    disabled={fetchingDevices}
                    className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition ${
                      isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                    }`}
                    title="รีเฟรชข้อมูลอุปกรณ์"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingDevices ? 'animate-spin' : ''}`} />
                    <span>รีเฟรช</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <span className={`block text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>บทบาทบัญชีผู้ใช้</span>
                    <span className="font-bold text-sm">
                      {currentUser.role === UserRole.TEACHER ? '👨‍🏫 อาจารย์ (Teacher)' : currentUser.role === UserRole.ADMIN ? '🛡️ ผู้ดูแลระบบ (Admin)' : '🧑‍🎓 นักศึกษา (Student)'}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <span className={`block text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>โควตานโยบายผูกอุปกรณ์</span>
                    {isTeacherOrAdmin || maxDevicesLimit === null ? (
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ไม่จำกัดจำนวนอุปกรณ์ (Unlimited)</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-xs text-amber-400">
                          สูงสุด {maxDevicesLimit} เครื่อง ({boundDevices.length}/{maxDevicesLimit})
                        </span>
                        <div className="w-20 bg-slate-700 h-2 rounded-full overflow-hidden ml-2">
                          <div
                            className={`h-full ${boundDevices.length >= maxDevicesLimit ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (boundDevices.length / (maxDevicesLimit || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isTeacherOrAdmin || maxDevicesLimit === null ? (
                    '💡 สำหรับบัญชีนี้ สามารถผูกและสลับใช้งานอุปกรณ์ได้ไม่จำกัดจำนวน เพื่อความสะดวกในการเข้าใช้งาน'
                  ) : (
                    `🔒 สำหรับนักศึกษา สามารถผูกอุปกรณ์ประจำตัวได้สูงสุด ${maxDevicesLimit} เครื่อง ตามที่ผู้ดูแลระบบกำหนด เพื่อป้องกันการส่งรหัสให้ผู้อื่นเช็คชื่อแทน`
                  )}
                </p>

                {/* Smart Hardware Fingerprint Banner */}
                <div className={`p-3 rounded-xl border flex items-start space-x-2 text-[11px] leading-relaxed ${
                  isDarkMode ? 'bg-sky-950/30 border-sky-800/40 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}>
                  <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">💡 คำแนะนำสำหรับการเข้าใช้งานแบบส่วนตัว (Incognito/Private Browsing):</span>
                    ระบบใช้ระบบ <span className="font-semibold text-emerald-500 dark:text-emerald-400">Smart Hardware Fingerprint</span> ในการวิเคราะห์และจดจำฮาร์ดแวร์ประจำเครื่อง ทำให้อุปกรณ์ของคุณยังคงถูกจดจำว่าเป็นเครื่องเดิมแม้เปิดในโหมดท่องเว็บส่วนตัว หากมีการสลับเครื่องใหม่และโควตาเต็ม สามารถกดรูปถังขยะ <Trash2 className="w-3 h-3 inline text-rose-400" /> เพื่อปลดล็อกอุปกรณ์เดิมได้เองทันที
                  </div>
                </div>
              </div>

              {/* Current Device Box */}
              <div className={`p-4 border rounded-2xl space-y-3 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-sky-400">
                    <Smartphone className="w-4 h-4" />
                    <span>อุปกรณ์ที่คุณกำลังใช้งานขณะนี้ (This Current Device)</span>
                  </div>
                  {boundDevices.some((d) => d.deviceId === currentDevInfo.deviceId || (currentDevInfo.hardwareFingerprint && d.deviceId.includes(currentDevInfo.hardwareFingerprint))) ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>ผูกอยู่ในระบบแล้ว (Smart Protected)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>ยังไม่ได้ผูกเครื่องนี้</span>
                    </span>
                  )}
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                      {currentDevInfo.deviceType === 'TABLET' ? (
                        <Tablet className="w-4 h-4" />
                      ) : currentDevInfo.deviceType === 'MOBILE' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : (
                        <Monitor className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs">{currentDevInfo.deviceName}</div>
                      <div className={`font-mono text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        ID: {currentDevInfo.deviceId.slice(0, 16)}...
                      </div>
                    </div>
                  </div>

                  {!boundDevices.some((d) => d.deviceId === currentDevInfo.deviceId) && (
                    <button
                      onClick={handleBindCurrentDevice}
                      disabled={deviceActionLoading || (!isTeacherOrAdmin && maxDevicesLimit !== null && boundDevices.length >= maxDevicesLimit)}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ผูกอุปกรณ์นี้</span>
                    </button>
                  )}
                </div>

                {!isTeacherOrAdmin && maxDevicesLimit !== null && boundDevices.length >= maxDevicesLimit && !boundDevices.some((d) => d.deviceId === currentDevInfo.deviceId) && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>คุณผูกอุปกรณ์ครบ {maxDevicesLimit} เครื่องแล้ว หากต้องการใช้เครื่องนี้ กรุณายกเลิกการผูกอุปกรณ์เดิม 1 เครื่องก่อน</span>
                  </div>
                )}
              </div>

              {/* Bound Devices List */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs flex items-center justify-between px-1">
                  <span>รายการอุปกรณ์ที่ผูกอยู่ในระบบ ({boundDevices.length} เครื่อง)</span>
                </h4>

                {boundDevices.length === 0 ? (
                  <div className={`p-6 text-center rounded-2xl border ${
                    isDarkMode ? 'bg-slate-800/30 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-xs">ยังไม่มีการผูกอุปกรณ์ในระบบ</p>
                    <p className="text-[11px] mt-0.5">อุปกรณ์จะถูกผูกโดยอัตโนมัติเมื่อท่านลงชื่อเข้าใช้หรือเช็คชื่อเข้าเรียนครั้งแรก</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {boundDevices.map((dev, idx) => {
                      const isCurrent = dev.deviceId === currentDevInfo.deviceId || (currentDevInfo.hardwareFingerprint && dev.deviceId.includes(currentDevInfo.hardwareFingerprint));
                      return (
                        <div
                          key={dev.id || dev.deviceId || `dev_${idx}`}
                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                            isCurrent
                              ? isDarkMode
                                ? 'bg-emerald-950/20 border-emerald-500/40'
                                : 'bg-emerald-50/50 border-emerald-300'
                              : isDarkMode
                              ? 'bg-slate-800/60 border-slate-700'
                              : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              isCurrent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/40 text-slate-300'
                            }`}>
                              {dev.deviceType === 'TABLET' ? (
                                <Tablet className="w-4 h-4" />
                              ) : dev.deviceType === 'MOBILE' ? (
                                <Smartphone className="w-4 h-4" />
                              ) : (
                                <Monitor className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs">{dev.deviceName || 'อุปกรณ์ผูกประจำตัว'}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    เครื่องปัจจุบัน
                                  </span>
                                )}
                                {dev.isPrimary && !isCurrent && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                    เครื่องหลัก
                                  </span>
                                )}
                              </div>
                              <div className={`font-mono text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                UUID: {dev.deviceId ? dev.deviceId.slice(0, 18) : 'N/A'}...
                              </div>
                              <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                ผูกเมื่อ: {new Date(dev.boundAt || Date.now()).toLocaleDateString('th-TH')} | ใช้งานล่าสุด: {new Date(dev.lastUsedAt || Date.now()).toLocaleDateString('th-TH')}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setDeviceToDelete({ id: dev.id, deviceId: dev.deviceId, name: dev.deviceName || 'อุปกรณ์ผูกประจำตัว' })}
                            disabled={deviceActionLoading}
                            className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:text-rose-300 transition disabled:opacity-50 cursor-pointer flex items-center space-x-1 border border-rose-500/20"
                            title="ยกเลิกการผูกอุปกรณ์นี้"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-[11px] font-extrabold sm:inline hidden">ยกเลิกผูก</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reset All Action */}
              {boundDevices.length > 0 && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowResetAllConfirm(true)}
                    disabled={deviceActionLoading}
                    className="py-2 px-3 rounded-xl text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 transition disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ยกเลิกผูกอุปกรณ์ทั้งหมด (Reset All)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Single Device Deletion */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">ยืนยันยกเลิกการผูกอุปกรณ์</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">การยกเลิกผูกอุปกรณ์จะปลดการล็อกเครื่องออกจากบัญชี</p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className="font-bold block text-slate-600 dark:text-slate-400">อุปกรณ์ที่จะยกเลิก:</span>
              <span className="text-rose-600 dark:text-rose-400 font-black text-sm block">{deviceToDelete.name}</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeviceToDelete(null)}
                disabled={deviceActionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteDevice}
                disabled={deviceActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95 transition cursor-pointer flex items-center space-x-2"
              >
                {deviceActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>ยืนยันปลดอุปกรณ์</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Resetting All Devices */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">ยืนยันรีเซ็ตการผูกอุปกรณ์ทั้งหมด</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">รายการอุปกรณ์ที่ผูกไว้ทั้งหมด ({boundDevices.length} เครื่อง) จะถูกลบออก</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetAllConfirm(false)}
                disabled={deviceActionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmResetAllDevices}
                disabled={deviceActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95 transition cursor-pointer flex items-center space-x-2"
              >
                {deviceActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>ยืนยันรีเซ็ตทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
