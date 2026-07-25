import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { updateUserProfile } from '../services/api';
import { X, User as UserIcon, Lock, Shield, CheckCircle2, ShieldAlert, Eye, EyeOff, KeyRound, Smartphone, Mail, MapPin, Globe } from 'lucide-react';
import { MapPicker } from './MapPicker';

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
  isDarkMode = true,
  initialTab = 'profile',
}) => {
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

  // Status
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (currentUser) {
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const finalTitle = titleOption === 'OTHER' ? customTitle.trim() : titleOption;
    if (!finalTitle) {
      setErrorMsg('กรุณาระบุคำนำหน้าชื่อ');
      return;
    }

    if (!firstNameTh.trim() || !lastNameTh.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุลภาษาไทย');
      return;
    }

    if (currentUser.role === UserRole.STUDENT && !universityId.trim()) {
      setErrorMsg('กรุณากรอกรหัสนักศึกษา');
      return;
    }

    try {
      setLoading(true);
      const res = await updateUserProfile(currentUser.id, {
        title: finalTitle,
        firstNameTh: firstNameTh.trim(),
        lastNameTh: lastNameTh.trim(),
        firstNameEn: firstNameEn.trim() || firstNameTh.trim(),
        lastNameEn: lastNameEn.trim() || lastNameTh.trim(),
        universityId: universityId.trim(),
      });

      onUpdateUser(res.user);
      setSuccessMsg('อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword) {
      setErrorMsg('กรุณากรอกรหัสผ่านปัจจุบัน');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    try {
      setLoading(true);
      const res = await updateUserProfile(currentUser.id, {
        currentPassword,
        newPassword,
      });

      onUpdateUser(res.user);
      setSuccessMsg('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านปัจจุบัน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl border rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">ตั้งค่าบัญชีผู้ใช้ (User Settings)</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentUser.title} {currentUser.firstNameTh} {currentUser.lastNameTh} ({currentUser.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b px-5 pt-3 gap-1 sm:gap-2 overflow-x-auto ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 px-3 sm:px-4 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>ข้อมูลส่วนตัว</span>
          </button>
          <button
            onClick={() => { setActiveTab('password'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 px-3 sm:px-4 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'password'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>รหัสผ่าน</span>
          </button>
          <button
            onClick={() => { setActiveTab('device'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 px-3 sm:px-4 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'device'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>อุปกรณ์ & ความปลอดภัย</span>
          </button>
          <button
            onClick={() => { setActiveTab('gps'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 px-3 sm:px-4 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'gps'
                ? 'border-teal-500 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>ตำแหน่ง GPS & แผนที่</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-2.5 text-emerald-600 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tab 1: Personal Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
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

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
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
              <div className={`p-4 border rounded-2xl space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center space-x-2 font-bold text-emerald-500">
                  <Shield className="w-4 h-4" />
                  <span>สถานะสิทธิ์และประเภทบัญชี</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>ประเภทบทบาท: </span>
                    <span className="font-semibold">{currentUser.role === UserRole.TEACHER ? '👨‍🏫 อาจารย์ (Teacher)' : '🧑‍🎓 นักศึกษา (Student)'}</span>
                  </div>
                  <div>
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>รหัสประจำตัว: </span>
                    <span className="font-semibold">{currentUser.universityId || '-'}</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 border rounded-2xl space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center space-x-2 font-bold text-sky-500">
                  <Smartphone className="w-4 h-4" />
                  <span>การผูกอุปกรณ์ประจำตัว (Device Fingerprint)</span>
                </div>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  ระบบ Anti-Proxy Check-in ใช้ Device ID เพื่อยืนยันว่าไม่มีการเช็คชื่อแทนกันจากอุปกรณ์อื่น
                </p>
                <div className={`p-2.5 rounded-xl font-mono text-[11px] break-all border ${
                  isDarkMode ? 'bg-slate-900 border-slate-700/80 text-emerald-400' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  Device UUID: {currentUser.deviceId || 'dev_bound_device'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
