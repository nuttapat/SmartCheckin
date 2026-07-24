import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { fetchCurrentUser } from './services/api';
import { Navbar } from './components/Navbar';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { RegisterModal } from './components/RegisterModal';
import { TeacherCourseCreationModal } from './components/TeacherCourseCreationModal';
import { JoinCourseModal } from './components/JoinCourseModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { LoginPage } from './components/LoginPage';

// Sample pre-seeded users for instant testing
const INITIAL_USERS: User[] = [
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

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState<boolean>(false);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState<boolean>(false);
  const [isJoinCourseOpen, setIsJoinCourseOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [quickEventTrigger, setQuickEventTrigger] = useState<number>(0);

  const handleUserUpdated = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('smart_attendance_logged_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to update localStorage user:', e);
    }
    setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
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
    try {
      localStorage.removeItem('smart_attendance_logged_user');
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
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={handleRegisterSuccess}
          isDarkMode={isDarkMode}
        />
      </>
    );
  }

  // Authenticated Dashboard View
  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 dark' 
        : 'bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white'
    }`}>
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        allUsers={allUsers}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenCreateCourse={() => setIsCreateCourseOpen(true)}
        onOpenJoinCourse={() => setIsJoinCourseOpen(true)}
        onOpenQuickEvent={handleOpenQuickEvent}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === UserRole.TEACHER ? (
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

      {/* Modals */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateUser={handleUserUpdated}
        isDarkMode={isDarkMode}
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
    </div>
  );
}
