import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../types';
import { registerUser, googleLogin, fetchSystemSettings } from '../services/api';
import { signInWithGooglePopup } from '../lib/firebaseStore';
import { getDeviceInfo } from '../utils/deviceHelper';
import { X, UserCheck, Mail, ShieldAlert, Smartphone, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  isDarkMode?: boolean;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess, isDarkMode: propIsDarkMode }) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [titleOption, setTitleOption] = useState<string>('นาย');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [firstNameTh, setFirstNameTh] = useState<string>('');
  const [lastNameTh, setLastNameTh] = useState<string>('');
  const [firstNameEn, setFirstNameEn] = useState<string>('');
  const [lastNameEn, setLastNameEn] = useState<string>('');
  const [universityId, setUniversityId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [sysSettings, setSysSettings] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSystemSettings().then(setSysSettings).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto generate device ID signature from stable hardware fingerprint
  const deviceFingerprint = getDeviceInfo().deviceId;

  // Helper to check domain allowance based on dynamic server settings
  const checkIsDomainAllowed = (emailStr: string, currentSysSettings?: any): { allowed: boolean; reason?: string } => {
    const clean = emailStr.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return { allowed: false, reason: 'รูปแบบอีเมลไม่ถูกต้อง' };

    const settingsToUse = currentSysSettings || sysSettings;

    // Check if system settings allow other domains
    const allowOther = settingsToUse?.allowOtherDomainsSelfRegister ?? settingsToUse?.allowOtherDomains ?? false;
    if (allowOther) {
      return { allowed: true };
    }

    const domain = clean.split('@')[1] || '';

    let sDomains: string[] = settingsToUse?.studentDomains;
    if (!Array.isArray(sDomains) && settingsToUse?.studentDomain) {
      sDomains = settingsToUse.studentDomain.split(/[,;\s]+/).filter(Boolean);
    }
    if (!Array.isArray(sDomains) || sDomains.length === 0) {
      sDomains = ['student.mahidol.ac.th', 'student.mahidol.edu'];
    } else {
      sDomains = sDomains.map((d: string) => d.trim().toLowerCase().replace(/^@/, ''));
    }

    let tDomains: string[] = settingsToUse?.teacherDomains;
    if (!Array.isArray(tDomains) && settingsToUse?.teacherDomain) {
      tDomains = settingsToUse.teacherDomain.split(/[,;\s]+/).filter(Boolean);
    }
    if (!Array.isArray(tDomains) || tDomains.length === 0) {
      tDomains = ['mahidol.ac.th', 'mahidol.edu'];
    } else {
      tDomains = tDomains.map((d: string) => d.trim().toLowerCase().replace(/^@/, ''));
    }

    const isStudentDomain = sDomains.some((d: string) => domain === d || domain.endsWith('.' + d));
    const isTeacherDomain = tDomains.some((d: string) => domain === d || domain.endsWith('.' + d));

    if (isStudentDomain || isTeacherDomain) {
      return { allowed: true };
    }

    const allowedStudentStr = sDomains.map((d: string) => `@${d}`).join(', ');
    const allowedTeacherStr = tDomains.map((d: string) => `@${d}`).join(', ');
    const allowedList = [allowedStudentStr, allowedTeacherStr].filter(Boolean).join(' และ ');

    return {
      allowed: false,
      reason: `🚫 โดเมนอีเมล @${domain} ไม่ได้รับอนุญาตให้ลงทะเบียนเข้าใช้งานระบบ (อนุญาตเฉพาะโดเมนสถาบัน: ${allowedList || 'ตามที่กำหนด'} หรือติดต่อผู้ดูแลระบบเพื่อขอเปิดสิทธิ์)`,
    };
  };

  const handleGoogleRegister = async () => {
    setErrorMsg('');
    setGoogleLoading(true);

    const finalTitle = titleOption === 'CUSTOM' ? customTitle.trim() : titleOption;
    if (role === UserRole.STUDENT && !universityId.trim()) {
      setErrorMsg('กรุณากรอกรหัสนักศึกษาก่อนสมัครด้วย Google');
      setGoogleLoading(false);
      return;
    }

    try {
      const fbUser = await signInWithGooglePopup();
      if (fbUser && fbUser.email) {
        const cleanEmail = fbUser.email.trim().toLowerCase();
        const domainCheck = checkIsDomainAllowed(cleanEmail);
        if (!domainCheck.allowed) {
          setErrorMsg(domainCheck.reason || '🚫 โดเมนอีเมลนี้ไม่ได้รับอนุญาตให้ลงทะเบียนเข้าใช้งาน');
          setGoogleLoading(false);
          return;
        }

        const res = await googleLogin(
          cleanEmail,
          fbUser.displayName || `${firstNameTh} ${lastNameTh}`.trim() || cleanEmail.split('@')[0],
          fbUser.photoURL || undefined,
          role,
          finalTitle || (role === UserRole.TEACHER ? 'อ.ดร.' : 'นาย'),
          role === UserRole.STUDENT ? universityId.trim() : undefined,
          firstNameTh.trim() || undefined,
          lastNameTh.trim() || undefined,
          firstNameEn.trim() || undefined,
          lastNameEn.trim() || undefined,
          password.trim() || undefined
        );
        onSuccess(res.user);
        onClose();
        return;
      } else {
        // Fallback for mobile browser where popup is blocked or storage partitioned
        if (email.trim() && email.includes('@')) {
          const cleanEmail = email.trim().toLowerCase();
          const domainCheck = checkIsDomainAllowed(cleanEmail);
          if (!domainCheck.allowed) {
            setErrorMsg(domainCheck.reason || '🚫 โดเมนอีเมลนี้ไม่ได้รับอนุญาตให้ลงทะเบียนเข้าใช้งาน');
            setGoogleLoading(false);
            return;
          }

          const res = await googleLogin(
            cleanEmail,
            `${firstNameTh} ${lastNameTh}`.trim() || cleanEmail.split('@')[0],
            'https://lh3.googleusercontent.com/a/default-user',
            role,
            finalTitle || (role === UserRole.TEACHER ? 'อ.ดร.' : 'นาย'),
            role === UserRole.STUDENT ? universityId.trim() : undefined,
            firstNameTh.trim() || undefined,
            lastNameTh.trim() || undefined,
            firstNameEn.trim() || undefined,
            lastNameEn.trim() || undefined,
            password.trim() || undefined
          );
          onSuccess(res.user);
          onClose();
          return;
        } else {
          setErrorMsg('📱 ระบบตรวจพบเบราว์เซอร์มือถือบล็อก Popup ของ Google กรุณากรอกช่องอีเมลในฟอร์มด้านบน แล้วกดปุ่มลงทะเบียนด้วย Google อีกครั้ง');
        }
      }
    } catch (err: any) {
      console.warn('Google Register popup error:', err);
      const backendMsg = err?.message || '';
      setErrorMsg(backendMsg || 'เกิดข้อผิดพลาดในการลงทะเบียนด้วย Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const finalTitle = titleOption === 'CUSTOM' ? customTitle.trim() : titleOption;
    if (!finalTitle) {
      setErrorMsg('กรุณาระบุคำนำหน้าชื่อ (Title is required)');
      return;
    }

    if (!firstNameTh.trim() || !lastNameTh.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุลภาษาไทย');
      return;
    }

    if (role === UserRole.STUDENT && !universityId.trim()) {
      setErrorMsg('กรุณากรอกรหัสนักศึกษา');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('กรุณากรอกอีเมลส่วนตัว (Email is required)');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('กรุณากรอกอีเมลในรูปแบบที่ถูกต้อง (เช่น example@gmail.com)');
      return;
    }

    const domainCheck = checkIsDomainAllowed(cleanEmail);
    if (!domainCheck.allowed) {
      setErrorMsg(domainCheck.reason || '🚫 โดเมนอีเมลนี้ไม่ได้รับอนุญาตให้ลงทะเบียนเข้าใช้งาน');
      return;
    }

    if (!password) {
      setErrorMsg('กรุณากำหนดรหัสผ่าน (Password is required)');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน (Passwords do not match)');
      return;
    }

    const finalFirstNameEn = firstNameEn.trim() || firstNameTh.trim();
    const finalLastNameEn = lastNameEn.trim() || lastNameTh.trim();

    try {
      setLoading(true);
      const res = await registerUser({
        role,
        title: finalTitle,
        firstNameTh: firstNameTh.trim(),
        lastNameTh: lastNameTh.trim(),
        firstNameEn: finalFirstNameEn,
        lastNameEn: finalLastNameEn,
        universityId: role === UserRole.STUDENT ? universityId.trim() : '',
        email: cleanEmail,
        password: password,
        deviceId: deviceFingerprint,
      });

      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'การลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className={`border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`px-5 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>สร้างบัญชีผู้ใช้ใหม่ (Create Account)</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ลงทะเบียนบัญชีด้วยอีเมลส่วนตัวสำหรับอาจารย์และนักศึกษา</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition shrink-0 ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form noValidate onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Google Register Option */}
          <div className="p-3.5 border rounded-2xl bg-blue-500/5 border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                🚀 สมัครด่วนด้วย Google Account
              </p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ใช้ข้อมูลจากบัญชี Google เพื่อสร้างบัญชีและเข้าสู่ระบบได้ทันที
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              className="py-2 px-3.5 rounded-xl text-xs font-bold border border-blue-500/30 bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center space-x-2 shrink-0 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleLoading ? 'กำลังลงทะเบียน...' : 'สมัครด้วย Google'}</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className={`w-full border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
            <span className={`absolute px-3 text-[10px] font-semibold uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'
            }`}>
              หรือกรอกข้อมูลสมัครสมาชิกด้วย Email
            </span>
          </div>

          {/* Role Selection */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              เลือกประเภทบัญชีผู้ใช้ (Account Role)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRole(UserRole.STUDENT);
                  setTitleOption('นาย');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                  role === UserRole.STUDENT
                    ? isDarkMode 
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 font-bold'
                      : 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 font-bold shadow-sm'
                    : isDarkMode
                      ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
                }`}
              >
                <span>🧑‍🎓 บัญชีนักศึกษา (Student)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole(UserRole.TEACHER);
                  setTitleOption('อ.ดร.');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                  role === UserRole.TEACHER
                    ? isDarkMode 
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 font-bold'
                      : 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 font-bold shadow-sm'
                    : isDarkMode
                      ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
                }`}
              >
                <span>👨‍🏫 บัญชีอาจารย์ (Teacher)</span>
              </button>
            </div>
          </div>

          {/* Title & Student ID (Student only) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={role === UserRole.STUDENT ? 'col-span-1' : 'col-span-1 md:col-span-3'}>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                คำนำหน้าชื่อ (Title)
              </label>
              <select
                value={titleOption}
                onChange={(e) => setTitleOption(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                }`}
              >
                {role === UserRole.STUDENT ? (
                  <>
                    <option value="นาย">นาย (Mr.)</option>
                    <option value="นางสาว">นางสาว (Ms.)</option>
                    <option value="นาง">นาง (Mrs.)</option>
                    <option value="CUSTOM">อื่นๆ (Custom...)</option>
                  </>
                ) : (
                  <>
                    <option value="อ.ดร.">อ.ดร. (Dr.)</option>
                    <option value="ผศ.ดร.">ผศ.ดร. (Asst. Prof. Dr.)</option>
                    <option value="รศ.ดร.">รศ.ดร. (Assoc. Prof. Dr.)</option>
                    <option value="ศ.ดร.">ศ.ดร. (Prof. Dr.)</option>
                    <option value="อ.">อ. (Instructor)</option>
                    <option value="CUSTOM">อื่นๆ (Custom...)</option>
                  </>
                )}
              </select>
            </div>

            {titleOption === 'CUSTOM' && (
              <div className="col-span-1 md:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  คำนำหน้าชื่อแบบระบุเอง
                </label>
                <input
                  type="text"
                  placeholder="ระบุคำนำหน้าชื่อ..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  }`}
                />
              </div>
            )}

            {/* Student ID field rendered ONLY for students */}
            {role === UserRole.STUDENT && (
              <div className="col-span-1 md:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสนักศึกษา (Student ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น 66010012"
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

          {/* Thai Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ชื่อ (ภาษาไทย) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="สมชาย"
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
                placeholder="ใจดี"
                value={lastNameTh}
                onChange={(e) => setLastNameTh(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                }`}
              />
            </div>
          </div>

          {/* English Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                First Name (English)
              </label>
              <input
                type="text"
                placeholder="Somchai"
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
                placeholder="Jaidee"
                value={lastNameEn}
                onChange={(e) => setLastNameEn(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                }`}
              />
            </div>
          </div>

          {/* Personal Email */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              อีเมลส่วนตัว (Personal Email) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="เช่น somchai@gmail.com, name@hotmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-emerald-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                }`}
              />
              <Mail className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              ใช้อีเมลส่วนตัวของท่านในการเข้าสู่ระบบและรับการแจ้งเตือน
            </p>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสผ่าน (Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3 py-2 pl-9 pr-9 text-xs focus:outline-none focus:border-emerald-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  }`}
                />
                <Lock className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-2.5 transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ยืนยันรหัสผ่าน (Confirm Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

          {/* Anti-proxy device binding notice */}
          <div className={`p-3 border rounded-xl flex items-start space-x-3 text-[11px] ${
            isDarkMode ? 'bg-slate-800/80 border-slate-700/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <Smartphone className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Device Binding Signature: </span>
              <span>
                อุปกรณ์เครื่องนี้จะถูกผูกเข้ากับบัญชีด้วย Device UUID (<code>{deviceFingerprint}</code>) เพื่อความปลอดภัย
              </span>
            </div>
          </div>

          {/* Submit */}
          <div className={`pt-2 flex items-center justify-end space-x-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center space-x-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>สร้างบัญชีผู้ใช้งาน</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

