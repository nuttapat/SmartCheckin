import React, { useState } from 'react';
import { Semester, TeachingWeek, Course } from '../types';
import { createCourse } from '../services/api';
import { X, Plus, Minus, BookOpen, Calendar, CheckCircle2, MapPin, Globe } from 'lucide-react';
import { MapPicker } from './MapPicker';
import { useTheme } from '../context/ThemeContext';

interface TeacherCourseCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (course: Course) => void;
  ownerId: string;
  coordinatorDefault: string;
  isDarkMode?: boolean;
}

// Helper function to calculate default current Academic Year (BE)
// Thai Academic Year starts Aug 1 (Month 8) to Jul 31 of next year
const getCurrentAcademicYear = (): number => {
  const now = new Date();
  const beYear = now.getFullYear() + 543;
  const month = now.getMonth() + 1; // 1 - 12
  return month >= 8 ? beYear : beYear - 1;
};

// Helper function to calculate default current Semester
// ภาคเรียนที่ 1: 1 ส.ค. - 31 ธ.ค. (8 - 12)
// ภาคเรียนที่ 2: 1 ม.ค. - 31 พ.ค. (1 - 5)
// ภาคฤดูร้อน: 1 มิ.ย. - 31 ก.ค. (6 - 7)
const getCurrentSemester = (): Semester => {
  const month = new Date().getMonth() + 1;
  if (month >= 8 && month <= 12) {
    return Semester.FIRST;
  } else if (month >= 1 && month <= 5) {
    return Semester.SECOND;
  } else {
    return Semester.SUMMER;
  }
};

export const TeacherCourseCreationModal: React.FC<TeacherCourseCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ownerId,
  coordinatorDefault,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [courseCode, setCourseCode] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<number>(getCurrentAcademicYear());
  const [semester, setSemester] = useState<Semester>(getCurrentSemester());
  const [coordinatorName, setCoordinatorName] = useState<string>(coordinatorDefault || '');

  // Course GPS default coordinates
  const [defaultLat, setDefaultLat] = useState<number>(13.7988363);
  const [defaultLng, setDefaultLng] = useState<number>(100.322944);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);

  // Dynamic Teaching Weeks state - default 1 week only with empty topic so placeholder shows
  const [weeks, setWeeks] = useState<TeachingWeek[]>([
    { weekNumber: 1, topic: '', date: new Date().toISOString().split('T')[0] },
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
        topic: '',
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
        defaultLat,
        defaultLng,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className={`border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Modal Header */}
        <div className={`px-5 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-sky-50/70 border-sky-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>สร้างรายวิชาใหม่ (Create New Course)</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>กำหนดรายละเอียดวิชาและสัปดาห์การสอน (Teaching Sessions)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition shrink-0 ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Basic Course Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสวิชา (Course Code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น MTID204"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 uppercase ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ชื่อรายวิชา (Course Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น Basic Data Management with Computer"
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

          {/* Course GPS Default Location */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ตำแหน่ง GPS ประจำห้องเรียนรายวิชานี้
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center space-x-1.5 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{showMapPicker ? 'ซ่อนแผนที่' : '📍 เลือกระบุพิกัดบน Maps'}</span>
              </button>
            </div>

            {/* Current Selected Location Indicator */}
            <div className={`px-3 py-2 rounded-xl text-xs flex items-center space-x-2 border ${
              isDarkMode ? 'bg-slate-900/90 border-slate-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
              <div className="truncate">
                <span className="font-bold">สถานที่อ้างอิง: </span>
                <span className="font-semibold">
                  {Math.abs(defaultLat - 13.7988363) < 0.0001 && Math.abs(defaultLng - 100.322944) < 0.0001
                    ? '📍 คณะเทคนิคการแพทย์ มหาวิทยาลัยมหิดล (ศาลายา)'
                    : Math.abs(defaultLat - 13.7578523) < 0.0001 && Math.abs(defaultLng - 100.4861744) < 0.0001
                    ? '📍 คณะเทคนิคการแพทย์ มหาวิทยาลัยมหิดล (ศิริราช)'
                    : `พิกัดระบุเอง (${defaultLat.toFixed(5)}, ${defaultLng.toFixed(5)})`}
                </span>
              </div>
            </div>

            {showMapPicker ? (
              <div className="pt-2 border-t border-slate-700/60">
                <MapPicker
                  initialLat={defaultLat}
                  initialLng={defaultLng}
                  isDarkMode={isDarkMode}
                  onSelectLocation={(l1, l2) => {
                    setDefaultLat(l1);
                    setDefaultLng(l2);
                    setShowMapPicker(false);
                  }}
                  onClose={() => setShowMapPicker(false)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Latitude (ละติจูด)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={defaultLat}
                    onChange={(e) => setDefaultLat(parseFloat(e.target.value) || 0)}
                    className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-300 text-blue-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Longitude (ลองจิจูด)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={defaultLng}
                    onChange={(e) => setDefaultLng(parseFloat(e.target.value) || 0)}
                    className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-300 text-blue-700'
                    }`}
                  />
                </div>
              </div>
            )}
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
                  <span className="w-16 text-center text-xs font-bold text-blue-600 dark:text-blue-300 bg-blue-500/10 py-1 rounded-lg border border-blue-500/20 shrink-0 font-mono">
                    สัปดาห์ {w.weekNumber}
                  </span>
                  <input
                    type="text"
                    value={w.topic}
                    onChange={(e) => handleWeekTopicChange(index, e.target.value)}
                    placeholder="เช่น Course orientation"
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
