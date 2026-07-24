import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, Course, Session } from '../types';
import { fetchStudentStats, submitCheckin, fetchActiveSessions } from '../services/api';
import { QrCode, Camera, CheckCircle2, AlertTriangle, ShieldX, MapPin, Clock, Award, ChevronRight, RefreshCw, X, ShieldCheck, Navigation, Sparkles } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface StudentDashboardProps {
  student: User;
  onOpenJoinCourse: () => void;
  isDarkMode?: boolean;
}

interface StudentCourseItem {
  course: Course;
  stats: {
    totalSessions: number;
    attendedSessions: number;
    lateSessions: number;
    absentSessions: number;
    percentage: number;
    statusColor: 'GREEN' | 'YELLOW' | 'RED';
  };
  pastCheckins: AttendanceRecord[];
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, onOpenJoinCourse, isDarkMode = true }) => {
  const [coursesStats, setCoursesStats] = useState<StudentCourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourseHistory, setSelectedCourseHistory] = useState<StudentCourseItem | null>(null);

  // Scanner modal & checkin options state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [checkinMode, setCheckinMode] = useState<'GPS_ONLY' | 'QR_ONLY' | 'HYBRID'>('HYBRID');
  const [scannedResult, setScannedResult] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [checkinStatus, setCheckinStatus] = useState<{
    success?: boolean;
    message?: string;
    distance?: number;
    record?: AttendanceRecord;
    error?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeSessionsList, setActiveSessionsList] = useState<Array<{ session: Session; course?: Course }>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const loadActiveSessions = async () => {
    try {
      const data = await fetchActiveSessions();
      setActiveSessionsList(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].session.id);
      }
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    }
  };

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setCurrentCoords({ lat: 13.7563, lng: 100.5018 });
        }
      );
    } else {
      setCurrentCoords({ lat: 13.7563, lng: 100.5018 });
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await fetchStudentStats(student.id);
      setCoursesStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    updateLocation();
  }, [student.id]);

  // Handle opening live camera QR Scanner when mode requires QR
  useEffect(() => {
    if (isScannerOpen && (checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID')) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 220, height: 220 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            setScannedResult(decodedText);
            scanner.clear();
            handleProcessCheckin(decodedText, checkinMode);
          },
          () => {
            // silent scan frame error
          }
        );

        scannerRef.current = scanner;
      }, 300);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    }
  }, [isScannerOpen, checkinMode]);

  const openCheckinModal = (initialMode: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID') => {
    setCheckinStatus(null);
    setCheckinMode(initialMode);
    loadActiveSessions();
    updateLocation();
    setIsScannerOpen(true);
  };

  // Process Check-in (supports GPS_ONLY, QR_ONLY, and HYBRID)
  const handleProcessCheckin = async (qrPayloadText?: string, modeOverride?: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID') => {
    setCheckinStatus(null);
    setSubmitting(true);
    const mode = modeOverride || checkinMode;

    try {
      let sessionId: string | undefined = selectedSessionId;
      let eventId: string | undefined;
      let token = (qrPayloadText || manualInput).trim();

      if (token && token.includes(':')) {
        const parts = token.split(':');
        if (parts[0] === 'SES') {
          sessionId = parts[1];
          token = parts[2] || parts[1];
        } else if (parts[0] === 'EVT') {
          eventId = parts[1];
          token = parts[2] || parts[1];
        } else {
          sessionId = parts[0];
          token = parts[1];
        }
      }

      if (!sessionId && activeSessionsList.length > 0) {
        sessionId = activeSessionsList[0].session.id;
      } else if (!sessionId && !eventId) {
        sessionId = 'ses_3';
      }

      const lat = currentCoords?.lat || 13.7563;
      const lng = currentCoords?.lng || 100.5018;

      const res = await submitCheckin({
        sessionId,
        eventId,
        qrToken: token,
        studentId: student.id,
        scannedLat: lat,
        scannedLng: lng,
        deviceId: student.deviceId || `dev_${student.id}`,
        checkinMode: mode,
      });

      setCheckinStatus({
        success: true,
        message: mode === 'GPS_ONLY' 
          ? 'เช็คชื่อด้วย GPS สำเร็จแล้ว!' 
          : mode === 'QR_ONLY' 
          ? 'เช็คชื่อด้วย QR Code สำเร็จแล้ว!' 
          : 'เช็คชื่อด้วย QR Code + GPS สำเร็จแล้ว!',
        distance: res.distanceMeters,
        record: res.record,
      });

      loadStats();
    } catch (err: any) {
      setCheckinStatus({
        success: false,
        error: err.message || 'Check-in failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Welcome & Prominent QR Scan Header */}
      <div className={`relative overflow-hidden rounded-3xl p-6 md:p-8 border transition-all ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-800 text-white shadow-2xl' 
          : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-sky-50/80 border-emerald-200/80 text-slate-900 shadow-md'
      }`}>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
              isDarkMode
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-100/80 border-emerald-200 text-emerald-800'
            }`}>
              <ShieldCheck className="w-4 h-4" />
              <span>Student Profile Verified • Device Bound: {student.deviceId?.slice(0, 10)}...</span>
            </div>
            <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              สวัสดี, {student.title} {student.firstNameTh} {student.lastNameTh}
            </h1>
            <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              รหัสนักศึกษา: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{student.universityId}</span> | {student.email}
            </p>
          </div>

          {/* Prominent Check-In Button */}
          <button
            onClick={() => openCheckinModal('HYBRID')}
            className="w-full lg:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center space-x-3 shadow-lg shadow-emerald-600/25 active:scale-95 transition border border-emerald-400/30"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black leading-none">เช็คชื่อเข้าเรียน (Check-in)</div>
              <div className="text-[10px] opacity-90 font-medium mt-0.5">สแกน QR Code + ตรวจพิกัด GPS (สแกน + GPS เป็นค่าเริ่มต้น)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Enrolled Courses & Attendance Status Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-bold flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Award className="w-5 h-5 text-emerald-500" />
              <span>รายวิชาที่ลงทะเบียน (Enrolled Courses)</span>
            </h2>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              เกณฑ์สิทธิ์เข้าสอบ: 🟢 &gt; 85% (ปกติ) | 🟡 80-84% (เฝ้าระวัง) | 🔴 &lt; 80% (หมดสิทธิ์สอบ)
            </p>
          </div>
          <button
            onClick={onOpenJoinCourse}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            + เข้าร่วมวิชาด้วย Invite Code
          </button>
        </div>

        {loading ? (
          <div className={`p-8 text-center text-xs flex items-center justify-center space-x-2 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
          }`}>
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
            <span>กำลังโหลดสถิติการเช็คชื่อ...</span>
          </div>
        ) : coursesStats.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>ยังไม่มีวิชาเรียนที่คุณลงทะเบียนไว้</p>
            <button
              onClick={onOpenJoinCourse}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 shadow-sm"
            >
              ป้อนรหัสเชิญชวน (Enter Invite Code)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coursesStats.map((item) => (
              <div
                key={item.course.id}
                className={`rounded-2xl p-5 space-y-4 transition-all shadow-sm hover:shadow-md relative overflow-hidden border ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    item.stats.statusColor === 'GREEN'
                      ? 'bg-emerald-500'
                      : item.stats.statusColor === 'YELLOW'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                ></div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                      isDarkMode 
                        ? 'bg-slate-800 text-emerald-400 border-slate-700' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {item.course.courseCode}
                    </span>
                    <h3 className={`text-base font-bold mt-2 leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {item.course.courseName}
                    </h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      อาจารย์ผู้สอน: {item.course.coordinatorName}
                    </p>
                  </div>

                  {/* Attendance Percentage Badge */}
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border text-sm font-black font-mono ${
                        item.stats.statusColor === 'GREEN'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : item.stats.statusColor === 'YELLOW'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <span>
                        {item.stats.statusColor === 'GREEN' ? '🟢' : item.stats.statusColor === 'YELLOW' ? '🟡' : '🔴'}
                      </span>
                      <span>{item.stats.percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className={`flex justify-between text-[11px] mb-1 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>เข้าเรียนแล้ว: {item.stats.attendedSessions} / {item.stats.totalSessions} ครั้ง</span>
                    <span>สิทธิ์สอบ: {item.stats.percentage >= 80 ? 'มีสิทธิ์สอบ (Eligible)' : 'เสี่ยงหมดสิทธิ์สอบ'}</span>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.stats.statusColor === 'GREEN'
                          ? 'bg-emerald-500'
                          : item.stats.statusColor === 'YELLOW'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, item.stats.percentage)}%` }}
                    ></div>
                  </div>
                </div>

                {/* History Trigger button */}
                <div className={`pt-3 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={`text-xs flex items-center space-x-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>เช็คชื่อล่าสุด: {item.pastCheckins.length > 0 ? new Date(item.pastCheckins[item.pastCheckins.length - 1].timestamp).toLocaleDateString('th-TH') : 'ยังไม่มีประวัติ'}</span>
                  </span>
                  <button
                    onClick={() => setSelectedCourseHistory(item)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center space-x-1"
                  >
                    <span>ดูประวัติทั้งหมด</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedCourseHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div>
                <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ประวัติการเช็คชื่อ: {selectedCourseHistory.course.courseCode}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{selectedCourseHistory.course.courseName}</p>
              </div>
              <button
                onClick={() => setSelectedCourseHistory(null)}
                className={`p-1 rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {selectedCourseHistory.pastCheckins.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">ยังไม่มีประวัติการเช็คชื่อในวิชานี้</p>
              ) : (
                selectedCourseHistory.pastCheckins.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3 border rounded-xl flex items-center justify-between ${
                      isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>เช็คชื่อสำเร็จ (PRESENT)</span>
                      </div>
                      <p className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(rec.timestamp).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>ระยะห่าง: {rec.distanceMeters} เมตร</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">Anti-Proxy Verified</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedCourseHistory(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL (GPS / QR CODE / HYBRID OPTIONS) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 overflow-hidden">
            {/* Header & Close */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">ระบบเช็คชื่อเข้าเรียน (Check-in)</h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Check-in Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('GPS_ONLY');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'GPS_ONLY'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>GPS อย่างเดียว</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('QR_ONLY');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'QR_ONLY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>QRอย่างเดียว</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('HYBRID');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'HYBRID'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>QR + GPS</span>
              </button>
            </div>

            {/* MODE 1: GPS ONLY CHECK-IN */}
            {checkinMode === 'GPS_ONLY' && (
              <div className="space-y-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sky-400 font-bold text-xs">
                    <Navigation className="w-4 h-4" />
                    <span>เช็คชื่อด้วยพิกัดตำแหน่ง GPS ชั้นเรียน</span>
                  </div>
                  <button
                    onClick={updateLocation}
                    className="text-[11px] text-sky-400 hover:underline flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>รีเฟรช GPS</span>
                  </button>
                </div>

                {/* Active Sessions Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เลือกคาบเรียนที่กำลังเปิดอยู่ (Active Session):
                  </label>
                  {activeSessionsList.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                      ยังไม่มีคาบเรียนเปิดเช็คชื่อในขณะนี้ (อาจารย์ต้องเปิดเช็คชื่อในระบบก่อน)
                    </div>
                  ) : (
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {activeSessionsList.map(({ session: s, course: c }) => (
                        <option key={s.id} value={s.id}>
                          {c ? `[${c.courseCode}] ${c.courseName}` : 'Ad-hoc Class'} - สัปดาห์ที่ {s.weekNumber}: {s.topic}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Live GPS Coordinates Info */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="text-slate-400 text-[10px]">พิกัด GPS ปัจจุบันของคุณ:</div>
                    <div className="font-mono text-white font-bold">
                      {currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'กำลังดึงพิกัด GPS...'}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    🟢 Geofence 50m Active
                  </span>
                </div>

                {/* Direct GPS Check-in Button */}
                <button
                  type="button"
                  onClick={() => handleProcessCheckin(undefined, 'GPS_ONLY')}
                  disabled={submitting || activeSessionsList.length === 0}
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-sky-600/25 disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{submitting ? 'กำลังตรวจพิกัดและบันทึก...' : 'กดเช็คชื่อด้วย GPS ทันที'}</span>
                </button>
              </div>
            )}

            {/* MODE 2 & 3: QR CODE & HYBRID SCANNER */}
            {(checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID') && (
              <div className="space-y-4">
                {/* Live Camera Scanner Viewport */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[240px]">
                  <div id="qr-reader" className="w-full"></div>
                </div>

                {/* Fallback Simulation Scanner Input */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-400 font-semibold">
                    หรือ ป้อนรหัส Token ล่าสุดจากหน้าจออาจารย์ (Test Simulation Input):
                  </p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="เช่น SES:ses_3:xyz... หรือ UUID token"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      className="flex-grow bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      onClick={() => handleProcessCheckin(manualInput || 'SES:ses_3:active_token', checkinMode)}
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {submitting ? 'กำลังตรวจ...' : 'ส่งเช็คชื่อ'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status & Feedback Toast */}
            {checkinStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1 ${
                  checkinStatus.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {checkinStatus.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>{checkinStatus.message}</span>
                    </>
                  ) : (
                    <>
                      <ShieldX className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>ตรวจสอบไม่ผ่าน (Check-in Failed)</span>
                    </>
                  )}
                </div>

                {checkinStatus.success ? (
                  <p className="text-slate-300 text-[11px] font-mono">
                    ระยะห่างจากห้องเรียน: {checkinStatus.distance} เมตร | วิธีที่ใช้: {checkinMode}
                  </p>
                ) : (
                  <p className="text-rose-200 text-xs leading-relaxed">{checkinStatus.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
