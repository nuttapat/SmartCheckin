import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole, Course, Session, AttendanceRecord, TeacherAttendanceRecord, InviteLink, CourseMember, CourseMemberRole } from '../types';
import { fetchCourses, fetchCourseDetails, activateSession, deactivateSession, generateInviteLink, submitTeacherCheckin, fetchTeacherCheckinRecords, fetchTeacherCoursesOverview, fetchTeacherLeaveRequests, toggleGpsCheck, toggleQrMode, updateQrInterval, fetchSystemSettings } from '../services/api';
import { QrCode, Users, Download, Plus, Play, Square, RefreshCw, CheckCircle2, Clock, Share2, Copy, Link, MapPin, ShieldCheck, ArrowRight, UserCheck, Edit3, Navigation, Building, FileText, CheckCircle, AlertCircle, KeyRound, Camera, X, ShieldX, Image, BarChart3, PieChart, TrendingUp, Search, FileSpreadsheet, BookOpen, Award, Calendar, Trash2, UserPlus, ShieldAlert, Crown, EyeOff, Eye, Lock, Maximize2, Minimize2, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { decodeQRCodeFromImage } from '../utils/qrDecoder';
import { getDeviceInfo } from '../utils/deviceHelper';
import { formatBangkokDateTime, formatBangkokTime } from '../utils/dateHelper';
import { TeacherCourseEditModal } from './TeacherCourseEditModal';
import { TeacherLeaveManagementModal } from './TeacherLeaveManagementModal';
import { DeleteCourseConfirmModal } from './DeleteCourseConfirmModal';
import { TeacherInviteModal } from './TeacherInviteModal';
import { StudentInviteModal } from './StudentInviteModal';
import { TeacherCheckinModal } from './TeacherCheckinModal';
import { DynamicQRModal } from './DynamicQRModal';
import { TeacherAttendanceGridModal } from './TeacherAttendanceGridModal';
import { useTheme } from '../context/ThemeContext';

interface TeacherDashboardProps {
  teacher: User;
  onOpenCreateCourse: () => void;
  onOpenQuickEvent?: () => void;
  quickEventTrigger?: number;
  isDarkMode?: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  onOpenCreateCourse,
  onOpenQuickEvent,
  quickEventTrigger,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseSessions, setCourseSessions] = useState<Session[]>([]);

  const effectiveSessions = useMemo(() => {
    if (courseSessions && courseSessions.length > 0) {
      return courseSessions;
    }
    if (selectedCourse?.weeks && selectedCourse.weeks.length > 0) {
      return selectedCourse.weeks.map((w) => ({
        id: `ses_${selectedCourse.id}_w${w.weekNumber}`,
        courseId: selectedCourse.id,
        weekNumber: Number(w.weekNumber),
        topic: w.topic || `สัปดาห์ที่ ${w.weekNumber}`,
        teacherLat: selectedCourse.defaultLat || 13.7988363,
        teacherLng: selectedCourse.defaultLng || 100.322944,
        isActive: false,
        createdAt: new Date().toISOString(),
      }));
    }
    return [];
  }, [courseSessions, selectedCourse]);
  const [currentCourseMembers, setCurrentCourseMembers] = useState<CourseMember[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteCourseModalOpen, setIsDeleteCourseModalOpen] = useState<boolean>(false);
  const [isInviteTeacherModalOpen, setIsInviteTeacherModalOpen] = useState<boolean>(false);
  const [isInviteStudentModalOpen, setIsInviteStudentModalOpen] = useState<boolean>(false);
  const [isLeaveManagementOpen, setIsLeaveManagementOpen] = useState<boolean>(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);
  const [isStatsModalMaximized, setIsStatsModalMaximized] = useState<boolean>(false);

  // Current System Academic Year & Semester
  const [currentSysYear, setCurrentSysYear] = useState<number>(2569);
  const [currentSysSemester, setCurrentSysSemester] = useState<string>('1');

  // Course Panel Search & Filter States
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('2569');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('ALL');
  const [showAllCourses, setShowAllCourses] = useState<boolean>(false);

  // Sorting state for Overview Student Table
  const [overviewSortField, setOverviewSortField] = useState<'studentIdNum' | 'studentName' | 'attended' | 'percent' | 'avgTime' | 'lastScan' | 'eligible'>('studentIdNum');
  const [overviewSortDir, setOverviewSortDir] = useState<'asc' | 'desc'>('asc');

  const handleOverviewSort = (field: 'studentIdNum' | 'studentName' | 'attended' | 'percent' | 'avgTime' | 'lastScan' | 'eligible') => {
    if (overviewSortField === field) {
      setOverviewSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOverviewSortField(field);
      setOverviewSortDir(field === 'percent' || field === 'attended' || field === 'lastScan' ? 'desc' : 'asc');
    }
  };

  // Sorting state for Session Modal - Attended Table
  const [attendedSortField, setAttendedSortField] = useState<'studentIdNum' | 'studentName' | 'checkinTime' | 'checkinMethod'>('studentIdNum');
  const [attendedSortDir, setAttendedSortDir] = useState<'asc' | 'desc'>('asc');

  const handleAttendedSort = (field: 'studentIdNum' | 'studentName' | 'checkinTime' | 'checkinMethod') => {
    if (attendedSortField === field) {
      setAttendedSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setAttendedSortField(field);
      setAttendedSortDir(field === 'checkinTime' ? 'desc' : 'asc');
    }
  };

  // Sorting state for Session Modal - Absent Table
  const [absentSortField, setAbsentSortField] = useState<'studentIdNum' | 'studentName' | 'email' | 'status'>('studentIdNum');
  const [absentSortDir, setAbsentSortDir] = useState<'asc' | 'desc'>('asc');

  const handleAbsentSort = (field: 'studentIdNum' | 'studentName' | 'email' | 'status') => {
    if (absentSortField === field) {
      setAbsentSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setAbsentSortField(field);
      setAbsentSortDir('asc');
    }
  };

  // Fetch current system settings on mount to set defaults
  useEffect(() => {
    fetchSystemSettings()
      .then((st) => {
        if (st) {
          if (st.academicYear) {
            const yr = Number(st.academicYear);
            setCurrentSysYear(yr);
            setSelectedYearFilter(String(yr));
            setCoordinatorSelectedYearFilter(String(yr));
          }
          if (st.academicSemester) {
            const sem = String(st.academicSemester);
            setCurrentSysSemester(sem);
          }
        }
      })
      .catch((err) => console.warn('Could not load system settings for teacher dashboard filters:', err));
  }, []);

  // Extract unique academic years from courses for the dropdown
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentSysYear);
    courses.forEach((c) => {
      if (c.academicYear) {
        yearsSet.add(Number(c.academicYear));
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [courses, currentSysYear]);

  // Filter courses by search query, academic year, semester, or show all
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // 1. Search Query Filter (Independent of Year & Semester filters)
      if (courseSearchQuery.trim()) {
        const q = courseSearchQuery.trim().toLowerCase();
        const codeMatch = c.courseCode.toLowerCase().includes(q);
        const nameMatch = c.courseName.toLowerCase().includes(q);
        const yearMatch = String(c.academicYear || '').includes(q);
        const semesterMatch = String(c.semester || '').includes(q);
        return codeMatch || nameMatch || yearMatch || semesterMatch;
      }

      // 2. Checkbox: Show All Courses
      if (showAllCourses) {
        return true;
      }

      // 3. Academic Year Filter
      if (selectedYearFilter !== 'ALL') {
        if (String(c.academicYear) !== String(selectedYearFilter)) return false;
      }

      // 4. Semester Filter
      if (selectedSemesterFilter !== 'ALL') {
        if (String(c.semester) !== String(selectedSemesterFilter)) return false;
      }

      return true;
    });
  }, [courses, courseSearchQuery, showAllCourses, selectedYearFilter, selectedSemesterFilter]);

  // Compute teacher role in the currently selected course
  const teacherRoleInfo = useMemo(() => {
    if (!selectedCourse) return {
      role: CourseMemberRole.INSTRUCTOR,
      isOwner: false,
      isCoordinator: false,
      isCoCoordinator: false,
      isInstructor: true,
      canEditCourse: false,
      canManageWeeks: false,
      canEditAttendance: false,
      canOpenQR: true,
      canManageLeave: false,
      canManageMembers: false,
      canEdit: false,
    };

    const isOwner = selectedCourse.ownerId === teacher.id || teacher.role === UserRole.ADMIN;
    const member = currentCourseMembers.find((m) => m.userId === teacher.id);
    const role = member ? member.role : (isOwner ? CourseMemberRole.COORDINATOR : CourseMemberRole.INSTRUCTOR);

    const isCoordinator = isOwner || role === CourseMemberRole.COORDINATOR || role === CourseMemberRole.CO_TEACHER;
    const isCoCoordinator = !isCoordinator && role === CourseMemberRole.CO_COORDINATOR;
    const isInstructor = !isCoordinator && !isCoCoordinator;

    // Granular permissions:
    // 1. Course Creator & Coordinator: Full management
    // 2. Co-coordinator: Cannot edit course structure/weeks. Can edit attendance grid, open QR, handle leaves.
    // 3. Instructor: ONLY open QR. All other functions are Read-Only.

    const canEditCourse = isCoordinator;
    const canManageWeeks = isCoordinator;
    const canEditAttendance = isCoordinator || isCoCoordinator;
    const canOpenQR = true;
    const canManageLeave = isCoordinator || isCoCoordinator;
    const canManageMembers = isCoordinator;

    return {
      role,
      isOwner,
      isCoordinator,
      isCoCoordinator,
      isInstructor,
      canEdit: canEditCourse,
      canEditCourse,
      canManageWeeks,
      canEditAttendance,
      canOpenQR,
      canManageLeave,
      canManageMembers,
    };
  }, [selectedCourse, currentCourseMembers, teacher.id, teacher.role]);

  const handleCourseDeleted = async (deletedCourseId: string) => {
    setIsDeleteCourseModalOpen(false);
    setIsEditModalOpen(false);

    try {
      const updatedList = await fetchCourses(teacher.id);
      setCourses(updatedList);

      if (selectedCourse?.id === deletedCourseId) {
        if (updatedList.length > 0) {
          handleSelectCourse(updatedList[0]);
        } else {
          setSelectedCourse(null);
          setCourseSessions([]);
          setActiveSession(null);
        }
      }

      if (dashboardTab === 'COURSE_OVERVIEW') {
        loadOverviewData();
      }
    } catch (err) {
      console.error('Error refreshing courses after deletion:', err);
    }
  };

  const loadPendingLeaveCount = async () => {
    try {
      const leaves = await fetchTeacherLeaveRequests(teacher.id);
      const pending = leaves.filter((l) => l.status === 'PENDING').length;
      setPendingLeaveCount(pending);
    } catch (e) {
      console.error('Failed to load pending leave count:', e);
    }
  };

  useEffect(() => {
    if (teacher.id) {
      loadPendingLeaveCount();
      const interval = setInterval(loadPendingLeaveCount, 10000);
      return () => clearInterval(interval);
    }
  }, [teacher.id]);

  // Active Dynamic QR state
  const [qrToken, setQrToken] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [liveCheckins, setLiveCheckins] = useState<AttendanceRecord[]>([]);
  const [isGpsCheckEnabled, setIsGpsCheckEnabled] = useState<boolean>(true);
  const [isStaticQr, setIsStaticQr] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(true);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(30);
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState<number>(15);
  const [qrInterval, setQrInterval] = useState<number>(30);
  const [qrCountdown, setQrCountdown] = useState<number>(30);
  const [teacherCoords, setTeacherCoords] = useState<{ lat: number; lng: number }>(() => {
    try {
      const saved = localStorage.getItem(`teacher_saved_coords_${teacher.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      lat: 13.7988363,
      lng: 100.322944,
    };
  });

  const updateTeacherCoords = (coords: { lat: number; lng: number }) => {
    setTeacherCoords(coords);
    try {
      localStorage.setItem(`teacher_saved_coords_${teacher.id}`, JSON.stringify(coords));
    } catch (e) {}
  };

  // Active View Tab State
  const [dashboardTab, setDashboardTab] = useState<'STUDENT_ATTENDANCE' | 'TEACHER_LOGS' | 'COURSE_OVERVIEW'>('STUDENT_ATTENDANCE');

  // Course Overview Dashboard State
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [selectedOverviewCourseId, setSelectedOverviewCourseId] = useState<string>('');
  const [overviewSearchQuery, setOverviewSearchQuery] = useState<string>('');
  const [overviewDetailTab, setOverviewDetailTab] = useState<'STUDENTS' | 'SESSIONS'>('STUDENTS');

  // Coordinator Overview Course Filters State
  const [isAttendanceGridModalOpen, setIsAttendanceGridModalOpen] = useState<boolean>(false);
  const [coordinatorCourseSearchQuery, setCoordinatorCourseSearchQuery] = useState<string>('');
  const [coordinatorSelectedYearFilter, setCoordinatorSelectedYearFilter] = useState<string>('2569');
  const [coordinatorSelectedSemesterFilter, setCoordinatorSelectedSemesterFilter] = useState<string>('ALL');
  const [coordinatorShowAllCourses, setCoordinatorShowAllCourses] = useState<boolean>(false);

  // Available academic years for coordinator overview courses
  const overviewAvailableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentSysYear);
    if (overviewData?.overviewList) {
      overviewData.overviewList.forEach((item: any) => {
        if (item.course?.academicYear) {
          yearsSet.add(Number(item.course.academicYear));
        }
      });
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [overviewData, currentSysYear]);

  // Filtered overview list for Coordinator Dashboard
  const filteredOverviewList = useMemo(() => {
    if (!overviewData?.overviewList) return [];
    return overviewData.overviewList.filter((item: any) => {
      const c = item.course;
      // 1. Search Query Filter (Independent of Year & Semester filters)
      if (coordinatorCourseSearchQuery.trim()) {
        const q = coordinatorCourseSearchQuery.trim().toLowerCase();
        const codeMatch = c.courseCode.toLowerCase().includes(q);
        const nameMatch = c.courseName.toLowerCase().includes(q);
        const yearMatch = String(c.academicYear || '').includes(q);
        const semesterMatch = String(c.semester || '').includes(q);
        return codeMatch || nameMatch || yearMatch || semesterMatch;
      }

      // 2. Checkbox: Show All Courses
      if (coordinatorShowAllCourses) {
        return true;
      }

      // 3. Academic Year Filter
      if (coordinatorSelectedYearFilter !== 'ALL') {
        if (String(c.academicYear) !== String(coordinatorSelectedYearFilter)) return false;
      }

      // 4. Semester Filter
      if (coordinatorSelectedSemesterFilter !== 'ALL') {
        if (String(c.semester) !== String(coordinatorSelectedSemesterFilter)) return false;
      }

      return true;
    });
  }, [overviewData, coordinatorCourseSearchQuery, coordinatorShowAllCourses, coordinatorSelectedYearFilter, coordinatorSelectedSemesterFilter]);

  // Auto-select first available course in filtered list if current selection is filtered out
  useEffect(() => {
    if (filteredOverviewList.length > 0) {
      const exists = filteredOverviewList.some((item: any) => item.course.id === selectedOverviewCourseId);
      if (!exists) {
        const nextCourse = filteredOverviewList[0].course;
        setSelectedOverviewCourseId(nextCourse.id);
        handleSelectCourse(nextCourse);
      }
    }
  }, [filteredOverviewList, selectedOverviewCourseId]);

  // Session Detail Modal State
  const currentOverviewItem = useMemo(() => {
    if (!overviewData?.overviewList || overviewData.overviewList.length === 0) return null;
    const targetCourseId = selectedOverviewCourseId || selectedCourse?.id;
    return (
      overviewData.overviewList.find((item: any) => item.course?.id === targetCourseId) ||
      overviewData.overviewList[0]
    );
  }, [overviewData, selectedOverviewCourseId, selectedCourse?.id]);

  const gridStudentList = useMemo(() => {
    const activeCourseId = selectedOverviewCourseId || selectedCourse?.id;
    const overviewMatch = overviewData?.overviewList?.find((item: any) => item.course?.id === activeCourseId);
    if (overviewMatch?.studentList && overviewMatch.studentList.length > 0) {
      return overviewMatch.studentList;
    }
    if (currentOverviewItem?.course?.id === activeCourseId && currentOverviewItem?.studentList) {
      return currentOverviewItem.studentList;
    }
    return (currentCourseMembers || [])
      .filter((m) => m.role === CourseMemberRole.STUDENT)
      .map((m) => ({
        userId: m.userId,
        studentName: m.user ? `${m.user.title || ''}${m.user.firstNameTh} ${m.user.lastNameTh}`.trim() : 'นักศึกษา',
        studentIdNum: m.user?.universityId || '-',
        email: m.user?.email || '',
        avatarUrl: m.user?.avatarUrl,
        sessionStatuses: effectiveSessions.map((s) => ({
          sessionId: s.id,
          weekNumber: s.weekNumber,
          topic: s.topic,
          status: 'ABSENT',
        })),
      }));
  }, [selectedOverviewCourseId, selectedCourse?.id, overviewData, currentOverviewItem, currentCourseMembers, effectiveSessions]);

  const [selectedSessionModal, setSelectedSessionModal] = useState<any>(null);
  const [sessionModalFilter, setSessionModalFilter] = useState<'ATTENDED' | 'ABSENT'>('ATTENDED');
  const [sessionModalSearch, setSessionModalSearch] = useState<string>('');

  const loadOverviewData = async () => {
    try {
      setLoadingOverview(true);
      const data = await fetchTeacherCoursesOverview(teacher.id);
      setOverviewData(data);
      if (data.overviewList && data.overviewList.length > 0 && !selectedOverviewCourseId) {
        setSelectedOverviewCourseId(data.overviewList[0].course.id);
      }
    } catch (err) {
      console.error('Error loading courses overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    if (teacher?.id) {
      loadOverviewData();
    }
  }, [teacher?.id]);

  const exportCourseOverviewCSV = (courseOverviewItem: any) => {
    if (!courseOverviewItem) return;
    const course = courseOverviewItem.course;
    const sessionDetailsList = courseOverviewItem.sessionDetailsList || [];

    let csv = `รายงานภาพรวมการเข้าเรียนรายวิชา,${course.courseCode} - ${course.courseName}\n`;
    csv += `อาจารย์ผู้รับผิดชอบ,${course.coordinatorName || course.ownerName}\n`;
    csv += `จำนวนผู้ลงทะเบียน,${courseOverviewItem.totalRegisteredCount} คน,จำนวนคาบเรียนทั้งหมด,${courseOverviewItem.totalSessions} คาบ\n`;
    csv += `อัตราการเข้าเรียนเฉลี่ย,${courseOverviewItem.courseAvgAttendanceRate}%\n\n`;

    // Per-session headers: e.g. "สัปดาห์ที่ 1 (บทนำ)", "สัปดาห์ที่ 2 (การออกแบบระบบ)"
    const sessionHeaders = sessionDetailsList.map((s: any) => {
      const weekLabel = `สัปดาห์ที่ ${s.weekNumber}`;
      const topicLabel = s.topic ? ` (${s.topic.replace(/,/g, ' ')})` : '';
      return `"${weekLabel}${topicLabel}"`;
    });

    const headers = [
      'ลำดับ',
      'รหัสนักศึกษา',
      'ชื่อ-นามสกุล',
      'อีเมล',
      ...sessionHeaders,
      'จำนวนคาบที่เข้าเรียน',
      'จำนวนคาบที่ลา',
      'คาบทั้งหมด',
      'เปอร์เซ็นต์เข้าเรียน',
      'เวลาเข้าเรียนเฉลี่ย',
      'การสแกนล่าสุด (Bangkok Time)',
      'สถานะสิทธิ์สอบ',
    ];

    csv += headers.join(',') + '\n';

    (courseOverviewItem.studentList || []).forEach((st: any, index: number) => {
      const examStatus = st.attendancePercent >= 80 ? 'มีสิทธิ์สอบ (80%+)' : 'เสี่ยงหมดสิทธิ์สอบ (ต่ำกว่า 80%)';
      const lastCheckinStr = formatBangkokDateTime(st.lastCheckinTime);

      // Per-session status for this student
      const sessionCols = sessionDetailsList.map((s: any) => {
        if (Array.isArray(st.sessionStatuses)) {
          const match = st.sessionStatuses.find(
            (ss: any) => ss.sessionId === s.sessionId || String(ss.weekNumber) === String(s.weekNumber)
          );
          if (match && match.statusText) {
            return `"${match.statusText}"`;
          }
        }
        return `"ขาดเรียน"`;
      });

      const row = [
        index + 1,
        `"${st.studentIdNum || '-'}"`,
        `"${st.studentName || '-'}"`,
        `"${st.email || '-'}"`,
        ...sessionCols,
        st.attendedCount || 0,
        st.approvedLeaveCount || 0,
        st.totalSessionsCount || 0,
        `"${st.attendancePercent || 0}%"`,
        `"${st.avgTimeStr || '-'}"`,
        `"${lastCheckinStr}"`,
        `"${examStatus}"`,
      ];

      csv += row.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Course_Overview_${course.courseCode}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  // Invite modal state
  const [inviteModalCode, setInviteModalCode] = useState<InviteLink | null>(null);

  // Teacher Attendance Check-In state
  const [isTeacherCheckinModalOpen, setIsTeacherCheckinModalOpen] = useState<boolean>(false);
  const [teacherCheckinMethod, setTeacherCheckinMethod] = useState<'HYBRID' | 'GPS_ONLY' | 'TOKEN' | 'QR_ONLY'>('HYBRID');
  const [teacherTokenInput, setTeacherTokenInput] = useState<string>('');
  const [teacherCheckinCourseId, setTeacherCheckinCourseId] = useState<string>('');
  const [teacherCheckinSessionId, setTeacherCheckinSessionId] = useState<string>('');
  const [buildingRoom, setBuildingRoom] = useState<string>('');
  const [teachingNotes, setTeachingNotes] = useState<string>('');
  const [teacherHistory, setTeacherHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [submittingTeacherCheckin, setSubmittingTeacherCheckin] = useState<boolean>(false);
  const [teacherCheckinResult, setTeacherCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

  // Teacher QR Scanner state
  const [teacherScannedCode, setTeacherScannedCode] = useState<string>('');
  const [teacherCameraError, setTeacherCameraError] = useState<string | null>(null);
  const [isTeacherImageProcessing, setIsTeacherImageProcessing] = useState<boolean>(false);
  const teacherFileInputRef = useRef<HTMLInputElement | null>(null);
  const teacherHtml5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const startTeacherLiveCameraStream = async () => {
    try {
      if (teacherHtml5QrCodeRef.current) {
        try {
          await teacherHtml5QrCodeRef.current.stop();
        } catch (e) {}
        teacherHtml5QrCodeRef.current = null;
      }

      const container = document.getElementById('teacher-qr-reader');
      if (!container) return;

      setTeacherCameraError(null);
      const html5QrCode = new Html5Qrcode('teacher-qr-reader');
      teacherHtml5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setTeacherScannedCode(decodedText);
          setTeacherTokenInput(decodedText);
          try {
            html5QrCode.stop();
          } catch (e) {}
        },
        () => {}
      );
    } catch (err: any) {
      console.warn('Environment camera failed for teacher, trying default camera:', err);
      try {
        if (!teacherHtml5QrCodeRef.current) {
          teacherHtml5QrCodeRef.current = new Html5Qrcode('teacher-qr-reader');
        }
        await teacherHtml5QrCodeRef.current.start(
          true,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setTeacherScannedCode(decodedText);
            setTeacherTokenInput(decodedText);
            try {
              teacherHtml5QrCodeRef.current?.stop();
            } catch (e) {}
          },
          () => {}
        );
      } catch (fallbackErr: any) {
        console.error('Teacher camera access failed:', fallbackErr);
        setTeacherCameraError('ไม่สามารถเปิดใช้งานกล้องได้ กรุณาอนุญาตสิทธิ์การเข้าถึงกล้อง หรือเลือกอัปโหลดรูปภาพ QR Code');
      }
    }
  };

  useEffect(() => {
    if (isTeacherCheckinModalOpen && teacherCheckinMethod === 'HYBRID') {
      const timer = setTimeout(() => {
        startTeacherLiveCameraStream();
      }, 250);

      return () => {
        clearTimeout(timer);
        if (teacherHtml5QrCodeRef.current) {
          teacherHtml5QrCodeRef.current.stop().catch(() => {});
          teacherHtml5QrCodeRef.current = null;
        }
      };
    } else {
      if (teacherHtml5QrCodeRef.current) {
        teacherHtml5QrCodeRef.current.stop().catch(() => {});
        teacherHtml5QrCodeRef.current = null;
      }
    }
  }, [isTeacherCheckinModalOpen, teacherCheckinMethod]);

  const handleTeacherFileUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsTeacherImageProcessing(true);
    try {
      const decodedText = await decodeQRCodeFromImage(file);
      setTeacherScannedCode(decodedText);
      setTeacherTokenInput(decodedText);
      alert(`สแกน QR Code จากรูปภาพสำเร็จ: ${decodedText}`);
    } catch (err: any) {
      alert(err.message || 'ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาถ่ายรูปให้เห็น QR Code ชัดเจน');
    } finally {
      setIsTeacherImageProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Teacher Log Dashboard View Mode and Filter State
  const [teacherLogViewMode, setTeacherLogViewMode] = useState<'OVERALL' | 'BY_COURSE'>('OVERALL');
  const [teacherLogCourseFilter, setTeacherLogCourseFilter] = useState<string>('ALL');

  // Computed course breakdown statistics for teacher logs
  const courseBreakdown = useMemo(() => {
    return courses.map((course) => {
      const courseLogs = teacherHistory.filter(
        (r) => r.courseId === course.id || r.courseCode === course.courseCode
      );
      return {
        course,
        count: courseLogs.length,
        lastCheckin: courseLogs.length > 0 ? courseLogs[0].timestamp : null,
      };
    });
  }, [courses, teacherHistory]);

  const generalLogsCount = useMemo(() => {
    return teacherHistory.filter((r) => !r.courseId && !courses.some((c) => c.courseCode === r.courseCode)).length;
  }, [courses, teacherHistory]);

  const filteredTeacherHistory = useMemo(() => {
    if (teacherLogCourseFilter === 'ALL') return teacherHistory;
    if (teacherLogCourseFilter === 'GENERAL') {
      return teacherHistory.filter((r) => !r.courseId && !courses.some((c) => c.courseCode === r.courseCode));
    }
    const selectedCourse = courses.find((c) => c.id === teacherLogCourseFilter);
    return teacherHistory.filter(
      (r) => r.courseId === teacherLogCourseFilter || (selectedCourse && r.courseCode === selectedCourse.courseCode)
    );
  }, [teacherHistory, teacherLogCourseFilter, courses]);

  // Sorting state for Teacher History Table
  const [historySortField, setHistorySortField] = useState<'timestamp' | 'course' | 'building' | 'method'>('timestamp');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');

  const handleHistorySort = (field: 'timestamp' | 'course' | 'building' | 'method') => {
    if (historySortField === field) {
      setHistorySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHistorySortField(field);
      setHistorySortDir(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const sortedTeacherHistory = useMemo(() => {
    const list = [...filteredTeacherHistory];
    list.sort((a, b) => {
      if (historySortField === 'timestamp') {
        const cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return historySortDir === 'asc' ? cmp : -cmp;
      }
      if (historySortField === 'course') {
        const aName = a.courseCode || a.courseName || '';
        const bName = b.courseCode || b.courseName || '';
        const cmp = aName.localeCompare(bName, 'th');
        return historySortDir === 'asc' ? cmp : -cmp;
      }
      if (historySortField === 'building') {
        const cmp = (a.buildingRoom || '').localeCompare(b.buildingRoom || '', 'th');
        return historySortDir === 'asc' ? cmp : -cmp;
      }
      if (historySortField === 'method') {
        const cmp = (a.checkinMethod || '').localeCompare(b.checkinMethod || '', 'th');
        return historySortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return list;
  }, [filteredTeacherHistory, historySortField, historySortDir]);

  const loadTeacherHistory = async () => {
    try {
      const records = await fetchTeacherCheckinRecords(teacher.id);
      setTeacherHistory(records);
    } catch (err) {
      console.error('Failed to load teacher history:', err);
    }
  };

  const handleOpenTeacherCheckin = () => {
    setTeacherCheckinResult(null);
    setTeacherScannedCode('');
    setTeacherTokenInput('');
    if (courses.length > 0 && !teacherCheckinCourseId) {
      setTeacherCheckinCourseId(courses[0].id);
    }
    loadTeacherHistory();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
    setIsTeacherCheckinModalOpen(true);
  };

  const handleTeacherCheckinSubmit = async () => {
    setTeacherCheckinResult(null);

    let tokenToSubmit = '';
    if (teacherCheckinMethod === 'HYBRID') {
      tokenToSubmit = (teacherScannedCode || teacherTokenInput).trim();
      if (!tokenToSubmit) {
        setTeacherCheckinResult({
          success: false,
          message: 'กรุณาสแกน QR Code หรืออัปโหลดรูปภาพ QR Code / กรอกรหัส Token ก่อนกดเช็คชื่อ',
        });
        return;
      }
    } else if (teacherCheckinMethod === 'TOKEN') {
      tokenToSubmit = teacherTokenInput.trim();
      if (!tokenToSubmit) {
        setTeacherCheckinResult({
          success: false,
          message: 'กรุณากรอกรหัส Token 6 หลักสำหรับเข้าสอนก่อนกดเช็คชื่อ',
        });
        return;
      }
    }

    setSubmittingTeacherCheckin(true);

    try {
      // 1. Get fresh Geolocation position on submit (matching student checkin process)
      let currentLat = teacherCoords.lat;
      let currentLng = teacherCoords.lng;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            });
          });
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
          updateTeacherCoords({ lat: currentLat, lng: currentLng });
        } catch (geoErr) {
          console.warn('Teacher geolocation lookup on submit failed/denied:', geoErr);
        }
      }

      // 2. Get device fingerprint info
      const devInfo = getDeviceInfo();

      // 3. Submit teacher check-in
      const res = await submitTeacherCheckin({
        teacherId: teacher.id,
        courseId: teacherCheckinCourseId || undefined,
        sessionId: teacherCheckinSessionId || undefined,
        lat: currentLat,
        lng: currentLng,
        deviceId: devInfo.deviceId,
        deviceName: devInfo.deviceName,
        deviceType: devInfo.deviceType,
        browser: devInfo.browser,
        os: devInfo.os,
        checkinMethod: teacherCheckinMethod,
        qrToken: tokenToSubmit || undefined,
        buildingRoom,
        notes: teachingNotes,
      });

      // Stop camera if running
      if (teacherHtml5QrCodeRef.current) {
        try {
          await teacherHtml5QrCodeRef.current.stop();
        } catch (e) {}
        teacherHtml5QrCodeRef.current = null;
      }

      const distMsg = typeof res.distanceMeters === 'number' && res.distanceMeters > 0
        ? ` (ระยะห่างจากสถานที่เรียน: ${res.distanceMeters} เมตร)`
        : '';

      setTeacherCheckinResult({
        success: true,
        message: (res.message || 'บันทึกการเช็คชื่อเข้าสอนเรียบร้อยแล้ว!') + distMsg,
      });

      // Reset inputs
      setTeacherScannedCode('');
      setTeacherTokenInput('');
      setBuildingRoom('');
      setTeachingNotes('');

      loadTeacherHistory();
    } catch (err: any) {
      setTeacherCheckinResult({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการเช็คชื่อเข้าสอน',
      });
    } finally {
      setSubmittingTeacherCheckin(false);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);

  const loadTeacherCourses = async () => {
    try {
      setLoading(true);
      const list = await fetchCourses(teacher.id);
      setCourses(list);
      if (list.length > 0 && !selectedCourse) {
        handleSelectCourse(list[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherCourses();

    // Get current teacher GPS coords if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Teacher geolocation warning:', err.message);
          // Do not overwrite saved location on geolocation warning
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [teacher.id]);

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedOverviewCourseId(course.id);
    if (course.defaultLat && course.defaultLng) {
      updateTeacherCoords({ lat: course.defaultLat, lng: course.defaultLng });
    }
    try {
      const details = await fetchCourseDetails(course.id);
      const sortedSessions = (details.sessions || []).sort(
        (a: any, b: any) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0)
      );
      setCourseSessions(sortedSessions);
      setCurrentCourseMembers(details.members || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshCourseMembers = async () => {
    if (!selectedCourse) return;
    try {
      const details = await fetchCourseDetails(selectedCourse.id);
      setCurrentCourseMembers(details.members || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Connect WebSocket to listen to dynamic QR updates and live checkin broadcasts
  const connectWebSocket = (targetId: string, isEvent = false) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?${isEvent ? 'eventId' : 'sessionId'}=${targetId}&role=teacher`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'QR_REFRESH') {
          const newToken = payload.data.token;
          setQrToken(newToken);
          if (payload.data.isStatic !== undefined) {
            setIsStaticQr(payload.data.isStatic);
          }
          const currentInterval = payload.data.refreshIntervalSeconds || qrInterval || 30;
          setQrInterval(currentInterval);
          setQrCountdown(currentInterval);

          // Generate QR Code Data URL image (Full web URL for native camera scanning)
          const qrText = isEvent ? `EVT:${targetId}:${newToken}` : `SES:${targetId}:${newToken}`;
          const qrFullUrl = `${window.location.origin}/?checkin=${encodeURIComponent(qrText)}`;
          const url = await QRCode.toDataURL(qrFullUrl, { width: 600, margin: 2, color: { dark: '#090d16', light: '#ffffff' } });
          setQrDataUrl(url);
        } else if (payload.type === 'CHECKIN_NEW') {
          // Live checkin event received!
          setLiveCheckins(payload.records || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    wsRef.current = ws;
  };

  // Launch Active Session QR Code
  const handleStartSessionQR = async (
    session: Session,
    duration: number = sessionDurationMinutes,
    lateThreshold: number = lateThresholdMinutes
  ) => {
    try {
      setActiveSession(session);
      setIsQrModalOpen(true);
      setLiveCheckins([]);

      const initialInterval = session.qrRefreshIntervalSeconds || qrInterval || 30;
      setQrInterval(initialInterval);
      setQrCountdown(initialInterval);

      // Prioritize classroom location specified for this course or session
      let currentLat = session.teacherLat || selectedCourse?.defaultLat || teacherCoords.lat;
      let currentLng = session.teacherLng || selectedCourse?.defaultLng || teacherCoords.lng;

      const res = await activateSession(session.id, currentLat, currentLng, isGpsCheckEnabled, duration, lateThreshold, isStaticQr, initialInterval);
      if (res.isStatic !== undefined) {
        setIsStaticQr(res.isStatic);
      }
      if (res.refreshIntervalSeconds) {
        setQrInterval(res.refreshIntervalSeconds);
        setQrCountdown(res.refreshIntervalSeconds);
      }

      // Render initial QR (Full web URL for native phone camera scanning)
      const initialText = `SES:${session.id}:${res.qrToken || 'active'}`;
      const initialFullUrl = `${window.location.origin}/?checkin=${encodeURIComponent(initialText)}`;
      const url = await QRCode.toDataURL(initialFullUrl, { width: 600, margin: 2, color: { dark: '#090d16', light: '#ffffff' } });
      setQrDataUrl(url);
      setQrToken(res.qrToken || '');

      // Connect WebSocket
      connectWebSocket(session.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Update QR Token Refresh Interval
  const handleUpdateQrInterval = async (newInterval: number) => {
    setQrInterval(newInterval);
    setQrCountdown(newInterval);
    if (activeSession?.id) {
      try {
        await updateQrInterval(activeSession.id, newInterval);
      } catch (err) {
        console.error('Failed to update QR interval:', err);
      }
    }
  };

  // Toggle Static vs Dynamic QR Mode
  const handleToggleStaticQr = async (isStatic: boolean) => {
    setIsStaticQr(isStatic);
    if (activeSession?.id) {
      try {
        await toggleQrMode(activeSession.id, isStatic);
      } catch (err) {
        console.error('Failed to toggle QR mode:', err);
      }
    }
  };

  // Update duration / late threshold on active session
  const handleUpdateDurationAndLate = async (newDuration: number, newLateThreshold: number) => {
    setSessionDurationMinutes(newDuration);
    setLateThresholdMinutes(newLateThreshold);
    if (activeSession) {
      let currentLat = activeSession.teacherLat || selectedCourse?.defaultLat || teacherCoords.lat;
      let currentLng = activeSession.teacherLng || selectedCourse?.defaultLng || teacherCoords.lng;
      await activateSession(activeSession.id, currentLat, currentLng, isGpsCheckEnabled, newDuration, newLateThreshold, isStaticQr, qrInterval);
    }
  };

  // Close QR Session
  const handleStopSessionQR = async () => {
    if (activeSession) {
      await deactivateSession(activeSession.id);
      setActiveSession(null);
    }
    setIsQrModalOpen(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Toggle GPS Geofence Check and Sync with Server
  const handleToggleGps = async () => {
    const nextVal = !isGpsCheckEnabled;
    setIsGpsCheckEnabled(nextVal);
    if (activeSession?.id) {
      try {
        await toggleGpsCheck(activeSession.id, nextVal);
      } catch (err) {
        console.error('Failed to sync GPS toggle with server:', err);
      }
    }
  };

  // Dynamic QR Code Countdown Timer Effect
  useEffect(() => {
    if (!activeSession) return;

    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev > 0 ? prev - 1 : qrInterval));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession, qrInterval]);

  // Generate Invite Link
  const handleGenerateInvite = async (role: 'STUDENT' | 'CO_TEACHER') => {
    if (!selectedCourse) return;
    try {
      const inv = await generateInviteLink(selectedCourse.id, role);
      setInviteModalCode(inv);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Teacher Welcome Header & Quick Action */}
      <div className={`rounded-3xl p-4 sm:p-6 md:p-8 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/50 border-sky-900/40 text-white shadow-2xl' 
          : 'bg-gradient-to-r from-sky-100/80 via-blue-50/70 to-indigo-50/50 border-sky-200/90 text-slate-900 shadow-sm'
      }`}>
        <div className="space-y-1 text-left w-full md:w-auto">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
            isDarkMode
              ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              : 'bg-sky-100 border-sky-200/90 text-sky-900'
          }`}>
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Teacher Console</span>
          </div>
          <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            ยินดีต้อนรับ, {teacher.title} {teacher.firstNameTh} {teacher.lastNameTh}
          </h1>
          <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {teacher.email}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-nowrap gap-2 sm:gap-2.5 w-full sm:w-auto md:ml-auto shrink-0">
          <button
            onClick={() => setIsLeaveManagementOpen(true)}
            className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-amber-600/20 active:scale-95 transition border border-amber-400/30 cursor-pointer relative whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-white shrink-0" />
            <span>คำขอลาเรียน</span>
            {pendingLeaveCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-white text-amber-900 font-black text-[10px]">
                {pendingLeaveCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenCreateCourse}
            className="w-full sm:w-auto px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 active:scale-95 transition border border-sky-300/40 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>สร้างรายวิชา</span>
          </button>

          <button
            onClick={handleOpenTeacherCheckin}
            className="w-full sm:w-auto px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 active:scale-95 transition border border-emerald-400/30 cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-4 h-4 text-white shrink-0" />
            <span>ลงชื่อเข้าสอน</span>
          </button>
        </div>
      </div>

      {/* System Mode Switcher Tabs */}
      <div className={`p-1.5 rounded-2xl border grid grid-cols-1 md:grid-cols-3 gap-1.5 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-sky-50/60 border-sky-200/80'
      }`}>
        <button
          type="button"
          onClick={() => setDashboardTab('STUDENT_ATTENDANCE')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center text-center space-x-2 cursor-pointer ${
            dashboardTab === 'STUDENT_ATTENDANCE'
              ? isDarkMode
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-xs'
                : 'bg-sky-200/90 text-sky-950 border border-sky-300 shadow-xs font-black'
              : isDarkMode
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100/60'
          }`}
        >
          <Users className="w-4 h-4 text-sky-700 dark:text-sky-300 shrink-0" />
          <span>
            <span className="md:hidden">1. เช็คชื่อนักศึกษา</span>
            <span className="hidden md:inline">1. บันทึกการเข้าเรียนนักศึกษา (Student Attendance)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('TEACHER_LOGS')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center text-center space-x-2 cursor-pointer ${
            dashboardTab === 'TEACHER_LOGS'
              ? isDarkMode
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-xs'
                : 'bg-emerald-100/90 text-emerald-950 border border-emerald-300 shadow-xs font-black'
              : isDarkMode
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-emerald-100/50'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
          <span>
            <span className="md:hidden">2. บันทึกการเข้าสอน</span>
            <span className="hidden md:inline">2. บันทึกการเข้าสอนอาจารย์ (Teacher Logs)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('COURSE_OVERVIEW')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center text-center space-x-2 cursor-pointer ${
            dashboardTab === 'COURSE_OVERVIEW'
              ? isDarkMode
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-xs'
                : 'bg-purple-100/90 text-purple-950 border border-purple-300 shadow-xs font-black'
              : isDarkMode
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-purple-100/50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-700 dark:text-purple-300 shrink-0" />
          <span>
            <span className="md:hidden">3. ภาพรวมวิชา</span>
            <span className="hidden md:inline">3. ภาพรวมวิชา &amp; เวลาเข้าเรียน (Coordinator Dashboard)</span>
          </span>
        </button>
      </div>

      {/* VIEW TAB 1: STUDENT ATTENDANCE MANAGEMENT */}
      {dashboardTab === 'STUDENT_ATTENDANCE' && (
        <div className="space-y-4">
          {/* ACTIVE BACKGROUND SESSION NOTIFICATION BANNER */}
          {activeSession && !isQrModalOpen && (
            <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-400/50">
              <div className="flex items-center space-x-3 text-xs font-bold">
                <div className="w-3.5 h-3.5 rounded-full bg-white animate-ping shrink-0"></div>
                <div>
                  <p className="font-extrabold text-sm flex items-center space-x-2">
                    <span>🟢 ระบบกำลังเปิดรับเช็คชื่อในพื้นหลัง</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-[10px] font-mono">
                      0 - {lateThresholdMinutes}m (ตรงเวลา) | {lateThresholdMinutes} - {sessionDurationMinutes}m (สาย)
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-100 font-normal">
                    {selectedCourse ? `${selectedCourse.courseCode} (${selectedCourse.courseName}) - สัปดาห์ที่ ${activeSession.weekNumber}` : 'วิชาที่เลือก'} •
                    นักศึกษาที่มาสายยังคงสามารถเช็คอินด้วย GPS Only ในห้องเรียนได้โดยที่อาจารย์ไม่ต้องเปิด QR Code ใหม่
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3.5 py-2 bg-white text-emerald-950 font-bold rounded-xl text-xs hover:bg-emerald-50 transition shadow-xs flex items-center space-x-1 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>เปิดหน้าจอ QR</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopSessionQR}
                  className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>ปิดระบบ</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Course Selector & Settings */}
          <div className="space-y-4">
            <div className={`rounded-2xl p-5 space-y-3.5 border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>รายวิชาที่รับผิดชอบ</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {filteredCourses.length}/{courses.length}
                  </span>
                </h2>
                <button
                  onClick={loadTeacherCourses}
                  className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                  title="รีเฟรชข้อมูลวิชา"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search & Term Filter controls when courses exist */}
              {courses.length > 0 && (
                <div className="space-y-2.5 pt-0.5">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                      placeholder="ค้นหาตามรหัส หรือ ชื่อวิชา..."
                      className={`w-full text-xs pl-8 pr-7 py-2 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
                        isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                      }`}
                    />
                    {courseSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCourseSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200 rounded-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Filters for ปีการศึกษา and ภาคเรียน */}
                  <div className={`grid grid-cols-2 gap-2 transition-opacity ${showAllCourses || courseSearchQuery.trim() ? 'opacity-50' : ''}`}>
                    {/* Dropdown ปีการศึกษา */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                        ปีการศึกษา {courseSearchQuery.trim() && <span className="text-[9px] font-normal text-sky-500">(ค้นหาทุกปี)</span>}
                      </label>
                      <select
                        value={selectedYearFilter}
                        onChange={(e) => setSelectedYearFilter(e.target.value)}
                        disabled={showAllCourses || Boolean(courseSearchQuery.trim())}
                        className={`w-full text-xs px-2 py-1.5 rounded-xl border font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="ALL">ทุกปีการศึกษา</option>
                        {availableYears.map((y) => (
                          <option key={y} value={String(y)}>
                            ปี {y} {String(y) === String(currentSysYear) ? '(ปัจจุบัน)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown ภาคเรียน */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                        ภาคเรียน {courseSearchQuery.trim() && <span className="text-[9px] font-normal text-sky-500">(ค้นหาทุกเทอม)</span>}
                      </label>
                      <select
                        value={selectedSemesterFilter}
                        onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                        disabled={showAllCourses || Boolean(courseSearchQuery.trim())}
                        className={`w-full text-xs px-2 py-1.5 rounded-xl border font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="ALL">ทุกภาคเรียน</option>
                        <option value="1">ภาคเรียนที่ 1 {currentSysSemester === '1' ? '(ปัจจุบัน)' : ''}</option>
                        <option value="2">ภาคเรียนที่ 2 {currentSysSemester === '2' ? '(ปัจจุบัน)' : ''}</option>
                        <option value="SUMMER">ฤดูการศึกษา (Summer)</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkbox for Showing All Courses */}
                  <div className="pt-0.5">
                    <label className="inline-flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showAllCourses}
                        onChange={(e) => setShowAllCourses(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500/30 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span>แสดงรายวิชาทั้งหมด (ทุกปี/ทุกเทอม)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Scrollable Course Cards List */}
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-400">กำลังโหลดวิชา...</div>
              ) : courses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">ยังไม่ได้สร้างวิชาเรียน</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 space-y-1.5 border border-dashed rounded-xl border-slate-700/50">
                  <p className="font-semibold text-slate-400">ไม่พบรายวิชาที่ตรงกับตัวกรอง</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCourseSearchQuery('');
                      setShowAllCourses(false);
                      setSelectedYearFilter(String(currentSysYear));
                      setSelectedSemesterFilter('ALL');
                    }}
                    className="text-[11px] font-bold text-sky-500 hover:underline"
                  >
                    ล้างคำค้นหาและรีเซ็ตตัวกรอง
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredCourses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCourse(c)}
                      className={`w-full text-left p-3.5 rounded-xl border transition ${
                        selectedCourse?.id === c.id
                          ? (isDarkMode ? 'bg-sky-500/15 border-sky-500/50 text-white font-bold ring-1 ring-sky-500/30' : 'bg-sky-50 border-sky-300 text-sky-950 font-bold ring-1 ring-sky-400/40')
                          : (isDarkMode ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-blue-950 dark:text-blue-300 font-extrabold">{c.courseCode}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-700'
                        }`}>
                          ปี {c.academicYear} / เทอม {c.semester}
                        </span>
                      </div>
                      <div className={`text-xs mt-1 font-semibold line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {c.courseName}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Invite Generator Card */}
            {selectedCourse && (
              <div className={`rounded-2xl p-5 space-y-3 border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span>ลิงก์เชิญผู้ใช้งาน (Course Invitations)</span>
                </h3>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ส่งรหัสเชิญให้นักศึกษาเพื่อเข้าเรียน หรือส่งให้อาจารย์ผู้ร่วมสอน (Co-teacher)
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsInviteStudentModalOpen(true)}
                    className="py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    เชิญนักศึกษา (Student)
                  </button>
                  <button
                    onClick={() => setIsInviteTeacherModalOpen(true)}
                    className="py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    เชิญอาจารย์ผู้สอนร่วม
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Sessions & Dynamic QR Screen */}
          <div className="lg:col-span-2 space-y-4">
            {selectedCourse ? (
              <div className={`rounded-2xl p-6 space-y-5 border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-100'
                }`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{selectedCourse.courseCode}</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>({selectedCourse.courseName})</span>
                      
                      {/* Course Role Badge */}
                      {teacherRoleInfo.isOwner ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          👑 ผู้สร้างรายวิชา (Course Creator)
                        </span>
                      ) : teacherRoleInfo.isCoordinator ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          👑 ผู้รับผิดชอบรายวิชา (Coordinator)
                        </span>
                      ) : teacherRoleInfo.isCoCoordinator ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          🤝 ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          👨‍🏫 อาจารย์ผู้สอน (Instructor)
                        </span>
                      )}
                    </div>
                    <h2 className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      รายการสัปดาห์สอน &amp; เปิดเช็คชื่อนักเรียน
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center justify-end gap-2 w-full sm:w-auto ml-auto">
                    <button
                      onClick={() => {
                        if (teacherRoleInfo.canEditCourse) {
                          setIsEditModalOpen(true);
                        } else {
                          const roleText = teacherRoleInfo.isCoCoordinator ? "ผู้ร่วมรับผิดชอบรายวิชา" : "อาจารย์ผู้สอน";
                          const detailText = teacherRoleInfo.isCoCoordinator
                            ? "ผู้ร่วมรับผิดชอบรายวิชาไม่มีอำนาจในการเพิ่ม/ลดสัปดาห์สอนหรือแก้ไขโครงสร้างวิชา (แต่สามารถแก้ไขตารางเช็คชื่อและเปิด QR Code ได้)"
                            : "อาจารย์ผู้สอนมีอำนาจแค่เปิด QR Code เพื่อเช็คชื่อได้เท่านั้น ฟังก์ชั่นอื่นเป็น Read-only";
                          alert(`สิทธิ์ไม่เพียงพอ: เฉพาะผู้สร้างรายวิชาและผู้รับผิดชอบรายวิชาเท่านั้นที่มีสิทธิ์แก้ไขวิชาและเพิ่ม/ลดสัปดาห์สอน\n\nสิทธิ์ของคุณ: ${roleText}\n${detailText}`);
                        }
                      }}
                      className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ${
                        teacherRoleInfo.canEditCourse
                          ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-70'
                      }`}
                      title={teacherRoleInfo.canEditCourse ? "แก้ไขวิชา / เพิ่มลดสัปดาห์" : "เฉพาะผู้สร้างวิชาและผู้รับผิดชอบรายวิชาเท่านั้นที่แก้ไขได้"}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไขวิชา / เพิ่มลดสัปดาห์</span>
                    </button>


                  </div>
                </div>

              {/* Sessions List */}
              {effectiveSessions && effectiveSessions.length > 0 ? (
                <div className="space-y-3">
                  {[...effectiveSessions]
                    .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0))
                    .map((session) => (
                      <div
                        key={session.id}
                        className={`p-4 border rounded-2xl flex items-center justify-between transition ${
                          isDarkMode 
                            ? 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600' 
                            : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-blue-950 dark:text-sky-200 border border-sky-300/80 dark:border-sky-800 text-xs font-mono font-black">
                              สัปดาห์ที่ {session.weekNumber}
                            </span>
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{session.topic}</span>
                          </div>
                          <p className={`text-[11px] flex items-center space-x-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>สร้างเมื่อ {new Date(session.createdAt || Date.now()).toLocaleDateString('th-TH')}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => handleStartSessionQR(session)}
                          className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-sm active:scale-95 shrink-0 cursor-pointer"
                          title="เปิด Dynamic QR Code"
                        >
                          <QrCode className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">เปิด Dynamic QR Code</span>
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className={`p-8 text-center border rounded-2xl ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h4 className="text-sm font-bold mb-1">ยังไม่มีการเพิ่มสัปดาห์การสอนในรายวิชานี้</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                    กดปุ่ม "แก้ไขวิชา / เพิ่มลดสัปดาห์" ด้านบน เพื่อกำหนดหัวข้อสอนและวันที่สำหรับแต่ละสัปดาห์
                  </p>
                  {teacherRoleInfo.canEditCourse && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 inline-flex items-center space-x-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>เพิ่มสัปดาห์การสอน</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`p-12 text-center border rounded-2xl text-xs font-semibold ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
            }`}>
              กรุณาเลือกรายวิชาเพื่อจัดการข้อมูลการสอน
            </div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* VIEW TAB 2: TEACHER TEACHING LOGS & REPORT */}
      {dashboardTab === 'TEACHER_LOGS' && (
        <div className="space-y-6">
          <div className={`rounded-3xl p-6 border space-y-6 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            {/* Header & Main Actions */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/20">
                    Teacher Attendance System
                  </span>
                </div>
                <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  รายงานและประวัติการลงเวลาเข้าสอนของอาจารย์ (Teacher Teaching Log)
                </h2>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  สถิติประวัติการเข้าสอนแยกต่างหากสำหรับอาจารย์ สามารถเลือกดูแบบรวมทั้งหมดหรือแยกรายวิชาได้
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenTeacherCheckin}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>ลงชื่อเข้าสอน</span>
                </button>

                {/* Export Teacher Attendance CSV Button */}
                <a
                  href={`/api/export-teacher-csv?teacherId=${teacher.id}&courseId=${teacherLogCourseFilter}`}
                  download
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition border ${
                    isDarkMode 
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80' 
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300/80 shadow-xs'
                  }`}
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Export CSV ({teacherLogCourseFilter === 'ALL' ? 'รวมทุกวิชา' : 'เฉพาะวิชานี้'})
                  </span>
                </a>
              </div>
            </div>

            {/* View Mode Toggle: Overall vs By Course */}
            <div className={`p-1 rounded-2xl border flex flex-col sm:flex-row gap-1.5 ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setTeacherLogViewMode('OVERALL');
                  setTeacherLogCourseFilter('ALL');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                  teacherLogViewMode === 'OVERALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📊 แสดงจำนวนครั้งการเข้าสอนรวมทั้งหมด ({teacherHistory.length} ครั้ง)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTeacherLogViewMode('BY_COURSE');
                  if (teacherLogCourseFilter === 'ALL' && courses.length > 0) {
                    setTeacherLogCourseFilter(courses[0].id);
                  }
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                  teacherLogViewMode === 'BY_COURSE'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📚 แบบแยกรายวิชา (Course Breakdown)</span>
              </button>
            </div>

            {/* Course Selector Filter Buttons (Visible in BY_COURSE mode or when filter is used) */}
            {teacherLogViewMode === 'BY_COURSE' && (
              <div className="space-y-2 pt-1">
                <div className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  เลือกระบุวิชาเพื่อดูรายงานการเข้าสอน:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTeacherLogCourseFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      teacherLogCourseFilter === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    ทุกวิชา ({teacherHistory.length})
                  </button>

                  {courseBreakdown.map(({ course, count }) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setTeacherLogCourseFilter(course.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                        teacherLogCourseFilter === course.id
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>{course.courseCode}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        teacherLogCourseFilter === course.id
                          ? 'bg-white/20 text-white'
                          : isDarkMode
                          ? 'bg-slate-900 text-blue-400'
                          : 'bg-slate-200 text-blue-700'
                      }`}>
                        {count} ครั้ง
                      </span>
                    </button>
                  ))}

                  {generalLogsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTeacherLogCourseFilter('GENERAL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                        teacherLogCourseFilter === 'GENERAL'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>ทั่วไป / อื่นๆ</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-blue-400">
                        {generalLogsCount} ครั้ง
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-blue-50/50 border-blue-100'
              }`}>
                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {teacherLogCourseFilter === 'ALL'
                    ? 'จำนวนครั้งการลงเวลาสอนรวมทั้งหมด'
                    : `จำนวนครั้งที่เข้าสอนวิชา ${
                        courses.find((c) => c.id === teacherLogCourseFilter)?.courseCode || 'ทั่วไป'
                      }`}
                </div>
                <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white font-mono">
                  {filteredTeacherHistory.length} <span className="text-xs font-semibold">ครั้ง</span>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-sky-50/50 border-sky-100'
              }`}>
                <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                  {teacherLogCourseFilter === 'ALL' ? 'วิชาที่มีประวัติบันทึกสอน' : 'ชื่อรายวิชาที่เลือก'}
                </div>
                <div className="text-xs font-bold mt-1 text-slate-800 dark:text-slate-200 truncate">
                  {teacherLogCourseFilter === 'ALL'
                    ? `${courseBreakdown.filter((c) => c.count > 0).length} รายวิชา (จากทั้งหมด ${courses.length})`
                    : courses.find((c) => c.id === teacherLogCourseFilter)?.courseName || 'การลงเวลาสอนทั่วไป'}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/50 border-emerald-100'
              }`}>
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  บันทึกล่าสุดเมื่อ
                </div>
                <div className="text-xs font-bold mt-1 text-slate-800 dark:text-slate-200">
                  {filteredTeacherHistory.length > 0
                    ? new Date(filteredTeacherHistory[0].timestamp).toLocaleString('th-TH')
                    : 'ยังไม่มีประวัติ'}
                </div>
              </div>
            </div>

            {/* OVERALL MODE: Course Summary Breakdown Cards */}
            {teacherLogViewMode === 'OVERALL' && courses.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  สรุปจำนวนครั้งการเข้าสอนแยกตามรายวิชา (Course Breakdown)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {courseBreakdown.map(({ course, count, lastCheckin }) => (
                    <div
                      key={course.id}
                      onClick={() => {
                        setTeacherLogViewMode('BY_COURSE');
                        setTeacherLogCourseFilter(course.id);
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition hover:scale-[1.01] ${
                        isDarkMode
                          ? 'bg-slate-950/60 border-slate-800 hover:border-blue-500/50 hover:bg-slate-950'
                          : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-white shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                          {course.courseCode}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-xs border border-blue-500/20">
                          {count} ครั้ง
                        </span>
                      </div>
                      <div className={`text-xs font-bold mt-1.5 line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {course.courseName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-2">
                        <span>บันทึกล่าสุด:</span>
                        <span className="font-semibold">{lastCheckin ? new Date(lastCheckin).toLocaleDateString('th-TH') : 'ยังไม่มี'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Table / History Log */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  ตารางประวัติการลงเวลาเข้าสอนอาจารย์ {teacherLogCourseFilter !== 'ALL' && `(${courses.find((c) => c.id === teacherLogCourseFilter)?.courseCode || 'วิชาที่เลือก'})`}
                </h3>
                <button
                  type="button"
                  onClick={loadTeacherHistory}
                  className={`text-xs font-semibold flex items-center space-x-1 ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเฟรชตาราง</span>
                </button>
              </div>

              {filteredTeacherHistory.length === 0 ? (
                <div className={`p-8 rounded-2xl text-center text-xs space-y-3 ${
                  isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-400' : 'bg-slate-50 border border-slate-200 text-slate-500 shadow-sm'
                }`}>
                  <UserCheck className="w-8 h-8 mx-auto text-emerald-500 opacity-60" />
                  <p>
                    {teacherLogCourseFilter === 'ALL'
                      ? 'ยังไม่มีประวัติการเช็คชื่อเข้าสอนของอาจารย์ในระบบ'
                      : 'ยังไม่มีประวัติการเช็คชื่อเข้าสอนสำหรับรายวิชานี้'}
                  </p>
                  <button
                    onClick={handleOpenTeacherCheckin}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    กดลงชื่อเข้าสอน
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-2xl border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className={`border-b text-[11px] uppercase font-bold ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <tr>
                        <th
                          onClick={() => handleHistorySort('timestamp')}
                          className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                          title="กดเพื่อจัดเรียงตามวัน-เวลา"
                        >
                          <div className="flex items-center space-x-1">
                            <span>วัน-เวลา</span>
                            {historySortField === 'timestamp' ? (
                              historySortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistorySort('course')}
                          className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                          title="กดเพื่อจัดเรียงตามวิชา"
                        >
                          <div className="flex items-center space-x-1">
                            <span>วิชา / คาบเรียน</span>
                            {historySortField === 'course' ? (
                              historySortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistorySort('building')}
                          className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                          title="กดเพื่อจัดเรียงตามอาคาร/ห้องเรียน"
                        >
                          <div className="flex items-center space-x-1">
                            <span>อาคาร / ห้องเรียน</span>
                            {historySortField === 'building' ? (
                              historySortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistorySort('method')}
                          className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                          title="กดเพื่อจัดเรียงตามวิธีเช็คชื่อ"
                        >
                          <div className="flex items-center space-x-1">
                            <span>วิธีเช็คชื่อ</span>
                            {historySortField === 'method' ? (
                              historySortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                            )}
                          </div>
                        </th>
                        <th className="p-3">พิกัด GPS</th>
                        <th className="p-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sortedTeacherHistory.map((rec) => (
                        <tr key={rec.id} className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                          <td className="p-3 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {new Date(rec.timestamp).toLocaleString('th-TH')}
                          </td>
                          <td className="p-3 font-bold">
                            {rec.courseCode ? `[${rec.courseCode}] ${rec.courseName}` : 'การสอนทั่วไป'}
                            {rec.sessionTopic && <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{rec.sessionTopic}</div>}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {rec.buildingRoom ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold">
                                📍 {rec.buildingRoom}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[10px]">
                              {rec.checkinMethod}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[10px] whitespace-nowrap text-slate-500">
                            {rec.lat.toFixed(4)}, {rec.lng.toFixed(4)}
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">
                            {rec.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 3: COURSE COORDINATOR OVERVIEW DASHBOARD */}
      {dashboardTab === 'COURSE_OVERVIEW' && (
        <div className="space-y-6">
          {/* Top Banner / Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border space-y-2 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  รายวิชาที่รับผิดชอบ
                </span>
                <BookOpen className="w-5 h-5 text-sky-500" />
              </div>
              <div className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {overviewData?.totalCourses || courses.length} วิชา
              </div>
              <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold flex items-center space-x-1">
                <span>จัดการเป็นอาจารย์ผู้รับผิดชอบหลัก &amp; ผู้สอน</span>
              </div>
            </div>

            <div className={`p-5 rounded-2xl border space-y-2 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ผู้ลงทะเบียนเรียนรวม
                </span>
                <Users className="w-5 h-5 text-sky-500" />
              </div>
              <div className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {overviewData?.overviewList
                  ? overviewData.overviewList.reduce((acc: number, item: any) => acc + item.totalRegisteredCount, 0)
                  : 0} คน
              </div>
              <div className="text-[11px] text-sky-500 dark:text-sky-400 font-semibold">
                นับรวมจำนวนนักศึกษาในทุกรายวิชา
              </div>
            </div>

            <div className={`p-5 rounded-2xl border space-y-2 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  จำนวนคาบเรียนทั้งหมด
                </span>
                <Calendar className="w-5 h-5 text-emerald-500" />
              </div>
              <div className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {overviewData?.overviewList
                  ? overviewData.overviewList.reduce((acc: number, item: any) => acc + item.totalSessions, 0)
                  : 0} คาบ
              </div>
              <div className="text-[11px] text-emerald-500 dark:text-emerald-400 font-semibold">
                แผนการเรียนสัปดาห์ในระบบ
              </div>
            </div>

            <div className={`p-5 rounded-2xl border space-y-2 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  อัตราเข้าเรียนเฉลี่ย
                </span>
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <div className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {overviewData?.overviewList && overviewData.overviewList.length > 0
                    ? Math.round(
                        overviewData.overviewList.reduce((acc: number, item: any) => acc + item.courseAvgAttendanceRate, 0) /
                          overviewData.overviewList.length
                      )
                    : 0}%
                </div>
              </div>
              <div className="text-[11px] text-amber-500 dark:text-amber-400 font-semibold">
                ค่าเฉลี่ยสถิติเข้าเรียนภาพรวม
              </div>
            </div>
          </div>

          {/* Main Course Selector & Detail Layout */}
          {loadingOverview ? (
            <div className={`p-12 rounded-3xl border text-center ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-sky-500 mb-3" />
              <p className="text-xs font-bold">กำลังประมวลผลข้อมูลภาพรวมจำนวนผู้ลงทะเบียนและเวลาเข้าเรียน...</p>
            </div>
          ) : !overviewData?.overviewList || overviewData.overviewList.length === 0 ? (
            <div className={`p-12 rounded-3xl border text-center ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <BookOpen className="w-12 h-12 mx-auto text-sky-400 opacity-50 mb-3" />
              <h3 className="text-sm font-bold text-slate-200">ยังไม่มีรายวิชาที่รับผิดชอบในระบบ</h3>
              <p className="text-xs text-slate-400 mt-1">กดปุ่ม "สร้างรายวิชา" เพื่อเริ่มต้นเพิ่มวิชาเรียนใหม่</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: List of Courses Overview Cards */}
              <div className={`p-5 rounded-2xl border space-y-4 self-start ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>วิชาในความดูแล</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {filteredOverviewList.length}/{overviewData.overviewList.length}
                    </span>
                  </h2>
                  <button
                    onClick={loadOverviewData}
                    className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                    title="รีเฟรชข้อมูลวิชา"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Search & Term Filter controls when overview courses exist */}
                {overviewData.overviewList.length > 0 && (
                  <div className="space-y-2.5 pt-0.5">
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={coordinatorCourseSearchQuery}
                        onChange={(e) => setCoordinatorCourseSearchQuery(e.target.value)}
                        placeholder="ค้นหาตามรหัส หรือ ชื่อวิชา..."
                        className={`w-full text-xs pl-8 pr-7 py-2 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                        }`}
                      />
                      {coordinatorCourseSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCoordinatorCourseSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200 rounded-md"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Filters for ปีการศึกษา and ภาคเรียน */}
                    <div className={`grid grid-cols-2 gap-2 transition-opacity ${coordinatorShowAllCourses || coordinatorCourseSearchQuery.trim() ? 'opacity-50' : ''}`}>
                      {/* Dropdown ปีการศึกษา */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                          ปีการศึกษา {coordinatorCourseSearchQuery.trim() && <span className="text-[9px] font-normal text-sky-500">(ค้นหาทุกปี)</span>}
                        </label>
                        <select
                          value={coordinatorSelectedYearFilter}
                          onChange={(e) => setCoordinatorSelectedYearFilter(e.target.value)}
                          disabled={coordinatorShowAllCourses || Boolean(coordinatorCourseSearchQuery.trim())}
                          className={`w-full text-xs px-2 py-1.5 rounded-xl border font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed ${
                            isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="ALL">ทุกปีการศึกษา</option>
                          {overviewAvailableYears.map((y) => (
                            <option key={y} value={String(y)}>
                              ปี {y} {String(y) === String(currentSysYear) ? '(ปัจจุบัน)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dropdown ภาคเรียน */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                          ภาคเรียน {coordinatorCourseSearchQuery.trim() && <span className="text-[9px] font-normal text-sky-500">(ค้นหาทุกเทอม)</span>}
                        </label>
                        <select
                          value={coordinatorSelectedSemesterFilter}
                          onChange={(e) => setCoordinatorSelectedSemesterFilter(e.target.value)}
                          disabled={coordinatorShowAllCourses || Boolean(coordinatorCourseSearchQuery.trim())}
                          className={`w-full text-xs px-2 py-1.5 rounded-xl border font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed ${
                            isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="ALL">ทุกภาคเรียน</option>
                          <option value="1">ภาคเรียนที่ 1 {currentSysSemester === '1' ? '(ปัจจุบัน)' : ''}</option>
                          <option value="2">ภาคเรียนที่ 2 {currentSysSemester === '2' ? '(ปัจจุบัน)' : ''}</option>
                          <option value="SUMMER">ฤดูการศึกษา (Summer)</option>
                        </select>
                      </div>
                    </div>

                    {/* Checkbox for Showing All Courses */}
                    <div className="pt-0.5">
                      <label className="inline-flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={coordinatorShowAllCourses}
                          onChange={(e) => setCoordinatorShowAllCourses(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500/30 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <span>แสดงรายวิชาทั้งหมด (ทุกปี/ทุกเทอม)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Scrollable Course Cards List */}
                {loadingOverview ? (
                  <div className="p-4 text-center text-xs text-slate-400">กำลังโหลดวิชา...</div>
                ) : overviewData.overviewList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">ยังไม่มีรายวิชาที่รับผิดชอบ</div>
                ) : filteredOverviewList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 space-y-1.5 border border-dashed rounded-xl border-slate-700/50">
                    <p className="font-semibold text-slate-400">ไม่พบรายวิชาที่ตรงกับตัวกรอง</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCoordinatorCourseSearchQuery('');
                        setCoordinatorShowAllCourses(false);
                        setCoordinatorSelectedYearFilter(String(currentSysYear));
                        setCoordinatorSelectedSemesterFilter('ALL');
                      }}
                      className="text-[11px] font-bold text-sky-500 hover:underline"
                    >
                      ล้างคำค้นหาและรีเซ็ตตัวกรอง
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredOverviewList.map((item: any) => {
                      const c = item.course;
                      const isSelected = selectedOverviewCourseId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedOverviewCourseId(c.id);
                            handleSelectCourse(c);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? (isDarkMode ? 'bg-sky-500/15 border-sky-500/50 text-white font-bold ring-1 ring-sky-500/30' : 'bg-sky-50 border-sky-300 text-sky-950 font-bold ring-1 ring-sky-400/40')
                              : (isDarkMode ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-blue-950 dark:text-blue-300 font-extrabold">{c.courseCode}</span>
                            <div className="flex items-center space-x-1.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-700'
                              }`}>
                                ปี {c.academicYear} / เทอม {c.semester}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                item.courseAvgAttendanceRate >= 80
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}>
                                {item.courseAvgAttendanceRate}% เข้าเรียน
                              </span>
                            </div>
                          </div>

                          <div className={`text-xs mt-1 font-semibold line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {c.courseName}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-700/30 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center space-x-1">
                              <Users className="w-3.5 h-3.5 text-sky-400" />
                              <span>ลงทะเบียน: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{item.totalRegisteredCount} คน</strong></span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-sky-400" />
                              <span>{item.totalSessions} คาบ</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Detailed View for Selected Course */}
              {(() => {
                if (!currentOverviewItem) return null;

                const course = currentOverviewItem.course;

                // Filter students by search
                const filteredStudents = currentOverviewItem.studentList.filter((st: any) => {
                  if (!overviewSearchQuery) return true;
                  const q = overviewSearchQuery.toLowerCase();
                  return (
                    st.studentName.toLowerCase().includes(q) ||
                    st.studentIdNum.toLowerCase().includes(q) ||
                    st.email.toLowerCase().includes(q)
                  );
                });

                // Sort students for Overview Table
                const sortedOverviewStudents = [...filteredStudents].sort((a: any, b: any) => {
                  if (overviewSortField === 'studentIdNum') {
                    const cmp = (a.studentIdNum || '').localeCompare(b.studentIdNum || '');
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'studentName') {
                    const cmp = (a.studentName || '').localeCompare(b.studentName || '', 'th');
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'attended') {
                    const cmp = (a.attendedCount || 0) - (b.attendedCount || 0);
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'percent') {
                    const cmp = (a.attendancePercent || 0) - (b.attendancePercent || 0);
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'avgTime') {
                    const cmp = (a.avgMinutes || 0) - (b.avgMinutes || 0);
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'lastScan') {
                    const aTime = a.lastCheckinTime ? new Date(a.lastCheckinTime).getTime() : 0;
                    const bTime = b.lastCheckinTime ? new Date(b.lastCheckinTime).getTime() : 0;
                    const cmp = aTime - bTime;
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  if (overviewSortField === 'eligible') {
                    const aEligible = (a.attendancePercent || 0) >= 80 ? 1 : 0;
                    const bEligible = (b.attendancePercent || 0) >= 80 ? 1 : 0;
                    const cmp = aEligible - bEligible;
                    return overviewSortDir === 'asc' ? cmp : -cmp;
                  }
                  return 0;
                });

                return (
                  <div className="lg:col-span-2 space-y-4">
                    {/* Course Header & Actions */}
                    <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-800/40">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm font-black text-sky-600 dark:text-sky-400">{course.courseCode}</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold">
                              ปีการศึกษา {course.academicYear} / ภาคเรียนที่ {course.semester}
                            </span>
                          </div>
                          <h2 className={`text-base sm:text-lg font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {course.courseName}
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            อาจารย์ผู้รับผิดชอบรายวิชา: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{course.coordinatorName || course.ownerName}</strong>
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAttendanceGridModalOpen(true)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-sky-600/20 active:scale-95 shrink-0 cursor-pointer"
                            title="เปิดตารางเช็คชื่อ และเปลี่ยนสถานะการเข้าเรียนของนักศึกษาแต่ละคน"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>ตารางเช็คชื่อ / แก้ไขสถานะรายคน</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportCourseOverviewCSV(currentOverviewItem)}
                            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition shrink-0 cursor-pointer shadow-xs ${
                              isDarkMode
                                ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300/80'
                            }`}
                          >
                            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>ส่งออก CSV</span>
                          </button>
                        </div>
                      </div>

                      {/* Course Key Performance Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        <div className={`p-3 sm:p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-[10px] font-bold uppercase text-slate-400">ผู้ลงทะเบียนเรียน</div>
                          <div className="text-lg sm:text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">{currentOverviewItem.totalRegisteredCount} คน</div>
                          <div className="text-[10px] text-slate-500">นักศึกษาในคลาส</div>
                        </div>

                        <div className={`p-3 sm:p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-[10px] font-bold uppercase text-slate-400">อาจารย์ผู้สอนร่วม</div>
                          <div className="text-lg sm:text-xl font-extrabold text-emerald-500 mt-0.5">{currentOverviewItem.totalCoTeachersCount} ท่าน</div>
                          <div className="text-[10px] text-slate-500">ทีมอาจารย์</div>
                        </div>

                        <div className={`p-3 sm:p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-[10px] font-bold uppercase text-slate-400">คาบเรียนทั้งหมด</div>
                          <div className="text-lg sm:text-xl font-extrabold text-sky-500 mt-0.5">{currentOverviewItem.totalSessions} คาบ</div>
                          <div className="text-[10px] text-slate-500">สัปดาห์เรียน</div>
                        </div>

                        <div className={`p-3 sm:p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-[10px] font-bold uppercase text-slate-400">อัตราเข้าเรียนรวม</div>
                          <div className="text-lg sm:text-xl font-extrabold text-amber-500 mt-0.5">{currentOverviewItem.courseAvgAttendanceRate}%</div>
                          <div className="text-[10px] text-slate-500">เปอร์เซ็นต์รวม</div>
                        </div>
                      </div>

                      {/* Detail Switcher Tabs */}
                      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-800/40 pt-2 overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setOverviewDetailTab('STUDENTS')}
                          className={`pb-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                            overviewDetailTab === 'STUDENTS'
                              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>1. รายชื่อและเวลาเข้าเรียน ({currentOverviewItem.studentList.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOverviewDetailTab('SESSIONS')}
                          className={`pb-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                            overviewDetailTab === 'SESSIONS'
                              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>2. สถิติเวลาเข้าเรียนแยกรายคาบ ({currentOverviewItem.sessionDetailsList.length})</span>
                        </button>
                      </div>

                      {/* SUB-TAB 1: REGISTERED STUDENTS & ATTENDANCE TIME TABLE */}
                      {overviewDetailTab === 'STUDENTS' && (
                        <div className="space-y-3">
                          {/* Search bar */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                            <div className="relative w-full sm:w-72">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                              <input
                                type="text"
                                placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา..."
                                value={overviewSearchQuery}
                                onChange={(e) => setOverviewSearchQuery(e.target.value)}
                                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>
                            <div className="text-[11px] text-slate-400 self-end sm:self-auto">
                              แสดง {filteredStudents.length} จาก {currentOverviewItem.studentList.length} คน
                            </div>
                          </div>

                          {filteredStudents.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                              <Users className="w-6 h-6 mx-auto text-slate-500 opacity-60" />
                              <p>ไม่พบนักศึกษาตรงตามเงื่อนไขที่ค้นหา</p>
                            </div>
                          ) : (
                            <>
                              {/* MOBILE STACKED CARD VIEW (FOR SMALL SCREENS) */}
                              <div className="block sm:hidden space-y-2.5">
                                {sortedOverviewStudents.map((st: any, idx: number) => {
                                  const isEligible = st.attendancePercent >= 80;
                                  return (
                                    <div
                                      key={st.userId}
                                      className={`p-3.5 rounded-2xl border space-y-2.5 ${
                                        isDarkMode ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      {/* Top Row: Name + Student ID */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center space-x-2.5 min-w-0">
                                          {st.avatarUrl ? (
                                            <img src={st.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 font-bold flex items-center justify-center text-xs shrink-0">
                                              {st.studentName.charAt(0)}
                                            </div>
                                          )}
                                          <div className="min-w-0">
                                            <div className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                              {st.studentName}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono line-clamp-1">{st.email}</div>
                                          </div>
                                        </div>

                                        <span className="font-mono text-xs font-black text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 shrink-0">
                                          {st.studentIdNum}
                                        </span>
                                      </div>

                                      {/* Exam Eligibility Badge */}
                                      <div className="flex items-center justify-between">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                          isEligible
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                        }`}>
                                          {isEligible ? '🟢 มีสิทธิ์สอบ (80%+)' : '🔴 เสี่ยงหมดสิทธิ์สอบ (<80%)'}
                                        </span>
                                        <span className={`text-xs font-mono font-bold ${isEligible ? 'text-emerald-500' : 'text-rose-500'}`}>
                                          {st.attendancePercent}%
                                        </span>
                                      </div>

                                      {/* Stats Grid */}
                                      <div className="pt-2 border-t border-slate-800/40 grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="space-y-0.5">
                                          <div className="text-slate-400">คาบที่เข้าเรียน:</div>
                                          <div className="font-mono font-bold">
                                            <span className="text-emerald-500">{st.attendedCount}</span> / {st.totalSessionsCount} คาบ
                                          </div>
                                        </div>
                                        <div className="space-y-0.5">
                                          <div className="text-slate-400">เวลาเข้าเรียนเฉลี่ย:</div>
                                          <div className="font-mono font-bold text-amber-500">{st.avgTimeStr}</div>
                                        </div>
                                      </div>

                                      {/* Last Scan Info */}
                                      <div className="pt-1.5 border-t border-slate-800/30 text-[10px] text-slate-400 flex items-center justify-between">
                                        <span>สแกนล่าสุด:</span>
                                        {st.lastCheckinTime ? (
                                          <div className="flex items-center space-x-1.5 font-mono">
                                            <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>
                                              {new Date(st.lastCheckinTime).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                            {st.lastCheckinMethod && (
                                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                                                {st.lastCheckinMethod}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-slate-500">-</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* DESKTOP TABLE VIEW (FOR SM SCREENS AND ABOVE) */}
                              <div className="hidden sm:block overflow-x-auto border rounded-2xl border-slate-200 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                  <thead className={`border-b text-[11px] uppercase font-bold ${
                                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                                  }`}>
                                    <tr>
                                      <th className="p-3">#</th>
                                      <th
                                        onClick={() => handleOverviewSort('studentIdNum')}
                                        className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามรหัสนักศึกษา"
                                      >
                                        <div className="flex items-center space-x-1">
                                          <span>รหัสนักศึกษา</span>
                                          {overviewSortField === 'studentIdNum' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('studentName')}
                                        className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามชื่อ-นามสกุล"
                                      >
                                        <div className="flex items-center space-x-1">
                                          <span>ชื่อ-นามสกุล</span>
                                          {overviewSortField === 'studentName' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('attended')}
                                        className="p-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามจำนวนคาบเข้าเรียน"
                                      >
                                        <div className="flex items-center justify-center space-x-1">
                                          <span>คาบที่เข้าเรียน</span>
                                          {overviewSortField === 'attended' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('percent')}
                                        className="p-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามอัตราเข้าเรียน"
                                      >
                                        <div className="flex items-center justify-center space-x-1">
                                          <span>อัตราเข้าเรียน (%)</span>
                                          {overviewSortField === 'percent' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('avgTime')}
                                        className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามเวลาเข้าเรียนเฉลี่ย"
                                      >
                                        <div className="flex items-center space-x-1">
                                          <span>เวลาเข้าเรียนเฉลี่ย</span>
                                          {overviewSortField === 'avgTime' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('lastScan')}
                                        className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามสแกนครั้งล่าสุด"
                                      >
                                        <div className="flex items-center space-x-1">
                                          <span>สแกนครั้งล่าสุด</span>
                                          {overviewSortField === 'lastScan' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        onClick={() => handleOverviewSort('eligible')}
                                        className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                        title="กดเพื่อจัดเรียงตามสิทธิ์สอบ"
                                      >
                                        <div className="flex items-center space-x-1">
                                          <span>สิทธิ์สอบ</span>
                                          {overviewSortField === 'eligible' ? (
                                            overviewSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {sortedOverviewStudents.map((st: any, idx: number) => {
                                      const isEligible = st.attendancePercent >= 80;
                                      return (
                                        <tr key={st.userId} className={isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                                          <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                                            {st.studentIdNum}
                                          </td>
                                          <td className="p-3 font-semibold whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                              {st.avatarUrl && (
                                                <img src={st.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                                              )}
                                              <div>
                                                <div>{st.studentName}</div>
                                                <div className="text-[10px] text-slate-500 font-normal">{st.email}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="p-3 text-center font-bold font-mono">
                                            <span className="text-emerald-500">{st.attendedCount}</span> / {st.totalSessionsCount} คาบ
                                          </td>
                                          <td className="p-3 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center space-x-1.5">
                                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full ${isEligible ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                  style={{ width: `${Math.min(100, st.attendancePercent)}%` }}
                                                ></div>
                                              </div>
                                              <span className={`font-mono font-bold text-xs ${isEligible ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {st.attendancePercent}%
                                              </span>
                                            </div>
                                          </td>
                                          <td className="p-3 font-mono font-bold text-amber-500 whitespace-nowrap">
                                            {st.avgTimeStr}
                                          </td>
                                          <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                                            {st.lastCheckinTime ? (
                                              <div>
                                                <div className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                  {new Date(st.lastCheckinTime).toLocaleString('th-TH')}
                                                </div>
                                                {st.lastCheckinMethod && (
                                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                                                    {st.lastCheckinMethod}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-slate-500">-</span>
                                            )}
                                          </td>
                                          <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                              isEligible
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                            }`}>
                                              {isEligible ? '🟢 มีสิทธิ์สอบ (80%+)' : '🔴 เสี่ยงหมดสิทธิ์สอบ (<80%)'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 2: SESSION BY SESSION ATTENDANCE BREAKDOWN */}
                      {overviewDetailTab === 'SESSIONS' && (
                        <div className="space-y-3">
                          <div className="text-xs text-slate-400">
                            สรุปจำนวนนักศึกษาและช่วงเวลาที่เริ่มสแกนในแต่ละสัปดาห์
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[...(currentOverviewItem.sessionDetailsList || [])]
                              .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0))
                              .map((ses: any) => (
                              <div
                                key={ses.sessionId}
                                className={`p-4 rounded-2xl border space-y-2.5 ${
                                  isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-sky-600 dark:text-sky-400">
                                    สัปดาห์ที่ {ses.weekNumber}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    ses.isActive
                                      ? 'bg-emerald-500 text-slate-950 animate-pulse'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {ses.isActive ? '⚡ กำลังเปิดสแกน' : 'ปิดคาบแล้ว'}
                                  </span>
                                </div>

                                <div className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                  {ses.topic || `การเรียนสัปดาห์ที่ ${ses.weekNumber}`}
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">นักศึกษาสแกนเข้าเรียน:</span>
                                    <span className="font-mono font-extrabold text-emerald-500">
                                      {ses.checkinCount} / {ses.registeredCount} คน ({ses.attendancePercentage}%)
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-sky-500"
                                      style={{ width: `${Math.min(100, ses.attendancePercentage)}%` }}
                                    ></div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-800/40 grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                                  <div>
                                    <span>คนแรกสแกน: </span>
                                    <strong className="text-sky-500">{ses.firstCheckinTimeStr}</strong>
                                  </div>
                                  <div>
                                    <span>คนสุดท้ายสแกน: </span>
                                    <strong className="text-amber-500">{ses.lastCheckinTimeStr}</strong>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSessionModal(ses);
                                    setSessionModalFilter('ATTENDED');
                                    setSessionModalSearch('');
                                  }}
                                  className="w-full mt-2 py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center space-x-1.5 transition border border-sky-500/20 cursor-pointer active:scale-95"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>เช็ครายชื่อผู้เข้าเรียน ({ses.checkinCount}) / ขาดเรียน ({ses.registeredCount - ses.checkinCount})</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* DYNAMIC QR DISPLAY MODAL / SCREEN (Active QR Session) */}
      <DynamicQRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onStopSession={handleStopSessionQR}
        course={selectedCourse}
        session={activeSession}
        qrDataUrl={qrDataUrl}
        qrToken={qrToken}
        isStaticQr={isStaticQr}
        qrInterval={qrInterval}
        qrCountdown={qrCountdown}
        onToggleStaticQr={handleToggleStaticQr}
        onUpdateQrInterval={handleUpdateQrInterval}
        isGpsCheckEnabled={isGpsCheckEnabled}
        onToggleGps={handleToggleGps}
        sessionDurationMinutes={sessionDurationMinutes}
        lateThresholdMinutes={lateThresholdMinutes}
        onUpdateDurationAndLate={handleUpdateDurationAndLate}
        liveCheckins={liveCheckins}
        isDarkMode={isDarkMode}
      />

      {/* Invite Modal */}
      {inviteModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>รหัสเชิญชวนประจำรายวิชา (Static Code)</h3>
              <button onClick={() => setInviteModalCode(null)} className={`p-1 rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                ✕
              </button>
            </div>
            <div className="text-center space-y-2 py-3">
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ส่งรหัสเชิญชวน 4 หลักนี้ หรือลิงก์ให้นักศึกษาเพื่อลงทะเบียนเข้าเรียน (รหัสแบบคงที่ไม่เปลี่ยนแปลง)
              </p>
              <div className={`text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-widest p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {inviteModalCode.code}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteModalCode.code);
                  alert('คัดลอกรหัส 4 หลักเรียบร้อยแล้ว!');
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>คัดลอกรหัส 4 หลัก</span>
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}?join=${inviteModalCode.code}`;
                  navigator.clipboard.writeText(url);
                  alert('คัดลอกลิงก์เชิญชวนเรียบร้อยแล้ว!');
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Link className="w-4 h-4" />
                <span>คัดลอกลิงก์เต็ม</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Edit Modal */}
      {selectedCourse && (
        <TeacherCourseEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          course={selectedCourse}
          teacherId={teacher.id}
          isDarkMode={isDarkMode}
          onSuccess={(updatedCourse) => {
            setSelectedCourse(updatedCourse);
            loadTeacherCourses();
            handleSelectCourse(updatedCourse);
          }}
          onDeleteSuccess={handleCourseDeleted}
        />
      )}

      {/* Delete Course Confirmation Modal */}
      {selectedCourse && (
        <DeleteCourseConfirmModal
          isOpen={isDeleteCourseModalOpen}
          onClose={() => setIsDeleteCourseModalOpen(false)}
          course={selectedCourse}
          teacherId={teacher.id}
          isDarkMode={isDarkMode}
          onSuccess={handleCourseDeleted}
        />
      )}

      {/* TEACHER CHECK-IN MODAL */}
      <TeacherCheckinModal
        isOpen={isTeacherCheckinModalOpen}
        onClose={() => setIsTeacherCheckinModalOpen(false)}
        teacher={teacher}
        courses={courses}
        isDarkMode={isDarkMode}
        onCheckinSuccess={() => {
          loadTeacherCourses();
        }}
      />
      {/* SESSION ATTENDANCE LIST MODAL */}
      {selectedSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
          <div className={`border shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
            isStatsModalMaximized
              ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
              : 'w-full max-w-3xl rounded-3xl max-h-[90vh] my-auto'
          } ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              isDarkMode ? 'bg-slate-800/80 border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      สถิติการเข้าเรียน สัปดาห์ที่ {selectedSessionModal.weekNumber}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      selectedSessionModal.isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {selectedSessionModal.isActive ? '⚡ กำลังเปิดสแกน' : 'ปิดคาบแล้ว'}
                    </span>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    หัวข้อ: {selectedSessionModal.topic || `การเรียนสัปดาห์ที่ ${selectedSessionModal.weekNumber}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStatsModalMaximized(!isStatsModalMaximized)}
                  title={isStatsModalMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isStatsModalMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSessionModal(null)}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">สแกนเข้าเรียนแล้ว</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-500 mt-0.5">
                    {selectedSessionModal.attendedStudents?.length || 0} คน
                  </div>
                </div>
                <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">ขาด / ลาเรียน</div>
                  <div className="text-lg sm:text-xl font-black text-rose-500 mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                    <span>{selectedSessionModal.absentStudents?.length || 0} คน</span>
                    {(() => {
                      const leavesCount = (selectedSessionModal.absentStudents || []).filter((s: any) => s.isOnLeave).length;
                      return leavesCount > 0 ? (
                        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          (ลาเรียน {leavesCount} คน)
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className={`p-3 rounded-2xl border col-span-2 sm:col-span-1 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">อัตราการเข้าเรียน</div>
                  <div className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
                    {selectedSessionModal.attendancePercentage}%
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800/40 pb-3">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setSessionModalFilter('ATTENDED')}
                    className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      sessionModalFilter === 'ATTENDED'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                        : isDarkMode ? 'bg-slate-800/40 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>เข้าเรียน ({selectedSessionModal.attendedStudents?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionModalFilter('ABSENT')}
                    className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      sessionModalFilter === 'ABSENT'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40'
                        : isDarkMode ? 'bg-slate-800/40 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span>ขาด / ลาเรียน ({selectedSessionModal.absentStudents?.length || 0})</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหารหัสนักศึกษา/ชื่อ..."
                    value={sessionModalSearch}
                    onChange={(e) => setSessionModalSearch(e.target.value)}
                    className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* List Table & Cards */}
              <div className="max-h-96 overflow-y-auto p-1">
                {sessionModalFilter === 'ATTENDED' ? (
                  (() => {
                    const rawList = (selectedSessionModal.attendedStudents || []).filter((st: any) => {
                      if (!sessionModalSearch) return true;
                      const q = sessionModalSearch.toLowerCase();
                      return st.studentName.toLowerCase().includes(q) || st.studentIdNum.toLowerCase().includes(q);
                    });

                    const list = [...rawList].sort((a: any, b: any) => {
                      if (attendedSortField === 'studentIdNum') {
                        const cmp = (a.studentIdNum || '').localeCompare(b.studentIdNum || '');
                        return attendedSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (attendedSortField === 'studentName') {
                        const cmp = (a.studentName || '').localeCompare(b.studentName || '', 'th');
                        return attendedSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (attendedSortField === 'checkinTime') {
                        const cmp = (a.checkinTime || '').localeCompare(b.checkinTime || '');
                        return attendedSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (attendedSortField === 'checkinMethod') {
                        const cmp = (a.checkinMethod || '').localeCompare(b.checkinMethod || '', 'th');
                        return attendedSortDir === 'asc' ? cmp : -cmp;
                      }
                      return 0;
                    });

                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                          <Users className="w-6 h-6 mx-auto text-slate-500 opacity-60" />
                          <p>ไม่พบรายชื่อนักศึกษาที่เข้าเรียนตามเงื่อนไขที่ค้นหา</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Mobile Stacked Card View */}
                        <div className="block sm:hidden space-y-2">
                          {list.map((st: any, idx: number) => (
                            <div
                              key={st.userId}
                              className={`p-3 rounded-2xl border space-y-2 ${
                                isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                                  {st.avatarUrl ? (
                                    <img src={st.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-sky-500/10 text-sky-500 font-bold flex items-center justify-center text-[10px] shrink-0">
                                      {st.studentName.charAt(0)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{st.studentName}</div>
                                    <div className="text-[10px] text-slate-400 font-mono line-clamp-1">{st.email}</div>
                                  </div>
                                </div>
                                <span className="font-mono text-xs font-black text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 shrink-0">
                                  {st.studentIdNum}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px]">
                                <div className="flex items-center space-x-1.5 font-mono">
                                  <span className="text-slate-400">เวลาสแกน:</span>
                                  <span className="font-bold text-emerald-500">{st.checkinTime}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                                    {st.checkinMethod}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                    ✓ เข้าเรียนแล้ว
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden sm:block border rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className={`border-b text-[11px] uppercase font-bold sticky top-0 ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}>
                              <tr>
                                <th className="p-3">#</th>
                                <th
                                  onClick={() => handleAttendedSort('studentIdNum')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามรหัสนักศึกษา"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>รหัสนักศึกษา</span>
                                    {attendedSortField === 'studentIdNum' ? (
                                      attendedSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAttendedSort('studentName')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามชื่อ-นามสกุล"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>ชื่อ-นามสกุล</span>
                                    {attendedSortField === 'studentName' ? (
                                      attendedSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAttendedSort('checkinTime')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามเวลาสแกน"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>เวลาที่สแกน</span>
                                    {attendedSortField === 'checkinTime' ? (
                                      attendedSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAttendedSort('checkinMethod')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามช่องทาง"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>ช่องทาง</span>
                                    {attendedSortField === 'checkinMethod' ? (
                                      attendedSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th className="p-3 text-center">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {list.map((st: any, idx: number) => (
                                <tr key={st.userId} className={isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                                  <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">{st.studentIdNum}</td>
                                  <td className="p-3 font-semibold whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                      {st.avatarUrl && (
                                        <img src={st.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                                      )}
                                      <div>
                                        <div>{st.studentName}</div>
                                        <div className="text-[10px] text-slate-500 font-normal">{st.email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-emerald-500 whitespace-nowrap">{st.checkinTime}</td>
                                  <td className="p-3 whitespace-nowrap">
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                                      {st.checkinMethod}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                      ✓ เข้าเรียนแล้ว
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    const rawList = (selectedSessionModal.absentStudents || []).filter((st: any) => {
                      if (!sessionModalSearch) return true;
                      const q = sessionModalSearch.toLowerCase();
                      return st.studentName.toLowerCase().includes(q) || st.studentIdNum.toLowerCase().includes(q);
                    });

                    const list = [...rawList].sort((a: any, b: any) => {
                      if (absentSortField === 'studentIdNum') {
                        const cmp = (a.studentIdNum || '').localeCompare(b.studentIdNum || '');
                        return absentSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (absentSortField === 'studentName') {
                        const cmp = (a.studentName || '').localeCompare(b.studentName || '', 'th');
                        return absentSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (absentSortField === 'email') {
                        const cmp = (a.email || '').localeCompare(b.email || '');
                        return absentSortDir === 'asc' ? cmp : -cmp;
                      }
                      if (absentSortField === 'status') {
                        const aVal = a.isOnLeave ? 1 : 0;
                        const bVal = b.isOnLeave ? 1 : 0;
                        const cmp = aVal - bVal;
                        return absentSortDir === 'asc' ? cmp : -cmp;
                      }
                      return 0;
                    });

                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 opacity-60" />
                          <p>ไม่มีนักศึกษาที่ขาดเรียนในสัปดาห์นี้ (เข้าเรียนครบทุกคน!)</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Mobile Stacked Card View */}
                        <div className="block sm:hidden space-y-2">
                          {list.map((st: any, idx: number) => (
                            <div
                              key={st.userId}
                              className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                                isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                                {st.avatarUrl ? (
                                  <img src={st.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0" />
                                ) : (
                                  <div className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                                    st.isOnLeave ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                                  }`}>
                                    {st.studentName.charAt(0)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{st.studentName}</div>
                                  <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold">{st.studentIdNum}</div>
                                </div>
                              </div>

                              {st.isOnLeave ? (
                                <div className="flex flex-col items-end shrink-0">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                    📄 {st.leaveTypeLabel || st.statusText || 'ลาเรียน'}
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0">
                                  ✕ ขาดเรียน
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden sm:block border rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className={`border-b text-[11px] uppercase font-bold sticky top-0 ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}>
                              <tr>
                                <th className="p-3">#</th>
                                <th
                                  onClick={() => handleAbsentSort('studentIdNum')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามรหัสนักศึกษา"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>รหัสนักศึกษา</span>
                                    {absentSortField === 'studentIdNum' ? (
                                      absentSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAbsentSort('studentName')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามชื่อ-นามสกุล"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>ชื่อ-นามสกุล</span>
                                    {absentSortField === 'studentName' ? (
                                      absentSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAbsentSort('email')}
                                  className="p-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามอีเมล"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>อีเมล</span>
                                    {absentSortField === 'email' ? (
                                      absentSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleAbsentSort('status')}
                                  className="p-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                                  title="กดเพื่อจัดเรียงตามสถานะ"
                                >
                                  <div className="flex items-center justify-center space-x-1">
                                    <span>สถานะ</span>
                                    {absentSortField === 'status' ? (
                                      absentSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                                    )}
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {list.map((st: any, idx: number) => (
                                <tr key={st.userId} className={isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                                  <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">{st.studentIdNum}</td>
                                  <td className="p-3 font-semibold whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                      {st.avatarUrl && (
                                        <img src={st.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                                      )}
                                      <div>
                                        <div>{st.studentName}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">{st.email}</td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    {st.isOnLeave ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                          📄 {st.leaveTypeLabel || st.statusText || 'ลาเรียน'}
                                        </span>
                                        {st.leaveReason && (
                                          <span className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate">
                                            เหตุผล: {st.leaveReason}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/30">
                                        ✕ ขาดเรียน
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Teacher Leave Management Modal */}
      <TeacherLeaveManagementModal
        isOpen={isLeaveManagementOpen}
        onClose={() => {
          setIsLeaveManagementOpen(false);
          loadPendingLeaveCount();
          loadOverviewData();
        }}
        teacher={teacher}
        courses={courses}
        canManageLeave={teacherRoleInfo.canManageLeave}
        isDarkMode={isDarkMode}
      />

      {/* Teacher Invite & RBAC Management Modal */}
      {selectedCourse && (
        <TeacherInviteModal
          isOpen={isInviteTeacherModalOpen}
          onClose={() => setIsInviteTeacherModalOpen(false)}
          course={selectedCourse}
          currentUserId={teacher.id}
          courseMembers={currentCourseMembers || []}
          isDarkMode={isDarkMode}
          onMembersUpdated={handleRefreshCourseMembers}
          onRefresh={handleRefreshCourseMembers}
        />
      )}

      {/* Student Invite & Enrolled Students Modal */}
      {selectedCourse && (
        <StudentInviteModal
          isOpen={isInviteStudentModalOpen}
          onClose={() => setIsInviteStudentModalOpen(false)}
          course={selectedCourse}
          currentUserId={teacher.id}
          courseMembers={currentCourseMembers || []}
          isDarkMode={isDarkMode}
          onMembersUpdated={handleRefreshCourseMembers}
          onRefresh={handleRefreshCourseMembers}
        />
      )}

      {/* Teacher Attendance Grid Modal */}
      {(selectedCourse || currentOverviewItem?.course) && (
        <TeacherAttendanceGridModal
          isOpen={isAttendanceGridModalOpen}
          onClose={() => setIsAttendanceGridModalOpen(false)}
          course={selectedCourse || currentOverviewItem?.course}
          studentList={gridStudentList}
          sessions={effectiveSessions.length > 0 ? effectiveSessions : currentOverviewItem?.sessionDetailsList || []}
          canEditAttendance={teacherRoleInfo.canEditAttendance}
          onRefresh={() => {
            loadOverviewData();
            if (selectedCourse) {
              handleSelectCourse(selectedCourse);
            }
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};
