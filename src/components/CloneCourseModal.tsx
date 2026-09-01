import React, { useState } from 'react';
import { Course, Semester } from '../types';
import { cloneCourseStructure } from '../services/api';
import {
  X,
  Copy,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Users,
  Clock,
  ArrowRight,
  BookOpen,
  MapPin,
  AlertCircle
} from 'lucide-react';

interface CloneCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  teacherId: string;
  isDarkMode?: boolean;
  onSuccess: (newCourse: Course) => void;
}

export const CloneCourseModal: React.FC<CloneCourseModalProps> = ({
  isOpen,
  onClose,
  course,
  teacherId,
  isDarkMode,
  onSuccess,
}) => {
  // Default new academic year to next year or current + 1
  const defaultYear = course.academicYear ? Number(course.academicYear) + 1 : 2570;
  
  const [academicYear, setAcademicYear] = useState<number>(defaultYear);
  const [semester, setSemester] = useState<Semester>(course.semester || Semester.FIRST);
  const [courseCode, setCourseCode] = useState<string>(course.courseCode || '');
  const [courseName, setCourseName] = useState<string>(course.courseName || '');
  const [startDate, setStartDate] = useState<string>('');
  const [includeCoTeachers, setIncludeCoTeachers] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen || !course) return null;

  const totalWeeks = course.weeks?.length || 0;

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim()) {
      setErrorMessage('กรุณาระบุรหัสวิชา');
      return;
    }
    if (!courseName.trim()) {
      setErrorMessage('กรุณาระบุชื่อวิชา');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await cloneCourseStructure(course.id, {
        teacherId,
        academicYear: Number(academicYear) || defaultYear,
        semester,
        newCourseCode: courseCode.trim().toUpperCase(),
        newCourseName: courseName.trim(),
        startDate: startDate || undefined,
        includeCoTeachers,
      });

      if (res && res.course) {
        onSuccess(res.course);
        onClose();
      } else {
        setErrorMessage('ไม่สามารถคัดลอกรายวิชาได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      console.error('Clone course failed:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการคัดลอกโครงสร้างรายวิชา');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full max-w-xl rounded-2xl border shadow-2xl transition-all my-8 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-5 sm:p-6 border-b ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>คัดลอกโครงสร้างรายวิชา</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Semester Rollover
                </span>
              </h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                นำโครงสร้างคาบเรียนและพิกัดเดิมไปเปิดสอนในเทอม/ปีการศึกษาใหม่
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition ${
              isDarkMode
                ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Course Reference Card */}
        <div className="p-5 sm:p-6 pb-2 space-y-4">
          <div
            className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sky-500" />
              <span>รายวิชาต้นแบบ (Source Template)</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-sm font-black text-sky-600 dark:text-sky-400 mr-2">
                  {course.courseCode}
                </span>
                <span className="text-xs font-bold">{course.courseName}</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                ปี {course.academicYear} / เทอม {course.semester} ({totalWeeks} สัปดาห์)
              </span>
            </div>
          </div>

          {/* Clean Slate & Isolation Guarantee Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div
              className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[11px]">ข้อมูลที่คัดลอกมาให้</p>
                <p className="text-[10px] opacity-90">หัวข้อคาบ {totalWeeks} สัปดาห์, พิกัด GPS, ระยะรัศมีเช็คชื่อ</p>
              </div>
            </div>
            <div
              className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                isDarkMode ? 'bg-sky-950/20 border-sky-800/40 text-sky-300' : 'bg-sky-50/80 border-sky-200 text-sky-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[11px]">แยกข้อมูลเด็ดขาด (Clean 100%)</p>
                <p className="text-[10px] opacity-90">รีเซ็ตนักศึกษา, การเช็คชื่อ, และใบลาเริ่มต้นใหม่ทั้งหมด</p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleClone} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Target Academic Year */}
              <div>
                <label className="block text-xs font-bold mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>ปีการศึกษาใหม่ *</span>
                </label>
                <input
                  type="number"
                  required
                  min={2560}
                  max={2600}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(Number(e.target.value))}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  placeholder="เช่น 2570"
                />
              </div>

              {/* Target Semester */}
              <div>
                <label className="block text-xs font-bold mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-500" />
                  <span>ภาคการศึกษาใหม่ *</span>
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as Semester)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value={Semester.FIRST}>ภาคเรียนที่ 1 (เทอม 1)</option>
                  <option value={Semester.SECOND}>ภาคเรียนที่ 2 (เทอม 2)</option>
                  <option value={Semester.SUMMER}>ภาคฤดูร้อน (Summer)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Course Code */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold mb-1.5">รหัสวิชา *</label>
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  placeholder="เช่น MTID204"
                />
              </div>

              {/* Course Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1.5">ชื่อรายวิชา *</label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  placeholder="ชื่อวิชาภาษาไทยหรืออังกฤษ"
                />
              </div>
            </div>

            {/* Start Date of Week 1 */}
            <div>
              <label className="block text-xs font-bold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  <span>วันเริ่มเรียนสัปดาห์ที่ 1 (ไม่บังคับ)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">ระบบจะคำนวณวันสอนสัปดาห์ถัดไปให้ทุก 7 วัน</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>

            {/* Include Co-teachers Checkbox */}
            <div
              onClick={() => setIncludeCoTeachers(!includeCoTeachers)}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                includeCoTeachers
                  ? isDarkMode
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                  : isDarkMode
                  ? 'bg-slate-800/40 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-sky-500" />
                <div>
                  <p className="text-xs font-bold">คัดลอกรายชื่ออาจารย์ผู้สอนร่วม (Co-teachers)</p>
                  <p className="text-[10px] opacity-80">
                    ดึงสิทธิ์อาจารย์ท่านอื่นในวิชาเดิมเข้ามาเป็นผู้สอนร่วมในวิชาใหม่โดยอัตโนมัติ
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeCoTeachers}
                onChange={() => {}}
                className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div
              className={`flex items-center justify-end space-x-3 pt-4 border-t ${
                isDarkMode ? 'border-slate-800' : 'border-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition ${
                  isDarkMode
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-sky-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังคัดลอก...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>สร้างรายวิชาใหม่จากโครงสร้างเดิม</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
