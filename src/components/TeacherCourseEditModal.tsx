import React, { useState, useEffect } from 'react';
import { Course, TeachingWeek, Semester, User } from '../types';
import { updateCourse, fetchTeachers } from '../services/api';
import { X, BookOpen, Plus, Minus, Trash2, Calendar, Save, CheckCircle2, MapPin, Globe, Maximize2, Minimize2 } from 'lucide-react';
import { MapPicker } from './MapPicker';
import { DeleteCourseConfirmModal } from './DeleteCourseConfirmModal';
import { useTheme } from '../context/ThemeContext';
import { addOneWeekToDate } from '../utils/dateHelper';

interface TeacherCourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onSuccess: (updatedCourse: Course) => void;
  onDeleteSuccess?: (courseId: string) => void;
  teacherId?: string;
  teachersList?: User[];
  isAdmin?: boolean;
  isDarkMode?: boolean;
}

export const TeacherCourseEditModal: React.FC<TeacherCourseEditModalProps> = ({
  isOpen,
  onClose,
  course,
  onSuccess,
  onDeleteSuccess,
  teacherId,
  teachersList,
  isAdmin = false,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const actualCourse = (course as any)?.course || course;

  const [courseCode, setCourseCode] = useState<string>(actualCourse?.courseCode || '');
  const [courseName, setCourseName] = useState<string>(actualCourse?.courseName || '');
  const [academicYear, setAcademicYear] = useState<number>(actualCourse?.academicYear || 2569);
  const [semester, setSemester] = useState<Semester>(actualCourse?.semester || Semester.FIRST);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(actualCourse?.ownerId || '');
  const [coordinatorName, setCoordinatorName] = useState<string>(actualCourse?.coordinatorName || '');
  const [defaultLat, setDefaultLat] = useState<number>(actualCourse?.defaultLat || 13.7988363);
  const [defaultLng, setDefaultLng] = useState<number>(actualCourse?.defaultLng || 100.322944);
  const [allowedGpsRadius, setAllowedGpsRadius] = useState<number>(actualCourse?.allowedGpsRadius || 200);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);
  const [weeks, setWeeks] = useState<TeachingWeek[]>(actualCourse?.weeks || []);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [fetchedTeachers, setFetchedTeachers] = useState<User[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      if (!teachersList || teachersList.length === 0) {
        fetchTeachers()
          .then((data) => {
            if (isMounted && data) {
              setFetchedTeachers(data);
            }
          })
          .catch((err) => {
            console.error('Error fetching teachers for edit modal:', err);
          });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, teachersList]);

  const activeTeachers = (teachersList && teachersList.length > 0) ? teachersList : fetchedTeachers;

  useEffect(() => {
    if (isOpen && actualCourse) {
      setCourseCode(actualCourse.courseCode || '');
      setCourseName(actualCourse.courseName || '');
      setAcademicYear(actualCourse.academicYear || 2569);
      setSemester(actualCourse.semester || Semester.FIRST);
      setSelectedTeacherId(actualCourse.ownerId || '');
      setCoordinatorName(actualCourse.coordinatorName || '');
      setDefaultLat(actualCourse.defaultLat || 13.7988363);
      setDefaultLng(actualCourse.defaultLng || 100.322944);
      setAllowedGpsRadius(actualCourse.allowedGpsRadius || 200);
      setWeeks(actualCourse.weeks ? [...actualCourse.weeks] : []);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, actualCourse]);

  if (!isOpen) return null;

  const handleAddWeek = () => {
    const nextNum = weeks.length + 1;
    const lastWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;
    const nextDate = lastWeek && lastWeek.date ? addOneWeekToDate(lastWeek.date) : new Date().toISOString().split('T')[0];
    setWeeks([
      ...weeks,
      {
        weekNumber: nextNum,
        topic: '',
        date: nextDate,
      },
    ]);
  };

  const handleRemoveWeek = (index: number) => {
    if (weeks.length <= 1) {
      setErrorMsg('ต้องมีสัปดาห์การสอนอย่างน้อย 1 สัปดาห์');
      return;
    }
    setErrorMsg('');
    const updated = weeks.filter((_, i) => i !== index).map((w, idx) => ({ ...w, weekNumber: idx + 1 }));
    setWeeks(updated);
  };

  const handleWeekChange = (index: number, field: keyof TeachingWeek, value: string | number) => {
    setWeeks((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      if (field === 'date' && typeof value === 'string') {
        let currentDate = value;
        for (let i = index + 1; i < updated.length; i++) {
          currentDate = addOneWeekToDate(currentDate);
          updated[i].date = currentDate;
        }
      }

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
        ownerId: selectedTeacherId || course.ownerId,
        defaultLat,
        defaultLng,
        allowedGpsRadius,
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
        className={`border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
            : 'w-full max-w-2xl rounded-3xl max-h-[92vh] my-auto'
        } ${
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
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-2 rounded-xl transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              ข้อมูลทั่วไปของรายวิชา (GENERAL INFORMATION)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              {/* Row 1: Course Code (4 cols) & Course Name (8 cols) */}
              <div className="md:col-span-4">
                <label className={`block text-xs font-semibold mb-1 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสวิชา (Course Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  className={`w-full h-[38px] border rounded-xl px-3 text-xs focus:outline-none focus:border-sky-500 uppercase font-mono font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="md:col-span-8">
                <label className={`block text-xs font-semibold mb-1 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  ชื่อรายวิชา (Course Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  required
                  className={`w-full h-[38px] border rounded-xl px-3 text-xs focus:outline-none focus:border-sky-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Row 2: Academic Year (3 cols), Semester (3 cols), Creator/Coordinator (6 cols) */}
              <div className="md:col-span-3">
                <label className={`block text-xs font-semibold mb-1 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  ปีการศึกษา (พ.ศ.)
                </label>
                <input
                  type="number"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(parseInt(e.target.value, 10) || 2569)}
                  className={`w-full h-[38px] border rounded-xl px-3 text-xs focus:outline-none focus:border-sky-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="md:col-span-3">
                <label className={`block text-xs font-semibold mb-1 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  ภาคการศึกษา (Semester)
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as Semester)}
                  className={`w-full h-[38px] border rounded-xl px-3 text-xs focus:outline-none focus:border-sky-500 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={Semester.FIRST}>ภาคเรียนที่ 1</option>
                  <option value={Semester.SECOND}>ภาคเรียนที่ 2</option>
                  <option value={Semester.SUMMER}>ภาคฤดูร้อน (Summer)</option>
                </select>
              </div>

              <div className="md:col-span-6">
                <label className={`block text-xs font-semibold mb-1 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} title="อาจารย์ผู้รับผิดชอบรายวิชา / ผู้สร้างรายวิชา">
                  อาจารย์ผู้รับผิดชอบรายวิชา / ผู้สร้างรายวิชา
                </label>
                {isAdmin ? (
                  activeTeachers && activeTeachers.length > 0 ? (
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => {
                        const tId = e.target.value;
                        setSelectedTeacherId(tId);
                        const tObj = activeTeachers.find((t) => t.id === tId);
                        if (tObj) {
                          const name = `${tObj.prefixTh || tObj.title || ''}${tObj.firstNameTh || tObj.firstName || ''} ${tObj.lastNameTh || tObj.lastName || ''}`.trim() || tObj.email;
                          setCoordinatorName(name);
                        }
                      }}
                      className={`w-full h-[38px] border rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-sky-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- โอนย้ายผู้สร้าง/ผู้รับผิดชอบรายวิชา (Admin Only) --</option>
                      {activeTeachers.map((t) => {
                        const name = `${t.prefixTh || t.title || ''}${t.firstNameTh || t.firstName || ''} ${t.lastNameTh || t.lastName || ''}`.trim() || t.email;
                        return (
                          <option key={t.id} value={t.id}>
                            {name} ({t.email})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={coordinatorName}
                      onChange={(e) => setCoordinatorName(e.target.value)}
                      className={`w-full h-[38px] border rounded-xl px-3 text-xs focus:outline-none focus:border-sky-500 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  )
                ) : (
                  <div className={`h-[38px] px-3.5 rounded-xl border text-xs flex items-center justify-between overflow-hidden ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    <span className="font-bold flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span>👑</span>
                      <span className="truncate">ผู้สร้างรายวิชา: {course.ownerName || coordinatorName || '-'}</span>
                    </span>
                  </div>
                )}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      รัศมีเช็คชื่อ GPS (เมตร)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={allowedGpsRadius}
                      onChange={(e) => setAllowedGpsRadius(Math.max(1, parseInt(e.target.value, 10) || 200))}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-300 text-blue-700'
                      }`}
                    />
                  </div>
                </div>
              )}
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
                  <span>กำหนดสัปดาห์การเรียนการสอน (DYNAMIC TEACHING WEEKS)</span>
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
                    onChange={(e) => handleWeekChange(index, 'topic', e.target.value)}
                    placeholder="เช่น Course orientation"
                    className={`flex-grow border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <input
                    type="date"
                    value={w.date}
                    onChange={(e) => handleWeekChange(index, 'date', e.target.value)}
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
