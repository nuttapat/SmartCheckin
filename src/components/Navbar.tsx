import React, { useState, useRef } from 'react';
import { User, UserRole } from '../types';
import { QrCode, User as UserIcon, Plus, Sparkles, Sun, Moon, Monitor, LogOut, Settings, KeyRound, ChevronDown, MapPin, Bot } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  allUsers: User[];
  onOpenRegister: () => void;
  onOpenCreateCourse: () => void;
  onOpenJoinCourse: () => void;
  onOpenQuickEvent?: () => void;
  onOpenUserSettings: (tab?: 'profile' | 'password' | 'device' | 'gps') => void;
  onOpenTestingAgent?: () => void;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectUser,
  allUsers,
  onOpenRegister,
  onOpenCreateCourse,
  onOpenJoinCourse,
  onOpenQuickEvent,
  onOpenUserSettings,
  onOpenTestingAgent,
  onLogout,
  isDarkMode: propIsDarkMode,
  onToggleTheme,
}) => {
  const { themeMode, setThemeMode, isDarkMode: themeIsDarkMode, toggleTheme } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const handleToggleTheme = onToggleTheme || toggleTheme;
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    // Graceful 350ms delay before closing dropdown menu
    hoverTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 350);
  };
  const isTeacher = currentUser?.role === UserRole.TEACHER;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return (
    <header className={`${isDarkMode ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white/90 border-slate-200/80 text-slate-900'} backdrop-blur-md border-b sticky top-0 z-40 shadow-xs transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & App Name */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all ${
              isAdmin
                ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-800 shadow-purple-500/20'
                : isTeacher
                ? 'bg-gradient-to-tr from-sky-600 via-sky-500 to-blue-600 shadow-sky-500/20'
                : 'bg-gradient-to-tr from-sky-600 via-blue-500 to-indigo-600 shadow-blue-500/20'
            }`}>
              <QrCode className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-extrabold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Smart Attendance
                </span>
                <span className={`hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-extrabold border rounded-full transition-all ${
                  isAdmin
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : isTeacher
                    ? isDarkMode
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-sky-100 text-sky-950 border-sky-300'
                    : isDarkMode
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : 'bg-sky-100 text-sky-950 border-sky-300'
                }`}>
                  {isAdmin ? '🛠️ ผู้ดูแลระบบ' : isTeacher ? '👨‍🏫 อาจารย์' : '🧑‍🎓 นักศึกษา'}
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                ระบบเช็คชื่ออัจฉริยะ (Anti-Proxy & Dynamic QR)
              </p>
            </div>
          </div>

          {/* Action Buttons & Switcher */}
          <div className="flex items-center space-x-2.5">
            {/* User Profile & Settings Menu */}
            <div 
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => onOpenUserSettings('profile')}
                className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl border cursor-pointer transition ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-200 border-slate-700' 
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-200'
                }`}
                title="คลิกเพื่อจัดการโปรไฟล์และตั้งค่ารหัสผ่าน"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="font-semibold">
                    {currentUser ? `${currentUser.title} ${currentUser.firstNameTh}` : 'โปรไฟล์ผู้ใช้'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-1 hidden sm:block" />
              </button>

              {/* User Profile Dropdown Menu (with Hover Delay) */}
              {isDropdownOpen && (
                <div className={`absolute right-0 top-full mt-1.5 w-64 border rounded-2xl shadow-2xl py-2 z-50 transition-all animate-in fade-in duration-150 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className={`px-3 py-1.5 border-b text-[11px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'
                  }`}>
                    เมนูผู้ใช้งาน (User Profile Menu)
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => { setIsDropdownOpen(false); onOpenUserSettings('profile'); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center space-x-2.5 transition font-medium ${
                        isDarkMode ? 'hover:bg-slate-700/80 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Settings className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-semibold">ตั้งค่าข้อมูลส่วนตัว</p>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>แก้ไขชื่อ คำนำหน้า และข้อมูล</p>
                      </div>
                    </button>

                    <button
                      onClick={() => { setIsDropdownOpen(false); onOpenUserSettings('gps'); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center space-x-2.5 transition font-medium ${
                        isDarkMode ? 'hover:bg-slate-700/80 text-teal-300' : 'hover:bg-teal-50 text-teal-800'
                      }`}
                    >
                      <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-teal-400 dark:text-teal-300">📍 ตำแหน่ง GPS & แผนที่</p>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ระบุและตั้งพิกัด GPS บนแผนที่</p>
                      </div>
                    </button>

                    <button
                      onClick={() => { setIsDropdownOpen(false); onOpenUserSettings('password'); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center space-x-2.5 transition font-medium ${
                        isDarkMode ? 'hover:bg-slate-700/80 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <KeyRound className="w-4 h-4 text-sky-500 shrink-0" />
                      <div>
                        <p className="font-semibold">เปลี่ยนรหัสผ่าน</p>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>อัปเดตรหัสผ่านเข้าสู่ระบบ</p>
                      </div>
                    </button>
                  </div>

                  {onLogout && (
                    <div className={`border-t mt-1 pt-1 px-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                      <button
                        onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                        className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center space-x-2 font-semibold transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>ออกจากระบบ (Logout)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Switcher 3-Way Control */}
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                  isDarkMode 
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={`โหมดธีม: ${themeMode === 'light' ? 'สว่าง (Light)' : themeMode === 'dark' ? 'มืด (Dark)' : 'ตามระบบอุปกรณ์ (System Auto)'}`}
              >
                {themeMode === 'light' && <Sun className="w-5 h-5 text-amber-500" />}
                {themeMode === 'dark' && <Moon className="w-5 h-5 text-sky-400" />}
                {themeMode === 'system' && <Monitor className="w-5 h-5 text-slate-400" />}
              </button>

              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-44 rounded-2xl shadow-xl border p-1.5 z-50 text-xs font-semibold ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">โหมดการแสดงผล</div>
                    <button
                      onClick={() => { setThemeMode('light'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl cursor-pointer transition ${
                        themeMode === 'light' 
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold' 
                          : 'hover:bg-slate-500/10'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>สว่าง (Light)</span>
                    </button>
                    <button
                      onClick={() => { setThemeMode('dark'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl cursor-pointer transition ${
                        themeMode === 'dark' 
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold' 
                          : 'hover:bg-slate-500/10'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-sky-400" />
                      <span>มืด (Dark)</span>
                    </button>
                    <button
                      onClick={() => { setThemeMode('system'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl cursor-pointer transition ${
                        themeMode === 'system' 
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold' 
                          : 'hover:bg-slate-500/10'
                      }`}
                    >
                      <Monitor className="w-4 h-4 text-slate-400" />
                      <span>ตามอุปกรณ์ (Auto)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className={`p-2 rounded-xl transition ${
                  isDarkMode 
                    ? 'text-rose-400 hover:text-rose-300 hover:bg-slate-800' 
                    : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                }`}
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

