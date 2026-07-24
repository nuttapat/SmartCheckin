import React from 'react';
import { User, UserRole } from '../types';
import { QrCode, User as UserIcon, Plus, Sparkles, Sun, Moon, LogOut, Settings, KeyRound, ChevronDown } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  allUsers: User[];
  onOpenRegister: () => void;
  onOpenCreateCourse: () => void;
  onOpenJoinCourse: () => void;
  onOpenQuickEvent: () => void;
  onOpenUserSettings: () => void;
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
  onLogout,
  isDarkMode = true,
  onToggleTheme,
}) => {
  return (
    <header className={`${isDarkMode ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white/90 border-slate-200/80 text-slate-900'} backdrop-blur-md border-b sticky top-0 z-40 shadow-xs transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & App Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <QrCode className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-extrabold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Smart Attendance
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full">
                  PWA Active
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                ระบบเช็คชื่อนักศึกษาอัจฉริยะ (Anti-Proxy & Dynamic QR)
              </p>
            </div>
          </div>

          {/* Action Buttons & Switcher */}
          <div className="flex items-center space-x-2.5">
            {/* Contextual Quick Actions */}
            {currentUser && currentUser.role === UserRole.TEACHER && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onOpenCreateCourse}
                  className="hidden md:flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างวิชาเรียน</span>
                </button>
                <button
                  onClick={onOpenQuickEvent}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>เช็คชื่อด่วน</span>
                </button>
              </div>
            )}

            {currentUser && currentUser.role === UserRole.STUDENT && (
              <button
                onClick={onOpenJoinCourse}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>เข้าร่วมวิชาเรียน</span>
              </button>
            )}

            {/* User Profile & Settings Menu */}
            <div className="relative group">
              <button
                onClick={onOpenUserSettings}
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
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {currentUser?.role === UserRole.TEACHER ? '👨‍🏫 อาจารย์ (Teacher)' : '🧑‍🎓 นักศึกษา (Student)'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-1 hidden sm:block" />
              </button>

              {/* User Settings Dropdown Menu */}
              <div className={`absolute right-0 top-full mt-1.5 w-60 border rounded-2xl shadow-xl py-2 hidden group-hover:block z-50 transition-all ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className={`px-3 py-1.5 border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'
                }`}>
                  จัดการบัญชีผู้ใช้ (User Settings)
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    onClick={onOpenUserSettings}
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
                    onClick={onOpenUserSettings}
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
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center space-x-2 font-semibold transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>ออกจากระบบ (Logout)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Theme Switcher Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-2 rounded-xl transition ${
                  isDarkMode 
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={isDarkMode ? 'เปลี่ยนเป็นธีมสว่าง (Light Theme)' : 'เปลี่ยนเป็นธีมมืด (Dark Theme)'}
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-sky-600" />}
              </button>
            )}

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

