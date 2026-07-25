import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, Course, Session } from '../types';
import { fetchStudentStats, submitCheckin, fetchActiveSessions } from '../services/api';
import { QrCode, Camera, CheckCircle2, AlertTriangle, ShieldX, MapPin, Clock, Award, ChevronRight, RefreshCw, X, ShieldCheck, Navigation, Sparkles, Image, Plus, KeyRound } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { decodeQRCodeFromImage } from '../utils/qrDecoder';

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
  const [checkinMode, setCheckinMode] = useState<'HYBRID' | 'GPS_ONLY' | 'TOKEN'>('HYBRID');
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
  const html5QrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);

  const handleFileUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImageProcessing(true);
    try {
      const decodedText = await decodeQRCodeFromImage(file);
      setScannedResult(decodedText);
      handleProcessCheckin(decodedText, checkinMode);
    } catch (err: any) {
      alert(err.message || 'ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาถ่ายรูปให้เห็น QR Code ชัดเจน แล้วลองอีกครั้ง');
    } finally {
      setIsImageProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

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
        (err) => {
          console.warn('Geolocation warning:', err.message);
          setCurrentCoords({ lat: 13.7563, lng: 100.5018 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const startLiveCameraStream = async () => {
    try {
      if (html5QrCodeInstanceRef.current) {
        try {
          await html5QrCodeInstanceRef.current.stop();
        } catch (e) {}
        html5QrCodeInstanceRef.current = null;
      }

      const container = document.getElementById('qr-reader');
      if (!container) return;

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeInstanceRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setScannedResult(decodedText);
          try {
            html5QrCode.stop();
          } catch (e) {}
          handleProcessCheckin(decodedText, checkinMode);
        },
        () => {}
      );
    } catch (err) {
      console.warn('Environment camera failed, trying default camera:', err);
      try {
        if (!html5QrCodeInstanceRef.current) {
          html5QrCodeInstanceRef.current = new Html5Qrcode('qr-reader');
        }
        await html5QrCodeInstanceRef.current.start(
          true,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setScannedResult(decodedText);
            try {
              html5QrCodeInstanceRef.current?.stop();
            } catch (e) {}
            handleProcessCheckin(decodedText, checkinMode);
          },
          () => {}
        );
      } catch (fallbackErr) {
        console.error('Camera access failed:', fallbackErr);
      }
    }
  };

  // Handle opening live camera QR Scanner when mode requires QR
  useEffect(() => {
    if (isScannerOpen && checkinMode === 'HYBRID') {
      const timer = setTimeout(() => {
        startLiveCameraStream();
      }, 250);

      return () => {
        clearTimeout(timer);
        if (html5QrCodeInstanceRef.current) {
          html5QrCodeInstanceRef.current.stop().catch(() => {});
          html5QrCodeInstanceRef.current = null;
        }
      };
    } else {
      if (html5QrCodeInstanceRef.current) {
        html5QrCodeInstanceRef.current.stop().catch(() => {});
        html5QrCodeInstanceRef.current = null;
      }
    }
  }, [isScannerOpen, checkinMode]);

  const openCheckinModal = (initialMode: 'HYBRID' | 'GPS_ONLY' | 'TOKEN' = 'HYBRID') => {
    setCheckinStatus(null);
    setCheckinMode(initialMode);
    loadActiveSessions();
    updateLocation();
    setIsScannerOpen(true);
  };

  // Process Check-in (supports HYBRID, GPS_ONLY, and TOKEN)
  const handleProcessCheckin = async (qrPayloadText?: string, modeOverride?: 'HYBRID' | 'GPS_ONLY' | 'TOKEN') => {
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

      let lat = currentCoords?.lat || 13.7563;
      let lng = currentCoords?.lng || 100.5018;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 0,
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          setCurrentCoords({ lat, lng });
        } catch (err) {
          console.warn('Fast student location lookup skipped, using currentCoords:', err);
        }
      }

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
          : mode === 'TOKEN' 
          ? 'เช็คชื่อด้วยรหัส Token สำเร็จแล้ว!' 
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
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/60 border-sky-900/50 text-white shadow-xl' 
          : 'bg-gradient-to-r from-sky-50 via-blue-50/60 to-indigo-50/40 border-sky-200 text-slate-900 shadow-sm'
      }`}>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-sky-300'
                : 'bg-sky-100 border-sky-200 text-sky-900'
            }`}>
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Student Profile Verified</span>
            </div>
            <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              สวัสดี, {student.title} {student.firstNameTh} {student.lastNameTh}
            </h1>
            <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              รหัสนักศึกษา: <span className="font-mono text-sky-600 dark:text-sky-300 font-black">{student.universityId}</span> | {student.email}
            </p>
          </div>

          {/* Action Buttons in Welcome Banner */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={onOpenJoinCourse}
              className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center justify-center space-x-3 shadow-md shadow-sky-500/20 active:scale-95 transition border border-sky-500/30 grow sm:grow-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black leading-none">เข้าร่วมวิชาเรียน</div>
                <div className="text-[10px] opacity-90 font-medium mt-0.5">กรอก Invite Code เพิ่มวิชาใหม่</div>
              </div>
            </button>

            <button
              onClick={() => openCheckinModal('HYBRID')}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center space-x-3 shadow-md shadow-blue-500/20 active:scale-95 transition border border-blue-500/30 grow sm:grow-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black leading-none">เช็คชื่อเข้าเรียน (Check-in)</div>
                <div className="text-[10px] opacity-90 font-medium mt-0.5">สแกน QR Code + ตรวจพิกัด GPS</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Enrolled Courses & Attendance Status Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-bold flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Award className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>รายวิชาที่ลงทะเบียน (Enrolled Courses)</span>
            </h2>
            <p className={`text-xs pl-7 mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              เกณฑ์สิทธิ์เข้าสอบ: 🟢 &gt; 85% (ปกติ) | 🟡 80-84% (เฝ้าระวัง) | 🔴 &lt; 80% (หมดสิทธิ์สอบ)
            </p>
          </div>
        </div>

        {loading ? (
          <div className={`p-8 text-center text-xs flex items-center justify-center space-x-2 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
          }`}>
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            <span>กำลังโหลดสถิติการเช็คชื่อ...</span>
          </div>
        ) : coursesStats.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <QrCode className="w-10 h-10 text-sky-600 mx-auto" />
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>ยังไม่มีวิชาเรียนที่คุณลงทะเบียนไว้</p>
            <button
              onClick={onOpenJoinCourse}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
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
                    : 'bg-white border-slate-200 hover:border-sky-300'
                }`}
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    item.stats.statusColor === 'GREEN'
                      ? 'bg-emerald-600'
                      : item.stats.statusColor === 'YELLOW'
                      ? 'bg-amber-600'
                      : 'bg-rose-600'
                  }`}
                ></div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                      isDarkMode 
                        ? 'bg-slate-800 text-sky-300 border-slate-700' 
                        : 'bg-sky-50 text-sky-900 border-sky-200'
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
                          ? 'bg-emerald-700/10 border-emerald-600/30 text-emerald-800 dark:text-emerald-300'
                          : item.stats.statusColor === 'YELLOW'
                          ? 'bg-amber-700/10 border-amber-600/30 text-amber-900 dark:text-amber-300'
                          : 'bg-rose-700/10 border-rose-600/30 text-rose-900 dark:text-rose-300'
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
                          ? 'bg-emerald-600'
                          : item.stats.statusColor === 'YELLOW'
                          ? 'bg-amber-600'
                          : 'bg-rose-600'
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
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center space-x-1 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className={`border rounded-2xl w-full max-w-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[88vh] overflow-y-auto ${
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
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>เช็คชื่อสำเร็จ (PRESENT)</span>
                      </div>
                      <p className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(rec.timestamp).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="text-sky-600 dark:text-sky-400 font-semibold flex items-center space-x-1">
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
                className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 overflow-y-auto ${
          isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/40'
        }`}>
          <div className={`border rounded-3xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 my-auto max-h-[88vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header & Close */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ระบบเช็คชื่อเข้าเรียน (Check-in)
                </h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className={`p-1.5 rounded-lg transition ${
                  isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Check-in Mode Selector Tabs */}
            <div className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              {/* Position 1 (Far Left / Default): QR + GPS */}
              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('HYBRID');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'HYBRID'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>QR + GPS</span>
              </button>

              {/* Position 2 (Middle): GPS อย่างเดียว */}
              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('GPS_ONLY');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'GPS_ONLY'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>GPS อย่างเดียว</span>
              </button>

              {/* Position 3 (Far Right): รหัสเข้าชั้นเรียน (Token) */}
              <button
                type="button"
                onClick={() => {
                  setCheckinStatus(null);
                  setCheckinMode('TOKEN');
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 ${
                  checkinMode === 'TOKEN'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>รหัสเข้าชั้นเรียน</span>
              </button>
            </div>

            {/* MODE 1: QR + GPS SCANNER (DEFAULT / FAR LEFT) */}
            {checkinMode === 'HYBRID' && (
              <div className="space-y-4">
                {/* Live Camera Scanner Viewport */}
                <div className={`relative rounded-2xl overflow-hidden border min-h-[200px] ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-300'
                }`}>
                  <div id="qr-reader" className="w-full"></div>
                  <div id="qr-reader-file-temp" className="hidden"></div>
                </div>

                {/* Native Mobile Camera Photo Upload Fallback */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUploadScan}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImageProcessing}
                    className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer"
                  >
                    <Image className="w-4 h-4" />
                    <span>{isImageProcessing ? 'กำลังประมวลผลรูป...' : '📷 ถ่ายรูป / อัปโหลด QR Code'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startLiveCameraStream()}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                      isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    <Camera className="w-4 h-4 text-sky-600" />
                    <span>ขอเปิดกล้องไลฟ์สดอีกครั้ง</span>
                  </button>
                </div>

                <div className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-sky-50/70 border-sky-200 text-slate-700'
                }`}>
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    💡 หากเบราว์เซอร์ไม่แสดง Pop-up ขออนุญาตเข้าถึงกล้อง:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                    <li><b>iOS Safari:</b> ไปที่ Setting -&gt; Safari -&gt; Camera -&gt; เลือก "Allow"</li>
                    <li><b>Android Chrome:</b> กดไอคอนกุญแจ/การตั้งค่ามุมซ้ายบนแถบ URL -&gt; Permissions -&gt; Allow Camera</li>
                    <li>หรือกดปุ่ม <b>"ถ่ายรูป / อัปโหลด QR Code"</b> ด้านบนเพื่อใช้แอปกล้องของเครื่องสแกนได้ทันที</li>
                  </ul>
                </div>
              </div>
            )}

            {/* MODE 2: GPS ONLY CHECK-IN (MIDDLE) */}
            {checkinMode === 'GPS_ONLY' && (
              <div className={`p-4 rounded-2xl border space-y-4 ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                    <Navigation className="w-4 h-4" />
                    <span>เช็คชื่อด้วยพิกัดตำแหน่ง GPS ชั้นเรียน</span>
                  </div>
                  <button
                    onClick={updateLocation}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>รีเฟรช GPS</span>
                  </button>
                </div>

                {/* Active Sessions Select */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    เลือกคาบเรียนที่กำลังเปิดอยู่ (Active Session):
                  </label>
                  {activeSessionsList.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-medium">
                      ยังไม่มีคาบเรียนเปิดเช็คชื่อในขณะนี้ (อาจารย์ต้องเปิดเช็คชื่อในระบบก่อน)
                    </div>
                  ) : (
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                      }`}
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
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="space-y-0.5">
                    <div className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>พิกัด GPS ปัจจุบันของคุณ:</div>
                    <div className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'กำลังดึงพิกัด GPS...'}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-700/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-600/30">
                    🟢 Geofence Active
                  </span>
                </div>

                {/* Direct GPS Check-in Button */}
                <button
                  type="button"
                  onClick={() => handleProcessCheckin(undefined, 'GPS_ONLY')}
                  disabled={submitting || activeSessionsList.length === 0}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{submitting ? 'กำลังตรวจพิกัดและบันทึก...' : 'กดเช็คชื่อด้วย GPS ทันที'}</span>
                </button>
              </div>
            )}

            {/* MODE 3: TOKEN / CLASS PASSCODE (FAR RIGHT) */}
            {checkinMode === 'TOKEN' && (
              <div className={`p-4 rounded-2xl border space-y-4 ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>เช็คชื่อด้วยรหัสผ่านเข้าชั้นเรียน (Token Code)</span>
                </div>

                {/* Active Sessions Select */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    เลือกคาบเรียนที่กำลังเปิดอยู่ (Active Session):
                  </label>
                  {activeSessionsList.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-medium">
                      ยังไม่มีคาบเรียนเปิดเช็คชื่อในขณะนี้ (อาจารย์ต้องเปิดเช็คชื่อในระบบก่อน)
                    </div>
                  ) : (
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                      }`}
                    >
                      {activeSessionsList.map(({ session: s, course: c }) => (
                        <option key={s.id} value={s.id}>
                          {c ? `[${c.courseCode}] ${c.courseName}` : 'Ad-hoc Class'} - สัปดาห์ที่ {s.weekNumber}: {s.topic}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Token Input Box */}
                <div className="space-y-2">
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ป้อนรหัส Token หรือตัวเลข 6 หลักจากหน้าจออาจารย์:
                  </label>
                  <input
                    type="text"
                    placeholder="ป้อนรหัส Token เช่น 842910 หรือ Token string"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500 placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm placeholder-slate-400'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!manualInput.trim()) {
                      alert('กรุณาป้อนรหัส Token หรือตัวเลข 6 หลักจากหน้าจออาจารย์ก่อนกดส่ง');
                      return;
                    }
                    handleProcessCheckin(manualInput.trim(), 'TOKEN');
                  }}
                  disabled={submitting || activeSessionsList.length === 0}
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{submitting ? 'กำลังตรวจสอบรหัส...' : 'ส่งเช็คชื่อด้วยรหัส Token'}</span>
                </button>
              </div>
            )}

            {/* Status & Feedback Toast */}
            {checkinStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1 ${
                  checkinStatus.success
                    ? isDarkMode
                      ? 'bg-stone-800/90 border-stone-700 text-stone-200'
                      : 'bg-[#efebe2] border-[#ded7c8] text-[#3b3028]'
                    : isDarkMode
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {checkinStatus.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{checkinStatus.message}</span>
                    </>
                  ) : (
                    <>
                      <ShieldX className="w-5 h-5 text-rose-500 shrink-0" />
                      <span>ตรวจสอบไม่ผ่าน (Check-in Failed)</span>
                    </>
                  )}
                </div>

                {checkinStatus.success ? (
                  <p className={`text-[11px] font-mono ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
                    ระยะห่างจากห้องเรียน: {checkinStatus.distance} เมตร | วิธีที่ใช้: {checkinMode}
                  </p>
                ) : (
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-rose-200' : 'text-rose-700'}`}>{checkinStatus.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
