import React, { useState } from 'react';
import { Semester, TeachingWeek, Course } from '../types';
import { createCourse } from '../services/api';
import { X, Plus, Minus, BookOpen, Calendar, CheckCircle2 } from 'lucide-react';

interface TeacherCourseCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (course: Course) => void;
  ownerId: string;
  coordinatorDefault: string;
  isDarkMode?: boolean;
}

export const TeacherCourseCreationModal: React.FC<TeacherCourseCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ownerId,
  coordinatorDefault,
  isDarkMode = true,
}) => {
  const [courseCode, setCourseCode] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<number>(2569);
  const [semester, setSemester] = useState<Semester>(Semester.FIRST);
  const [coordinatorName, setCoordinatorName] = useState<string>(coordinatorDefault || '');

  // Dynamic Teaching Weeks state
  const [weeks, setWeeks] = useState<TeachingWeek[]>([
    { weekNumber: 1, topic: 'สัปดาห์ที่ 1: ปฐมนิเทศ และภาพรวมรายวิชา', date: '2026-08-01' },
    { weekNumber: 2, topic: 'สัปดาห์ที่ 2: สถาปัตยกรรมซอฟต์แวร์และการออกแบบ API', date: '2026-08-08' },
    { weekNumber: 3, topic: 'สัปดาห์ที่ 3: ระบบเช็คชื่อแบบเรียลไทม์ และ Dynamic QR Code', date: '2026-08-15' },
    { weekNumber: 4, topic: 'สัปดาห์ที่ 4: การป้องกันการทุจริตและการตรวจสอบพิกัด Geofence', date: '2026-08-22' },
  ]);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAddWeek = () => {
    const nextNum = weeks.length + 1;
    setWeeks([
      ...weeks,
      {
        weekNumber: nextNum,
        topic: `สัปดาห์ที่ ${nextNum}: หัวข้อการเรียนรู้`,
        date: new Date(Date.now() + nextNum * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    ]);
  };

  const handleRemoveWeek = (index: number) => {
    if (weeks.length <= 1) return;
    const updated = weeks.filter((_, i) => i !== index).map((w, idx) => ({ ...w, weekNumber: idx + 1 }));
    setWeeks(updated);
  };

  const handleWeekTopicChange = (index: number, topic: string) => {
    const updated = [...weeks];
    updated[index].topic = topic;
    setWeeks(updated);
  };

  const handleWeekDateChange = (index: number, date: string) => {
    const updated = [...weeks];
    updated[index].date = date;
    setWeeks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) {
      setErrorMsg('กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }

    try {
      setLoading(true);
      const res = await createCourse({
        courseCode: courseCode.trim().toUpperCase(),
        courseName: courseName.trim(),
        academicYear,
        semester,
        coordinatorName: coordinatorName || coordinatorDefault,
        ownerId,
        weeks,
      });

      onSuccess(res.course);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Modal Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-sky-50/70 border-sky-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>สร้างรายวิชาใหม่ (Create New Course)</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>กำหนดรายละเอียดวิชาและสัปดาห์การสอน (Teaching Sessions)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Basic Course Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสวิชา (Course Code)
              </label>
              <input
                type="text"
                placeholder="เช่น MTID204"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 uppercase font-mono ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ชื่อรายวิชา (Course Name)
              </label>
              <input
                type="text"
                placeholder="เช่น Software Architecture & System Design"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ปีการศึกษา (พ.ศ.)
              </label>
              <input
                type="number"
                value={academicYear}
                onChange={(e) => setAcademicYear(parseInt(e.target.value, 10))}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ภาคการศึกษา (Semester)
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as Semester)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value={Semester.FIRST}>ภาคเรียนที่ 1 (First Semester)</option>
                <option value={Semester.SECOND}>ภาคเรียนที่ 2 (Second Semester)</option>
                <option value={Semester.SUMMER}>ภาคฤดูร้อน (Summer)</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                อาจารย์ผู้รับผิดชอบรายวิชา
              </label>
              <input
                type="text"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Dynamic Session Weeks Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                  isDarkMode ? 'text-sky-400' : 'text-sky-600'
                }`}>
                  <Calendar className="w-4 h-4" />
                  <span>กำหนดสัปดาห์การเรียนการสอน (Dynamic Teaching Weeks)</span>
                </h3>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  เพิ่มหรือลดสัปดาห์สอนด้วยปุ่ม [+] และ [-] เพื่อสร้างสถิติการเข้าเรียน
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddWeek}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสัปดาห์ [+]</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {weeks.map((w, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-2 p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="w-16 text-center text-xs font-bold text-teal-600 dark:text-teal-300 bg-teal-500/10 py-1 rounded-lg border border-teal-500/20 shrink-0 font-mono">
                    สัปดาห์ {w.weekNumber}
                  </span>
                  <input
                    type="text"
                    value={w.topic}
                    onChange={(e) => handleWeekTopicChange(index, e.target.value)}
                    placeholder="หัวข้อการเรียนการสอน..."
                    className={`flex-grow border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <input
                    type="date"
                    value={w.date}
                    onChange={(e) => handleWeekDateChange(index, e.target.value)}
                    className={`w-32 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500 shrink-0 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveWeek(index)}
                    disabled={weeks.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition shrink-0"
                    title="ลบสัปดาห์นี้ [-]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className={`pt-3 flex items-center justify-end space-x-3 border-t ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center space-x-1.5 transition shadow-md shadow-sky-600/20 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <span>กำลังสร้างคอร์ส...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันการสร้างรายวิชา</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
