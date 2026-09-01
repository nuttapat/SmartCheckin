import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  ShieldCheck,
  User as UserIcon,
  BookOpen,
  Calendar,
  Sparkles,
  RefreshCw,
  X,
  Smartphone,
  Check,
} from 'lucide-react';
import { formatBangkokDateTime } from '../utils/dateHelper';

export interface CheckinResultData {
  success: boolean;
  isDuplicate?: boolean;
  status?: 'PRESENT' | 'LATE' | 'FAILED' | 'DUPLICATE' | 'EXPIRED' | 'OUT_OF_BOUNDS';
  title?: string;
  message?: string;
  error?: string;
  courseCode?: string;
  courseName?: string;
  weekNumber?: number;
  sessionTopic?: string;
  timestamp?: string | Date;
  userName?: string;
  userUniversityId?: string;
  userRole?: 'STUDENT' | 'TEACHER';
  distanceMeters?: number;
  allowedRadius?: number;
  checkinMethod?: string;
  deviceName?: string;
  lateMinutes?: number;
}

interface CheckinResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CheckinResultData | null;
  onRetry?: () => void;
  isDarkMode?: boolean;
}

export const CheckinResultModal: React.FC<CheckinResultModalProps> = ({
  isOpen,
  onClose,
  result,
  onRetry,
  isDarkMode = false,
}) => {
  if (!isOpen || !result) return null;

  const isSuccess = result.success;
  const isDuplicate = result.isDuplicate || result.status === 'DUPLICATE' || result.error?.includes('คุณได้เช็คชื่อในคาบนี้ไปแล้ว');
  const isLate = result.status === 'LATE' || (result.message && result.message.includes('สาย'));

  // Trigger haptic vibration on modern mobile browsers
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (isSuccess) {
          navigator.vibrate([60, 50, 100]);
        } else {
          navigator.vibrate([100, 80, 100]);
        }
      } catch (e) {}
    }
  }, [isSuccess]);

  // Determine Main Theme Tone
  let tone: 'emerald' | 'amber' | 'sky' | 'rose' = 'emerald';
  if (!isSuccess && !isDuplicate) {
    tone = 'rose';
  } else if (isDuplicate) {
    tone = 'sky';
  } else if (isLate) {
    tone = 'amber';
  } else {
    tone = 'emerald';
  }

  const titleText =
    result.title ||
    (isDuplicate
      ? 'คุณได้เช็คชื่อในคาบนี้ไปแล้ว'
      : isSuccess
      ? isLate
        ? result.userRole === 'TEACHER'
          ? 'บันทึกเวลาเข้าสอนเรียบร้อย (เข้าสอนสาย)'
          : 'เช็คชื่อเข้าเรียนสำเร็จ (เข้าเรียนสาย)'
        : result.userRole === 'TEACHER'
        ? 'บันทึกเวลาเข้าสอนสำเร็จ!'
        : 'เช็คชื่อเข้าเรียนสำเร็จ!'
      : 'ไม่สามารถเช็คชื่อได้');

  const subtitleText =
    result.message ||
    (isDuplicate
      ? 'ระบบมีประวัติการเข้าเรียนของคุณในคาบเรียนนี้แล้ว ข้อมูลถูกต้องสมบูรณ์'
      : isSuccess
      ? isLate
        ? `ระบบได้บันทึกเวลาเข้าเรียนแล้ว (สถานะ: เข้าเรียนสาย)`
        : 'ระบบได้บันทึกเวลาเข้าเรียนของคุณเรียบร้อยแล้ว'
      : result.error || 'กรุณาตรวจสอบเงื่อนไขและลองใหม่อีกครั้ง');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 transform scale-100 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Decorative Accent Bar */}
        <div
          className={`h-2.5 w-full ${
            tone === 'emerald'
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400'
              : tone === 'amber'
              ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400'
              : tone === 'sky'
              ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-400'
              : 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-400'
          }`}
        />

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition cursor-pointer ${
            isDarkMode
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
          }`}
          title="ปิดหน้าต่าง"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6 text-center">
          {/* Main Visual Status Icon */}
          <div className="flex justify-center">
            {isSuccess && !isLate && (
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
                  <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 text-white rounded-full shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            )}

            {isSuccess && isLate && (
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xl shadow-amber-500/10">
                  <Clock className="w-12 h-12 stroke-[2.5]" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-amber-600 text-white rounded-full shadow-md">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            )}

            {isDuplicate && (
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-sky-500/15 border-2 border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-xl shadow-sky-500/10">
                  <ShieldCheck className="w-12 h-12 stroke-[2.5]" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-sky-600 text-white rounded-full shadow-md">
                  <Check className="w-4 h-4" />
                </div>
              </div>
            )}

            {!isSuccess && !isDuplicate && (
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xl shadow-rose-500/10">
                  <XCircle className="w-12 h-12 stroke-[2.5]" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-rose-600 text-white rounded-full shadow-md">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase border">
              {isSuccess && !isLate && (
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>ตรงเวลา (PRESENT)</span>
                </span>
              )}
              {isSuccess && isLate && (
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                  <span>มาสาย (LATE)</span>
                </span>
              )}
              {isDuplicate && (
                <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <Check className="w-3 h-3 text-sky-500 inline-block" />
                  <span>บันทึกแล้ว (RECORDED)</span>
                </span>
              )}
              {!isSuccess && !isDuplicate && (
                <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  <span>ไม่สำเร็จ (FAILED)</span>
                </span>
              )}
            </div>

            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {titleText}
            </h2>

            <p className={`text-sm leading-relaxed px-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {subtitleText}
            </p>
          </div>

          {/* Details Summary Card */}
          <div
            className={`text-left rounded-2xl border p-4 sm:p-5 space-y-3 ${
              isDarkMode
                ? 'bg-slate-950/80 border-slate-800 divide-y divide-slate-800/80'
                : 'bg-slate-50 border-slate-200 divide-y divide-slate-200/80'
            }`}
          >
            {/* Course & Session Info */}
            {(result.courseCode || result.courseName) && (
              <div className="pb-3 flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-xs">
                      {result.courseCode}
                    </span>
                    {typeof result.weekNumber === 'number' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        สัปดาห์ที่ {result.weekNumber}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-bold truncate mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {result.courseName}
                  </div>
                  {result.sessionTopic && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      หัวข้อ: {result.sessionTopic}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Student / Teacher Info */}
            {(result.userName || result.userUniversityId) && (
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 font-medium">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>ผู้เช็คชื่อ:</span>
                </span>
                <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {result.userName} {result.userUniversityId && `(${result.userUniversityId})`}
                </span>
              </div>
            )}

            {/* Timestamp */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>เวลาที่บันทึก:</span>
              </span>
              <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {formatBangkokDateTime(result.timestamp || new Date())}
              </span>
            </div>

            {/* GPS Distance info if available */}
            {typeof result.distanceMeters === 'number' && (
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>ระยะห่างจากห้องเรียน:</span>
                </span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${
                    result.distanceMeters <= (result.allowedRadius || 200)
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {result.distanceMeters} เมตร {result.allowedRadius ? `(เกณฑ์ ≤ ${result.allowedRadius} ม.)` : ''}
                </span>
              </div>
            )}

            {/* Verification Method & Device */}
            {(result.checkinMethod || result.deviceName) && (
              <div className="pt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>วิธี / อุปกรณ์:</span>
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[200px]">
                  {result.checkinMethod || 'QR Code + GPS'} {result.deviceName ? `(${result.deviceName})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 justify-center">
            {!isSuccess && !isDuplicate && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ลองใหม่อีกครั้ง</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`w-full ${
                !isSuccess && !isDuplicate && onRetry ? 'sm:w-1/2' : 'sm:w-full'
              } py-3.5 px-6 rounded-2xl font-extrabold text-sm transition shadow-lg active:scale-95 flex items-center justify-center space-x-2 cursor-pointer ${
                tone === 'emerald'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25'
                  : tone === 'amber'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25'
                  : tone === 'sky'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSuccess || isDuplicate ? 'รับทราบ / ปิดหน้าต่าง' : 'ปิดหน้าต่าง'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
