import React, { useState, useEffect, useRef } from 'react';
import { User, Course, Session } from '../types';
import { submitTeacherCheckin } from '../services/api';
import { decodeQRCodeFromImage } from '../utils/qrDecoder';
import { getDeviceInfo } from '../utils/deviceHelper';
import { Html5Qrcode } from 'html5-qrcode';
import {
  UserCheck,
  X,
  ShieldCheck,
  Navigation,
  KeyRound,
  QrCode,
  Image,
  Building,
  FileText,
  CheckCircle,
  AlertCircle,
  Camera,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface TeacherCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User;
  courses: Course[];
  sessionsMap?: Record<string, Session[]>;
  isDarkMode?: boolean;
  onCheckinSuccess?: () => void;
}

export const TeacherCheckinModal: React.FC<TeacherCheckinModalProps> = ({
  isOpen,
  onClose,
  teacher,
  courses,
  sessionsMap,
  isDarkMode = false,
  onCheckinSuccess,
}) => {
  const [method, setMethod] = useState<'HYBRID' | 'GPS_ONLY' | 'TOKEN' | 'QR_ONLY'>('HYBRID');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [courseId, setCourseId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [buildingRoom, setBuildingRoom] = useState<string>('');
  const [teachingNotes, setTeachingNotes] = useState<string>('');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [teacherCoords, setTeacherCoords] = useState<{ lat: number; lng: number }>({
    lat: 13.7563,
    lng: 100.5018,
  });

  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const teacherHtml5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSessionsForCourse = (cId: string): Session[] => {
    if (!cId) return [];
    let list: Session[] = [];
    if (sessionsMap && sessionsMap[cId]) list = sessionsMap[cId];
    else {
      const course = courses.find((c) => c.id === cId);
      list = course?.sessions || [];
    }
    return [...list].sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
  };

  // Initialize course selection when modal opens
  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  // Sync session selection when course changes
  useEffect(() => {
    const sessions = getSessionsForCourse(courseId);
    if (sessions.length > 0) {
      setSessionId(sessions[0].id);
    } else {
      setSessionId('');
    }
  }, [courseId, sessionsMap, courses]);

  // Update geolocation
  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setScannedCode('');
      setTokenInput('');
      updateLocation();
    } else {
      stopTeacherCamera();
    }
  }, [isOpen]);

  const stopTeacherCamera = async () => {
    if (teacherHtml5QrCodeRef.current) {
      try {
        await teacherHtml5QrCodeRef.current.stop();
      } catch (err) {}
      teacherHtml5QrCodeRef.current = null;
    }
  };

  const startTeacherCamera = async () => {
    await stopTeacherCamera();
    const element = document.getElementById('teacher-qr-reader-viewport');
    if (!element) return;

    try {
      const html5Qr = new Html5Qrcode('teacher-qr-reader-viewport');
      teacherHtml5QrCodeRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setScannedCode(decodedText);
          stopTeacherCamera();
        },
        () => {}
      );
    } catch (err) {
      console.warn('Teacher camera stream failed:', err);
    }
  };

  useEffect(() => {
    if (isOpen && method === 'HYBRID') {
      const timer = setTimeout(() => {
        startTeacherCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopTeacherCamera();
      };
    } else {
      stopTeacherCamera();
    }
  }, [isOpen, method]);

  // Upload QR Image Scanner
  const handleTeacherFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageProcessing(true);
    setResult(null);

    try {
      const decodedText = await decodeQRCodeFromImage(file);
      setScannedCode(decodedText);
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'ไม่สามารถอ่านรหัส QR จากรูปภาพนี้ได้',
      });
    } finally {
      setIsImageProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    setResult(null);

    let tokenToSubmit = '';
    if (method === 'HYBRID') {
      tokenToSubmit = (scannedCode || tokenInput).trim();
      if (!tokenToSubmit) {
        setResult({
          success: false,
          message: 'กรุณาสแกน QR Code หรืออัปโหลดรูปภาพ / กรอกรหัส Token ก่อนกดเช็คชื่อ',
        });
        return;
      }
    } else if (method === 'TOKEN') {
      tokenToSubmit = tokenInput.trim();
      if (!tokenToSubmit) {
        setResult({
          success: false,
          message: 'กรุณากรอกรหัส Token 6 หลักสำหรับเข้าสอนก่อนกดเช็คชื่อ',
        });
        return;
      }
    }

    setSubmitting(true);

    try {
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
          setTeacherCoords({ lat: currentLat, lng: currentLng });
        } catch (geoErr) {
          console.warn('Teacher geolocation lookup on submit failed/denied:', geoErr);
        }
      }

      const devInfo = getDeviceInfo();

      const res = await submitTeacherCheckin({
        teacherId: teacher.id,
        courseId: courseId || undefined,
        sessionId: sessionId || undefined,
        lat: currentLat,
        lng: currentLng,
        deviceId: devInfo.deviceId,
        deviceName: devInfo.deviceName,
        deviceType: devInfo.deviceType,
        browser: devInfo.browser,
        os: devInfo.os,
        checkinMethod: method,
        qrToken: tokenToSubmit || undefined,
        buildingRoom,
        notes: teachingNotes,
      });

      await stopTeacherCamera();

      const distMsg =
        typeof res.distanceMeters === 'number' && res.distanceMeters > 0
          ? ` (ระยะห่างจากสถานที่เรียน: ${res.distanceMeters} เมตร)`
          : '';

      setResult({
        success: true,
        message: (res.message || 'บันทึกการเช็คชื่อเข้าสอนเรียบร้อยแล้ว!') + distMsg,
      });

      setScannedCode('');
      setTokenInput('');
      setBuildingRoom('');
      setTeachingNotes('');

      if (onCheckinSuccess) {
        onCheckinSuccess();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'เกิดข้อผิดพลาด ไม่สามารถเช็คชื่อเข้าสอนได้',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCourseSessions = getSessionsForCourse(courseId);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 overflow-y-auto ${
        isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/40'
      }`}
    >
      <div
        className={`border transition-all duration-300 shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
            : 'w-full max-w-lg rounded-3xl max-h-[90vh] my-auto'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              เช็คชื่อเข้าสอนอาจารย์ (Teacher Check-in)
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Check-in Method Selector Tabs */}
        <div
          className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setMethod('HYBRID')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
              method === 'HYBRID'
                ? 'bg-sky-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>QR + GPS</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('GPS_ONLY')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
              method === 'GPS_ONLY'
                ? 'bg-blue-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>GPS อย่างเดียว</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('TOKEN')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
              method === 'TOKEN'
                ? 'bg-indigo-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>รหัส Token</span>
          </button>
        </div>

        {/* Course and Session Selectors */}
        <div className="space-y-3">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              เลือกรายวิชาที่จะลงชื่อเข้าสอน:
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
              }`}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.courseCode}] {c.courseName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              เลือกคาบเรียน / สัปดาห์:
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
              }`}
            >
              {currentCourseSessions.length === 0 ? (
                <option value="">(ยังไม่มีคาบเรียนย่อย - ลงชื่อเข้าสอนแบบระบุวิชา)</option>
              ) : (
                currentCourseSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    สัปดาห์ที่ {s.weekNumber}: {s.topic} ({s.isActive ? 'กำลังเปิดสอน' : 'คาบเรียนปกติ'})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* MODE 1: QR + GPS Scanner View */}
        {method === 'HYBRID' && (
          <div className="space-y-3">
            <div
              className={`relative rounded-2xl overflow-hidden border min-h-[180px] ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-300'
              }`}
            >
              <div id="teacher-qr-reader-viewport" className="w-full"></div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleTeacherFileUpload}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImageProcessing}
                className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer"
              >
                <Image className="w-4 h-4" />
                <span>{isImageProcessing ? 'กำลังอ่านรูป...' : '📷 ถ่ายรูป / อัปโหลด QR'}</span>
              </button>

              <button
                type="button"
                onClick={() => startTeacherCamera()}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                <Camera className="w-4 h-4 text-sky-600" />
                <span>เปิดกล้องไลฟ์สด</span>
              </button>
            </div>

            {scannedCode && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>สแกนโค้ดได้: {scannedCode}</span>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: Token Input */}
        {method === 'TOKEN' && (
          <div className="space-y-2">
            <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              ป้อนรหัส Token 6 หลักสำหรับเข้าสอน:
            </label>
            <input
              type="text"
              placeholder="ป้อนรหัส Token เช่น 842910"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500 placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm placeholder-slate-400'
              }`}
            />
          </div>
        )}

        {/* Building & Room / Teaching Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              อาคาร / ห้องเรียน (Building/Room):
            </label>
            <div className="relative">
              <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="เช่น อาคาร 1 ห้อง 102"
                value={buildingRoom}
                onChange={(e) => setBuildingRoom(e.target.value)}
                className={`w-full border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              บันทึกเพิ่มเติม (Notes):
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="เช่น สอนชดเชย, การบ้านสัปดาห์นี้"
                value={teachingNotes}
                onChange={(e) => setTeachingNotes(e.target.value)}
                className={`w-full border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || courses.length === 0}
          className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <UserCheck className="w-4 h-4" />
          <span>{submitting ? 'กำลังบันทึกการเช็คชื่อเข้าสอน...' : 'ยืนยันลงชื่อเข้าสอน (Teacher Check-in)'}</span>
        </button>

        {/* Feedback Message */}
        {result && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2 ${
              result.success
                ? isDarkMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDarkMode
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {result.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-semibold">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
