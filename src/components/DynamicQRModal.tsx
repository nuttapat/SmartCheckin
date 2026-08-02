import React, { useState } from 'react';
import {
  Minimize2,
  Maximize2,
  EyeOff,
  Square,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Lock,
  Copy,
  Clock,
  ShieldCheck,
  Users,
  Download,
} from 'lucide-react';
import { Course, Session, AttendanceRecord } from '../types';
import { useTheme } from '../context/ThemeContext';

interface DynamicQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStopSession: () => void;
  course: Course | null;
  session: Session | null;
  qrDataUrl: string;
  qrToken: string;
  isStaticQr: boolean;
  qrInterval: number;
  qrCountdown: number;
  onToggleStaticQr: (isStatic: boolean) => void;
  onUpdateQrInterval: (newInterval: number) => void;
  isGpsCheckEnabled: boolean;
  onToggleGps: () => void;
  sessionDurationMinutes: number;
  lateThresholdMinutes: number;
  onUpdateDurationAndLate: (duration: number, lateThreshold: number) => void;
  liveCheckins: AttendanceRecord[];
  isDarkMode?: boolean;
}

export const DynamicQRModal: React.FC<DynamicQRModalProps> = ({
  isOpen,
  onClose,
  onStopSession,
  course,
  session,
  qrDataUrl,
  qrToken,
  isStaticQr,
  qrInterval,
  qrCountdown,
  onToggleStaticQr,
  onUpdateQrInterval,
  isGpsCheckEnabled,
  onToggleGps,
  sessionDurationMinutes,
  lateThresholdMinutes,
  onUpdateDurationAndLate,
  liveCheckins,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isQrEnlarged, setIsQrEnlarged] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  if (!isOpen || !session) return null;

  const courseCodeStr = course?.courseCode || course?.code || '';

  const handleCopyToken = () => {
    if (!qrToken) return;
    navigator.clipboard.writeText(qrToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div
        className={`border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
            : 'w-full max-w-4xl rounded-2xl sm:rounded-3xl max-h-[92vh] sm:max-h-[90vh] my-auto'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
            isDarkMode ? 'bg-slate-800/80 border-slate-800' : 'bg-sky-50/80 border-sky-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0"></div>
            <div>
              <h3 className={`text-sm sm:text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {`กำลังเปิดสแกน: ${courseCodeStr} - สัปดาห์ที่ ${session.weekNumber}`}
              </h3>
              <p className={`text-[11px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {isStaticQr
                  ? '📌 Static QR Code: รหัสคงที่ตลอดคลาส'
                  : '🔄 Dynamic QR Code: เปลี่ยนรหัสอัตโนมัติทุก 30 วินาที'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
              title="ย่อหน้าจอเพื่อเริ่มการสอน (นักศึกษายังคงเช็คอินด้วย GPS Only ได้โดยไม่ต้องเปิด QR ใหม่)"
            >
              <EyeOff className="w-3.5 h-3.5 text-sky-500" />
              <span>ย่อหน้าจอ (ให้ นศ. เช็คอินผ่าน GPS)</span>
            </button>

            <button
              onClick={onStopSession}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>ปิดระบบ</span>
            </button>
          </div>
        </div>

        {/* Modal Body Grid */}
        <div
          className={`p-4 sm:p-6 grid grid-cols-1 ${
            isQrEnlarged ? 'grid-cols-1' : 'md:grid-cols-2'
          } gap-4 sm:gap-6 items-start overflow-y-auto`}
        >
          {/* Dynamic / Static QR Code Canvas Display */}
          <div
            className={`relative flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border space-y-4 transition-all duration-300 ${
              isQrEnlarged ? 'w-full max-w-2xl mx-auto' : ''
            } ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Enlarge/Reduce QR Button in Top-Right Corner */}
            <button
              type="button"
              onClick={() => setIsQrEnlarged(!isQrEnlarged)}
              className={`absolute top-3 right-3 sm:top-4 sm:right-4 p-2 border rounded-xl transition-all duration-200 cursor-pointer shadow-xs ${
                isQrEnlarged
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30 ring-2 ring-amber-500/20'
                  : isDarkMode
                  ? 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-slate-50'
              }`}
              title={isQrEnlarged ? 'ย่อขนาด QR Code' : 'ขยายขนาด QR Code'}
            >
              {isQrEnlarged ? (
                <ZoomOut className="w-4.5 h-4.5 text-amber-500" />
              ) : (
                <ZoomIn className="w-4.5 h-4.5 text-sky-500" />
              )}
            </button>

            {/* Minimal Segment Toggle Switch */}
            <div className="flex flex-col items-center justify-center w-full space-y-2">
              <div
                className={`inline-flex items-center p-1 border rounded-xl shadow-inner text-xs font-bold space-x-1 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/80 border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleStaticQr(false)}
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
                  onClick={() => onToggleStaticQr(true)}
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
            </div>

            <div
              onClick={() => setIsQrEnlarged(!isQrEnlarged)}
              title="คลิกเพื่อขยาย / ย่อขนาด QR Code"
              className={`relative p-3 sm:p-5 bg-white rounded-2xl shadow-xl border cursor-pointer transition-all duration-300 group ${
                isQrEnlarged
                  ? 'border-sky-500/60 shadow-2xl ring-4 ring-sky-500/20 p-6 sm:p-8'
                  : 'border-slate-100 hover:border-sky-300'
              }`}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Attendance QR Code"
                  className={`object-contain transition-all duration-300 ${
                    isQrEnlarged
                      ? 'w-72 h-72 sm:w-[380px] sm:h-[380px] md:w-[460px] md:h-[460px]'
                      : 'w-48 h-48 sm:w-60 sm:h-60'
                  }`}
                />
              ) : (
                <div
                  className={`flex items-center justify-center text-slate-500 text-xs ${
                    isQrEnlarged ? 'w-72 h-72 sm:w-[380px] sm:h-[380px]' : 'w-48 h-48 sm:w-60 sm:h-60'
                  }`}
                >
                  กำลังสร้าง QR Code...
                </div>
              )}

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-md pointer-events-none">
                {isQrEnlarged ? '🔍 คลิกเพื่อย่อขนาด' : '🔍 คลิกเพื่อขยายใหญ่'}
              </div>

              {isStaticQr ? (
                <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-sky-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                  <Lock className="w-3 h-3" />
                  <span>Static</span>
                </div>
              ) : (
                <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                  <span>Dynamic {qrInterval}s</span>
                </div>
              )}
            </div>

            {/* 6-Character Token Display */}
            <div
              className={`w-full border rounded-2xl p-3 text-center space-y-1 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 ${
                  isDarkMode ? 'text-sky-400' : 'text-sky-600'
                }`}
              >
                <span>🔑 รหัส Token 6 ตัวอักษร (สำหรับป้อนด้วยตนเอง):</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <span
                  className={`font-mono text-xl sm:text-2xl font-black tracking-widest ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                >
                  {qrToken || '------'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className={`p-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1 cursor-pointer transition ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                  title="คัดลอกรหัส 6 หลัก"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedToken ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                </button>
              </div>
            </div>

            {/* Timer Bar or Static Notice */}
            {isStaticQr ? (
              <div
                className={`w-full p-2 rounded-xl border text-xs flex items-center justify-center space-x-1.5 ${
                  isDarkMode
                    ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                    : 'bg-sky-50 border-sky-200 text-sky-800'
                }`}
              >
                <Lock className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                <span className={`text-[11px] font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                  โหมด Static: รหัสคงที่ตลอดคลาส
                </span>
              </div>
            ) : (
              <div className="w-full space-y-2">
                <div className="w-full space-y-1">
                  <div
                    className={`flex items-center justify-between text-[11px] font-bold ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                      <span>รีเฟรชรหัสถัดไปในอีก:</span>
                    </span>
                    <span className="font-mono text-emerald-500 font-extrabold">{qrCountdown} วินาที</span>
                  </div>
                  <div
                    className={`w-full h-2 rounded-full overflow-hidden ${
                      isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className="h-full bg-sky-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.min(100, Math.max(0, (qrCountdown / qrInterval) * 100))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Dynamic Refresh Interval Selector underneath countdown bar */}
                <div className="flex flex-col items-center justify-center space-y-1 w-full pt-1">
                  <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    ⏱️ เลือกรอบเวลารีเฟรช Dynamic QR:
                  </span>
                  <div
                    className={`inline-flex items-center p-1 border rounded-xl space-x-1 ${
                      isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-200/70 border-slate-300'
                    }`}
                  >
                    {[10, 15, 30, 60, 120].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onUpdateQrInterval(sec)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 cursor-pointer ${
                          qrInterval === sec
                            ? 'bg-emerald-600 text-white shadow-xs font-black'
                            : isDarkMode
                            ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/80'
                        }`}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* GPS Toggle Switch */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={onToggleGps}
                className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition ${
                  isGpsCheckEnabled
                    ? isDarkMode
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isDarkMode
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck
                    className={`w-4 h-4 ${
                      isGpsCheckEnabled
                        ? isDarkMode
                          ? 'text-emerald-400'
                          : 'text-emerald-600'
                        : isDarkMode
                        ? 'text-rose-400'
                        : 'text-rose-600'
                    }`}
                  />
                  <span>ตรวจสอบพิกัด GPS</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                    isGpsCheckEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {isGpsCheckEnabled ? '🟢 เปิดตรวจ GPS (Geofence 200m)' : '🔴 ปิดตรวจ GPS (QR อย่างเดียว)'}
                </span>
              </button>
            </div>

            {/* Duration & Late Threshold Controls */}
            <div
              className={`w-full space-y-2 pt-3 border-t ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div
                className={`text-[11px] font-extrabold flex items-center justify-between ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                <span>⏱️ กำหนดเวลาเปิดรับเช็คชื่อ &amp; เกณฑ์เข้าสาย:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    ระยะเวลาเปิดรับทั้งหมด:
                  </label>
                  <select
                    value={sessionDurationMinutes}
                    onChange={(e) =>
                      onUpdateDurationAndLate(Number(e.target.value), lateThresholdMinutes)
                    }
                    className={`w-full p-2 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none transition ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
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
                  <label
                    className={`block text-[10px] font-bold mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    เริ่มถือว่า "เข้าเรียนสาย" หลัง:
                  </label>
                  <select
                    value={lateThresholdMinutes}
                    onChange={(e) =>
                      onUpdateDurationAndLate(sessionDurationMinutes, Number(e.target.value))
                    }
                    className={`w-full p-2 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none transition ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value={5}>5 นาทีแรก</option>
                    <option value={10}>10 นาทีแรก</option>
                    <option value={15}>15 นาทีแรก (มาตรฐาน)</option>
                    <option value={20}>20 นาทีแรก</option>
                    <option value={30}>30 นาทีแรก</option>
                  </select>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border text-[10px] space-y-1 ${
                  isDarkMode
                    ? 'bg-sky-950/60 border-sky-800/80 text-sky-200'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                <p className={`font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                  💡 การนับสถานะสำหรับผู้มาสาย:
                </p>
                <p>
                  • <b>0 ถึง {lateThresholdMinutes} นาที:</b> ลงบันทึก{' '}
                  <span className={isDarkMode ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold'}>
                    🟢 ตรงเวลา (PRESENT)
                  </span>
                </p>
                <p>
                  • <b>{lateThresholdMinutes} ถึง {sessionDurationMinutes} นาที:</b> ลงบันทึก{' '}
                  <span className={isDarkMode ? 'text-amber-400 font-bold' : 'text-amber-600 font-bold'}>
                    🟡 มาสาย (LATE)
                  </span>{' '}
                  อัตโนมัติ
                </p>
                <p>
                  • <b>เกิน {sessionDurationMinutes} นาที:</b> หมดเวลาเช็คชื่อ ถือว่า{' '}
                  <span className={isDarkMode ? 'text-rose-400 font-bold' : 'text-rose-600 font-bold'}>
                    🔴 ขาดเรียน (ABSENT)
                  </span>
                </p>
                <p className={`italic mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  อาจารย์สามารถย่อหน้าจอนี้ไปเริ่มสอนได้ทันที นักศึกษาที่มาสายจะกดเช็คชื่อด้วย GPS Only ในห้องเรียนได้เอง
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Student Check-in Live Stream (WebSockets) */}
          <div className="space-y-4 h-full flex flex-col justify-between">
            <div>
              <div
                className={`flex items-center justify-between pb-2 border-b ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <h4
                  className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>รายชื่อนักศึกษาที่สแกนแล้ว (Real-time Stream)</span>
                </h4>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                  เช็คชื่อแล้ว {liveCheckins.length} คน
                </span>
              </div>

              <div className="mt-3 space-y-2 max-h-48 sm:max-h-64 overflow-y-auto pr-1">
                {liveCheckins.length === 0 ? (
                  <div className={`text-center py-8 sm:py-12 text-xs space-y-2 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <Clock className="w-8 h-8 text-slate-400 mx-auto animate-bounce" />
                    <p>กำลังรอการสแกนจากนักศึกษา...</p>
                  </div>
                ) : (
                  liveCheckins.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3 border rounded-xl flex items-center justify-between transition ${
                        isDarkMode
                          ? 'bg-slate-800/80 border-slate-700/80'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <div
                          className={`text-xs font-bold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {rec.studentNameTh}
                        </div>
                        <div
                          className={`text-[10px] font-mono ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          รหัส: {rec.studentUniversityId} • เวลา:{' '}
                          {new Date(rec.timestamp).toLocaleTimeString('th-TH')}
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
            <div
              className={`pt-3 border-t ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <a
                href={course ? `/api/export-csv/${course.id}` : '#'}
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
  );
};
