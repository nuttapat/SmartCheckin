import React, { useState } from 'react';
import { User, UserRole } from '../types';
import {
  X,
  Zap,
  Search,
  User as UserIcon,
  Shield,
  BookOpen,
  GraduationCap,
  Check,
  ArrowRight,
} from 'lucide-react';

interface DemoAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  isDarkMode?: boolean;
}

export const DemoAccountsModal: React.FC<DemoAccountsModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onSelectUser,
  isDarkMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter((u) => {
    // Role filter
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

    // Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const nameTh = `${u.title || ''}${u.firstNameTh || ''} ${u.lastNameTh || ''}`.toLowerCase();
      const nameEn = `${u.firstNameEn || ''} ${u.lastNameEn || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const studentId = (u.studentId || '').toLowerCase();

      return (
        nameTh.includes(term) ||
        nameEn.includes(term) ||
        email.includes(term) ||
        studentId.includes(term)
      );
    }

    return true;
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return <Shield className="w-4 h-4 text-purple-400" />;
      case UserRole.TEACHER:
        return <BookOpen className="w-4 h-4 text-sky-400" />;
      case UserRole.STUDENT:
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      default:
        return <UserIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return {
          label: 'ผู้ดูแลระบบ (Admin)',
          bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
          avatarBg: 'bg-purple-500/20 text-purple-400',
        };
      case UserRole.TEACHER:
        return {
          label: 'อาจารย์ (Teacher)',
          bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
          avatarBg: 'bg-sky-500/20 text-sky-400',
        };
      case UserRole.STUDENT:
        return {
          label: 'นักศึกษา (Student)',
          bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
          avatarBg: 'bg-emerald-500/20 text-emerald-400',
        };
      default:
        return {
          label: 'ผู้ใช้งาน',
          bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
          avatarBg: 'bg-slate-500/20 text-slate-400',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl border rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-slate-900/95 border-amber-500/30 text-slate-100'
            : 'bg-white border-amber-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`p-5 sm:p-6 border-b flex items-start justify-between ${
            isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-amber-50/50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-lg shadow-amber-500/25 shrink-0">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  ⚡ บัญชีทดสอบระบบ (Demo Accounts Console)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  สำหรับ Admin
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                เลือกบัญชีเพื่อสลับไปทดสอบระบบในมุมมองนักศึกษา, อาจารย์ หรือ Admin ท่านอื่น
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-full transition cursor-pointer ${
              isDarkMode
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200/80 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className={`p-4 border-b space-y-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          {/* Role Filter Tabs */}
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer border whitespace-nowrap ${
                roleFilter === 'ALL'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ทั้งหมด ({allUsers.length})
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.ADMIN)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer border whitespace-nowrap flex items-center space-x-1.5 ${
                roleFilter === UserRole.ADMIN
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>ผู้ดูแลระบบ ({allUsers.filter((u) => u.role === UserRole.ADMIN).length})</span>
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.TEACHER)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer border whitespace-nowrap flex items-center space-x-1.5 ${
                roleFilter === UserRole.TEACHER
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>อาจารย์ ({allUsers.filter((u) => u.role === UserRole.TEACHER).length})</span>
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.STUDENT)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer border whitespace-nowrap flex items-center space-x-1.5 ${
                roleFilter === UserRole.STUDENT
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
              <span>นักศึกษา ({allUsers.filter((u) => u.role === UserRole.STUDENT).length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="ค้นหาตามชื่อ, อีเมล, รหัสนักศึกษา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold border transition outline-none ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500'
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[300px] max-h-[500px]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="text-sm font-bold">ไม่พบรายชื่อผู้ใช้งานทดสอบ</p>
              <p className="text-xs text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองประเภทบทบาท</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const roleBadge = getRoleBadge(u.role);
              return (
                <div
                  key={u.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isDarkMode
                      ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${roleBadge.avatarBg}`}
                    >
                      {getRoleIcon(u.role)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-extrabold text-xs truncate">
                          {u.title} {u.firstNameTh} {u.lastNameTh}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded-md font-extrabold border ${roleBadge.bg}`}
                        >
                          {roleBadge.label}
                        </span>
                        {u.authProvider === 'google' && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded font-semibold">
                            Google
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] mt-0.5 text-slate-500 dark:text-slate-400 truncate">
                        <span>{u.email}</span>
                        {u.studentId && <span>• รหัส: {u.studentId}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectUser(u);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer flex items-center space-x-1.5 shrink-0"
                  >
                    <span>สลับบัญชี</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          className={`p-4 border-t text-center text-xs ${
            isDarkMode ? 'border-slate-800 bg-slate-900/90 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}
        >
          💡 <span className="font-bold">คำแนะนำ:</span> เมื่อสลับไปใช้งานบทบาทอื่น คุณสามารถกดปุ่ม <span className="font-bold text-amber-500">"🔙 ออกจากมุมมอง (กลับสู่ Admin)"</span> ในเมนูมุมขวาบนเพื่อกลับมาสู่สิทธิ์ Admin ได้ตลอดเวลา
        </div>
      </div>
    </div>
  );
};
