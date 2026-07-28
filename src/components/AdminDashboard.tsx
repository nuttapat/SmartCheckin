import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Course, LeaveStatus, AttendanceStatus, Session } from '../types';
import {
  fetchAdminDatabaseOverview,
  fetchAdminCollection,
  saveAdminDocument,
  deleteAdminDocument,
  updateUserRole,
  resetUserDevice,
  overrideAttendanceRecord,
  updateLeaveRequestStatus,
  fetchTeachers,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  Database,
  Users,
  Shield,
  Key,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Server,
  FileText,
  UserCheck,
  Smartphone,
  Eye,
  AlertCircle,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  Check,
  X,
  Sliders,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  BookOpen,
  Calendar,
  MapPin,
  Play,
  Square,
  ChevronRight,
  ListPlus,
  Radio,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
} from 'lucide-react';

interface AdminDashboardProps {
  adminUser: User;
  onSwitchUserRole?: (role: UserRole) => void;
  isDarkMode?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  id: 'ID เอกสาร',
  firstNameTh: 'ชื่อ (ไทย)',
  lastNameTh: 'นามสกุล (ไทย)',
  firstNameEn: 'First Name',
  lastNameEn: 'Last Name',
  universityId: 'รหัสประจำตัว',
  role: 'สิทธิ์ (Role)',
  email: 'อีเมล',
  deviceId: 'อุปกรณ์',
  code: 'รหัสวิชา',
  nameTh: 'ชื่อวิชา',
  academicYear: 'ปีการศึกษา',
  semester: 'ภาคเรียน',
  courseId: 'รหัสวิชาอ้างอิง',
  userId: 'ผู้ใช้อ้างอิง',
  status: 'สถานะ',
  sessionId: 'รหัสเซสชัน',
  date: 'วันที่',
  startTime: 'เวลาเริ่ม',
  endTime: 'เวลาเลิก',
  studentNameTh: 'ชื่อนักศึกษา',
  studentUniversityId: 'รหัสนักศึกษา',
  teacherNameTh: 'ชื่ออาจารย์',
  timestamp: 'ประทับเวลา',
  checkinMethod: 'วิธีเช็กชื่อ',
  leaveType: 'ประเภทลา',
  startDate: 'วันเริ่มลา',
  endDate: 'วันสิ้นสุด',
  title: 'ชื่อกิจกรรม',
  checkinCount: 'จำนวนเช็กชื่อ',
  expiresAt: 'หมดอายุเวลา',
  createdAt: 'สร้างเมื่อ',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onSwitchUserRole,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [activeTab, setActiveTab] = useState<'DATABASE' | 'USERS' | 'COURSES' | 'OVERRIDE' | 'SYSTEM'>('DATABASE');
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Database Inspector state
  const [selectedCollection, setSelectedCollection] = useState<string>('users');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getCollectionColumns = (coll: string, docs: any[]): string[] => {
    const predefinedMap: Record<string, string[]> = {
      users: ['id', 'firstNameTh', 'lastNameTh', 'universityId', 'role', 'email'],
      courses: ['id', 'code', 'nameTh', 'academicYear', 'semester'],
      courseMembers: ['id', 'courseId', 'userId', 'role', 'status'],
      sessions: ['id', 'courseId', 'date', 'startTime', 'endTime', 'status'],
      attendanceRecords: ['id', 'studentNameTh', 'studentUniversityId', 'status', 'timestamp', 'checkinMethod'],
      teacherAttendanceRecords: ['id', 'teacherNameTh', 'status', 'timestamp'],
      leaveRequests: ['id', 'studentNameTh', 'leaveType', 'status', 'startDate', 'endDate'],
      quickEvents: ['id', 'title', 'code', 'status', 'checkinCount'],
      activeQRCodes: ['id', 'courseId', 'sessionId', 'expiresAt'],
    };

    if (predefinedMap[coll]) {
      return predefinedMap[coll];
    }

    const keySet = new Set<string>();
    keySet.add('id');
    docs.forEach((doc) => {
      if (doc && typeof doc === 'object') {
        Object.keys(doc).forEach((k) => {
          if (!['password', 'createdAt', 'updatedAt'].includes(k)) keySet.add(k);
        });
      }
    });
    return Array.from(keySet).slice(0, 6);
  };

  const renderTableCell = (doc: any, key: string) => {
    const val = doc[key];

    if (val === undefined || val === null || val === '') {
      return <span className={`italic text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>;
    }

    if (key === 'id') {
      return (
        <div className="flex items-center space-x-1.5 font-mono font-bold">
          <span className={`truncate max-w-[120px] ${isDarkMode ? 'text-purple-400' : 'text-purple-700 font-bold'}`}>{String(val)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(String(val));
              showToast('คัดลอก ID แล้ว');
            }}
            className={`transition shrink-0 cursor-pointer p-0.5 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}
            title="คัดลอก ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      );
    }

    if (key === 'role') {
      const roleStr = String(val);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${
          roleStr === 'ADMIN'
            ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
            : roleStr === 'TEACHER'
            ? isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-100 text-sky-900 border-sky-300'
            : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
        }`}>
          {roleStr === 'ADMIN' ? '🛠️ ADMIN' : roleStr === 'TEACHER' ? '👨‍🏫 TEACHER' : '👨‍🎓 STUDENT'}
        </span>
      );
    }

    if (key === 'status') {
      const stStr = String(val);
      let badgeClass = isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-200 text-slate-900 border-slate-300 font-bold';
      if (['PRESENT', 'APPROVED', 'ACTIVE'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
      } else if (['LATE', 'PENDING'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-950 border-amber-300 font-bold';
      } else if (['ABSENT', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300 font-bold';
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
          {stStr}
        </span>
      );
    }

    if (typeof val === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          val
            ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300'
            : isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300'
        }`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }

    if (typeof val === 'object') {
      return (
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border block truncate max-w-[140px] ${
          isDarkMode ? 'text-slate-400 bg-slate-800/60 border-slate-700/50' : 'text-slate-900 bg-slate-100 border-slate-300 font-bold'
        }`} title={JSON.stringify(val)}>
          {JSON.stringify(val)}
        </span>
      );
    }

    return <span className={`truncate max-w-[180px] block ${isDarkMode ? 'text-slate-200 font-medium' : 'text-slate-900 font-bold'}`}>{String(val)}</span>;
  };
  
  // JSON Edit Modal state
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // User Management state
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userTableSortField, setUserTableSortField] = useState<'name' | 'email' | 'role' | null>(null);
  const [userTableSortDir, setUserTableSortDir] = useState<'asc' | 'desc'>('asc');

  const handleUserTableSort = (field: 'name' | 'email' | 'role') => {
    if (userTableSortField === field) {
      if (userTableSortDir === 'asc') setUserTableSortDir('desc');
      else { setUserTableSortField(null); setUserTableSortDir('asc'); }
    } else {
      setUserTableSortField(field);
      setUserTableSortDir('asc');
    }
  };

  // Course & Session Sorting state
  const [courseSortField, setCourseSortField] = useState<'code' | 'year' | 'coordinator' | 'weeks' | 'sessions' | null>(null);
  const [courseSortDir, setCourseSortDir] = useState<'asc' | 'desc'>('asc');

  const handleCourseSort = (field: 'code' | 'year' | 'coordinator' | 'weeks' | 'sessions') => {
    if (courseSortField === field) {
      if (courseSortDir === 'asc') setCourseSortDir('desc');
      else { setCourseSortField(null); setCourseSortDir('asc'); }
    } else {
      setCourseSortField(field);
      setCourseSortDir('asc');
    }
  };

  const [sessionSortField, setSessionSortField] = useState<'week' | 'topic' | 'status' | null>(null);
  const [sessionSortDir, setSessionSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSessionSort = (field: 'week' | 'topic' | 'status') => {
    if (sessionSortField === field) {
      if (sessionSortDir === 'asc') setSessionSortDir('desc');
      else { setSessionSortField(null); setSessionSortDir('asc'); }
    } else {
      setSessionSortField(field);
      setSessionSortDir('asc');
    }
  };

  // Attendance Override Form state & User Search
  const [overrideUserType, setOverrideUserType] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [overrideUserSearch, setOverrideUserSearch] = useState<string>('');
  const [overrideSelectedUser, setOverrideSelectedUser] = useState<User | null>(null);
  const [overrideCourseId, setOverrideCourseId] = useState<string>('');
  const [overrideSessionId, setOverrideSessionId] = useState<string>('');
  const [overrideStatus, setOverrideStatus] = useState<string>('PRESENT');
  const [overrideMsg, setOverrideMsg] = useState<string>('');
  const [overrideErrorMsg, setOverrideErrorMsg] = useState<string>('');
  const [isOverrideSubmitting, setIsOverrideSubmitting] = useState<boolean>(false);

  // Check-in History & Deletion state
  const [checkinRoleFilter, setCheckinRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [checkinSearchQuery, setCheckinSearchQuery] = useState<string>('');
  const [checkinCourseFilter, setCheckinCourseFilter] = useState<string>('ALL');
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [allStudentAttendance, setAllStudentAttendance] = useState<any[]>([]);
  const [allTeacherAttendance, setAllTeacherAttendance] = useState<any[]>([]);
  const [loadingOverrideData, setLoadingOverrideData] = useState<boolean>(false);

  // Filter users for Override Form search
  const filteredUsersForOverride = useMemo(() => {
    return allUsersList.filter((u) => {
      if (overrideUserType === 'STUDENT' && u.role !== UserRole.STUDENT) return false;
      if (overrideUserType === 'TEACHER' && u.role !== UserRole.TEACHER) return false;

      if (!overrideUserSearch.trim()) return true;

      const q = overrideUserSearch.toLowerCase().trim();
      const fullName = `${u.title || ''}${u.firstNameTh || ''} ${u.lastNameTh || ''}`.toLowerCase();
      const id = (u.id || '').toLowerCase();
      const uniId = (u.universityId || '').toLowerCase();
      const email = (u.email || '').toLowerCase();

      return fullName.includes(q) || id.includes(q) || uniId.includes(q) || email.includes(q);
    });
  }, [allUsersList, overrideUserType, overrideUserSearch]);

  // Course & Weekly Session Management state
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<User[]>([]);
  const [selectedCourseForSessions, setSelectedCourseForSessions] = useState<string>('ALL');
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>('');
  const [loadingCoursesData, setLoadingCoursesData] = useState<boolean>(false);

  // Modals state for Course & Session
  const [courseModalOpen, setCourseModalOpen] = useState<boolean>(false);
  const [editingCourseData, setEditingCourseData] = useState<any | null>(null);

  const [sessionModalOpen, setSessionModalOpen] = useState<boolean>(false);
  const [editingSessionData, setEditingSessionData] = useState<any | null>(null);

  // Custom Delete Confirm Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    type: 'course' | 'session' | 'document' | 'device';
    id: string;
    title: string;
    subtitle?: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState<boolean>(false);

  // Toast / Status Feedback
  const [toastMessage, setToastMessage] = useState<string>('');

  useEffect(() => {
    loadOverview();
  }, []);

  // Load Courses, Weekly Sessions, and Teachers list
  const loadCoursesAndSessionsData = async (silent = false) => {
    try {
      if (!silent) setLoadingCoursesData(true);
      const [coursesRes, sessionsRes, teachersRes] = await Promise.all([
        fetchAdminCollection('courses'),
        fetchAdminCollection('sessions'),
        fetchTeachers().catch(() => []),
      ]);
      setAllCourses(coursesRes.documents || []);
      setAllSessions(sessionsRes.documents || []);
      if (Array.isArray(teachersRes) && teachersRes.length > 0) {
        setTeachersList(teachersRes);
      }
    } catch (err) {
      console.error('Failed to load courses & sessions:', err);
    } finally {
      if (!silent) setLoadingCoursesData(false);
    }
  };

  // Load Override & Check-in Management data
  const loadOverrideTabData = async (silent = false) => {
    try {
      if (!silent) setLoadingOverrideData(true);
      const [usersRes, coursesRes, sessionsRes, attRes, teacherAttRes] = await Promise.all([
        fetchAdminCollection('users'),
        fetchAdminCollection('courses'),
        fetchAdminCollection('sessions'),
        fetchAdminCollection('attendanceRecords'),
        fetchAdminCollection('teacherAttendanceRecords').catch(() => ({ documents: [] })),
      ]);
      setAllUsersList(usersRes.documents || []);
      setAllCourses(coursesRes.documents || []);
      setAllSessions(sessionsRes.documents || []);
      setAllStudentAttendance(attRes.documents || []);
      setAllTeacherAttendance(teacherAttRes.documents || []);
    } catch (err) {
      console.error('Failed to load override tab data:', err);
    } finally {
      if (!silent) setLoadingOverrideData(false);
    }
  };

  // Auto-refresh interval for Real-time database inspection & Courses & Override
  useEffect(() => {
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadOverview(true);
        if (activeTab === 'DATABASE') {
          loadCollectionDocs(selectedCollection, true);
        } else if (activeTab === 'COURSES') {
          loadCoursesAndSessionsData(true);
        } else if (activeTab === 'OVERRIDE') {
          loadOverrideTabData(true);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, selectedCollection]);

  useEffect(() => {
    if (activeTab === 'DATABASE') {
      loadCollectionDocs(selectedCollection);
    } else if (activeTab === 'COURSES') {
      loadCoursesAndSessionsData();
    } else if (activeTab === 'OVERRIDE') {
      loadOverrideTabData();
    }
  }, [selectedCollection, activeTab]);

  // Handlers for Course CRUD
  const handleOpenCreateCourse = async () => {
    if (teachersList.length === 0) {
      const tData = await fetchTeachers().catch(() => []);
      if (tData.length > 0) setTeachersList(tData);
    }
    const defaultOwner = adminUser || {};
    const newCourseDoc = {
      id: `crs_${Date.now()}`,
      courseCode: '',
      courseName: '',
      academicYear: 2569,
      semester: '1',
      coordinatorName: `${defaultOwner.title || ''}${defaultOwner.firstNameTh || ''} ${defaultOwner.lastNameTh || ''}`.trim() || 'อาจารย์ผู้รับผิดชอบ',
      ownerId: defaultOwner.id || '',
      defaultLat: 13.7988363,
      defaultLng: 100.322944,
      weeks: Array.from({ length: 15 }, (_, i) => ({
        weekNumber: i + 1,
        topic: `สัปดาห์ที่ ${i + 1}`,
        date: new Date(Date.now() + i * 7 * 86400000).toISOString().slice(0, 10),
      })),
      createdAt: new Date().toISOString(),
    };
    setEditingCourseData(newCourseDoc);
    setCourseModalOpen(true);
  };

  const handleOpenEditCourse = async (course: any) => {
    if (teachersList.length === 0) {
      const tData = await fetchTeachers().catch(() => []);
      if (tData.length > 0) setTeachersList(tData);
    }
    setEditingCourseData(JSON.parse(JSON.stringify(course)));
    setCourseModalOpen(true);
  };

  const handleSaveCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseData?.courseCode || !editingCourseData?.courseName) {
      alert('กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }
    try {
      await saveAdminDocument('courses', editingCourseData);
      showToast(`บันทึกข้อมูลวิชา ${editingCourseData.courseCode} สำเร็จ`);
      setCourseModalOpen(false);
      await loadCoursesAndSessionsData();
      await loadOverview(true);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึกรายวิชาได้');
    }
  };

  const handleDeleteCourseSubmit = (courseId: string, courseCode: string) => {
    setDeleteConfirmItem({
      type: 'course',
      id: courseId,
      title: `คุณต้องการลบรายวิชา "${courseCode}" ใช่หรือไม่?`,
      subtitle: 'การลบรายวิชานี้จะทำการลบสัปดาห์สอน สมาชิก ประวัติการเช็คชื่อ และใบลาที่เกี่ยวข้องทั้งหมดออกจากฐานข้อมูลถาวร',
      action: async () => {
        await deleteAdminDocument('courses', courseId);
        showToast(`ลบวิชา ${courseCode} เรียบร้อยแล้ว`);
        await loadCoursesAndSessionsData();
        await loadOverview(true);
      },
    });
  };

  // Handlers for Weekly Sessions CRUD
  const handleOpenCreateSession = (preselectedCourseId?: string) => {
    const course = allCourses.find((c) => c.id === preselectedCourseId) || allCourses[0];
    const courseId = course?.id || '';
    const existingSessions = allSessions.filter((s) => s.courseId === courseId);
    const nextWeekNum = existingSessions.length + 1;

    const newSessionDoc = {
      id: `ses_${courseId}_w${nextWeekNum}_${Date.now()}`,
      courseId: courseId,
      weekNumber: nextWeekNum,
      topic: `การเรียนสัปดาห์ที่ ${nextWeekNum}`,
      teacherLat: course?.defaultLat || 13.7988363,
      teacherLng: course?.defaultLng || 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    setEditingSessionData(newSessionDoc);
    setSessionModalOpen(true);
  };

  const handleOpenEditSession = (session: any) => {
    setEditingSessionData(JSON.parse(JSON.stringify(session)));
    setSessionModalOpen(true);
  };

  const handleSaveSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSessionData?.courseId || !editingSessionData?.topic) {
      alert('กรุณาเลือกรายวิชาและระบุหัวข้อการเรียน');
      return;
    }
    try {
      await saveAdminDocument('sessions', editingSessionData);
      showToast(`บันทึก Session สัปดาห์ที่ ${editingSessionData.weekNumber} สำเร็จ`);
      setSessionModalOpen(false);
      await loadCoursesAndSessionsData();
      await loadOverview(true);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึก Session ได้');
    }
  };

  const handleToggleSessionActiveStatus = async (session: any) => {
    try {
      const updated = {
        ...session,
        isActive: !session.isActive,
        updatedAt: new Date().toISOString(),
      };
      await saveAdminDocument('sessions', updated);
      showToast(`${updated.isActive ? '🟢 เปิดการเช็กชื่อ' : '🔴 ปิดการเช็กชื่อ'} สัปดาห์ที่ ${session.weekNumber} สำเร็จ`);
      await loadCoursesAndSessionsData();
      await loadOverview(true);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถปรับสถานะการเช็กชื่อได้');
    }
  };

  const handleDeleteSessionSubmit = (sessionId: string, weekNum: number) => {
    setDeleteConfirmItem({
      type: 'session',
      id: sessionId,
      title: `คุณต้องการลบ Session สัปดาห์ที่ ${weekNum} ใช่หรือไม่?`,
      subtitle: 'การลบ Session นี้จะลบประวัติการเข้าเรียนในสัปดาห์นี้ถาวร',
      action: async () => {
        await deleteAdminDocument('sessions', sessionId);
        showToast(`ลบ Session สัปดาห์ที่ ${weekNum} เรียบร้อยแล้ว`);
        await loadCoursesAndSessionsData();
        await loadOverview(true);
      },
    });
  };

  const handleGenerateSessionsFromWeeks = async (course: any) => {
    if (!course) return;
    const weeksList = course.weeks && course.weeks.length > 0
      ? course.weeks
      : Array.from({ length: 15 }, (_, i) => ({
          weekNumber: i + 1,
          topic: `การเรียนสัปดาห์ที่ ${i + 1}`,
          date: new Date(Date.now() + i * 7 * 86400000).toISOString().slice(0, 10),
        }));

    const existingSessions = allSessions.filter((s) => s.courseId === course.id);
    const existingWeekNums = new Set(existingSessions.map((s) => Number(s.weekNumber)));

    let createdCount = 0;
    for (const w of weeksList) {
      const wNum = Number(w.weekNumber);
      if (!existingWeekNums.has(wNum)) {
        const newSes = {
          id: `ses_${course.id}_w${wNum}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          courseId: course.id,
          weekNumber: wNum,
          topic: w.topic || `การเรียนสัปดาห์ที่ ${wNum}`,
          teacherLat: course.defaultLat || 13.7988363,
          teacherLng: course.defaultLng || 100.322944,
          isActive: false,
          createdAt: new Date().toISOString(),
        };
        await saveAdminDocument('sessions', newSes);
        createdCount++;
      }
    }

    showToast(`สร้าง Session อัตโนมัติเพิ่ม ${createdCount} สัปดาห์ เรียบร้อยแล้ว`);
    await loadCoursesAndSessionsData();
    await loadOverview(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadOverview = async (silent = false) => {
    try {
      if (!silent) setLoadingOverview(true);
      const data = await fetchAdminDatabaseOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load admin database overview:', err);
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  };

  const loadCollectionDocs = async (collName: string, silent = false) => {
    try {
      if (!silent) setLoadingDocs(true);
      const res = await fetchAdminCollection(collName);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error(`Failed to load collection ${collName}:`, err);
    } finally {
      if (!silent) setLoadingDocs(false);
    }
  };

  const handleOpenEditDoc = (doc: any) => {
    setEditingDoc(doc);
    setRawJsonText(JSON.stringify(doc, null, 2));
    setJsonError('');
    setIsCreatingNew(false);
  };

  const handleOpenCreateDoc = () => {
    const templateDoc = {
      id: `${selectedCollection.slice(0, 3)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(templateDoc);
    setRawJsonText(JSON.stringify(templateDoc, null, 2));
    setJsonError('');
    setIsCreatingNew(true);
  };

  const handleSaveDoc = async () => {
    try {
      setJsonError('');
      const parsed = JSON.parse(rawJsonText);
      if (!parsed.id) {
        setJsonError('เอกสารต้องมี field "id" ที่ไม่เป็นค่าว่าง');
        return;
      }
      await saveAdminDocument(selectedCollection, parsed);
      showToast(`บันทึกข้อมูลใน ${selectedCollection} สำเร็จ`);
      setEditingDoc(null);
      await loadCollectionDocs(selectedCollection);
      await loadOverview(true);
    } catch (err: any) {
      setJsonError(err.message || 'รูปแบบ JSON ไม่ถูกต้อง');
    }
  };

  const handleDeleteDoc = (docId: string) => {
    setDeleteConfirmItem({
      type: 'document',
      id: docId,
      title: `คุณต้องการลบเอกสาร ID "${docId}" ใช่หรือไม่?`,
      subtitle: `การลบเอกสารออกจากคอลเลกชัน ${selectedCollection} ถาวร`,
      action: async () => {
        await deleteAdminDocument(selectedCollection, docId);
        showToast(`ลบเอกสาร ${docId} เรียบร้อยแล้ว`);
        await loadCollectionDocs(selectedCollection);
        await loadOverview(true);
      },
    });
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      showToast(`ปรับเปลี่ยนสิทธิ์ผู้ใช้เป็น ${newRole} เรียบร้อยแล้ว`);
      if (selectedCollection === 'users') {
        await loadCollectionDocs('users');
      }
      await loadOverview(true);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถอัปเดตสิทธิ์ผู้ใช้ได้');
    }
  };

  const handleResetDevice = (userId: string, userName: string) => {
    setDeleteConfirmItem({
      type: 'device',
      id: userId,
      title: `ยืนยันการปลดล็อกอุปกรณ์สำหรับ ${userName}?`,
      subtitle: 'ผู้ใช้จะสามารถผูกอุปกรณ์เครื่องใหม่เข้ากับบัญชีนี้ได้ในการเข้าใช้งานครั้งถัดไป',
      action: async () => {
        await resetUserDevice(userId);
        showToast(`ปลดล็อกอุปกรณ์ของ ${userName} สำเร็จ!`);
        if (selectedCollection === 'users') {
          await loadCollectionDocs('users');
        }
      },
    });
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(documents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${selectedCollection}_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`ส่งออกไฟล์ ${selectedCollection}.json สำเร็จ`);
  };

  const handleOverrideAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideMsg('');
    setOverrideErrorMsg('');

    if (!overrideSelectedUser) {
      setOverrideErrorMsg('กรุณาค้นหาและเลือกผู้ใช้ (นักศึกษา หรือ อาจารย์) จากระบบก่อนทำรายการ');
      return;
    }

    const sessionsForSelectedCourse = overrideCourseId && overrideCourseId !== 'ALL'
      ? allSessions.filter((s) => s.courseId === overrideCourseId)
      : allSessions;

    if (overrideCourseId && overrideCourseId !== 'ALL' && sessionsForSelectedCourse.length > 0 && !overrideSessionId) {
      setOverrideErrorMsg('กรุณาเลือก Session ที่ต้องการปรับสถานะ');
      return;
    }

    try {
      setIsOverrideSubmitting(true);
      const res = await overrideAttendanceRecord({
        studentId: overrideSelectedUser.id,
        courseId: overrideCourseId !== 'ALL' ? overrideCourseId : undefined,
        sessionId: overrideSessionId || undefined,
        status: overrideStatus,
      });

      setOverrideMsg(res.message || 'บันทึกแก้ไขสถานะการเช็กชื่อสำเร็จเรียบร้อยแล้ว');
      showToast('ปรับสถานะการเช็กชื่อเรียบร้อยแล้ว');
      setTimeout(() => setOverrideMsg(''), 4000);
      await loadOverrideTabData(true);
      await loadOverview(true);
    } catch (err: any) {
      setOverrideErrorMsg(err.message || 'เกิดข้อผิดพลาดในการปรับสถานะ');
    } finally {
      setIsOverrideSubmitting(false);
    }
  };

  const handleDeleteCheckinRecord = (record: any, type: 'STUDENT' | 'TEACHER') => {
    const coll = type === 'STUDENT' ? 'attendanceRecords' : 'teacherAttendanceRecords';
    const userName = record.studentNameTh || record.teacherName || record.studentUniversityId || record.id;
    const courseInfo = record.courseCode || record.sessionId || '';

    setDeleteConfirmItem({
      type: 'document',
      id: record.id,
      title: `ยืนยันการลบประวัติการเช็กชื่อของ ${userName}`,
      subtitle: `รายการเช็กชื่อ (${type === 'STUDENT' ? 'นักศึกษา' : 'อาจารย์'}) ${courseInfo ? `วิชา ${courseInfo}` : ''} จะถูกลบออกจากฐานข้อมูลถาวร`,
      action: async () => {
        await deleteAdminDocument(coll, record.id);
        showToast(`ลบข้อมูลการเช็กชื่อของ ${userName} เรียบร้อยแล้ว`);
        await loadOverrideTabData(true);
        await loadOverview(true);
      },
    });
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const str = JSON.stringify(doc).toLowerCase();
    return str.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl bg-emerald-500 text-white font-extrabold text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className={`p-6 md:p-8 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
        isDarkMode
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-indigo-500/20 text-white'
          : 'bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 border-sky-200 text-slate-900'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-left">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-2xl border ${
                isDarkMode ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-100 border-purple-300 text-purple-700'
              }`}>
                <Shield className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
              </div>
              <span className={`text-xs font-extrabold font-mono tracking-widest uppercase px-3 py-1 rounded-full border ${
                isDarkMode ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-100 border-purple-300 text-purple-900'
              }`}>
                SYSTEM ADMIN & REALTIME DATABASE INSPECTOR
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black">
              แผงควบคุมผู้ดูแลระบบ & ฐานข้อมูล Realtime
            </h1>
            <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
              ตรวจสอบข้อมูล Firestore แบบเรียลไทม์, แก้ไขสิทธิ์ผู้ใช้, ปลดล็อกเครื่อง, และจัดการการเช็กชื่อของระบบ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Realtime Sync Badge */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                autoRefresh
                  ? isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200'
                  : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 border-slate-300 text-slate-800 hover:bg-slate-300'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${
                autoRefresh 
                  ? isDarkMode ? 'bg-emerald-400 animate-ping' : 'bg-emerald-600 animate-ping'
                  : 'bg-slate-500'
              }`} />
              <span>{autoRefresh ? 'Realtime Auto-Sync Enabled' : 'Auto-Sync Paused'}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => {
                loadOverview();
                if (activeTab === 'DATABASE') loadCollectionDocs(selectedCollection);
              }}
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 active:scale-95 transition flex items-center space-x-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
              <span>รีเฟรชข้อมูล</span>
            </button>
          </div>
        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>ผู้ใช้ทั้งหมด</span>
            <span className={`text-xl font-black ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>{overview?.collections?.users || 0}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>รายวิชาเรียน</span>
            <span className={`text-xl font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>{overview?.collections?.courses || 0}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>การเช็กชื่อนักศึกษา</span>
            <span className={`text-xl font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{overview?.collections?.attendanceRecords || 0}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>ใบขอลาเรียน</span>
            <span className={`text-xl font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>{overview?.collections?.leaveRequests || 0}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Dynamic QR Active</span>
            <span className={`text-xl font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{overview?.collections?.activeQRCodes || 0}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Uptime ระบบ</span>
            <span className={`text-sm font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>{Math.floor((overview?.system?.uptime || 0) / 60)} นาที</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className={`flex border-b overflow-x-auto gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('DATABASE')}
          className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeTab === 'DATABASE'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>🗄️ ฐานข้อมูล Realtime</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('USERS');
            setSelectedCollection('users');
            loadCollectionDocs('users');
          }}
          className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeTab === 'USERS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>👥 จัดการผู้ใช้ & สิทธิ์</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('COURSES');
            loadCoursesAndSessionsData();
          }}
          className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeTab === 'COURSES'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>📚 การจัดการฐานข้อมูลรายวิชาและ session แต่ละสัปดาห์</span>
        </button>

        <button
          onClick={() => setActiveTab('OVERRIDE')}
          className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeTab === 'OVERRIDE'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>📝 แก้ไขการเช็กชื่อ & อนุมัติแทน</span>
        </button>
      </div>

      {/* TAB 1: REALTIME DATABASE INSPECTOR */}
      {activeTab === 'DATABASE' && (() => {
        const columns = getCollectionColumns(selectedCollection, documents);
        
        const sortedAndFilteredDocs = documents
          .filter((doc) => {
            if (!searchQuery.trim()) return true;
            const term = searchQuery.toLowerCase();
            return JSON.stringify(doc).toLowerCase().includes(term);
          })
          .sort((a, b) => {
            if (!sortField) return 0;
            let valA = a[sortField];
            let valB = b[sortField];

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'number' && typeof valB === 'number') {
              return sortDirection === 'asc' ? valA - valB : valB - valA;
            }

            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();

            if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
            if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
          });

        return (
          <div className="space-y-4">
            {/* Collection Toolbar & Controls */}
            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>เลือก Collection:</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value);
                    setSortField(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="users">👤 users ({overview?.collections?.users || 0})</option>
                  <option value="courses">📚 courses ({overview?.collections?.courses || 0})</option>
                  <option value="courseMembers">🎓 courseMembers ({overview?.collections?.courseMembers || 0})</option>
                  <option value="sessions">🗓️ sessions ({overview?.collections?.sessions || 0})</option>
                  <option value="attendanceRecords">✅ attendanceRecords ({overview?.collections?.attendanceRecords || 0})</option>
                  <option value="teacherAttendanceRecords">👨‍🏫 teacherAttendanceRecords ({overview?.collections?.teacherAttendanceRecords || 0})</option>
                  <option value="leaveRequests">📄 leaveRequests ({overview?.collections?.leaveRequests || 0})</option>
                  <option value="quickEvents">⚡ quickEvents ({overview?.collections?.quickEvents || 0})</option>
                  <option value="activeQRCodes">🔐 activeQRCodes ({overview?.collections?.activeQRCodes || 0})</option>
                </select>

                {/* Document Search Filter */}
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    placeholder="ค้นหาข้อมูลทุก Field..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-64 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute right-2.5 top-2 text-xs cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort info badge & clear */}
                {sortField && (
                  <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border ${
                    isDarkMode
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                      : 'bg-purple-100 border-purple-300 text-purple-900 font-bold'
                  }`}>
                    <Filter className={`w-3 h-3 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
                    <span>เรียงตาม: <strong>{FIELD_LABELS[sortField] || sortField}</strong> ({sortDirection.toUpperCase()})</span>
                    <button
                      onClick={() => setSortField(null)}
                      className={`ml-1 transition cursor-pointer ${isDarkMode ? 'text-purple-400 hover:text-purple-200' : 'text-purple-700 hover:text-purple-950'}`}
                      title="ยกเลิกการเรียง"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className={`text-[11px] font-semibold hidden lg:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                  แสดง {sortedAndFilteredDocs.length} / {documents.length} รายการ
                </span>

                <button
                  onClick={handleExportJSON}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-sm'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>

                <button
                  onClick={handleOpenCreateDoc}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มเอกสารใหม่</span>
                </button>
              </div>
            </div>

            {/* Collection Data Table */}
            <div className={`rounded-2xl border overflow-hidden shadow-lg ${
              isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              {loadingDocs ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                  <span>กำลังโหลดเอกสารใน {selectedCollection}...</span>
                </div>
              ) : sortedAndFilteredDocs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {searchQuery ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${searchQuery}"` : `ไม่พบเอกสารใน Collection ${selectedCollection}`}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`border-b font-mono font-bold uppercase select-none ${
                      isDarkMode ? 'bg-slate-950/90 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}>
                      <tr>
                        {columns.map((col) => {
                          const isActive = sortField === col;
                          return (
                            <th
                              key={col}
                              onClick={() => handleSort(col)}
                              className="p-3 transition hover:text-purple-500 cursor-pointer whitespace-nowrap group"
                            >
                              <div className="flex items-center space-x-1.5">
                                <span>{FIELD_LABELS[col] || col}</span>
                                {isActive ? (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                                  )
                                ) : (
                                  <ArrowUpDown className={`w-3 h-3 transition ${isDarkMode ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-700'}`} />
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="p-3 text-right whitespace-nowrap">จัดการเอกสาร</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/40' : 'divide-slate-200'}`}>
                      {sortedAndFilteredDocs.map((doc, idx) => (
                        <tr key={doc.id || idx} className={`transition ${
                          isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                        }`}>
                          {columns.map((col) => (
                            <td key={col} className="p-3 whitespace-nowrap">
                              {renderTableCell(doc, col)}
                            </td>
                          ))}

                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenEditDoc(doc)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border-sky-500/30'
                                    : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border-sky-300 font-bold'
                                }`}
                                title="แก้ไข JSON"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                                    : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border-rose-300 font-bold'
                                }`}
                                title="ลบเอกสาร"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 2: USER ROLE & DEVICE CONTROL */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, อีเมล, รหัสประจำตัว..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                  }`}
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">ทุกสิทธิ์การใช้งาน</option>
                <option value={UserRole.STUDENT}>👨‍🎓 นักศึกษา (STUDENT)</option>
                <option value={UserRole.TEACHER}>👨‍🏫 อาจารย์ (TEACHER)</option>
                <option value={UserRole.ADMIN}>🛠️ ผู้ดูแลระบบ (ADMIN)</option>
              </select>
            </div>
          </div>

          {/* User Management Table */}
          <div className={`rounded-2xl border overflow-hidden shadow-lg ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-mono font-bold uppercase select-none ${
                  isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}>
                  <tr>
                    <th
                      onClick={() => handleUserTableSort('name')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>ชื่อ-นามสกุล / รหัส</span>
                        {userTableSortField === 'name' ? (
                          userTableSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleUserTableSort('email')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>อีเมล & อุปกรณ์</span>
                        {userTableSortField === 'email' ? (
                          userTableSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleUserTableSort('role')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>สิทธิ์ใช้งาน (Role)</span>
                        {userTableSortField === 'role' ? (
                          userTableSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/40' : 'divide-slate-200'}`}>
                  {documents
                    .filter((u: User) => {
                      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
                      if (userSearchQuery.trim()) {
                        const term = userSearchQuery.toLowerCase();
                        const name = `${u.firstNameTh || ''} ${u.lastNameTh || ''}`.toLowerCase();
                        const email = (u.email || '').toLowerCase();
                        const uid = (u.universityId || '').toLowerCase();
                        return name.includes(term) || email.includes(term) || uid.includes(term);
                      }
                      return true;
                    })
                    .sort((a: User, b: User) => {
                      if (!userTableSortField) return 0;
                      const dir = userTableSortDir === 'asc' ? 1 : -1;
                      if (userTableSortField === 'name') {
                        const nameA = `${a.firstNameTh || ''} ${a.lastNameTh || ''}`.toLowerCase();
                        const nameB = `${b.firstNameTh || ''} ${b.lastNameTh || ''}`.toLowerCase();
                        return nameA.localeCompare(nameB) * dir;
                      }
                      if (userTableSortField === 'email') {
                        return (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase()) * dir;
                      }
                      if (userTableSortField === 'role') {
                        return (a.role || '').localeCompare(b.role || '') * dir;
                      }
                      return 0;
                    })
                    .map((user: User) => (
                      <tr key={user.id} className={`transition ${
                        isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                      }`}>
                        <td className="p-3">
                          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {user.title || ''} {user.firstNameTh} {user.lastNameTh}
                          </div>
                          <div className={`text-[11px] font-mono ${isDarkMode ? 'text-purple-400' : 'text-purple-700 font-bold'}`}>
                            ID: {user.universityId} ({user.id})
                          </div>
                        </td>

                        <td className={`p-3 font-mono text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-900 font-semibold'}`}>
                          <div>{user.email}</div>
                          <div className={`${isDarkMode ? 'text-slate-500' : 'text-slate-700 font-medium'} flex items-center space-x-1 mt-0.5`}>
                            <Smartphone className={`w-3 h-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                            <span>{user.deviceId ? `Locked: ${user.deviceId.slice(0, 12)}...` : '🔓 ไม่มีการผูกเครื่อง'}</span>
                          </div>
                        </td>

                        <td className="p-3">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                              user.role === UserRole.ADMIN
                                ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
                                : user.role === UserRole.TEACHER
                                ? isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-100 text-sky-900 border-sky-300'
                                : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            <option value={UserRole.STUDENT}>STUDENT</option>
                            <option value={UserRole.TEACHER}>TEACHER</option>
                            <option value={UserRole.ADMIN}>ADMIN</option>
                          </select>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleResetDevice(user.id, `${user.firstNameTh} ${user.lastNameTh}`)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center space-x-1 ml-auto cursor-pointer ${
                              isDarkMode
                                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30'
                                : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border-amber-300 font-extrabold'
                            }`}
                            title="ปลดล็อกอุปกรณ์เพื่อให้นักศึกษาลงทะเบียนเข้าใช้จากเครื่องใหม่ได้"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>ปลดล็อกเครื่อง</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COURSES & WEEKLY SESSIONS MANAGEMENT */}
      {activeTab === 'COURSES' && (
        <div className="space-y-6">
          {/* Top Control Bar & Stats Header */}
          <div className={`p-6 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <BookOpen className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
                    <span>ฐานข้อมูลรายวิชา & Session สัปดาห์</span>
                  </div>
                  <span className={`block text-xs font-semibold ${isDarkMode ? 'text-purple-300/80' : 'text-purple-700/80'}`}>
                    (Courses & Weekly Sessions)
                  </span>
                </h3>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                  จัดการข้อมูลรายวิชา กำหนดสัปดาห์เรียน เพิ่ม/แก้ไข/ลบ Session และเปิด-ปิดการเช็กชื่อสำหรับนักศึกษา
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenCreateCourse}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายวิชาใหม่</span>
                </button>

                <button
                  onClick={() => handleOpenCreateSession(selectedCourseForSessions !== 'ALL' ? selectedCourseForSessions : undefined)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>เพิ่ม Session สัปดาห์</span>
                </button>

                <button
                  onClick={() => loadCoursesAndSessionsData()}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCoursesData ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Metric Summary Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/40">
              <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>รายวิชาทั้งหมด</span>
                <span className={`text-xl font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{allCourses.length} วิชา</span>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Session สัปดาห์ทั้งหมด</span>
                <span className={`text-xl font-black ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>{allSessions.length} เซสชัน</span>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>กำลังเปิดเช็กชื่ออยู่ (Active)</span>
                <span className={`text-xl font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {allSessions.filter((s) => s.isActive).length} เซสชัน
                </span>
              </div>
            </div>
          </div>

          {/* SECTION A: COURSES TABLE */}
          <div className={`p-6 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h4 className="text-sm font-extrabold flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-purple-500" />
                <span>1. รายชื่อรายวิชาในฐานข้อมูล ({allCourses.length})</span>
              </h4>

              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
                  value={courseSearchQuery}
                  onChange={(e) => setCourseSearchQuery(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                  }`}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-mono font-bold uppercase select-none ${
                  isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}>
                  <tr>
                    <th
                      onClick={() => handleCourseSort('code')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>รหัสวิชา / ชื่อวิชา</span>
                        {courseSortField === 'code' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleCourseSort('year')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>ปีการศึกษา/ภาค</span>
                        {courseSortField === 'year' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleCourseSort('coordinator')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>อาจารย์ผู้รับผิดชอบ</span>
                        {courseSortField === 'coordinator' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="p-3">พิกัด Lat/Lng</th>
                    <th
                      onClick={() => handleCourseSort('weeks')}
                      className="p-3 text-center cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center justify-center space-x-1.5">
                        <span>สัปดาห์เรียน</span>
                        {courseSortField === 'weeks' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleCourseSort('sessions')}
                      className="p-3 text-center cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center justify-center space-x-1.5">
                        <span>Session ที่สร้าง</span>
                        {courseSortField === 'sessions' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                  {allCourses
                    .filter((c) => {
                      if (!courseSearchQuery) return true;
                      const q = courseSearchQuery.toLowerCase();
                      return (
                        (c.courseCode || c.code || '').toLowerCase().includes(q) ||
                        (c.courseName || c.nameTh || '').toLowerCase().includes(q) ||
                        (c.coordinatorName || '').toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      if (!courseSortField) return 0;
                      const dir = courseSortDir === 'asc' ? 1 : -1;
                      if (courseSortField === 'code') {
                        const codeA = (a.courseCode || a.code || '').toLowerCase();
                        const codeB = (b.courseCode || b.code || '').toLowerCase();
                        return codeA.localeCompare(codeB) * dir;
                      }
                      if (courseSortField === 'year') {
                        return ((a.academicYear || 0) - (b.academicYear || 0)) * dir;
                      }
                      if (courseSortField === 'coordinator') {
                        const cA = (a.coordinatorName || a.ownerName || '').toLowerCase();
                        const cB = (b.coordinatorName || b.ownerName || '').toLowerCase();
                        return cA.localeCompare(cB) * dir;
                      }
                      if (courseSortField === 'weeks') {
                        const wA = a.weeks ? a.weeks.length : 0;
                        const wB = b.weeks ? b.weeks.length : 0;
                        return (wA - wB) * dir;
                      }
                      if (courseSortField === 'sessions') {
                        const sA = allSessions.filter((s) => s.courseId === a.id).length;
                        const sB = allSessions.filter((s) => s.courseId === b.id).length;
                        return (sA - sB) * dir;
                      }
                      return 0;
                    })
                    .map((course) => {
                      const courseCode = course.courseCode || course.code || course.id;
                      const courseName = course.courseName || course.nameTh || '-';
                      const createdCount = allSessions.filter((s) => s.courseId === course.id).length;
                      const weeksCount = course.weeks ? course.weeks.length : 0;

                      return (
                        <tr key={course.id} className={`transition ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                          <td className="p-3">
                            <div className="font-mono font-extrabold text-purple-500 text-xs">{courseCode}</div>
                            <div className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{courseName}</div>
                          </td>
                          <td className={`p-3 font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                            {course.academicYear || 2569} / ภาค {course.semester || '1'}
                          </td>
                          <td className={`p-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>
                            <div className="font-extrabold text-xs flex items-center space-x-1.5">
                              <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              <span>{course.coordinatorName || course.ownerName || 'อ.ผู้รับผิดชอบ'}</span>
                            </div>
                            {course.ownerId && (
                              <div className="text-[10px] text-slate-400 font-mono pl-5">
                                {teachersList.find((t) => t.id === course.ownerId)?.email || `ID: ${course.ownerId}`}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            <div className="flex items-center space-x-1 text-slate-500">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{course.defaultLat ? `${Number(course.defaultLat).toFixed(4)}, ${Number(course.defaultLng).toFixed(4)}` : 'ไม่ระบุ'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                              isDarkMode ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-900 border-purple-200'
                            }`}>
                              {weeksCount} สัปดาห์
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                              createdCount > 0
                                ? isDarkMode ? 'bg-sky-500/10 text-sky-300 border-sky-500/30' : 'bg-sky-50 text-sky-900 border-sky-200'
                                : isDarkMode ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-300'
                            }`}>
                              {createdCount} Session
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => setSelectedCourseForSessions(course.id)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  selectedCourseForSessions === course.id
                                    ? 'bg-purple-600 text-white border-purple-500'
                                    : isDarkMode
                                    ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border-purple-500/30'
                                    : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border-purple-300 font-bold'
                                }`}
                                title="ดู Session ทั้งหมดของวิชานี้"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenCreateSession(course.id)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-bold'
                                }`}
                                title="เพิ่ม Session ใหม่ในวิชานี้"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>

                              <button
                                onClick={() => handleOpenEditCourse(course)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border-sky-500/30'
                                    : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border-sky-300 font-bold'
                                }`}
                                title="แก้ไขข้อมูลวิชา"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteCourseSubmit(course.id, courseCode)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                                    : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border-rose-300 font-bold'
                                }`}
                                title="ลบรายวิชา"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: WEEKLY SESSIONS TABLE */}
          <div className={`p-6 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-sky-500" />
                <h4 className="text-sm font-extrabold">
                  2. รายการ Session แต่ละสัปดาห์ (Weekly Sessions)
                </h4>
              </div>

              <div className="flex items-center space-x-2">
                <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>กรองตามรายวิชา:</label>
                <select
                  value={selectedCourseForSessions}
                  onChange={(e) => setSelectedCourseForSessions(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">📚 แสดงวิชาทั้งหมด ({allSessions.length} เซสชัน)</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.courseCode || c.code}] {c.courseName || c.nameTh}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Course Banner */}
            {selectedCourseForSessions !== 'ALL' && (() => {
              const curC = allCourses.find((c) => c.id === selectedCourseForSessions);
              return curC ? (
                <div className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                  isDarkMode ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-950'
                }`}>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>กำลังแสดง Session ของ: <strong className="underline font-extrabold">{curC.courseCode || curC.code} - {curC.courseName || curC.nameTh}</strong></span>
                  </div>
                  <button
                    onClick={() => setSelectedCourseForSessions('ALL')}
                    className="text-[11px] underline hover:opacity-80 cursor-pointer ml-2"
                  >
                    ล้างการกรอง (ดูทุกวิชา)
                  </button>
                </div>
              ) : null;
            })()}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-mono font-bold uppercase select-none ${
                  isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}>
                  <tr>
                    <th
                      onClick={() => handleSessionSort('week')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>สัปดาห์ / วิชา</span>
                        {sessionSortField === 'week' ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSessionSort('topic')}
                      className="p-3 cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>หัวข้อการเรียน (Topic)</span>
                        {sessionSortField === 'topic' ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="p-3">พิกัดสถานที่ (Lat/Lng)</th>
                    <th
                      onClick={() => handleSessionSort('status')}
                      className="p-3 text-center cursor-pointer hover:text-purple-500 transition"
                    >
                      <div className="flex items-center justify-center space-x-1.5">
                        <span>สถานะการเช็กชื่อ</span>
                        {sessionSortField === 'status' ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-500 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-500 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                  {allSessions
                    .filter((s) => {
                      if (selectedCourseForSessions !== 'ALL' && s.courseId !== selectedCourseForSessions) return false;
                      if (!courseSearchQuery) return true;
                      const q = courseSearchQuery.toLowerCase();
                      const matchedCourse = allCourses.find((c) => c.id === s.courseId);
                      const code = matchedCourse ? (matchedCourse.courseCode || matchedCourse.code || '') : '';
                      return (
                        (s.topic || '').toLowerCase().includes(q) ||
                        code.toLowerCase().includes(q) ||
                        String(s.weekNumber).includes(q)
                      );
                    })
                    .sort((a, b) => {
                      if (!sessionSortField) return Number(a.weekNumber) - Number(b.weekNumber);
                      const dir = sessionSortDir === 'asc' ? 1 : -1;
                      if (sessionSortField === 'week') {
                        return (Number(a.weekNumber) - Number(b.weekNumber)) * dir;
                      }
                      if (sessionSortField === 'topic') {
                        const tA = (a.topic || '').toLowerCase();
                        const tB = (b.topic || '').toLowerCase();
                        return tA.localeCompare(tB) * dir;
                      }
                      if (sessionSortField === 'status') {
                        return ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)) * dir;
                      }
                      return 0;
                    })
                    .map((session) => {
                      const matchedCourse = allCourses.find((c) => c.id === session.courseId);
                      const courseCode = matchedCourse ? (matchedCourse.courseCode || matchedCourse.code || 'วิชา') : 'วิชา';

                      return (
                        <tr key={session.id} className={`transition ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                          <td className="p-3">
                            <div className="flex items-center space-x-1.5 font-bold">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-900'
                              }`}>
                                สัปดาห์ที่ {session.weekNumber}
                              </span>
                              <span className="font-mono text-[11px] text-purple-500 font-extrabold">[{courseCode}]</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 mt-0.5">ID: {session.id}</div>
                          </td>

                          <td className={`p-3 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {session.topic || `สัปดาห์ที่ ${session.weekNumber}`}
                          </td>

                          <td className="p-3 font-mono text-[11px]">
                            <div className="flex items-center space-x-1 text-slate-500">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{session.teacherLat ? `${Number(session.teacherLat).toFixed(4)}, ${Number(session.teacherLng).toFixed(4)}` : 'ใช้พิกัดวิชา'}</span>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleSessionActiveStatus(session)}
                              className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition flex items-center space-x-1.5 mx-auto cursor-pointer ${
                                session.isActive
                                  ? isDarkMode
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200'
                                  : isDarkMode
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                  : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                              }`}
                              title="คลิกเพื่อสลับสถานะเปิด/ปิดเช็กชื่อ"
                            >
                              <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
                              <span>{session.isActive ? '🟢 เปิดเช็กชื่อ (ACTIVE)' : '🔴 ปิดเช็กชื่อ (INACTIVE)'}</span>
                            </button>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenEditSession(session)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border-sky-500/30'
                                    : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border-sky-300 font-bold'
                                }`}
                                title="แก้ไข Session"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteSessionSubmit(session.id, session.weekNumber)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                                    : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border-rose-300 font-bold'
                                }`}
                                title="ลบ Session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE & LEAVE OVERRIDE */}
      {activeTab === 'OVERRIDE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Override Attendance Form */}
            <div
              className={`p-6 rounded-3xl border shadow-xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <h3 className="text-base font-extrabold flex items-center space-x-2 mb-4">
                <Sliders className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                <span>ปรับแก้ไขสถานะการเช็กชื่อ (Attendance Override)</span>
              </h3>

              {overrideMsg && (
                <div
                  className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
                    isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>{overrideMsg}</span>
                </div>
              )}

              {overrideErrorMsg && (
                <div
                  className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
                    isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>{overrideErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleOverrideAttendanceSubmit} className="space-y-4 text-xs">
                {/* 1. Target User Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                      1. ค้นหาและเลือกผู้ใช้ (นักศึกษา หรือ อาจารย์) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
                      <button
                        type="button"
                        onClick={() => setOverrideUserType('ALL')}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          overrideUserType === 'ALL'
                            ? 'bg-sky-600 text-white shadow'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideUserType('STUDENT')}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          overrideUserType === 'STUDENT'
                            ? 'bg-sky-600 text-white shadow'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        นักศึกษา
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideUserType('TEACHER')}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          overrideUserType === 'TEACHER'
                            ? 'bg-sky-600 text-white shadow'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        อาจารย์
                      </button>
                    </div>
                  </div>

                  {/* Selected User Preview Card */}
                  {overrideSelectedUser ? (
                    <div
                      className={`p-3 rounded-2xl border flex items-center justify-between ${
                        isDarkMode
                          ? 'bg-sky-500/10 border-sky-500/30 text-white'
                          : 'bg-sky-50/80 border-sky-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                            overrideSelectedUser.role === UserRole.TEACHER ? 'bg-amber-500' : 'bg-sky-600'
                          }`}
                        >
                          {overrideSelectedUser.role === UserRole.TEACHER ? <UserCheck className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-extrabold flex items-center space-x-1.5">
                            <span>
                              {overrideSelectedUser.title || ''}
                              {overrideSelectedUser.firstNameTh} {overrideSelectedUser.lastNameTh}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                overrideSelectedUser.role === UserRole.TEACHER
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                              }`}
                            >
                              {overrideSelectedUser.role === UserRole.TEACHER ? 'อาจารย์' : 'นักศึกษา'}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-75 font-mono">
                            {overrideSelectedUser.universityId ? `รหัสประจำตัว: ${overrideSelectedUser.universityId} | ` : ''}
                            User ID: {overrideSelectedUser.id}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideSelectedUser(null);
                          setOverrideUserSearch('');
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                          isDarkMode
                            ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-rose-500/30'
                            : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        ✕ เปลี่ยนผู้ใช้
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="พิมพ์รหัสนักศึกษา, User ID, ชื่อ-นามสกุล หรือ อีเมล..."
                          value={overrideUserSearch}
                          onChange={(e) => setOverrideUserSearch(e.target.value)}
                          className={`w-full pl-9 pr-3 py-2.5 rounded-2xl border font-mono text-xs ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                              : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold placeholder-slate-400'
                          }`}
                        />
                      </div>

                      {/* Dropdown list of matching users */}
                      <div
                        className={`max-h-48 overflow-y-auto rounded-2xl border divide-y ${
                          isDarkMode
                            ? 'bg-slate-800/90 border-slate-700 divide-slate-700/50'
                            : 'bg-slate-50 border-slate-200 divide-slate-200'
                        }`}
                      >
                        {filteredUsersForOverride.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-[11px]">
                            {allUsersList.length === 0 ? 'กำลังโหลดรายการผู้ใช้...' : 'ไม่พบข้อมูลผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา'}
                          </div>
                        ) : (
                          filteredUsersForOverride.slice(0, 10).map((u) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setOverrideSelectedUser(u);
                                setOverrideErrorMsg('');
                              }}
                              className={`p-2.5 hover:bg-sky-500/10 transition cursor-pointer flex items-center justify-between text-xs ${
                                isDarkMode ? 'hover:text-sky-300' : 'hover:text-sky-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    u.role === UserRole.TEACHER
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                                  }`}
                                >
                                  {u.role === UserRole.TEACHER ? 'อาจารย์' : 'นักศึกษา'}
                                </span>
                                <span className="font-bold">
                                  {u.title || ''}
                                  {u.firstNameTh} {u.lastNameTh}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {u.universityId ? `รหัส: ${u.universityId}` : `ID: ${u.id}`}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Course Selection Dropdown */}
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    2. เลือกรายวิชา:
                  </label>
                  <select
                    value={overrideCourseId}
                    onChange={(e) => {
                      setOverrideCourseId(e.target.value);
                      setOverrideSessionId('');
                      setOverrideErrorMsg('');
                    }}
                    className={`w-full p-2.5 rounded-2xl border font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- เลือกรายวิชา --</option>
                    <option value="ALL">-- ทุกวิชา / กิจกรรมส่วนกลาง (Quick Event) --</option>
                    {allCourses.map((crs) => (
                      <option key={crs.id} value={crs.id}>
                        [{crs.courseCode}] {crs.courseName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Session Selection Dropdown */}
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    3. เลือก Session หรือสัปดาห์เรียน:
                  </label>
                  <select
                    value={overrideSessionId}
                    onChange={(e) => {
                      setOverrideSessionId(e.target.value);
                      setOverrideErrorMsg('');
                    }}
                    className={`w-full p-2.5 rounded-2xl border font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- เลือก Session --</option>
                    {(overrideCourseId && overrideCourseId !== 'ALL'
                      ? allSessions.filter((s) => s.courseId === overrideCourseId)
                      : allSessions
                    ).map((ses) => (
                      <option key={ses.id} value={ses.id}>
                        สัปดาห์ที่ {ses.weekNumber}: {ses.topic || 'ไม่มีหัวข้อ'} ({ses.isActive ? '🟢 Active' : '🔴 Inactive'})
                      </option>
                    ))}
                  </select>

                  {/* Warning if selected course has no sessions */}
                  {overrideCourseId &&
                    overrideCourseId !== 'ALL' &&
                    allSessions.filter((s) => s.courseId === overrideCourseId).length === 0 && (
                      <div
                        className={`mt-1.5 p-2 rounded-xl border text-[11px] font-bold flex items-center space-x-1.5 ${
                          isDarkMode
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>รายวิชานี้ยังไม่มี Session ในระบบ กรุณาสร้าง Session ในเมนูจัดการวิชาก่อน</span>
                      </div>
                    )}
                </div>

                {/* 4. Status Selection (Includes AttendanceStatus & LeaveStatus) */}
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    4. สถานะที่ต้องการกำหนด (รวมสถานะลา):
                  </label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className={`w-full p-2.5 rounded-2xl border font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <optgroup label="-- สถานะเข้าเรียนทั่วไป --">
                      <option value={AttendanceStatus.PRESENT}>🟢 PRESENT (มาเรียน)</option>
                      <option value={AttendanceStatus.LATE}>🟡 LATE (สาย)</option>
                      <option value={AttendanceStatus.ABSENT}>🔴 ABSENT (ขาดเรียน)</option>
                    </optgroup>
                    <optgroup label="-- สถานะการลาเรียน (Leave System) --">
                      <option value="SICK_LEAVE">🏥 SICK_LEAVE (ลาป่วย)</option>
                      <option value="PERSONAL_LEAVE">📝 PERSONAL_LEAVE (ลากิจ)</option>
                      <option value="LEAVE">📄 LEAVE / APPROVED_LEAVE (อนุมัติการลา)</option>
                    </optgroup>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isOverrideSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-sky-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isOverrideSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>บันทึกการปรับสถานะเช็กชื่อ</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Info & Guidelines */}
            <div
              className={`p-6 rounded-3xl border shadow-xl space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <h3 className={`text-base font-extrabold flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <Shield className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                <span>คำแนะนำสำหรับการใช้ Admin Mode</span>
              </h3>

              <div className="space-y-3 text-xs leading-relaxed">
                <div
                  className={`p-3 rounded-2xl border ${
                    isDarkMode ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-950 font-medium'
                  }`}
                >
                  <span className="font-bold">Realtime Search & Override:</span> ค้นหานักศึกษาหรืออาจารย์ด้วย User ID, รหัสนักศึกษา หรือชื่อจากฐานข้อมูลจริง เพื่อป้องกันข้อมูลซ้ำซ้อน
                </div>

                <div
                  className={`p-3 rounded-2xl border ${
                    isDarkMode ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-950 font-medium'
                  }`}
                >
                  <span className="font-bold">Leave Integration:</span> รองรับการปรับสถานะการเช็กชื่อเป็นสถานะลาป่วย (SICK_LEAVE), ลากิจ (PERSONAL_LEAVE) หรืออนุมัติการลา (LEAVE) ได้โดยตรง
                </div>

                <div
                  className={`p-3 rounded-2xl border ${
                    isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-950 font-medium'
                  }`}
                >
                  <span className="font-bold">Check-in Deletion:</span> Admin สามารถตรวจสอบและกดลบรายการเช็กชื่อของทั้งนักศึกษาและอาจารย์ที่มีปัญหาออกจากระบบในตารางด้านล่างได้ทันที
                </div>
              </div>
            </div>
          </div>

          {/* LOWER SECTION: CHECK-IN HISTORY & DELETION TABLE */}
          <div
            className={`p-6 rounded-3xl border shadow-xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold flex items-center space-x-2">
                  <Database className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                  <span>รายการประวัติการเช็กชื่อและลบข้อมูล (Check-in History & Deletion)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ตรวจสอบรายการเช็กชื่อทั้งหมด สามารถค้นหา กรองรายวิชา และกดลบรายการที่ไม่ถูกต้องได้
                </p>
              </div>

              {/* Role filter buttons */}
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs">
                <button
                  type="button"
                  onClick={() => setCheckinRoleFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    checkinRoleFilter === 'ALL'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ทั้งหมด ({allStudentAttendance.length + allTeacherAttendance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckinRoleFilter('STUDENT')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    checkinRoleFilter === 'STUDENT'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🎓 นักศึกษา ({allStudentAttendance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckinRoleFilter('TEACHER')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    checkinRoleFilter === 'TEACHER'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  👨‍🏫 อาจารย์ ({allTeacherAttendance.length})
                </button>
              </div>
            </div>

            {/* Filter controls bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, รหัสนักศึกษา, วิชา, สถานะ..."
                  value={checkinSearchQuery}
                  onChange={(e) => setCheckinSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <select
                value={checkinCourseFilter}
                onChange={(e) => setCheckinCourseFilter(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs font-semibold ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">-- กรองตามรายวิชาทั้งหมด --</option>
                {allCourses.map((crs) => (
                  <option key={crs.id} value={crs.id}>
                    [{crs.courseCode}] {crs.courseName}
                  </option>
                ))}
              </select>
            </div>

            {/* Check-in History Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={`border-b font-extrabold ${
                      isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <th className="p-3 w-10">#</th>
                    <th className="p-3">ประเภท</th>
                    <th className="p-3">ผู้เช็กชื่อ (Name / ID)</th>
                    <th className="p-3">รายวิชา & Session</th>
                    <th className="p-3">เวลาที่ประทับ</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3">วิธีเช็กชื่อ</th>
                    <th className="p-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-800'}`}>
                  {(() => {
                    const combined = [
                      ...allStudentAttendance.map((a) => ({ ...a, __type: 'STUDENT' as const })),
                      ...allTeacherAttendance.map((a) => ({ ...a, __type: 'TEACHER' as const })),
                    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

                    const filtered = combined.filter((item) => {
                      if (checkinRoleFilter === 'STUDENT' && item.__type !== 'STUDENT') return false;
                      if (checkinRoleFilter === 'TEACHER' && item.__type !== 'TEACHER') return false;

                      if (checkinCourseFilter !== 'ALL') {
                        const ses = allSessions.find((s) => s.id === item.sessionId);
                        const itemCourseId = item.courseId || ses?.courseId;
                        if (itemCourseId !== checkinCourseFilter) return false;
                      }

                      if (!checkinSearchQuery.trim()) return true;
                      const q = checkinSearchQuery.toLowerCase().trim();
                      const str = JSON.stringify(item).toLowerCase();
                      return str.includes(q);
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                            {loadingOverrideData ? 'กำลังโหลดรายการเช็กชื่อ...' : 'ไม่พบรายการเช็กชื่อตรงตามเงื่อนไขที่กำหนด'}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((item, idx) => {
                      const ses = allSessions.find((s) => s.id === item.sessionId);
                      const crs = allCourses.find((c) => c.id === (item.courseId || ses?.courseId));

                      const isStudent = item.__type === 'STUDENT';
                      const userObj = isStudent
                        ? allUsersList.find((u) => u.id === item.studentId || (item.studentUniversityId && u.universityId === item.studentUniversityId))
                        : allUsersList.find((u) => u.id === item.teacherId);

                      const formattedNameFromUser = userObj
                        ? `${userObj.title || ''}${userObj.firstNameTh || ''} ${userObj.lastNameTh || ''}`.trim()
                        : '';

                      const displayName = formattedNameFromUser || (isStudent
                        ? item.studentNameTh || item.studentNameEn || 'นักศึกษา'
                        : item.teacherName || 'อาจารย์');
                      const idText = isStudent
                        ? item.studentUniversityId || item.studentId
                        : item.teacherId;

                      const statusVal = item.status || 'PRESENT';

                      return (
                        <tr key={item.id} className={`hover:bg-sky-500/5 transition ${isDarkMode ? '' : 'even:bg-slate-50/50'}`}>
                          <td className="p-3 font-mono opacity-60 text-[11px]">{idx + 1}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isStudent
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {isStudent ? '🎓 นักศึกษา' : '👨‍🏫 อาจารย์'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{displayName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{idText}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {crs ? `[${crs.courseCode}] ${crs.courseName}` : item.courseCode || 'วิชาส่วนกลาง / Quick Event'}
                            </div>
                            {ses && (
                              <div className="text-[10px] text-slate-400">
                                สัปดาห์ที่ {ses.weekNumber}: {ses.topic || 'เรียนปกติ'}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString('th-TH') : '-'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                statusVal === 'PRESENT'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : statusVal === 'LATE'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : statusVal === 'ABSENT'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                              }`}
                            >
                              {statusVal === 'PRESENT' && '🟢 PRESENT'}
                              {statusVal === 'LATE' && '🟡 LATE'}
                              {statusVal === 'ABSENT' && '🔴 ABSENT'}
                              {['SICK_LEAVE', 'PERSONAL_LEAVE', 'LEAVE'].includes(statusVal) && `📄 ${statusVal}`}
                              {!['PRESENT', 'LATE', 'ABSENT', 'SICK_LEAVE', 'PERSONAL_LEAVE', 'LEAVE'].includes(statusVal) && statusVal}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] font-mono opacity-80">
                            {item.checkinMethod || 'HYBRID'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteCheckinRecord(item, item.__type)}
                              className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer flex items-center space-x-1 ml-auto ${
                                isDarkMode
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                              title="ลบรายการเช็กชื่อนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>ลบ</span>
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Course Create / Edit Modal */}
      {courseModalOpen && editingCourseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className={`relative w-full max-w-xl my-8 p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h4 className="text-base font-extrabold flex items-center space-x-2">
                <BookOpen className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
                <span>{editingCourseData.courseCode ? `แก้ไขรายวิชา ${editingCourseData.courseCode}` : 'เพิ่มรายวิชาใหม่'}</span>
              </h4>
              <button onClick={() => setCourseModalOpen(false)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>รหัสวิชา (Course Code): *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น CS101, TEST101"
                    value={editingCourseData.courseCode || editingCourseData.code || ''}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, courseCode: e.target.value, code: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-purple-300' : 'bg-slate-50 border-slate-300 text-purple-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>ชื่อวิชา (Course Name): *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น การโปรแกรมคอมพิวเตอร์"
                    value={editingCourseData.courseName || editingCourseData.nameTh || ''}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, courseName: e.target.value, nameTh: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>ปีการศึกษา:</label>
                  <input
                    type="number"
                    value={editingCourseData.academicYear || 2569}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, academicYear: Number(e.target.value) })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>ภาคเรียน:</label>
                  <select
                    value={editingCourseData.semester || '1'}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, semester: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="1">ภาคเรียนที่ 1</option>
                    <option value="2">ภาคเรียนที่ 2</option>
                    <option value="SUMMER">ภาคฤดูร้อน (Summer)</option>
                  </select>
                </div>
              </div>

              {/* Course Owner & Coordinator Selection Block */}
              <div className="p-3.5 rounded-2xl border bg-purple-500/5 border-purple-500/20 space-y-3">
                <div>
                  <label className={`block font-extrabold mb-1.5 flex items-center justify-between ${isDarkMode ? 'text-purple-300' : 'text-purple-900'}`}>
                    <span>👨‍🏫 อาจารย์เจ้าของรายวิชา (Course Owner):</span>
                    <span className="text-[10px] font-normal text-purple-400">เลือกอาจารย์ที่มีอยู่ในฐานข้อมูล</span>
                  </label>
                  <select
                    value={editingCourseData.ownerId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedTeacher = teachersList.find((t) => t.id === selectedId);
                      if (selectedTeacher) {
                        const autoName = `${selectedTeacher.title || ''}${selectedTeacher.firstNameTh || ''} ${selectedTeacher.lastNameTh || ''}`.trim();
                        setEditingCourseData({
                          ...editingCourseData,
                          ownerId: selectedTeacher.id,
                          coordinatorName: autoName,
                        });
                      } else {
                        setEditingCourseData({
                          ...editingCourseData,
                          ownerId: selectedId,
                        });
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                    }`}
                  >
                    <option value="">-- เลือกอาจารย์ผู้รับผิดชอบจากระบบ --</option>
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title || ''}{t.firstNameTh} {t.lastNameTh} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    ชื่อแสดงอาจารย์ผู้รับผิดชอบ (Coordinator Name):
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น อ.ดร.สมชาย ใจดี"
                    value={editingCourseData.coordinatorName || ''}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, coordinatorName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-semibold text-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Latitude (พิกัดสถานที่):</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingCourseData.defaultLat || 13.7988363}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, defaultLat: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Longitude (พิกัดสถานที่):</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingCourseData.defaultLng || 100.5018}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, defaultLng: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>รัศมี GPS อนุญาต (เมตร):</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={editingCourseData.allowedGpsRadius || 200}
                    onChange={(e) => setEditingCourseData({ ...editingCourseData, allowedGpsRadius: Math.max(1, parseInt(e.target.value, 10) || 200) })}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
                >
                  บันทึกรายวิชา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Create / Edit Modal */}
      {sessionModalOpen && editingSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className={`relative w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h4 className="text-base font-extrabold flex items-center space-x-2">
                <Calendar className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`} />
                <span>{editingSessionData.id ? `แก้ไข Session สัปดาห์ที่ ${editingSessionData.weekNumber}` : 'เพิ่ม Session สัปดาห์ใหม่'}</span>
              </h4>
              <button onClick={() => setSessionModalOpen(false)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSessionSubmit} className="space-y-4 text-xs">
              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>เลือกรายวิชา: *</label>
                <select
                  value={editingSessionData.courseId || ''}
                  onChange={(e) => setEditingSessionData({ ...editingSessionData, courseId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.courseCode || c.code}] {c.courseName || c.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>สัปดาห์ที่ (Week No.): *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={editingSessionData.weekNumber || 1}
                    onChange={(e) => setEditingSessionData({ ...editingSessionData, weekNumber: Number(e.target.value) })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>สถานะเปิดเช็กชื่อ:</label>
                  <div className="pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingSessionData.isActive}
                        onChange={(e) => setEditingSessionData({ ...editingSessionData, isActive: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className={`font-bold ${editingSessionData.isActive ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {editingSessionData.isActive ? '🟢 เปิดให้เช็กชื่ออยู่ (Active)' : '🔴 ปิดเช็กชื่อ (Inactive)'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>หัวข้อการเรียน (Topic): *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น บทนำสู่การเขียนโปรแกรม"
                  value={editingSessionData.topic || ''}
                  onChange={(e) => setEditingSessionData({ ...editingSessionData, topic: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Teacher Latitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingSessionData.teacherLat || 13.7988363}
                    onChange={(e) => setEditingSessionData({ ...editingSessionData, teacherLat: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Teacher Longitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingSessionData.teacherLng || 100.5018}
                    onChange={(e) => setEditingSessionData({ ...editingSessionData, teacherLng: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-lg shadow-sky-600/30 transition cursor-pointer"
                >
                  บันทึก Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JSON Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className={`relative w-full max-w-2xl p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h4 className="text-base font-extrabold flex items-center space-x-2">
                <Edit3 className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
                <span>{isCreatingNew ? `เพิ่มเอกสารใหม่ใน ${selectedCollection}` : `แก้ไขเอกสาร ${editingDoc.id}`}</span>
              </h4>
              <button onClick={() => setEditingDoc(null)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {jsonError && (
              <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
                isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div>
              <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Raw JSON Format:</label>
              <textarea
                rows={12}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className={`w-full p-4 rounded-2xl border font-mono text-xs leading-relaxed ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-sky-300' : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold'
                }`}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setEditingDoc(null)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveDoc}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
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
                type="button"
                disabled={isDeletingLoading}
                onClick={async () => {
                  setIsDeletingLoading(true);
                  try {
                    await deleteConfirmItem.action();
                    setDeleteConfirmItem(null);
                  } catch (err: any) {
                    alert(err.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
                  } finally {
                    setIsDeletingLoading(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-rose-600 hover:bg-rose-500 transition shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {isDeletingLoading ? 'กำลังดำเนินการ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
