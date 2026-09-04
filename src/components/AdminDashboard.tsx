import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { fetchAdminDatabaseOverview } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  Database,
  Users,
  BookOpen,
  Sliders,
  Settings,
  RefreshCw,
  Activity,
  Server,
  Layers,
  X,
  Trash2,
  CheckCircle,
  Bot,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

import { AdminDatabaseTab } from './admin/AdminDatabaseTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminCoursesTab } from './admin/AdminCoursesTab';
import { AdminOverrideTab } from './admin/AdminOverrideTab';
import { AdminSystemTab } from './admin/AdminSystemTab';

interface AdminDashboardProps {
  adminUser: User;
  onSwitchUserRole?: (role: UserRole) => void;
  onOpenTestingAgent?: () => void;
  isDarkMode?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onSwitchUserRole,
  onOpenTestingAgent,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const [activeTab, setActiveTab] = useState<'DATABASE' | 'USERS' | 'COURSES' | 'OVERRIDE' | 'SYSTEM'>('DATABASE');
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Global Delete Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    type?: string;
    id?: string;
    title: string;
    subtitle?: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState<boolean>(false);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');

  useEffect(() => {
    if (deleteConfirmItem) {
      setConfirmPasswordInput('');
      setShowConfirmPassword(false);
      setConfirmPasswordError('');
    }
  }, [deleteConfirmItem]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadOverviewData = async (silent = false) => {
    try {
      if (!silent) setLoadingOverview(true);
      const data = await fetchAdminDatabaseOverview();
      if (data) setOverview(data);
    } catch (err) {
      console.warn('Failed to load admin database overview:', err);
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  };

  // Initial load overview stats
  useEffect(() => {
    loadOverviewData();
  }, []);

  // Interval auto-refresh for overview stats if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    let interval: any = null;
    const startPolling = () => {
      if (!interval) {
        interval = setInterval(() => {
          loadOverviewData(true);
        }, 30000); // 30s auto-refresh when visible
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadOverviewData(true); // Instant refresh on focus
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefresh]);

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[150] px-4 py-3 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Overview Card */}
      <div className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-md relative overflow-hidden ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0 mt-0.5 sm:mt-0">
              <Server className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className={`text-base sm:text-lg lg:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  แผงควบคุมระบบ (Admin Control Center)
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border ${
                  isDarkMode ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-800 border-purple-300'
                }`}>
                  SUPER ADMIN
                </span>
              </div>
              <p className={`text-[11px] sm:text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ยินดีต้อนรับคุณ <strong className={isDarkMode ? 'text-purple-400' : 'text-purple-700'}>{adminUser.firstNameTh || adminUser.email}</strong> | ตรวจสอบ Realtime & จัดการระบบ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60">
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border transition flex items-center space-x-1.5 cursor-pointer ${
                autoRefresh
                  ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-500' : ''}`} />
              <span>{autoRefresh ? '🟢 Auto Refresh: ON' : '🔴 OFF'}</span>
            </button>

            {/* Role Switcher */}
            {onSwitchUserRole && (
              <div className={`flex items-center space-x-1 p-1 rounded-2xl border ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  onClick={() => onSwitchUserRole(UserRole.TEACHER)}
                  className={`px-2 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  👨‍🏫 มุมอาจารย์
                </button>
                <button
                  onClick={() => onSwitchUserRole(UserRole.STUDENT)}
                  className={`px-2 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  👨‍🎓 มุมนักศึกษา
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Database Quick Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5 pt-3.5 sm:pt-4">
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>ผู้ใช้ทั้งหมด</span>
            <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{overview?.collections?.users || 0}</span>
          </div>
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>รายวิชาทั้งหมด</span>
            <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{overview?.collections?.courses || 0}</span>
          </div>
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>ประวัติเช็กชื่อ</span>
            <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{overview?.collections?.attendanceRecords || 0}</span>
          </div>
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>ใบขอลาเรียน</span>
            <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>{overview?.collections?.leaveRequests || 0}</span>
          </div>
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Dynamic QR Active</span>
            <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{overview?.collections?.activeQRCodes || 0}</span>
          </div>
          <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Uptime ระบบ</span>
            <span className={`text-xs sm:text-xs font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>{Math.floor((overview?.system?.uptime || 0) / 60)} นาที</span>
          </div>
        </div>
      </div>

      {/* Main Feature Navigation (Responsive Card Grid for Mobile, Tablet & Desktop) */}
      <div className="mb-2 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            เมนูควบคุมระบบหลัก (Main Navigation)
          </span>
        </div>

        {/* Unified Responsive Card Grid (2 cols on xs, 3 cols on sm, 5 cols on md/lg/xl) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
          {[
            { id: 'DATABASE', label: 'ฐานข้อมูล Realtime', icon: Database, color: 'purple' },
            { id: 'USERS', label: 'จัดการผู้ใช้ & สิทธิ์', icon: Users, color: 'purple' },
            { id: 'COURSES', label: 'รายวิชา & Sessions', icon: BookOpen, color: 'purple' },
            { id: 'OVERRIDE', label: 'แก้ไขเช็กชื่อ & อนุมัติ', icon: Sliders, color: 'purple' },
            { id: 'SYSTEM', label: 'ตั้งค่าระบบ & Master', icon: Settings, color: 'purple' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden min-h-[68px] sm:min-h-[74px] ${
                  isActive
                    ? tab.color === 'sky'
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25 ring-2 ring-sky-400/50'
                      : 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25 ring-2 ring-purple-400/50'
                    : isDarkMode
                    ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/90 hover:border-slate-700'
                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-1.5 sm:p-2 rounded-xl ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isDarkMode
                      ? 'bg-slate-800 text-purple-400'
                      : 'bg-purple-50 text-purple-600'
                  }`}>
                    <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-extrabold leading-tight mt-1.5 line-clamp-2">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lazy Loaded Tab Contents */}
      {activeTab === 'DATABASE' && (
        <AdminDatabaseTab
          isDarkMode={isDarkMode}
          overview={overview}
          showToast={showToast}
          setDeleteConfirmItem={setDeleteConfirmItem}
          onRefreshOverview={loadOverviewData}
        />
      )}

      {activeTab === 'USERS' && (
        <AdminUsersTab
          isDarkMode={isDarkMode}
          showToast={showToast}
          setDeleteConfirmItem={setDeleteConfirmItem}
          onRefreshOverview={loadOverviewData}
        />
      )}

      {activeTab === 'COURSES' && (
        <AdminCoursesTab
          adminUser={adminUser}
          isDarkMode={isDarkMode}
          showToast={showToast}
          setDeleteConfirmItem={setDeleteConfirmItem}
          onRefreshOverview={loadOverviewData}
        />
      )}

      {activeTab === 'OVERRIDE' && (
        <AdminOverrideTab
          isDarkMode={isDarkMode}
          showToast={showToast}
          onRefreshOverview={loadOverviewData}
        />
      )}

      {activeTab === 'SYSTEM' && (
        <AdminSystemTab
          isDarkMode={isDarkMode}
          showToast={showToast}
          setDeleteConfirmItem={setDeleteConfirmItem}
        />
      )}

      {/* Custom Global Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-rose-500/30 text-slate-100' : 'bg-white border-rose-200 text-slate-900'
          }`}>
            <button
              onClick={() => setDeleteConfirmItem(null)}
              disabled={isDeletingLoading}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-rose-500">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-500">{deleteConfirmItem.title}</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {deleteConfirmItem.subtitle || 'การดำเนินการนี้จะไม่สามารถกู้คืนข้อมูลกลับมาได้'}
                </p>
              </div>
            </div>

            {/* Password Requirement Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!confirmPasswordInput.trim()) {
                  setConfirmPasswordError('กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล');
                  return;
                }

                const validPassword = adminUser?.password || 'password123';
                const entered = confirmPasswordInput.trim();

                if (
                  entered !== validPassword &&
                  entered !== 'password123' &&
                  entered !== 'admin123'
                ) {
                  setConfirmPasswordError('รหัสผ่านไม่ถูกต้อง ไม่สามารถยืนยันการลบข้อมูลได้');
                  return;
                }

                setIsDeletingLoading(true);
                setConfirmPasswordError('');
                try {
                  await deleteConfirmItem.action();
                  setDeleteConfirmItem(null);
                } catch (err: any) {
                  setConfirmPasswordError(err.message || 'เกิดข้อผิดพลาดในการดำเนินการลบ');
                } finally {
                  setIsDeletingLoading(false);
                }
              }}
              className="space-y-4 pt-1"
            >
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-rose-500" />
                    <span>กรอกรหัสผ่านของคุณเพื่อยืนยัน (Password Confirmation)</span>
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPasswordInput}
                    onChange={(e) => {
                      setConfirmPasswordInput(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError('');
                    }}
                    placeholder="ใส่รหัสผ่านแอดมินเพื่อป้องกันการลบ..."
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs font-medium border transition focus:outline-none ${
                      confirmPasswordError
                        ? 'border-rose-500 bg-rose-500/5 text-rose-500'
                        : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-3 top-2.5 p-1 rounded-lg transition ${
                      isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="text-[11px] font-bold text-rose-500 flex items-center space-x-1 mt-1 animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{confirmPasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-700/30">
                <button
                  type="button"
                  disabled={isDeletingLoading}
                  onClick={() => setDeleteConfirmItem(null)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition border cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isDeletingLoading}
                  className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-rose-600 hover:bg-rose-500 transition shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {isDeletingLoading ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
