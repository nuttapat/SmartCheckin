import React, { useState, useEffect } from 'react';
import { Course, TeachingWeek, Semester } from '../types';
import { updateCourse } from '../services/api';
import { X, BookOpen, Plus, Trash2, Calendar, Save, CheckCircle2, MapPin, Globe } from 'lucide-react';
import { MapPicker } from './MapPicker';
import { DeleteCourseConfirmModal } from './DeleteCourseConfirmModal';

interface TeacherCourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onSuccess: (updatedCourse: Course) => void;
  onDeleteSuccess?: (courseId: string) => void;
  teacherId?: string;
  isDarkMode?: boolean;
}

export const TeacherCourseEditModal: React.FC<TeacherCourseEditModalProps> = ({
  isOpen,
  onClose,
  course,
  onSuccess,
  onDeleteSuccess,
  teacherId,
  isDarkMode = true,
}) => {
  const [courseCode, setCourseCode] = useState<string>(course.courseCode);
  const [courseName, setCourseName] = useState<string>(course.courseName);
  const [academicYear, setAcademicYear] = useState<number>(course.academicYear);
  const [semester, setSemester] = useState<Semester>(course.semester);
  const [coordinatorName, setCoordinatorName] = useState<string>(course.coordinatorName);
  const [defaultLat, setDefaultLat] = useState<number>(course.defaultLat || 13.7988363);
  const [defaultLng, setDefaultLng] = useState<number>(course.defaultLng || 100.322944);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);
  const [weeks, setWeeks] = useState<TeachingWeek[]>(course.weeks || []);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setCourseCode(course.courseCode);
    setCourseName(course.courseName);
    setAcademicYear(course.academicYear);
    setSemester(course.semester);
    setCoordinatorName(course.coordinatorName);
    setDefaultLat(course.defaultLat || 13.7988363);
    setDefaultLng(course.defaultLng || 100.322944);
    setWeeks(course.weeks ? [...course.weeks] : []);
    setErrorMsg('');
    setSuccessMsg('');
  }, [course]);

  if (!isOpen) return null;

  const handleAddWeek = () => {
    const nextWeekNum = weeks.length > 0 ? Math.max(...weeks.map((w) => w.weekNumber)) + 1 : 1;
    const todayStr = new Date().toISOString().split('T')[0];
    setWeeks((prev) => [
      ...prev,
      {
        weekNumber: nextWeekNum,
        topic: `หัวข้อการสอนสัปดาห์ที่ ${nextWeekNum}`,
        date: todayStr,
      },
    ]);
  };

  const handleRemoveWeek = (weekNumber: number) => {
    if (weeks.length <= 1) {
      setErrorMsg('ต้องมีสัปดาห์การสอนอย่างน้อย 1 สัปดาห์');
      return;
    }
    setErrorMsg('');
    const filtered = weeks.filter((w) => w.weekNumber !== weekNumber);
    // Re-index week numbers sequentially
    const reindexed = filtered.map((w, index) => ({
      ...w,
      weekNumber: index + 1,
    }));
    setWeeks(reindexed);
  };

  const handleWeekChange = (index: number, field: keyof TeachingWeek, value: string | number) => {
    setWeeks((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!courseCode.trim() || !courseName.trim()) {
      setErrorMsg('กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      const res = await updateCourse(course.id, {
        courseCode,
        courseName,
        academicYear,
        semester,
        coordinatorName,
        defaultLat,
        defaultLng,
        weeks,
      });

      setSuccessMsg('บันทึกการแก้ไขรายวิชาเรียบร้อยแล้ว!');
      setTimeout(() => {
        onSuccess(res.course);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการอัปเดตวิชา');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div
        className={`border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-sky-50/70 border-sky-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                แก้ไขรายวิชา &amp; จัดการสัปดาห์สอน
              </h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                แก้ไขข้อมูลวิชา เพิ่ม หรือลดจำนวนสัปดาห์สำหรับการเช็คชื่อ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition shrink-0 ${
              isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Basic Course Details */}
          <div className="space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
              ข้อมูลทั่วไปของรายวิชา (General Information)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสวิชา (Course Code)
                </label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500 uppercase font-mono font-bold ${
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
                  onChange={(e) => setAcademicYear(parseInt(e.target.value, 10) || 2569)}
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
                  <option value={Semester.FIRST}>ภาคเรียนที่ 1</option>
                  <option value={Semester.SECOND}>ภาคเรียนที่ 2</option>
                  <option value={Semester.SUMMER}>ภาคฤดูร้อน (Summer)</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  อาจารย์ผู้รับผิดชอบวิชา
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
          </div>

          {/* Teaching Weeks Management */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                กำหนดสัปดาห์การสอน &amp; หัวข้อวิชา ({weeks.length} สัปดาห์)
              </h3>
              <button
                type="button"
                onClick={handleAddWeek}
                className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center space-x-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มสัปดาห์สอน</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {weeks.map((week, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 border rounded-2xl flex items-center gap-3 transition ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="shrink-0 w-16 text-center">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300 text-xs font-mono font-bold">
                      W{week.weekNumber}
                    </span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={week.topic}
                        onChange={(e) => handleWeekChange(idx, 'topic', e.target.value)}
                        placeholder="หัวข้อการสอน"
                        required
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="relative flex items-center">
                        <Calendar className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                        <input
                          type="date"
                          value={week.date}
                          onChange={(e) => handleWeekChange(idx, 'date', e.target.value)}
                          className={`w-full border rounded-xl pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveWeek(week.weekNumber)}
                    title="ลบสัปดาห์นี้"
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className={`flex items-center justify-between pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/25 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบรายวิชานี้</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white shadow-lg shadow-sky-500/20 flex items-center space-x-2 transition active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Course Confirmation Modal */}
      <DeleteCourseConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        course={course}
        teacherId={teacherId || ''}
        isDarkMode={isDarkMode}
        onSuccess={(deletedId) => {
          setIsDeleteModalOpen(false);
          onClose();
          if (onDeleteSuccess) {
            onDeleteSuccess(deletedId);
          }
        }}
      />
    </div>
  );
};
