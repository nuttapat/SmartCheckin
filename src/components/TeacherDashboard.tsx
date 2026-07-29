import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Course, Session, AttendanceRecord, TeacherAttendanceRecord, InviteLink, CourseMember, CourseMemberRole } from '../types';
import { fetchCourses, fetchCourseDetails, activateSession, deactivateSession, generateInviteLink, submitTeacherCheckin, fetchTeacherCheckinRecords, fetchTeacherCoursesOverview, fetchTeacherLeaveRequests, toggleGpsCheck, toggleQrMode } from '../services/api';
import { QrCode, Users, Download, Plus, Play, Square, RefreshCw, CheckCircle2, Clock, Share2, Copy, Link, MapPin, ShieldCheck, ArrowRight, UserCheck, Edit3, Navigation, Building, FileText, CheckCircle, AlertCircle, KeyRound, Camera, X, ShieldX, Image, BarChart3, PieChart, TrendingUp, Search, FileSpreadsheet, BookOpen, Award, Calendar, Trash2, UserPlus, ShieldAlert, Crown, EyeOff, Eye, Lock } from 'lucide-react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { decodeQRCodeFromImage } from '../utils/qrDecoder';
import { getDeviceInfo } from '../utils/deviceHelper';
import { TeacherCourseEditModal } from './TeacherCourseEditModal';
import { TeacherLeaveManagementModal } from './TeacherLeaveManagementModal';
import { DeleteCourseConfirmModal } from './DeleteCourseConfirmModal';
import { TeacherInviteModal } from './TeacherInviteModal';
import { StudentInviteModal } from './StudentInviteModal';
import { TeacherCheckinModal } from './TeacherCheckinModal';
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
  const [currentCourseMembers, setCurrentCourseMembers] = useState<CourseMember[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteCourseModalOpen, setIsDeleteCourseModalOpen] = useState<boolean>(false);
  const [isInviteTeacherModalOpen, setIsInviteTeacherModalOpen] = useState<boolean>(false);
  const [isInviteStudentModalOpen, setIsInviteStudentModalOpen] = useState<boolean>(false);
  const [isLeaveManagementOpen, setIsLeaveManagementOpen] = useState<boolean>(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);

  // Compute teacher role in the currently selected course
  const teacherRoleInfo = useMemo(() => {
    if (!selectedCourse) return { role: CourseMemberRole.INSTRUCTOR, isOwner: false, isCoordinator: false, isCoCoordinator: false, isInstructor: true, canEdit: false };

    const isOwner = selectedCourse.ownerId === teacher.id;
    const member = currentCourseMembers.find((m) => m.userId === teacher.id);
    const role = member ? member.role : (isOwner ? CourseMemberRole.COORDINATOR : CourseMemberRole.INSTRUCTOR);

    const isCoordinator = isOwner || role === CourseMemberRole.COORDINATOR || role === CourseMemberRole.CO_TEACHER;
    const isCoCoordinator = role === CourseMemberRole.CO_COORDINATOR;
    const isInstructor = role === CourseMemberRole.INSTRUCTOR;

    return {
      role,
      isOwner,
      isCoordinator,
      isCoCoordinator,
      isInstructor,
      canEdit: isCoordinator, // Owner & Course Coordinators can edit/delete
    };
  }, [selectedCourse, currentCourseMembers, teacher.id]);

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

  // Session Detail Modal State
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
    if (dashboardTab === 'COURSE_OVERVIEW') {
      loadOverviewData();
    }
  }, [dashboardTab, teacher.id]);

  const exportCourseOverviewCSV = (courseOverviewItem: any) => {
    if (!courseOverviewItem) return;
    const course = courseOverviewItem.course;
    let csv = `รายงานภาพรวมการเข้าเรียนรายวิชา,${course.courseCode} - ${course.courseName}\n`;
    csv += `อาจารย์ผู้รับผิดชอบ,${course.coordinatorName || course.ownerName}\n`;
    csv += `จำนวนผู้ลงทะเบียน,${courseOverviewItem.totalRegisteredCount} คน,จำนวนคาบเรียนทั้งหมด,${courseOverviewItem.totalSessions} คาบ\n`;
    csv += `อัตราการเข้าเรียนเฉลี่ย,${courseOverviewItem.courseAvgAttendanceRate}%\n\n`;

    csv += `ลำดับ,รหัสนักศึกษา,ชื่อ-นามสกุล,อีเมล,จำนวนคาบที่เข้าเรียน,คาบทั้งหมด,เปอร์เซ็นต์เข้าเรียน,เวลาเข้าเรียนเฉลี่ย,การสแกนล่าสุด,สถานะสิทธิ์สอบ\n`;

    courseOverviewItem.studentList.forEach((st: any, index: number) => {
      const examStatus = st.attendancePercent >= 80 ? 'มีสิทธิ์สอบ (80%+)' : 'เสี่ยงหมดสิทธิ์สอบ (ต่ำกว่า 80%)';
      const lastCheckinStr = st.lastCheckinTime ? new Date(st.lastCheckinTime).toLocaleString('th-TH') : 'ยังไม่เคยสแกน';
      csv += `${index + 1},"${st.studentIdNum}","${st.studentName}","${st.email}",${st.attendedCount},${st.totalSessionsCount},${st.attendancePercent}%,"${st.avgTimeStr}","${lastCheckinStr}","${examStatus}"\n`;
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
    if (course.defaultLat && course.defaultLng) {
      updateTeacherCoords({ lat: course.defaultLat, lng: course.defaultLng });
    }
    try {
      const details = await fetchCourseDetails(course.id);
      setCourseSessions(details.sessions || []);
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
          setQrCountdown(30);

          // Generate QR Code Data URL image
          const qrText = isEvent ? `EVT:${targetId}:${newToken}` : `SES:${targetId}:${newToken}`;
          const url = await QRCode.toDataURL(qrText, { width: 320, margin: 2, color: { dark: '#090d16', light: '#ffffff' } });
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

      // Prioritize classroom location specified for this course or session
      let currentLat = session.teacherLat || selectedCourse?.defaultLat || teacherCoords.lat;
      let currentLng = session.teacherLng || selectedCourse?.defaultLng || teacherCoords.lng;

      const res = await activateSession(session.id, currentLat, currentLng, isGpsCheckEnabled, duration, lateThreshold, isStaticQr);
      if (res.isStatic !== undefined) {
        setIsStaticQr(res.isStatic);
      }

      // Render initial QR
      const initialText = `SES:${session.id}:${res.qrToken || 'active'}`;
      const url = await QRCode.toDataURL(initialText, { width: 320, margin: 2, color: { dark: '#090d16', light: '#ffffff' } });
      setQrDataUrl(url);
      setQrToken(res.qrToken || '');

      // Connect WebSocket
      connectWebSocket(session.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Update duration / late threshold on active session
  const handleUpdateDurationAndLate = async (newDuration: number, newLateThreshold: number) => {
    setSessionDurationMinutes(newDuration);
    setLateThresholdMinutes(newLateThreshold);
    if (activeSession) {
      let currentLat = activeSession.teacherLat || selectedCourse?.defaultLat || teacherCoords.lat;
      let currentLng = activeSession.teacherLng || selectedCourse?.defaultLng || teacherCoords.lng;
      await activateSession(activeSession.id, currentLat, currentLng, isGpsCheckEnabled, newDuration, newLateThreshold);
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

  // 30-second Countdown Timer Effect for Dynamic QR Code
  useEffect(() => {
    if (!activeSession) return;

    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

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
    <div className="space-y-6">
      {/* Teacher Welcome Header & Quick Action */}
      <div className={`rounded-3xl p-6 md:p-8 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/50 border-sky-900/40 text-white shadow-2xl' 
          : 'bg-gradient-to-r from-sky-100/80 via-blue-50/70 to-indigo-50/50 border-sky-200/90 text-slate-900 shadow-sm'
      }`}>
        <div className="space-y-1 text-left">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
            isDarkMode
              ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              : 'bg-sky-100 border-sky-200/90 text-sky-900'
          }`}>
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Teacher Console</span>
          </div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            ยินดีต้อนรับ, {teacher.title} {teacher.firstNameTh} {teacher.lastNameTh}
          </h1>
          <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {teacher.email}
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2.5 w-full sm:w-auto md:ml-auto shrink-0">
          <button
            onClick={() => setIsLeaveManagementOpen(true)}
            className="px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-amber-600/20 active:scale-95 transition border border-amber-400/30 cursor-pointer relative whitespace-nowrap"
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
            className="px-4 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 active:scale-95 transition border border-sky-300/40 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>สร้างรายวิชา</span>
          </button>

          <button
            onClick={handleOpenTeacherCheckin}
            className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 active:scale-95 transition border border-emerald-400/30 cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-4 h-4 text-white shrink-0" />
            <span>ลงชื่อเข้าสอน</span>
          </button>
        </div>
      </div>

      {/* System Mode Switcher Tabs */}
      <div className={`p-1.5 rounded-2xl border flex flex-col md:flex-row gap-2 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-sky-50/60 border-sky-200/80'
      }`}>
        <button
          type="button"
          onClick={() => setDashboardTab('STUDENT_ATTENDANCE')}
          className={`flex-1 py-3 px-3.5 rounded-xl text-xs font-extrabold transition flex items-center justify-start md:justify-center text-left space-x-2 ${
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
          <span>1. บันทึกการเข้าเรียนนักศึกษา (Student Attendance)</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('TEACHER_LOGS')}
          className={`flex-1 py-3 px-3.5 rounded-xl text-xs font-extrabold transition flex items-center justify-start md:justify-center text-left space-x-2 ${
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
          <span>2. บันทึกการเข้าสอนอาจารย์ (Teacher Logs)</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('COURSE_OVERVIEW')}
          className={`flex-1 py-3 px-3.5 rounded-xl text-xs font-extrabold transition flex items-center justify-start md:justify-center text-left space-x-2 ${
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
          <span>3. ภาพรวมวิชา &amp; เวลาเข้าเรียน (Coordinator Dashboard)</span>
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
            <div className={`rounded-2xl p-5 space-y-4 border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <span>รายวิชาที่รับผิดชอบ ({courses.length})</span>
                <button
                  onClick={loadTeacherCourses}
                  className={`p-1 rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </h2>

              {loading ? (
                <div className="p-4 text-center text-xs text-slate-400">กำลังโหลดวิชา...</div>
              ) : courses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">ยังไม่ได้สร้างวิชาเรียน</div>
              ) : (
                <div className="space-y-2">
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCourse(c)}
                      className={`w-full text-left p-3.5 rounded-xl border transition ${
                        selectedCourse?.id === c.id
                          ? (isDarkMode ? 'bg-sky-500/15 border-sky-500/50 text-white font-bold' : 'bg-sky-50 border-sky-300 text-sky-950 font-bold')
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
                      {teacherRoleInfo.isCoordinator && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          👑 ผู้รับผิดชอบรายวิชา (Coordinator)
                        </span>
                      )}
                      {teacherRoleInfo.isCoCoordinator && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          🤝 ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)
                        </span>
                      )}
                      {teacherRoleInfo.isInstructor && !teacherRoleInfo.isCoordinator && !teacherRoleInfo.isCoCoordinator && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          👨‍🏫 อาจารย์ผู้สอน (Instructor)
                        </span>
                      )}
                    </div>
                    <h2 className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      รายการสัปดาห์สอน &amp; เปิดเช็คชื่อนักเรียน
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto ml-auto">
                    <button
                      onClick={() => {
                        if (teacherRoleInfo.canEdit) {
                          setIsEditModalOpen(true);
                        } else {
                          alert("สิทธิ์ไม่เพียงพอ: เฉพาะผู้รับผิดชอบรายวิชา (Course Coordinator) และเจ้าของรายวิชาเท่านั้นที่มีสิทธิ์แก้ไขข้อมูลรายวิชา\n\nสิทธิ์ของคุณ: " + (teacherRoleInfo.isCoCoordinator ? "ผู้ร่วมรับผิดชอบรายวิชา" : "อาจารย์ผู้สอน") + " สามารถเปิดเช็คชื่อ สร้าง QR Code และดูรายชื่อนักศึกษาได้");
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer ${
                        teacherRoleInfo.canEdit
                          ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-70'
                      }`}
                      title={teacherRoleInfo.canEdit ? "แก้ไขวิชา / เพิ่มลดสัปดาห์" : "เฉพาะผู้รับผิดชอบรายวิชาเท่านั้นที่แก้ไขได้"}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไขวิชา / เพิ่มลดสัปดาห์</span>
                    </button>

                    {/* Export Student Attendance CSV Button */}
                    <a
                      href={`/api/export-csv/${selectedCourse.id}`}
                      download
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border ${
                        isDarkMode 
                          ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Export รายงานนักเรียน (CSV)</span>
                    </a>
                  </div>
                </div>

              {/* Sessions List */}
              <div className="space-y-3">
                {courseSessions.map((session) => (
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
                        <span>สร้างเมื่อ {new Date(session.createdAt).toLocaleDateString('th-TH')}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleStartSessionQR(session)}
                      className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-sm active:scale-95 shrink-0"
                      title="เปิด Dynamic QR Code"
                    >
                      <QrCode className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">เปิด Dynamic QR Code</span>
                    </button>
                  </div>
                ))}
              </div>
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
                      ? 'bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700' 
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200 shadow-sm'
                  }`}
                >
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                        <th className="p-3">วัน-เวลา</th>
                        <th className="p-3">วิชา / คาบเรียน</th>
                        <th className="p-3">อาคาร / ห้องเรียน</th>
                        <th className="p-3">วิธีเช็คชื่อ</th>
                        <th className="p-3">พิกัด GPS</th>
                        <th className="p-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredTeacherHistory.map((rec) => (
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
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    วิชาในความดูแล ({overviewData.overviewList.length})
                  </h3>
                  <button
                    onClick={loadOverviewData}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>อัปเดตข้อมูล</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {overviewData.overviewList.map((item: any) => {
                    const c = item.course;
                    const isSelected = selectedOverviewCourseId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedOverviewCourseId(c.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-950/30'
                              : 'bg-sky-50 border-sky-300 shadow-sm'
                            : isDarkMode
                            ? 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-extrabold text-sky-600 dark:text-sky-400">
                            {c.courseCode}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.courseAvgAttendanceRate >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.courseAvgAttendanceRate}% เข้าเรียน
                          </span>
                        </div>

                        <div className={`text-xs font-bold mt-1 line-clamp-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                          {c.courseName}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400">
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
              </div>

              {/* Right Column: Detailed View for Selected Course */}
              {(() => {
                const currentOverviewItem = overviewData.overviewList.find(
                  (item: any) => item.course.id === selectedOverviewCourseId
                ) || overviewData.overviewList[0];

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

                        <button
                          type="button"
                          onClick={() => exportCourseOverviewCSV(currentOverviewItem)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-sky-600/20 active:scale-95 shrink-0 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>ส่งออกรายงานภาพรวม (CSV)</span>
                        </button>
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
                                {filteredStudents.map((st: any, idx: number) => {
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
                                      <th className="p-3">รหัสนักศึกษา</th>
                                      <th className="p-3">ชื่อ-นามสกุล</th>
                                      <th className="p-3 text-center">คาบที่เข้าเรียน</th>
                                      <th className="p-3 text-center">อัตราเข้าเรียน (%)</th>
                                      <th className="p-3">เวลาเข้าเรียนเฉลี่ย</th>
                                      <th className="p-3">สแกนครั้งล่าสุด</th>
                                      <th className="p-3">สิทธิ์สอบ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {filteredStudents.map((st: any, idx: number) => {
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
                            {currentOverviewItem.sessionDetailsList.map((ses: any) => (
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
      {activeSession && isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
          <div className={`border rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
              isDarkMode ? 'bg-slate-800/80 border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0"></div>
                <div>
                  <h3 className={`text-sm sm:text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {`กำลังเปิดสแกน: ${selectedCourse?.courseCode} - สัปดาห์ที่ ${activeSession?.weekNumber}`}
                  </h3>
                  <p className={`text-[11px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isStaticQr
                      ? '📌 Static QR Code: รหัสคงที่ตลอดคลาส'
                      : '🔄 Dynamic QR Code: เปลี่ยนรหัสอัตโนมัติทุก 30 วินาที'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm cursor-pointer"
                  title="ย่อหน้าจอเพื่อเริ่มการสอน (นักศึกษายังคงเช็คอินด้วย GPS Only ได้โดยไม่ต้องเปิด QR ใหม่)"
                >
                  <EyeOff className="w-3.5 h-3.5 text-sky-400" />
                  <span>ย่อหน้าจอ (ให้ นศ. เช็คอินผ่าน GPS)</span>
                </button>

                <button
                  onClick={handleStopSessionQR}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>ปิดระบบ</span>
                </button>
              </div>
            </div>

            {/* Modal Body Grid */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start overflow-y-auto">
              {/* Dynamic / Static QR Code Canvas Display */}
              <div className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border space-y-4 ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/70 border-slate-200'
              }`}>
                {/* Minimal Segment Toggle Switch: Dynamic / Static */}
                <div className={`inline-flex p-1 border rounded-xl shadow-inner text-xs font-bold space-x-1 ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-200/80 border-slate-300'
                }`}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isStaticQr) return;
                      setIsStaticQr(false);
                      if (activeSession?.id) {
                        try {
                          await toggleQrMode(activeSession.id, false);
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all duration-200 cursor-pointer ${
                      !isStaticQr
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 font-extrabold'
                        : isDarkMode
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${!isStaticQr ? 'animate-spin' : ''}`} />
                    <span>Dynamic</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (isStaticQr) return;
                      setIsStaticQr(true);
                      if (activeSession?.id) {
                        try {
                          await toggleQrMode(activeSession.id, true);
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all duration-200 cursor-pointer ${
                      isStaticQr
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 font-extrabold'
                        : isDarkMode
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Static</span>
                  </button>
                </div>

                <div className="relative p-3 sm:p-4 bg-white rounded-2xl shadow-xl border border-slate-100">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Attendance QR Code" className="w-48 h-48 sm:w-60 sm:h-60 object-contain" />
                  ) : (
                    <div className="w-48 h-48 sm:w-60 sm:h-60 flex items-center justify-center text-slate-500 text-xs">
                      กำลังสร้าง QR Code...
                    </div>
                  )}
                  {isStaticQr ? (
                    <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-sky-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                      <Lock className="w-3 h-3" />
                      <span>Static</span>
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                      <span>Dynamic 30s</span>
                    </div>
                  )}
                </div>

                {/* 6-Character Token Display */}
                <div className={`w-full border rounded-2xl p-3 text-center space-y-1 ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 ${
                    isDarkMode ? 'text-sky-400' : 'text-sky-600'
                  }`}>
                    <span>🔑 รหัส Token 6 ตัวอักษร (สำหรับป้อนด้วยตนเอง):</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <span className={`font-mono text-xl sm:text-2xl font-black tracking-widest ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      {qrToken || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qrToken);
                        alert(`คัดลอกรหัส ${qrToken} เรียบร้อยแล้ว!`);
                      }}
                      className={`p-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1 cursor-pointer transition ${
                        isDarkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                      title="คัดลอกรหัส 6 หลัก"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอก</span>
                    </button>
                  </div>
                </div>

                {/* Timer Bar or Static Notice */}
                {isStaticQr ? (
                  <div className={`w-full p-2 rounded-xl border text-xs flex items-center justify-center space-x-1.5 ${
                    isDarkMode
                      ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                      : 'bg-sky-50 border-sky-200 text-sky-800'
                  }`}>
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                    <span className={`text-[11px] font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>โหมด Static: รหัสคงที่ตลอดคลาส</span>
                  </div>
                ) : (
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span>รีเฟรชรหัสถัดไปในอีก:</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">{qrCountdown} วินาที</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${(qrCountdown / 30) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* GPS Toggle Switch */}
                <div className="w-full pt-1">
                  <button
                    type="button"
                    onClick={handleToggleGps}
                    className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition ${
                      isGpsCheckEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className={`w-4 h-4 ${isGpsCheckEnabled ? 'text-emerald-400' : 'text-rose-400'}`} />
                      <span>ตรวจสอบพิกัด GPS</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                      isGpsCheckEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                    }`}>
                      {isGpsCheckEnabled ? '🟢 เปิดตรวจ GPS (Geofence 200m)' : '🔴 ปิดตรวจ GPS (QR อย่างเดียว)'}
                    </span>
                  </button>
                </div>

                {/* Duration & Late Threshold Controls */}
                <div className="w-full space-y-2 pt-3 border-t border-slate-700/60">
                  <div className="text-[11px] font-extrabold text-slate-200 flex items-center justify-between">
                    <span>⏱️ กำหนดเวลาเปิดรับเช็คชื่อ &amp; เกณฑ์เข้าสาย:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">ระยะเวลาเปิดรับทั้งหมด:</label>
                      <select
                        value={sessionDurationMinutes}
                        onChange={(e) => handleUpdateDurationAndLate(Number(e.target.value), lateThresholdMinutes)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs font-bold focus:ring-2 focus:ring-sky-500"
                      >
                        <option value={15}>15 นาที</option>
                        <option value={30}>30 นาที (มาตรฐาน)</option>
                        <option value={45}>45 นาที</option>
                        <option value={60}>60 นาที (1 ชม.)</option>
                        <option value={90}>90 นาที (1.5 ชม.)</option>
                        <option value={120}>120 นาที (2 ชม.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">เริ่มถือว่า "เข้าเรียนสาย" หลัง:</label>
                      <select
                        value={lateThresholdMinutes}
                        onChange={(e) => handleUpdateDurationAndLate(sessionDurationMinutes, Number(e.target.value))}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs font-bold focus:ring-2 focus:ring-sky-500"
                      >
                        <option value={5}>5 นาทีแรก</option>
                        <option value={10}>10 นาทีแรก</option>
                        <option value={15}>15 นาทีแรก (มาตรฐาน)</option>
                        <option value={20}>20 นาทีแรก</option>
                        <option value={30}>30 นาทีแรก</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-800/80 text-[10px] text-sky-200 space-y-1">
                    <p className="font-bold text-sky-300">💡 การนับสถานะสำหรับผู้มาสาย:</p>
                    <p>• <b>0 ถึง {lateThresholdMinutes} นาที:</b> ลงบันทึก <span className="text-emerald-400 font-bold">🟢 ตรงเวลา (PRESENT)</span></p>
                    <p>• <b>{lateThresholdMinutes} ถึง {sessionDurationMinutes} นาที:</b> ลงบันทึก <span className="text-amber-400 font-bold">🟡 มาสาย (LATE)</span> อัตโนมัติ</p>
                    <p>• <b>เกิน {sessionDurationMinutes} นาที:</b> หมดเวลาเช็คชื่อ ถือว่า <span className="text-rose-400 font-bold">🔴 ขาดเรียน (ABSENT)</span></p>
                    <p className="text-slate-400 italic mt-1">อาจารย์สามารถย่อหน้าจอนี้ไปเริ่มสอนได้ทันที นักศึกษาที่มาสายจะกดเช็คชื่อด้วย GPS Only ในห้องเรียนได้เอง</p>
                  </div>
                </div>
              </div>

              {/* Real-time Student Check-in Live Stream (WebSockets) */}
              <div className="space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className={`flex items-center justify-between pb-2 border-b ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-100'
                  }`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      <Users className="w-4 h-4 text-emerald-500" />
                      <span>รายชื่อนักศึกษาที่สแกนแล้ว (Real-time Stream)</span>
                    </h4>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                      เช็คชื่อแล้ว {liveCheckins.length} คน
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 max-h-48 sm:max-h-64 overflow-y-auto pr-1">
                    {liveCheckins.length === 0 ? (
                      <div className="text-center py-8 sm:py-12 text-slate-400 text-xs space-y-2">
                        <Clock className="w-8 h-8 text-slate-400 mx-auto animate-bounce" />
                        <p>กำลังรอการสแกนจากนักศึกษา...</p>
                      </div>
                    ) : (
                      liveCheckins.map((rec) => (
                        <div
                          key={rec.id}
                          className={`p-3 border rounded-xl flex items-center justify-between transition ${
                            isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <div className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{rec.studentNameTh}</div>
                            <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              รหัส: {rec.studentUniversityId} • เวลา: {new Date(rec.timestamp).toLocaleTimeString('th-TH')}
                            </div>
                          </div>
                          <div className="text-right text-[10px]">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                              {rec.distanceMeters}m Verified
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* CSV Download Trigger */}
                <div className={`pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <a
                    href={selectedCourse ? `/api/export-csv/${selectedCourse.id}` : '#'}
                    download
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition border ${
                      isDarkMode 
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm'
                    }`}
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Export รายงานการเข้าเรียนนักเรียน (CSV)</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className={`border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
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
                    const list = (selectedSessionModal.attendedStudents || []).filter((st: any) => {
                      if (!sessionModalSearch) return true;
                      const q = sessionModalSearch.toLowerCase();
                      return st.studentName.toLowerCase().includes(q) || st.studentIdNum.toLowerCase().includes(q);
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
                                <th className="p-3">รหัสนักศึกษา</th>
                                <th className="p-3">ชื่อ-นามสกุล</th>
                                <th className="p-3">เวลาที่สแกน</th>
                                <th className="p-3">ช่องทาง</th>
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
                    const list = (selectedSessionModal.absentStudents || []).filter((st: any) => {
                      if (!sessionModalSearch) return true;
                      const q = sessionModalSearch.toLowerCase();
                      return st.studentName.toLowerCase().includes(q) || st.studentIdNum.toLowerCase().includes(q);
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
                                <th className="p-3">รหัสนักศึกษา</th>
                                <th className="p-3">ชื่อ-นามสกุล</th>
                                <th className="p-3">อีเมล</th>
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
          courseMembers={currentCourseMembers || []}
          isDarkMode={isDarkMode}
          onMembersUpdated={handleRefreshCourseMembers}
          onRefresh={handleRefreshCourseMembers}
        />
      )}
    </div>
  );
};
