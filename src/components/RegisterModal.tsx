import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { registerUser } from '../services/api';
import { X, UserCheck, Mail, ShieldAlert, Smartphone, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  isDarkMode?: boolean;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess, isDarkMode = true }) => {
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

  if (!isOpen) return null;

  // Auto generate device ID signature
  const deviceFingerprint = `dev_${Math.random().toString(36).substring(2, 10)}`;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>สร้างบัญชีผู้ใช้ใหม่ (Create Account)</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ลงทะเบียนบัญชีด้วยอีเมลส่วนตัวสำหรับอาจารย์และนักศึกษา</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form noValidate onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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

