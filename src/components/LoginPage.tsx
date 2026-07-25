import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { loginUser, forgotPassword, googleLogin } from '../services/api';
import { signInWithGooglePopup } from '../lib/firebaseStore';
import { QrCode, Mail, LogIn, UserPlus, ShieldAlert, Sun, Moon, Lock, Eye, EyeOff, User as UserIcon, KeyRound, CheckCircle2, X, Sparkles } from 'lucide-react';

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
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  // Fallback Google Modal state if popup blocked
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [googleEmailInput, setGoogleEmailInput] = useState<string>('');
  const [googleNameInput, setGoogleNameInput] = useState<string>('');
  const [googleRoleSelect, setGoogleRoleSelect] = useState<UserRole>(UserRole.STUDENT);
  const [googleTitleOption, setGoogleTitleOption] = useState<string>('นาย');
  const [googleCustomTitle, setGoogleCustomTitle] = useState<string>('');
  const [googleFirstNameTh, setGoogleFirstNameTh] = useState<string>('');
  const [googleLastNameTh, setGoogleLastNameTh] = useState<string>('');
  const [googleFirstNameEn, setGoogleFirstNameEn] = useState<string>('');
  const [googleLastNameEn, setGoogleLastNameEn] = useState<string>('');
  const [googleStudentIdInput, setGoogleStudentIdInput] = useState<string>('');

  // Forgot password state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string>('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

  // Hidden dev mode state for demo accounts
  const [showDemoAccounts, setShowDemoAccounts] = useState<boolean>(false);

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const fbUser = await signInWithGooglePopup();
      if (fbUser && fbUser.email) {
        const res = await googleLogin(
          fbUser.email,
          fbUser.displayName || fbUser.email.split('@')[0],
          fbUser.photoURL || undefined
        );

        if (res.requiresOnboarding) {
          // New Google account - open Onboarding Modal with prefilled default name parts
          setGoogleEmailInput(fbUser.email);
          const rawName = fbUser.displayName || fbUser.email.split('@')[0];
          setGoogleNameInput(rawName);
          const parts = rawName.trim().split(' ');
          setGoogleFirstNameTh(parts[0] || '');
          setGoogleLastNameTh(parts.slice(1).join(' ') || '');
          setGoogleFirstNameEn(parts[0] || '');
          setGoogleLastNameEn(parts.slice(1).join(' ') || '');
          setIsGoogleModalOpen(true);
          return;
        }

        if (res.user) {
          onLoginSuccess(res.user);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Google popup error, presenting fallback account option:', err);
      // Popup blocked or closed - open smooth Google Account dialog
      setIsGoogleModalOpen(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!googleEmailInput.trim() || !googleEmailInput.includes('@')) {
      setErrorMsg('กรุณากรอก Google Email ที่ถูกต้อง');
      return;
    }

    const finalTitle = googleTitleOption === 'CUSTOM' ? googleCustomTitle.trim() : googleTitleOption;
    if (!finalTitle) {
      setErrorMsg('กรุณาระบุคำนำหน้าชื่อ');
      return;
    }

    if (!googleFirstNameTh.trim() || !googleLastNameTh.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุลภาษาไทย');
      return;
    }

    if (googleRoleSelect === UserRole.STUDENT && !googleStudentIdInput.trim()) {
      setErrorMsg('กรุณากรอกรหัสประจำตัวนักศึกษาที่ถูกต้องก่อนเริ่มต้นใช้งาน');
      return;
    }

    try {
      setGoogleLoading(true);
      const res = await googleLogin(
        googleEmailInput.trim().toLowerCase(),
        googleNameInput.trim() || `${googleFirstNameTh} ${googleLastNameTh}`.trim() || googleEmailInput.split('@')[0],
        'https://lh3.googleusercontent.com/a/default-user',
        googleRoleSelect,
        finalTitle,
        googleRoleSelect === UserRole.STUDENT ? googleStudentIdInput.trim() : undefined,
        googleFirstNameTh.trim(),
        googleLastNameTh.trim(),
        googleFirstNameEn.trim() || googleFirstNameTh.trim(),
        googleLastNameEn.trim() || googleLastNameTh.trim()
      );

      if (res.user) {
        setIsGoogleModalOpen(false);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
    } finally {
      setGoogleLoading(false);
    }
  };

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
              รองรับการเข้าสู่ระบบด้วย Google Account และ Email/Password
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* GOOGLE SIGN IN BUTTON */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-3 shadow-sm cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700/90 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? 'กำลังเข้าสู่ระบบผ่าน Google...' : 'เข้าสู่ระบบด้วย Google Account'}</span>
            </button>
          </div>

          {/* DIVIDER */}
          <div className="relative my-5 flex items-center justify-center">
            <div className={`w-full border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
            <span className={`absolute px-3 text-[11px] font-semibold uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'
            }`}>
              หรือด้วย Email & Password
            </span>
          </div>

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
                  <span>เข้าสู่ระบบด้วย Email</span>
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
                <span>ลงทะเบียนสร้างบัญชีใหม่</span>
              </button>
            </p>
          </div>
        </div>

        {/* Subtle toggle for dev mode demo accounts (Hidden by default) */}
        {allUsers && allUsers.length > 0 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className={`text-[11px] transition cursor-pointer font-medium ${
                isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {showDemoAccounts ? '🙈 ซ่อนบัญชีทดสอบระบบ' : '⚡ บัญชีทดสอบระบบ (Dev Mode)'}
            </button>
          </div>
        )}

        {/* Quick Demo Accounts Selection */}
        {showDemoAccounts && allUsers && allUsers.length > 0 && (
          <div className={`mt-3 border rounded-2xl p-4 transition-all ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-100/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}>
                ⚡ บัญชีทดสอบระบบด่วน (Demo Accounts)
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold">คลิกเพื่อสลับเข้าสู่ระบบ</span>
            </div>
            <div className="space-y-2">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleQuickLogin(u)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition cursor-pointer ${
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
                      <div className="flex items-center space-x-1.5">
                        <p className="font-semibold">{u.title} {u.firstNameTh} {u.lastNameTh}</p>
                        {u.authProvider === 'google' && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded font-medium">Google</span>
                        )}
                      </div>
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

        {/* Footer Credit & Copyright Info */}
        <div className={`mt-8 pt-4 border-t text-center space-y-1 ${
          isDarkMode ? 'border-slate-800/60 text-slate-500' : 'border-slate-200/80 text-slate-500'
        }`}>
          <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
            © 2026 พัฒนาโดย ผศ. ดร. ณัฐภัทร อนุวงศ์เจริญ
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            อัปเดตล่าสุด: 26 กรกฎาคม 2569
          </p>
        </div>
      </div>

      {/* Google Sign-In Dialog / Onboarding Modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className={`w-full max-w-lg border rounded-3xl shadow-2xl relative transition-all my-auto max-h-[92vh] flex flex-col ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`p-5 sm:p-6 border-b flex items-center justify-between shrink-0 ${
              isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">ตั้งค่าโปรไฟล์เข้าใช้งานด้วย Google</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    เลือกประเภทผู้ใช้งานและระบุข้อมูลประจำตัวให้สอดคล้องกับระบบ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGoogleModalOpen(false)}
                className={`p-2 rounded-full transition shrink-0 ${
                  isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCustomGoogleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-300 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  เลือกประเภทบัญชีผู้ใช้ (Account Role) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleRoleSelect(UserRole.STUDENT);
                      setGoogleTitleOption('นาย');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                      googleRoleSelect === UserRole.STUDENT
                        ? isDarkMode 
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 font-bold'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 font-bold shadow-sm'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-800/80 text-slate-400 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🧑‍🎓 นักศึกษา (Student)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleRoleSelect(UserRole.TEACHER);
                      setGoogleTitleOption('อ.ดร.');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                      googleRoleSelect === UserRole.TEACHER
                        ? isDarkMode 
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 font-bold'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 font-bold shadow-sm'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-800/80 text-slate-400 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>👨‍🏫 อาจารย์ (Teacher)</span>
                  </button>
                </div>
              </div>

              {/* Title & Student ID (for Students) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={googleRoleSelect === UserRole.STUDENT ? 'col-span-1' : 'col-span-1 md:col-span-3'}>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    คำนำหน้าชื่อ (Title) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={googleTitleOption}
                    onChange={(e) => setGoogleTitleOption(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  >
                    {googleRoleSelect === UserRole.STUDENT ? (
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

                {googleTitleOption === 'CUSTOM' && (
                  <div className="col-span-1 md:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      คำนำหน้าชื่อแบบระบุเอง
                    </label>
                    <input
                      type="text"
                      placeholder="ระบุคำนำหน้าชื่อ..."
                      value={googleCustomTitle}
                      onChange={(e) => setGoogleCustomTitle(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      }`}
                    />
                  </div>
                )}

                {googleRoleSelect === UserRole.STUDENT && (
                  <div className="col-span-1 md:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      รหัสนักศึกษา (Student ID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 66010012"
                      value={googleStudentIdInput}
                      onChange={(e) => setGoogleStudentIdInput(e.target.value)}
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
                    value={googleFirstNameTh}
                    onChange={(e) => setGoogleFirstNameTh(e.target.value)}
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
                    value={googleLastNameTh}
                    onChange={(e) => setGoogleLastNameTh(e.target.value)}
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
                    value={googleFirstNameEn}
                    onChange={(e) => setGoogleFirstNameEn(e.target.value)}
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
                    value={googleLastNameEn}
                    onChange={(e) => setGoogleLastNameEn(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Google Email Account */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  อีเมล Google (Google Email Account) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="เช่น user@gmail.com หรือ student@university.ac.th"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {googleLoading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกโปรไฟล์และเข้าสู่ระบบ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
