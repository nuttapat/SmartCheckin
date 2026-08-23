import React, { useState, useEffect } from 'react';
import { Bot, Shield, Wrench, RefreshCw, LogOut, Radio, X, Zap } from 'lucide-react';
import { User, UserRole, SystemSettings } from './types';
import { fetchCurrentUser, fetchSystemSettings } from './services/api';
import { Navbar } from './components/Navbar';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { RegisterModal } from './components/RegisterModal';
import { TeacherCourseCreationModal } from './components/TeacherCourseCreationModal';
import { JoinCourseModal } from './components/JoinCourseModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { LoginPage } from './components/LoginPage';
import { TestingAgentModal } from './components/TestingAgentModal';
import { AdminDashboard } from './components/AdminDashboard';
import { DemoAccountsModal } from './components/DemoAccountsModal';
import { useTheme } from './context/ThemeContext';
import { parseCheckinToken } from './utils/qrParser';

// Sample pre-seeded users for instant testing
const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_1',
    role: UserRole.ADMIN,
    title: 'ผู้ดูแลระบบ',
    firstNameTh: 'แอดมิน',
    lastNameTh: 'คุมระบบ',
    firstNameEn: 'Admin',
    lastNameEn: 'System',
    universityId: 'ADM001',
    email: 'admin@university.ac.th',
    deviceId: 'dev_admin_1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_teacher_1',
    role: UserRole.TEACHER,
    title: 'อ.ดร.',
    firstNameTh: 'สมชาย',
    lastNameTh: 'ใจดี',
    firstNameEn: 'Somchai',
    lastNameEn: 'Jaidee',
    universityId: '',
    email: 'somchai@university.ac.th',
    deviceId: 'dev_teacher_1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_student_1',
    role: UserRole.STUDENT,
    title: 'นาย',
    firstNameTh: 'กิตติพงษ์',
    lastNameTh: 'สุขเสริฐ',
    firstNameEn: 'Kittipong',
    lastNameEn: 'Suksert',
    universityId: '66010012',
    email: '66010012@university.ac.th',
    deviceId: 'dev_student_1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_student_2',
    role: UserRole.STUDENT,
    title: 'นางสาว',
    firstNameTh: 'ณัฐธิดา',
    lastNameTh: 'รักเรียน',
    firstNameEn: 'Nattida',
    lastNameEn: 'Rakrien',
    universityId: '66010045',
    email: '66010045@university.ac.th',
    deviceId: 'dev_student_2',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_teacher_2',
    role: UserRole.TEACHER,
    title: 'ผศ.ดร.',
    firstNameTh: 'วนิดา',
    lastNameTh: 'เรียนดี',
    firstNameEn: 'Wanida',
    lastNameEn: 'Riandee',
    universityId: '',
    email: 'wanida@university.ac.th',
    deviceId: 'dev_teacher_2',
    createdAt: new Date().toISOString(),
  },
];

export default function App() {
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  
  // Initial authentication state: null (not logged in) unless restored from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('smart_attendance_logged_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error('Failed to parse saved user:', e);
    }
    return null;
  });

  // Self-healing: Verify currentUser against backend to resolve any merged accounts
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchCurrentUser(currentUser.id)
      .then((activeUser) => {
        if (activeUser && activeUser.id) {
          if (activeUser.id !== currentUser.id || activeUser.email !== currentUser.email) {
            console.log(`[Account Healed] Updated user ID from ${currentUser.id} to ${activeUser.id}`);
            setCurrentUser(activeUser);
            try {
              localStorage.setItem('smart_attendance_logged_user', JSON.stringify(activeUser));
            } catch (e) {
              console.error('Failed to save healed user to localStorage:', e);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Could not verify/heal active user state:', err);
      });
  }, []);

  // Track if current session was switched from Admin view mode
  const [switchedFromAdmin, setSwitchedFromAdmin] = useState<User | null>(() => {
    try {
      const savedAdmin = localStorage.getItem('smart_attendance_switched_from_admin');
      if (savedAdmin) {
        return JSON.parse(savedAdmin);
      }
    } catch (e) {
      console.error('Failed to parse saved switched_from_admin:', e);
    }
    return null;
  });

  const { isDarkMode, toggleTheme } = useTheme();

  // Global System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState<boolean>(false);

  const loadGlobalSettings = async () => {
    try {
      const res = await fetchSystemSettings();
      const settingsObj = res?.settings || res?.document || res;
      if (settingsObj && typeof settingsObj === 'object') {
        setSystemSettings(settingsObj);
      }
    } catch (err) {
      console.warn('Could not refresh system settings:', err);
    }
  };

  useEffect(() => {
    loadGlobalSettings();
    const timer = setInterval(loadGlobalSettings, 10000);
    return () => clearInterval(timer);
  }, []);

  // Detect direct camera QR scan link from URL query params (e.g. ?checkin=SES:123:ABC)
  useEffect(() => {
    try {
      const search = window.location.search;
      if (search && (search.includes('checkin') || search.includes('qrToken') || search.includes('SES') || search.includes('EVT'))) {
        const parsed = parseCheckinToken(window.location.href);
        if (parsed.rawToken) {
          const payload = {
            rawToken: parsed.rawToken,
            targetId: parsed.targetId,
            qrToken: parsed.qrToken,
            type: parsed.type,
            timestamp: Date.now(),
          };
          sessionStorage.setItem('pending_qr_checkin', JSON.stringify(payload));
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (err) {
      console.error('Error handling direct camera QR scan URL:', err);
    }
  }, []);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState<boolean>(false);
  const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'password' | 'device' | 'gps'>('profile');
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState<boolean>(false);
  const [isJoinCourseOpen, setIsJoinCourseOpen] = useState<boolean>(false);
  const [isTestingAgentOpen, setIsTestingAgentOpen] = useState<boolean>(false);
  const [isDemoAccountsModalOpen, setIsDemoAccountsModalOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [quickEventTrigger, setQuickEventTrigger] = useState<number>(0);

  const handleSelectDemoUser = (user: User) => {
    if (currentUser && currentUser.role === UserRole.ADMIN && user.id !== currentUser.id) {
      setSwitchedFromAdmin(currentUser);
      try {
        localStorage.setItem('smart_attendance_switched_from_admin', JSON.stringify(currentUser));
      } catch (e) {
        console.error('Failed to save switched_from_admin:', e);
      }
    }
    handleSelectUser(user);
    setIsDemoAccountsModalOpen(false);
  };

  const handleOpenUserSettings = (tab: 'profile' | 'password' | 'device' | 'gps' = 'profile') => {
    setUserSettingsTab(tab);
    setIsUserSettingsOpen(true);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('smart_attendance_logged_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to update localStorage user:', e);
    }
    setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleSwitchUserRole = (targetRole: UserRole) => {
    if (!currentUser) return;
    // Save original Admin user profile before switching view
    if (currentUser.role === UserRole.ADMIN || currentUser.id === 'usr_admin_1' || (currentUser.email && currentUser.email.toLowerCase().startsWith('admin')) || switchedFromAdmin) {
      const adminObj = switchedFromAdmin || { ...currentUser, role: UserRole.ADMIN };
      setSwitchedFromAdmin(adminObj);
      try {
        localStorage.setItem('smart_attendance_switched_from_admin', JSON.stringify(adminObj));
      } catch (e) {
        console.error('Failed to save switched_from_admin:', e);
      }
    }
    const updatedUser = { ...currentUser, role: targetRole };
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('smart_attendance_logged_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to save updated user:', e);
    }
  };

  const handleExitViewMode = () => {
    let restoredAdmin = switchedFromAdmin;
    if (!restoredAdmin && currentUser) {
      restoredAdmin = { ...currentUser, role: UserRole.ADMIN };
    }
    if (restoredAdmin) {
      const updatedUser = { ...restoredAdmin, role: UserRole.ADMIN };
      setCurrentUser(updatedUser);
      setSwitchedFromAdmin(null);
      try {
        localStorage.setItem('smart_attendance_logged_user', JSON.stringify(updatedUser));
        localStorage.removeItem('smart_attendance_switched_from_admin');
      } catch (e) {
        console.error('Failed to clear switched_from_admin:', e);
      }
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('smart_attendance_logged_user', JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user to localStorage:', e);
    }
    // Ensure user exists in allUsers list
    setAllUsers((prev) => {
      if (prev.some((u) => u.id === user.id || (u.email && u.email.toLowerCase() === user.email.toLowerCase()))) {
        return prev;
      }
      return [user, ...prev];
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSwitchedFromAdmin(null);
    try {
      localStorage.removeItem('smart_attendance_logged_user');
      localStorage.removeItem('smart_attendance_switched_from_admin');
    } catch (e) {
      console.error('Failed to clear user from localStorage:', e);
    }
  };

  const handleSelectUser = (user: User) => {
    handleLoginSuccess(user);
  };

  const handleRegisterSuccess = (newUser: User) => {
    setAllUsers((prev) => [newUser, ...prev]);
    handleLoginSuccess(newUser);
  };

  const handleOpenQuickEvent = () => {
    setQuickEventTrigger(Date.now());
  };

  // Unauthenticated View: Render Login Screen ONLY
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onOpenRegister={() => setIsRegisterOpen(true)}
          allUsers={allUsers}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          onOpenTestingAgent={() => setIsTestingAgentOpen(true)}
        />
        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={handleRegisterSuccess}
          isDarkMode={isDarkMode}
        />
        <TestingAgentModal
          isOpen={isTestingAgentOpen}
          onClose={() => setIsTestingAgentOpen(false)}
          currentUser={currentUser}
          isDarkMode={isDarkMode}
        />
      </>
    );
  }

  const isTeacher = currentUser?.role === UserRole.TEACHER;
  const isMaintenanceMode = (systemSettings?.maintenanceMode || systemSettings?.systemMaintenanceMode) ?? false;
  const isUserAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.id === 'usr_admin_1';
  const isSwitchedFromAdmin = !!switchedFromAdmin || (!!currentUser && currentUser.role !== UserRole.ADMIN && (currentUser.id === 'usr_admin_1' || (currentUser.email && currentUser.email.toLowerCase().startsWith('admin'))));

  // If Maintenance Mode is enabled and current user is NOT admin
  if (currentUser && isMaintenanceMode && !isUserAdmin && !isSwitchedFromAdmin) {
    const maintenanceMsg = systemSettings?.maintenanceMessage || systemSettings?.announcementMessage || 'ขออภัยในความไม่สะดวก ระบบกำลังปิดปรับปรุงชั่วคราวเพื่อพัฒนาประสิทธิภาพการใช้งาน';
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center space-y-6 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="w-20 h-20 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 animate-pulse">
            <Wrench className="w-10 h-10 stroke-[2.2]" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-block">
              ⛔ MAINTENANCE MODE
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white pt-2">
              ระบบกำลังปิดปรับปรุงชั่วคราว
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium pt-1">
              {maintenanceMsg}
            </p>
          </div>
          <div className="pt-2 flex flex-col space-y-3">
            <button
              onClick={() => loadGlobalSettings()}
              className="w-full py-3 rounded-2xl font-extrabold text-xs text-white bg-sky-600 hover:bg-sky-500 transition shadow-lg shadow-sky-600/30 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>ลองใหม่อีกครั้ง / ตรวจสอบสถานะ</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard View
  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${
      isDarkMode 
        ? isTeacher
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-slate-950 dark' 
          : 'bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-slate-950 dark'
        : isTeacher
        ? 'bg-slate-50/70 text-slate-900 selection:bg-blue-600 selection:text-white'
        : 'bg-slate-50/70 text-slate-900 selection:bg-indigo-500 selection:text-white'
    }`}>
      {/* System Announcement Broadcast Banner */}
      {(systemSettings?.announcementMessage || systemSettings?.systemAnnouncement) && !announcementDismissed && (
        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 text-white shadow-md border-b border-sky-400/30 px-4 py-2.5 z-40 relative">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3 flex-1 mr-3">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 animate-pulse">
                <Radio className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xs font-semibold leading-snug">
                <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide mr-2 shadow-xs shrink-0">
                  📢 ประกาศสำคัญจากผู้ดูแลระบบ
                </span>
                <span className="font-bold text-white">
                  {systemSettings.announcementMessage || systemSettings.systemAnnouncement}
                </span>
              </div>
            </div>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition shrink-0 cursor-pointer"
              title="ซ่อนประกาศ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* View Mode Sticky Banner for Admin */}
      {isSwitchedFromAdmin && (
        <div className="bg-gradient-to-r from-purple-800 via-indigo-700 to-sky-700 text-white px-4 py-2.5 shadow-lg flex items-center justify-between z-50 sticky top-0 border-b border-purple-400/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-amber-400/40">
              <Shield className="w-4 h-4 text-amber-300" />
            </div>
            <div className="text-xs font-semibold">
              <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide mr-2 shadow-xs">
                โหมดมุมมองทดสอบ (VIEW MODE)
              </span>
              <span>
                คุณกำลังอยู่ใน <strong className="font-extrabold underline text-amber-200">{currentUser?.role === UserRole.TEACHER ? 'มุมมองอาจารย์ (Teacher View)' : 'มุมมองนักศึกษา (Student View)'}</strong>
              </span>
              {switchedFromAdmin && (
                <span className="hidden md:inline text-purple-100 font-normal ml-1">
                  (สลับมาจากบัญชีผู้ดูแลระบบ: {switchedFromAdmin.firstNameTh || switchedFromAdmin.email})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleExitViewMode}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3.5 py-1.5 rounded-xl shadow-md transition transform active:scale-95 flex items-center space-x-1.5 cursor-pointer text-xs shrink-0"
          >
            <Shield className="w-3.5 h-3.5 fill-slate-950" />
            <span>🔙 ออกจากมุมมอง (กลับสู่ Admin)</span>
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        allUsers={allUsers}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenCreateCourse={() => setIsCreateCourseOpen(true)}
        onOpenJoinCourse={() => setIsJoinCourseOpen(true)}
        onOpenQuickEvent={handleOpenQuickEvent}
        onOpenUserSettings={handleOpenUserSettings}
        onOpenTestingAgent={() => setIsTestingAgentOpen(true)}
        onLogout={handleLogout}
        onExitViewMode={handleExitViewMode}
        isSwitchedFromAdmin={isSwitchedFromAdmin}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === UserRole.ADMIN ? (
          <AdminDashboard
            key={`admin_${currentUser.id}_${refreshKey}`}
            adminUser={currentUser}
            onSwitchUserRole={handleSwitchUserRole}
            onOpenTestingAgent={() => setIsTestingAgentOpen(true)}
            isDarkMode={isDarkMode}
          />
        ) : currentUser.role === UserRole.TEACHER ? (
          <TeacherDashboard
            key={`teacher_${currentUser.id}_${refreshKey}`}
            teacher={currentUser}
            onOpenCreateCourse={() => setIsCreateCourseOpen(true)}
            onOpenQuickEvent={handleOpenQuickEvent}
            quickEventTrigger={quickEventTrigger}
            isDarkMode={isDarkMode}
          />
        ) : (
          <StudentDashboard
            key={`student_${currentUser.id}_${refreshKey}`}
            student={currentUser}
            onOpenJoinCourse={() => setIsJoinCourseOpen(true)}
            isDarkMode={isDarkMode}
          />
        )}
      </main>

      {/* Footer */}
      <footer className={`mt-auto py-6 border-t text-center space-y-2 ${
        isDarkMode 
          ? 'border-slate-800/80 text-slate-400 bg-slate-950/60' 
          : 'border-slate-200/80 text-slate-600 bg-slate-100/50'
      }`}>
        <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
          © 2026 พัฒนาโดย ผศ. ดร. ณัฐภัทร อนุวงศ์เจริญ
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          อัปเดตล่าสุด: 26 กรกฎาคม 2569
        </p>
        {(currentUser.role === UserRole.ADMIN || isUserAdmin) && (
          <div className="pt-2 flex justify-center items-center space-x-2 sm:space-x-3 flex-wrap gap-y-2">
            <button
              onClick={() => setIsTestingAgentOpen(true)}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-2xl border text-xs font-bold transition shadow-sm cursor-pointer ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-sky-500/20 via-blue-500/20 to-indigo-500/20 text-sky-300 border-sky-500/40 hover:border-sky-400 hover:bg-sky-500/30' 
                  : 'bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 text-sky-900 border-sky-300 hover:bg-sky-100'
              }`}
              title="เปิด Agent ทดสอบระบบอัจฉริยะ (System QA Agent - เฉพาะ Admin)"
            >
              <Bot className="w-4 h-4 text-sky-500 shrink-0" />
              <span>🤖 Agent ทดสอบระบบ (Admin)</span>
            </button>

            <button
              onClick={() => setIsDemoAccountsModalOpen(true)}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-2xl border text-xs font-bold transition shadow-sm cursor-pointer ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/30' 
                  : 'bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="สลับเข้าใช้งานบัญชีทดสอบระบบ (Demo Accounts)"
            >
              <Zap className="w-4 h-4 text-amber-500 shrink-0 fill-current" />
              <span>⚡ เข้าใช้งานบัญชีทดสอบ</span>
            </button>
          </div>
        )}
      </footer>

      {/* Modals */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateUser={handleUserUpdated}
        isDarkMode={isDarkMode}
        initialTab={userSettingsTab}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleRegisterSuccess}
        isDarkMode={isDarkMode}
      />

      <TeacherCourseCreationModal
        isOpen={isCreateCourseOpen}
        onClose={() => setIsCreateCourseOpen(false)}
        ownerId={currentUser.id}
        coordinatorDefault={`${currentUser.title} ${currentUser.firstNameTh} ${currentUser.lastNameTh}`}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
        isDarkMode={isDarkMode}
      />

      <JoinCourseModal
        isOpen={isJoinCourseOpen}
        onClose={() => setIsJoinCourseOpen(false)}
        userId={currentUser.id}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
        isDarkMode={isDarkMode}
      />

      <TestingAgentModal
        isOpen={isTestingAgentOpen}
        onClose={() => setIsTestingAgentOpen(false)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
      />

      <DemoAccountsModal
        isOpen={isDemoAccountsModalOpen}
        onClose={() => setIsDemoAccountsModalOpen(false)}
        allUsers={allUsers}
        onSelectUser={handleSelectDemoUser}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
