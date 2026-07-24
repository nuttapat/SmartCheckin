import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { loginUser, forgotPassword } from '../services/api';
import { QrCode, Mail, LogIn, UserPlus, ShieldAlert, Sun, Moon, Lock, Eye, EyeOff, User as UserIcon, KeyRound, CheckCircle2, X } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onOpenRegister: () => void;
  allUsers: User[];
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onOpenRegister,
  allUsers,
  isDarkMode,
  onToggleTheme,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Forgot password state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string>('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('กรุณากรอกอีเมลที่ใช้ลงทะเบียน');
      return;
    }

    if (!password) {
      setErrorMsg('กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ');
      return;
    }

    try {
      setLoading(true);
      const res = await loginUser(cleanEmail, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่พบผู้ใช้งานในระบบหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotEmail(email);
    setForgotErrorMsg('');
    setForgotSuccessMsg('');
    setIsForgotPasswordOpen(true);
  };

  const handleSendForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg('');
    setForgotSuccessMsg('');

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setForgotErrorMsg('กรุณากรอกอีเมลที่ใช้ลงทะเบียน');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await forgotPassword(cleanEmail);
      setForgotSuccessMsg(res.message);
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'ไม่พบผู้ใช้งานในระบบที่มีอีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleQuickLogin = (user: User) => {
    onLoginSuccess(user);
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center p-4 relative transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950' 
        : 'bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white'
    }`}>
      {/* Top Header Controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center space-x-3">
        <button
          onClick={onToggleTheme}
          className={`p-2.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold transition ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800' 
              : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md my-8">
        {/* Brand & App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-xl shadow-emerald-500/20 mb-4">
            <QrCode className="w-9 h-9 text-white stroke-[2.5]" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Smart Attendance System
          </h1>
          <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            ระบบเช็คชื่อนักศึกษาอัจฉริยะด้วย Anti-Proxy & Dynamic QR Code
          </p>
        </div>

        {/* Login Card */}
        <div className={`border rounded-3xl p-6 sm:p-8 shadow-2xl transition-all ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="mb-6">
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              เข้าสู่ระบบ (Sign In)
            </h2>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              กรอกอีเมลที่ได้ลงทะเบียนไว้เพื่อเข้าใช้งานระบบ
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                อีเมลผู้ใช้งาน (Email Address) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="เช่น somchai@university.ac.th"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3.5 py-2.5 pl-10 text-xs focus:outline-none focus:border-emerald-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <Mail className={`w-4 h-4 absolute left-3.5 top-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสผ่าน (Password)
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgotPassword}
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านของท่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-xs focus:outline-none focus:border-emerald-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <Lock className={`w-4 h-4 absolute left-3.5 top-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3.5 top-3 transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>กำลังเข้าสู่ระบบ...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </>
              )}
            </button>
          </form>

          {/* Create Account Action */}
          <div className={`mt-6 pt-5 border-t text-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              ยังไม่มีบัญชีผู้ใช้งาน?{' '}
              <button
                type="button"
                onClick={onOpenRegister}
                className="font-bold text-emerald-500 hover:text-emerald-400 hover:underline inline-flex items-center space-x-1 ml-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>สร้างบัญชีผู้ใช้ใหม่</span>
              </button>
            </p>
          </div>
        </div>

        {/* Quick Demo Accounts Selection */}
        {allUsers && allUsers.length > 0 && (
          <div className={`mt-6 border rounded-2xl p-4 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-100/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}>
                ⚡ บัญชีทดสอบระบบด่วน (Demo Accounts)
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold">คลิกเลือกเพื่อเข้าสู่ระบบทันที</span>
            </div>
            <div className="space-y-2">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleQuickLogin(u)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition ${
                    isDarkMode 
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      u.role === UserRole.TEACHER ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold">{u.title} {u.firstNameTh} {u.lastNameTh}</p>
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    u.role === UserRole.TEACHER 
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300' 
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  }`}>
                    {u.role === UserRole.TEACHER ? 'อาจารย์' : 'นักศึกษา'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl relative transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button
              onClick={() => setIsForgotPasswordOpen(false)}
              className={`absolute top-4 right-4 p-2 rounded-full transition ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">ลืมรหัสผ่าน (Forgot Password)</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ระบบจะตรวจสอบและส่งรหัสผ่านไปยังอีเมลของคุณ
                </p>
              </div>
            </div>

            {forgotErrorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{forgotErrorMsg}</span>
              </div>
            )}

            {forgotSuccessMsg ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start space-x-3 text-emerald-600 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-emerald-500">ตรวจสอบอีเมลของคุณ</p>
                    <p className="leading-relaxed">{forgotSuccessMsg}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  ตกลงและกลับหน้าเข้าสู่ระบบ
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendForgotPassword} className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    กรอกอีเมลที่ลงทะเบียนไว้ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="เช่น somchai@university.ac.th"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-3.5 py-2.5 pl-10 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <Mail className={`w-4 h-4 absolute left-3.5 top-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center space-x-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <span>กำลังส่งข้อมูล...</span>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>ส่งรหัสผ่านไปยังอีเมล</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
