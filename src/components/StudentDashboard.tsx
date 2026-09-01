import React, { useState, useEffect } from 'react';
import { User, AttendanceRecord, Course, Session } from '../types';
import { fetchStudentStats, fetchActiveSessions } from '../services/api';
import { QrCode, Camera, AlertTriangle, MapPin, Clock, Award, ChevronRight, RefreshCw, X, Sparkles, Plus, FileText, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { StudentLeaveModal } from './StudentLeaveModal';
import { StudentCheckinModal } from './StudentCheckinModal';
import { useTheme } from '../context/ThemeContext';
import { formatBangkokDateTime, formatBangkokDateThai } from '../utils/dateHelper';

interface StudentDashboardProps {
  student: User;
  onOpenJoinCourse: () => void;
  isDarkMode?: boolean;
}

interface StudentCourseItem {
  course: Course;
  stats: {
    totalSessions: number;
    conductedSessions: number;
    attendedSessions: number;
    approvedLeaveSessions?: number;
    lateSessions: number;
    absentSessions: number;
    percentage: number;
    statusColor: 'GREEN' | 'YELLOW' | 'RED';
    maxAllowedAbsences: number;
    remainingAbsenceQuota: number;
    statusText?: string;
    examEligibilityStatus?: 'ELIGIBLE' | 'WARNING' | 'INELIGIBLE';
  };
  pastCheckins: AttendanceRecord[];
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, onOpenJoinCourse, isDarkMode: propIsDarkMode }) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [coursesStats, setCoursesStats] = useState<StudentCourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourseHistory, setSelectedCourseHistory] = useState<StudentCourseItem | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [activeSessionsList, setActiveSessionsList] = useState<Array<{ session: Session; course?: Course }>>([]);

  const loadActiveSessions = async () => {
    try {
      const data = await fetchActiveSessions();
      setActiveSessionsList(data);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
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
  }, [student.id]);

  // Auto-open checkin modal if user scanned QR code via mobile phone camera
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pending_qr_checkin');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.rawToken) {
          loadActiveSessions();
          setIsScannerOpen(true);
        }
      }
    } catch (e) {
      console.error('Failed to trigger auto checkin from pending QR:', e);
    }
  }, []);

  const openCheckinModal = () => {
    loadActiveSessions();
    setIsScannerOpen(true);
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
          <div className="space-y-2 text-left">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-sky-300'
                : 'bg-sky-100 border-sky-200 text-sky-900'
            }`}>
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Student Console</span>
            </div>
            <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              สวัสดี, {student.title} {student.firstNameTh} {student.lastNameTh}
            </h1>
            <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              รหัสนักศึกษา: <span className="font-mono text-sky-600 dark:text-sky-300 font-black">{student.universityId}</span> | {student.email}
            </p>
          </div>

          {/* Action Buttons in Welcome Banner */}
          <div className="flex flex-col items-stretch gap-3 w-full md:w-auto md:ml-auto shrink-0">
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-start space-x-3 shadow-md shadow-amber-500/20 active:scale-95 transition border border-amber-500/30 w-full cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black leading-none">แจ้งลาเรียน</div>
                <div className="text-[10px] opacity-90 font-medium mt-0.5">ยื่นใบลาป่วย / ลากิจส่งอาจารย์</div>
              </div>
            </button>

            <button
              onClick={onOpenJoinCourse}
              className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center justify-start space-x-3 shadow-md shadow-sky-500/20 active:scale-95 transition border border-sky-500/30 w-full cursor-pointer"
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
              onClick={openCheckinModal}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-start space-x-3 shadow-md shadow-blue-500/20 active:scale-95 transition border border-blue-500/30 w-full cursor-pointer"
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
                      อาจารย์ผู้สอน: {item.course.coordinatorName || '-'}
                    </p>
                  </div>

                  {/* Attendance Percentage Badge */}
                  <div className="text-right flex flex-col items-end">
                    <div
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-sm font-black font-mono shadow-sm ${
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
                    <span className="text-[10px] text-slate-400 mt-1 font-medium">
                      {item.stats.conductedSessions === 0 
                        ? 'ยังไม่เริ่มสอน (100%)' 
                        : `จาก ${item.stats.conductedSessions} คาบที่เปิดสอน`}
                    </span>
                  </div>
                </div>

                {/* Progress bar & Quota Information */}
                <div className="space-y-1.5">
                  <div className={`flex justify-between text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>
                      เข้าเรียน: <strong className="text-sky-600 dark:text-sky-400">{item.stats.attendedSessions}</strong>/{item.stats.conductedSessions} คาบที่สอนแล้ว (ทั้งหมด {item.stats.totalSessions} คาบ)
                    </span>
                    <span className={`font-bold ${
                      item.stats.statusColor === 'GREEN' 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : item.stats.statusColor === 'YELLOW' 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {item.stats.statusText || (item.stats.percentage >= 80 ? 'มีสิทธิ์สอบปกติ' : 'เสี่ยงหมดสิทธิ์สอบ')}
                    </span>
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
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      โควตาขาดเรียน: ขาดได้อีก <strong className={item.stats.remainingAbsenceQuota <= 1 ? 'text-amber-500 font-bold' : 'text-slate-600 dark:text-slate-300 font-bold'}>{item.stats.remainingAbsenceQuota}</strong> ครั้ง (ขาดไปแล้ว {item.stats.absentSessions}/{item.stats.maxAllowedAbsences} ครั้ง)
                    </span>
                    {item.stats.approvedLeaveSessions ? (
                      <span className="text-amber-500 font-medium">มีใบลา {item.stats.approvedLeaveSessions} คาบ</span>
                    ) : null}
                  </div>
                </div>

                {/* History Trigger button */}
                <div className={`pt-3 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={`text-xs flex items-center space-x-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>เช็คชื่อล่าสุด: {item.pastCheckins.length > 0 ? formatBangkokDateThai(item.pastCheckins[item.pastCheckins.length - 1].timestamp) : 'ยังไม่มีประวัติ'}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className={`border rounded-2xl w-full max-w-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[88vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-mono font-black">
                  {selectedCourseHistory.course.courseCode}
                </span>
                <div>
                  <h3 className={`text-sm sm:text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    ประวัติการเช็คชื่อ
                  </h3>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{selectedCourseHistory.course.courseName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCourseHistory(null)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {selectedCourseHistory.pastCheckins.length === 0 ? (
                <div className={`p-8 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <p className="text-xs font-semibold">ยังไม่มีประวัติการเช็คชื่อในวิชานี้</p>
                </div>
              ) : (
                selectedCourseHistory.pastCheckins.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3.5 border rounded-2xl flex items-center justify-between transition ${
                      isDarkMode ? 'bg-slate-950/60 border-slate-800 hover:border-sky-500/30' : 'bg-slate-50 border-slate-200 hover:border-sky-500/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>เช็คชื่อสำเร็จ (PRESENT)</span>
                      </div>
                      <p className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatBangkokDateTime(rec.timestamp)}
                      </p>
                    </div>
                    <div className="text-right text-[11px] space-y-0.5">
                      <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold">
                        <MapPin className="w-3 h-3" />
                        <span>ระยะห่าง: {rec.distanceMeters} เมตร</span>
                      </div>
                      <div className="text-slate-400 text-[10px] font-semibold">Anti-Proxy Verified</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCourseHistory(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-md shadow-sky-600/20 active:scale-95 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Check-in Modal */}
      <StudentCheckinModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        student={student}
        activeSessionsList={activeSessionsList}
        isDarkMode={isDarkMode}
        onCheckinSuccess={() => {
          loadStats();
        }}
      />
      {/* Student Leave Modal */}
      <StudentLeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        student={student}
        courses={coursesStats.map((c) => c.course)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
