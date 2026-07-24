import React, { useState, useEffect, useRef } from 'react';
import { User, Course, Session, AttendanceRecord, TeacherAttendanceRecord, QuickEvent, InviteLink } from '../types';
import { fetchCourses, fetchCourseDetails, activateSession, deactivateSession, createQuickEvent, generateInviteLink, submitTeacherCheckin, fetchTeacherCheckinRecords } from '../services/api';
import { QrCode, Users, Download, Sparkles, Plus, Play, Square, RefreshCw, CheckCircle2, Clock, Share2, Copy, MapPin, ShieldCheck, ArrowRight, UserCheck, Edit3, Navigation, Building, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { TeacherCourseEditModal } from './TeacherCourseEditModal';

interface TeacherDashboardProps {
  teacher: User;
  onOpenCreateCourse: () => void;
  onOpenQuickEvent: () => void;
  quickEventTrigger?: number;
  isDarkMode?: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  onOpenCreateCourse,
  onOpenQuickEvent,
  quickEventTrigger,
  isDarkMode = true,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseSessions, setCourseSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Active Dynamic QR state
  const [qrToken, setQrToken] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [liveCheckins, setLiveCheckins] = useState<AttendanceRecord[]>([]);
  const [teacherCoords, setTeacherCoords] = useState<{ lat: number; lng: number }>({
    lat: 13.7563,
    lng: 100.5018,
  });

  // Invite modal state
  const [inviteModalCode, setInviteModalCode] = useState<InviteLink | null>(null);
  const [quickEventModal, setQuickEventModal] = useState<QuickEvent | null>(null);

  // Teacher Attendance Check-In state
  const [isTeacherCheckinModalOpen, setIsTeacherCheckinModalOpen] = useState<boolean>(false);
  const [teacherCheckinMethod, setTeacherCheckinMethod] = useState<'GPS_ONLY' | 'QR_ONLY' | 'HYBRID'>('GPS_ONLY');
  const [teacherCheckinCourseId, setTeacherCheckinCourseId] = useState<string>('');
  const [teacherCheckinSessionId, setTeacherCheckinSessionId] = useState<string>('');
  const [buildingRoom, setBuildingRoom] = useState<string>('');
  const [teachingNotes, setTeachingNotes] = useState<string>('');
  const [teacherHistory, setTeacherHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [submittingTeacherCheckin, setSubmittingTeacherCheckin] = useState<boolean>(false);
  const [teacherCheckinResult, setTeacherCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

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
    if (courses.length > 0 && !teacherCheckinCourseId) {
      setTeacherCheckinCourseId(courses[0].id);
    }
    loadTeacherHistory();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setTeacherCoords({ lat: 13.7563, lng: 100.5018 })
      );
    }
    setIsTeacherCheckinModalOpen(true);
  };

  const handleTeacherCheckinSubmit = async () => {
    setSubmittingTeacherCheckin(true);
    setTeacherCheckinResult(null);
    try {
      const res = await submitTeacherCheckin({
        teacherId: teacher.id,
        courseId: teacherCheckinCourseId || undefined,
        sessionId: teacherCheckinSessionId || undefined,
        lat: teacherCoords.lat,
        lng: teacherCoords.lng,
        deviceId: teacher.deviceId || `dev_${teacher.id}`,
        checkinMethod: teacherCheckinMethod,
        buildingRoom,
        notes: teachingNotes,
      });

      setTeacherCheckinResult({
        success: true,
        message: res.message || 'บันทึกการเช็คชื่อเข้าสอนเรียบร้อยแล้ว!',
      });
      loadTeacherHistory();
      setBuildingRoom('');
      setTeachingNotes('');
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

    // Get current teacher GPS coords
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setTeacherCoords({ lat: 13.7563, lng: 100.5018 });
        }
      );
    }
  }, [teacher.id]);

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    try {
      const details = await fetchCourseDetails(course.id);
      setCourseSessions(details.sessions || []);
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
  const handleStartSessionQR = async (session: Session) => {
    try {
      setActiveSession(session);
      setLiveCheckins([]);
      const res = await activateSession(session.id, teacherCoords.lat, teacherCoords.lng);

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

  // Close QR Session
  const handleStopSessionQR = async () => {
    if (activeSession) {
      await deactivateSession(activeSession.id);
      setActiveSession(null);
    }
    if (quickEventModal) {
      setQuickEventModal(null);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Launch Quick Check-in (Ad-hoc Event)
  const handleLaunchQuickEvent = async () => {
    try {
      const qEvt = await createQuickEvent('การเช็คชื่อด่วน (Quick Event)', teacherCoords.lat, teacherCoords.lng, teacher.id);
      setQuickEventModal(qEvt);
      setLiveCheckins([]);

      const initialText = `EVT:${qEvt.id}:active_token`;
      const url = await QRCode.toDataURL(initialText, { width: 320, margin: 2 });
      setQrDataUrl(url);

      connectWebSocket(qEvt.id, true);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (quickEventTrigger && quickEventTrigger > 0) {
      handleLaunchQuickEvent();
    }
  }, [quickEventTrigger]);

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
          ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-800 text-white shadow-xl' 
          : 'bg-gradient-to-r from-sky-50/90 via-teal-50/70 to-emerald-50/80 border-sky-200/80 text-slate-900 shadow-md'
      }`}>
        <div className="space-y-1">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
            isDarkMode
              ? 'bg-sky-500/20 border-sky-500/30 text-sky-300'
              : 'bg-sky-100/80 border-sky-200 text-sky-800'
          }`}>
            <ShieldCheck className="w-4 h-4" />
            <span>Teacher Console • {teacher.universityId ? `Staff ID: ${teacher.universityId}` : teacher.email}</span>
          </div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            ยินดีต้อนรับ, {teacher.title} {teacher.firstNameTh} {teacher.lastNameTh}
          </h1>
          <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            ระบบจัดการรายวิชาและเปิดสแกน QR Code แบบเรียลไทม์พร้อมระบบป้องกันการฝากเช็คชื่อ
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={handleOpenTeacherCheckin}
            className="w-full md:w-auto px-5 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center justify-center space-x-3 shadow-lg shadow-teal-600/25 active:scale-95 transition border border-teal-400/30"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black leading-none">เช็คชื่ออาจารย์เข้าสอน</div>
              <div className="text-[10px] opacity-90 font-medium mt-0.5">ระบบลงเวลาเข้าสอนสำหรับผู้สอน</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Course Management Layout */}
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
                      <span className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold">{c.courseCode}</span>
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
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <Share2 className="w-4 h-4 text-emerald-500" />
                <span>ลิงก์เชิญผู้ใช้งาน (Course Invitations)</span>
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ส่งรหัสเชิญให้นักศึกษาเพื่อเข้าเรียน หรือส่งให้อาจารย์ผู้ร่วมสอน (Co-teacher)
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleGenerateInvite('STUDENT')}
                  className="py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition"
                >
                  เชิญนักศึกษา (Student)
                </button>
                <button
                  onClick={() => handleGenerateInvite('CO_TEACHER')}
                  className="py-2 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold transition"
                >
                  เชิญอาจารย์ผู้สอนร่วม
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Active Session Sessions & Dynamic QR Screen */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCourse ? (
            <div className={`rounded-2xl p-6 space-y-5 border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
                isDarkMode ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-sky-600 dark:text-sky-400">{selectedCourse.courseCode}</span>
                    <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>({selectedCourse.courseName})</span>
                  </div>
                  <h2 className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    รายการสัปดาห์สอน &amp; เปิดเช็คชื่อ (Teaching Sessions)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center space-x-1.5 transition active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>แก้ไขวิชา / เพิ่มลดสัปดาห์สอน</span>
                  </button>

                  {/* Export CSV Button */}
                  <a
                    href={`/api/export-csv/${selectedCourse.id}`}
                    download
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border ${
                      isDarkMode 
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ส่งออก CSV</span>
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
                        <span className="px-2.5 py-0.5 rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-300 text-xs font-mono font-bold">
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
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-sm active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>เปิด Dynamic QR Code</span>
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

      {/* DYNAMIC QR DISPLAY MODAL / SCREEN (Active QR Session or Quick Event) */}
      {(activeSession || quickEventModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className={`border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800/80 border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                <div>
                  <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {quickEventModal
                      ? 'โหมดเช็คชื่อด่วน (Quick Check-in Mode)'
                      : `กำลังเปิดสแกน: ${selectedCourse?.courseCode} - สัปดาห์ที่ ${activeSession?.weekNumber}`}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Dynamic QR Code เปลี่ยนรหัสอัตโนมัติทุก 5 วินาที • ป้องกันการถ่ายรูปส่งให้เพื่อน
                  </p>
                </div>
              </div>

              <button
                onClick={handleStopSessionQR}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>ปิดหน้าจอรับเช็คชื่อ</span>
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Dynamic QR Code Canvas Display */}
              <div className={`flex flex-col items-center justify-center p-6 rounded-2xl border space-y-4 ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/70 border-slate-200'
              }`}>
                <div className="relative p-4 bg-white rounded-2xl shadow-xl border border-slate-100">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Dynamic Attendance QR" className="w-64 h-64 object-contain" />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-slate-500">
                      กำลังสร้าง QR Code...
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                    Dynamic Live
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className={`text-xs font-mono flex items-center justify-center space-x-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>Token: {qrToken.slice(0, 18)}... (Refreshes every 5s)</span>
                  </div>
                  <div className={`text-[11px] flex items-center justify-center space-x-1 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    <MapPin className="w-3 h-3 text-indigo-500" />
                    <span>พิกัดห้องเรียน: {teacherCoords.lat.toFixed(4)}, {teacherCoords.lng.toFixed(4)} (Geofence 50m)</span>
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

                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                    {liveCheckins.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs space-y-2">
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
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์รายงาน CSV ทันที</span>
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
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>รหัสเชิญชวน (Invite Code)</h3>
              <button onClick={() => setInviteModalCode(null)} className={`p-1 rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                ✕
              </button>
            </div>
            <div className="text-center space-y-2 py-4">
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ส่งรหัสนี้ให้กับ {inviteModalCode.role === 'STUDENT' ? 'นักศึกษา' : 'อาจารย์ผู้ร่วมสอน'} เพื่อลงทะเบียนเข้าวิชา
              </p>
              <div className={`text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-widest p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {inviteModalCode.code}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteModalCode.code);
                alert('คัดลอกรหัสเชิญเรียบร้อยแล้ว!');
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>คัดลอกรหัสเชิญชวน</span>
            </button>
          </div>
        </div>
      )}

      {/* Course Edit Modal */}
      {selectedCourse && (
        <TeacherCourseEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          course={selectedCourse}
          isDarkMode={isDarkMode}
          onSuccess={(updatedCourse) => {
            setSelectedCourse(updatedCourse);
            loadTeacherCourses();
            handleSelectCourse(updatedCourse);
          }}
        />
      )}

      {/* TEACHER CHECK-IN MODAL */}
      {isTeacherCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className={`border rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-8 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    ระบบเช็คชื่ออาจารย์เข้าสอน (Teacher Check-In)
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    บันทึกเวลาการปฏิบัติการสอนและสถานที่สำหรับผู้สอน (ข้อมูลเก็บแยกจากนักศึกษา)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTeacherCheckinModalOpen(false)}
                className={`p-2 rounded-xl transition ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                ✕
              </button>
            </div>

            {/* Check-In Form */}
            <div className="space-y-4">
              {/* Method Selection */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  วิธีการบันทึกการสอน:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTeacherCheckinMethod('GPS_ONLY')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                      teacherCheckinMethod === 'GPS_ONLY'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>GPS พิกัดตำแหน่ง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeacherCheckinMethod('QR_ONLY')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                      teacherCheckinMethod === 'QR_ONLY'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code ชั้นเรียน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeacherCheckinMethod('HYBRID')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                      teacherCheckinMethod === 'HYBRID'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>GPS + QR Code</span>
                  </button>
                </div>
              </div>

              {/* Course & Session Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    เลือกรายวิชาที่เข้าสอน:
                  </label>
                  <select
                    value={teacherCheckinCourseId}
                    onChange={(e) => {
                      setTeacherCheckinCourseId(e.target.value);
                      const selected = courses.find((c) => c.id === e.target.value);
                      if (selected && selected.sessions && selected.sessions.length > 0) {
                        setTeacherCheckinSessionId(selected.sessions[0].id);
                      } else {
                        setTeacherCheckinSessionId('');
                      }
                    }}
                    className={`w-full text-xs font-medium rounded-xl p-2.5 border focus:outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-500'
                    }`}
                  >
                    <option value="">-- การสอนทั่วไป / นอกเหนือตารางวิชา --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.courseCode}] {c.courseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    คาบเรียน / หัวข้อ:
                  </label>
                  <select
                    value={teacherCheckinSessionId}
                    onChange={(e) => setTeacherCheckinSessionId(e.target.value)}
                    className={`w-full text-xs font-medium rounded-xl p-2.5 border focus:outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-500'
                    }`}
                  >
                    <option value="">-- ไม่ระบุคาบเรียน (Ad-hoc Lecture) --</option>
                    {courses
                      .find((c) => c.id === teacherCheckinCourseId)
                      ?.sessions?.map((s) => (
                        <option key={s.id} value={s.id}>
                          สัปดาห์ที่ {s.weekNumber}: {s.topic}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Building / Room and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    อาคาร / ห้องเรียน:
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="เช่น อาคาร 3 ห้อง 302"
                      value={buildingRoom}
                      onChange={(e) => setBuildingRoom(e.target.value)}
                      className={`w-full text-xs font-medium rounded-xl pl-9 pr-3 py-2.5 border focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    บันทึกการสอนเพิ่มเติม:
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="เช่น หัวข้อพิเศษ หรือ ลิงก์สไลด์การสอน"
                      value={teachingNotes}
                      onChange={(e) => setTeachingNotes(e.target.value)}
                      className={`w-full text-xs font-medium rounded-xl pl-9 pr-3 py-2.5 border focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* GPS Info Banner */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    พิกัด GPS ปัจจุบันของผู้สอน:
                  </span>
                  <div className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {teacherCoords.lat.toFixed(5)}, {teacherCoords.lng.toFixed(5)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => setTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => {}
                      );
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 text-[11px] font-bold transition flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>อัปเดต GPS</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleTeacherCheckinSubmit}
                disabled={submittingTeacherCheckin}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-teal-600/25 disabled:opacity-50 active:scale-98"
              >
                <UserCheck className="w-4 h-4" />
                <span>{submittingTeacherCheckin ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันเช็คชื่อเข้าสอนทันที'}</span>
              </button>

              {/* Result Notification */}
              {teacherCheckinResult && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2 ${
                  teacherCheckinResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}>
                  {teacherCheckinResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span className="font-semibold">{teacherCheckinResult.message}</span>
                </div>
              )}
            </div>

            {/* Teacher Check-in History Log */}
            <div className={`pt-4 border-t space-y-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h4 className={`text-xs font-extrabold uppercase tracking-wider flex items-center justify-between ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <span>ประวัติการลงเวลาเข้าสอนของคุณอาจารย์</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                  {teacherHistory.length} รายการ
                </span>
              </h4>

              {teacherHistory.length === 0 ? (
                <div className={`p-4 rounded-2xl text-center text-xs font-medium ${
                  isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'
                }`}>
                  ยังไม่มีประวัติการเช็คชื่อเข้าสอนในระบบ
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {teacherHistory.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                        isDarkMode ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-teal-600 dark:text-teal-400">
                            {rec.courseCode ? `[${rec.courseCode}] ${rec.courseName}` : 'การสอนทั่วไป / Ad-hoc'}
                          </span>
                          {rec.buildingRoom && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                            }`}>
                              📍 {rec.buildingRoom}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {rec.sessionTopic ? `คาบเรียน: ${rec.sessionTopic} • ` : ''}
                          วิธี: <span className="font-semibold text-sky-500">{rec.checkinMethod}</span>
                          {rec.notes ? ` • หมายเหตุ: ${rec.notes}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono text-[11px] opacity-75">
                        <div>{new Date(rec.timestamp).toLocaleDateString('th-TH')}</div>
                        <div className="font-bold text-teal-500">{new Date(rec.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
