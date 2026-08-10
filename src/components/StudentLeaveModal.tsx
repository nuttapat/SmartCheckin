import React, { useState, useEffect } from 'react';
import { User, Course, LeaveRequest, LeaveType, LeaveStatus } from '../types';
import { submitLeaveRequest, fetchStudentLeaveRequests, cancelLeaveRequest, fetchCourseDetails } from '../services/api';
import { FileText, Calendar, Clock, AlertCircle, CheckCircle, XCircle, Upload, Plus, Trash2, X, Eye, FileCheck, ShieldAlert, Sparkles, CalendarDays, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface StudentLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User;
  courses: Course[];
  isDarkMode?: boolean;
}

export const StudentLeaveModal: React.FC<StudentLeaveModalProps> = ({
  isOpen,
  onClose,
  student,
  courses,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [leaveRangeMode, setLeaveRangeMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [weekNumber, setWeekNumber] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.SICK);
  const [leaveDate, setLeaveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const [courseSessions, setCourseSessions] = useState<any[]>([]);
  const [classCheckWarning, setClassCheckWarning] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [confirmingLeaveId, setConfirmingLeaveId] = useState<string | null>(null);
  const [cancelingLeaveId, setCancelingLeaveId] = useState<string | null>(null);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      if (courses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courses[0].id);
      }
    }
  }, [isOpen, student.id]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseDetails(selectedCourseId)
        .then((data) => {
          if (data && data.sessions) {
            setCourseSessions(data.sessions);
          }
        })
        .catch(() => {});
    }
  }, [selectedCourseId]);

  // Sync logic when Week Number changes
  const handleWeekChange = (selectedWk: string) => {
    setWeekNumber(selectedWk);
    if (!selectedWk) {
      setClassCheckWarning('');
      return;
    }
    const wkNum = parseInt(selectedWk, 10);
    const foundWeek = selectedCourse?.weeks?.find((w) => w.weekNumber === wkNum);
    if (foundWeek && foundWeek.date) {
      setLeaveDate(foundWeek.date);
      if (leaveRangeMode === 'MULTI' && endDate < foundWeek.date) {
        setEndDate(foundWeek.date);
      }
      setClassCheckWarning('');
    } else {
      const foundSession = courseSessions.find((s) => s.weekNumber === wkNum);
      if (foundSession && foundSession.createdAt) {
        const sDate = foundSession.createdAt.split('T')[0];
        setLeaveDate(sDate);
        if (leaveRangeMode === 'MULTI' && endDate < sDate) {
          setEndDate(sDate);
        }
        setClassCheckWarning('');
      } else {
        setClassCheckWarning(`ไม่มีการเรียนของรายวิชา ${selectedCourse?.courseCode || ''} ในสัปดาห์ที่เลือก (สัปดาห์ที่ ${selectedWk})`);
      }
    }
  };

  // Sync logic when Leave Date changes
  const handleLeaveDateChange = (newDate: string) => {
    setLeaveDate(newDate);
    if (leaveRangeMode === 'MULTI' && endDate < newDate) {
      setEndDate(newDate);
    }
    if (!newDate) return;

    let matchedWeek: number | undefined;

    if (selectedCourse?.weeks && selectedCourse.weeks.length > 0) {
      const foundWk = selectedCourse.weeks.find((w) => w.date === newDate);
      if (foundWk) {
        matchedWeek = foundWk.weekNumber;
      }
    }

    if (!matchedWeek && courseSessions.length > 0) {
      const foundSes = courseSessions.find((s) => s.createdAt && s.createdAt.startsWith(newDate));
      if (foundSes) {
        matchedWeek = foundSes.weekNumber;
      }
    }

    if (matchedWeek) {
      setWeekNumber(matchedWeek.toString());
      setClassCheckWarning('');
    } else {
      setWeekNumber('');
      if (selectedCourse?.weeks && selectedCourse.weeks.length > 0) {
        setClassCheckWarning(`ไม่มีการเรียนของรายวิชา ${selectedCourse?.courseCode || ''} ในสัปดาห์ที่เลือก (หรือวันที่เลือกไม่มีคลาสเรียนของวิชานี้)`);
      } else {
        setClassCheckWarning('');
      }
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchStudentLeaveRequests(student.id);
      setLeaveRequests(data);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDocumentPreview = (url: string) => {
    if (!url) return;
    if (url.startsWith('data:image/')) {
      setSelectedImagePreview(url);
    } else {
      try {
        const parts = url.split(',');
        if (parts.length === 2) {
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
        } else {
          window.open(url, '_blank');
        }
      } catch (err) {
        window.open(url, '_blank');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setAttachmentName(file.name);

    if (file.type.startsWith('image/')) {
      // Compress image to fit within safe storage limits
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setAttachmentUrl(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => setAttachmentUrl(event.target?.result as string);
      };
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAttachmentUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!selectedCourseId) {
      setFormError('กรุณาเลือกรายวิชาที่ต้องการแจ้งลา');
      return;
    }

    if (!leaveDate) {
      setFormError('กรุณาระบุวันที่ขอลาเรียน');
      return;
    }

    if (leaveRangeMode === 'MULTI') {
      if (!endDate) {
        setFormError('กรุณาระบุวันที่สิ้นสุดการลา');
        return;
      }
      if (endDate < leaveDate) {
        setFormError('วันที่สิ้นสุดการลาต้องไม่น้อยกว่าวันที่เริ่มต้น');
        return;
      }
    }

    if (!reason.trim()) {
      setFormError('กรุณาระบุเหตุผลการลา');
      return;
    }

    try {
      setSubmitting(true);
      await submitLeaveRequest({
        studentId: student.id,
        courseId: selectedCourseId,
        weekNumber: weekNumber ? parseInt(weekNumber, 10) : undefined,
        leaveType,
        leaveDate,
        endDate: leaveRangeMode === 'MULTI' ? endDate : undefined,
        isMultiDay: leaveRangeMode === 'MULTI',
        reason: reason.trim(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      });

      setSuccessMessage('ส่งใบลาเรียนเรียบร้อยแล้ว');
      // Reset form
      setReason('');
      setAttachmentName('');
      setAttachmentUrl('');
      setWeekNumber('');
      setClassCheckWarning('');
      
      // Reload history and switch tab
      await loadHistory();
      setTimeout(() => {
        setActiveTab('HISTORY');
        setSuccessMessage('');
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการส่งใบลาเรียน');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    try {
      setCancelingLeaveId(leaveId);
      await cancelLeaveRequest(leaveId);
      setLeaveRequests((prev) => prev.filter((l) => l.id !== leaveId));
      setConfirmingLeaveId(null);
      await loadHistory();
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการยกเลิกใบลา');
    } finally {
      setCancelingLeaveId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`relative w-full transition-all duration-300 flex flex-col border shadow-2xl overflow-hidden ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'max-w-3xl max-h-[90vh] rounded-3xl'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-5 md:p-6 border-b ${
            isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-sky-50/60 border-sky-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isDarkMode ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-100 border-sky-200 text-sky-700'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-lg font-extrabold flex items-center space-x-2 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                <span>ระบบแจ้งลาเรียน (Student Leave System)</span>
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ยื่นใบลาป่วย/ลากิจ และติดตามสถานะการพิจารณาจากอาจารย์ผู้สอน
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className={`flex border-b px-6 pt-3 gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'NEW'
                ? 'bg-sky-600 text-white shadow-md'
                : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>กรอกใบลาเรียนใหม่</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-sky-600 text-white shadow-md'
                : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>ประวัติการยื่นใบลา ({leaveRequests.length})</span>
            {leaveRequests.some((r) => r.status === LeaveStatus.PENDING) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'NEW' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-medium flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Course Selector */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  เลือกรายวิชาที่ต้องการแจ้งลา <span className="text-rose-500">*</span>
                </label>
                {courses.length === 0 ? (
                  <p className={`text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>คุณยังไม่ได้ลงทะเบียนในรายวิชาใดๆ กรุณาเพิ่มรายวิชาก่อนส่งใบลา</p>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setWeekNumber('');
                      setClassCheckWarning('');
                    }}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                        [{c.courseCode}] {c.courseName} (อาจารย์: {c.coordinatorName || '-'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Leave Duration Range Selector */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  รูปแบบระยะเวลาการลา <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveRangeMode('SINGLE');
                      setClassCheckWarning('');
                    }}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      leaveRangeMode === 'SINGLE'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>ลาคาบเดียว / 1 วัน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveRangeMode('MULTI');
                      if (endDate < leaveDate) setEndDate(leaveDate);
                      setClassCheckWarning('');
                    }}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      leaveRangeMode === 'MULTI'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>ลาหลายวัน / ช่วงวันที่</span>
                  </button>
                </div>
              </div>

              {/* Leave Type and Date Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Leave Type */}
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    ประเภทการลา <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={LeaveType.SICK} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>🤒 ลาป่วย (Sick Leave)</option>
                    <option value={LeaveType.PERSONAL} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>📌 ลากิจ (Personal Leave)</option>
                    <option value={LeaveType.OTHER} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>📑 ลาอื่นๆ (Other)</option>
                  </select>
                </div>

                {/* Leave Date or Start Date */}
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    {leaveRangeMode === 'MULTI' ? 'วันที่เริ่มต้นลา ' : 'วันที่ขอลา '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={(e) => handleLeaveDateChange(e.target.value)}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* End Date (Multi-Day) OR Week Number (Single-Day) */}
                {leaveRangeMode === 'MULTI' ? (
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                      วันที่สิ้นสุดการลา <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={leaveDate}
                      className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                      สัปดาห์เรียน
                    </label>
                    <select
                      value={weekNumber}
                      onChange={(e) => handleWeekChange(e.target.value)}
                      className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>-- ไม่ระบุ / Sync ตามวันที่ --</option>
                      {[...(selectedCourse?.weeks || [])]
                        .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0))
                        .map((w) => (
                        <option key={w.weekNumber} value={w.weekNumber} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                          สัปดาห์ที่ {w.weekNumber}: {w.topic} {w.date ? `(${w.date})` : ''}
                        </option>
                      )) || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((w) => (
                        <option key={w} value={w} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>สัปดาห์ที่ {w}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Class Existence Warning Banner */}
              {classCheckWarning && (
                <div className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center space-x-2.5 ${
                  isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-800 font-semibold'
                }`}>
                  <AlertCircle className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`} />
                  <span>{classCheckWarning}</span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  เหตุผลรายละเอียดการลา <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุสาเหตุการลา เช่น มีอาการป่วยไข้สูง แพทย์สั่งพักผ่อน หรือติดภารกิจทางครอบครัว..."
                  className={`w-full p-3 rounded-2xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  แนบหลักฐานประกอบการลา (ใบรับรองแพทย์ / ใบลากิจ)
                </label>
                <div
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition ${
                    isDarkMode
                      ? 'border-slate-700 hover:border-sky-500/50 bg-slate-800/40'
                      : 'border-slate-300 hover:border-sky-500/50 bg-slate-50'
                  }`}
                >
                  {attachmentName ? (
                    <div className={`flex items-center justify-between p-2 rounded-xl border ${
                      isDarkMode ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-800'
                    }`}>
                      <div className="flex items-center space-x-2 truncate">
                        <FileCheck className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-medium truncate">{attachmentName}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => openDocumentPreview(attachmentUrl)}
                            className={`p-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer ${
                              isDarkMode ? 'hover:bg-sky-500/20 text-sky-400' : 'hover:bg-sky-200 text-sky-800'
                            }`}
                            title="ดูตัวอย่างเอกสาร"
                          >
                            <Eye className="w-4 h-4" />
                            <span>ดูไฟล์</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentName('');
                            setAttachmentUrl('');
                          }}
                          className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-500 transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center py-3">
                      <Upload className="w-8 h-8 text-sky-500 mb-2 animate-bounce" />
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>
                        กดเพื่ออัปโหลดไฟล์ / ถ่ายภาพใบรับรองแพทย์
                      </span>
                      <span className={`text-[11px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        รองรับ JPG, PNG, PDF ขนาดไม่เกิน 5MB
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || courses.length === 0}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-sky-600/30 active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {submitting ? (
                    <span>กำลังบันทึกข้อมูล...</span>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>ยื่นใบลาเรียน</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-4">
              {loading ? (
                <div className={`py-12 text-center text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>กำลังโหลดประวัติการแจ้งลา...</div>
              ) : leaveRequests.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ยังไม่มีประวัติการยื่นใบลาเรียน
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>คุณสามารถส่งใบลาใหม่ผ่านแท็บ "กรอกใบลาเรียนใหม่"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests.map((leave) => {
                    const statusConfig =
                      leave.status === LeaveStatus.APPROVED
                        ? {
                            label: 'อนุมัติแล้ว',
                            color: isDarkMode
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold',
                            icon: <CheckCircle className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} />,
                          }
                        : leave.status === LeaveStatus.REJECTED
                        ? {
                            label: 'ไม่อนุมัติ',
                            color: isDarkMode
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold',
                            icon: <XCircle className={`w-4 h-4 ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`} />,
                          }
                        : {
                            label: 'รออนุมัติ',
                            color: isDarkMode
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold',
                            icon: <Clock className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'} animate-pulse`} />,
                          };

                    const typeLabel =
                      leave.leaveType === LeaveType.SICK
                        ? '🤒 ลาป่วย'
                        : leave.leaveType === LeaveType.PERSONAL
                        ? '📌 ลากิจ'
                        : '📑 ลาอื่นๆ';

                    return (
                      <div
                        key={leave.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isDarkMode
                            ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
                          isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
                        }`}>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                                isDarkMode ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' : 'text-sky-800 bg-sky-100 border-sky-300'
                              }`}>
                                {leave.courseCode}
                              </span>
                              <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{leave.courseName}</span>
                            </div>
                            <div className={`text-xs mt-1 flex items-center space-x-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              <span>{typeLabel}</span>
                              <span>•</span>
                              <span>
                                {leave.isMultiDay && leave.endDate
                                  ? `ช่วงวันที่ลา: ${leave.leaveDate} ถึง ${leave.endDate}`
                                  : `วันที่ลา: ${leave.leaveDate}`}
                              </span>
                              {leave.weekNumber && (
                                <>
                                  <span>•</span>
                                  <span>สัปดาห์ที่ {leave.weekNumber}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 ${statusConfig.color}`}
                            >
                              {statusConfig.icon}
                              <span>{statusConfig.label}</span>
                            </div>

                            {(leave.status === LeaveStatus.PENDING || (leave.status as string) === 'PENDING') && (
                              cancelingLeaveId === leave.id ? (
                                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  <span>กำลังถอน...</span>
                                </div>
                              ) : confirmingLeaveId === leave.id ? (
                                <div className="flex items-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelLeave(leave.id)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    ยืนยันถอน
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingLeaveId(null)}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingLeaveId(leave.id)}
                                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-sm transition active:scale-95 cursor-pointer dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"
                                  title="ยื่นถอน (ยกเลิก) คำขออนุมัติใบลาเรียน"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>ถอนคำขอ</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Leave Detail */}
                        <div className="mt-3 text-xs space-y-2">
                          <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                            <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>เหตุผลการลา:</span> {leave.reason}
                          </p>

                          {leave.attachmentName && (
                            <div className="flex items-center space-x-2 pt-1">
                              <FileCheck className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`} />
                              <span className={`font-medium ${isDarkMode ? 'text-sky-400' : 'text-sky-800'}`}>เอกสารประกอบ: {leave.attachmentName}</span>
                              {leave.attachmentUrl && (
                                <button
                                  type="button"
                                  onClick={() => openDocumentPreview(leave.attachmentUrl!)}
                                  className={`flex items-center space-x-1 font-bold ml-2 cursor-pointer hover:underline ${
                                    isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-800'
                                  }`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>เปิดดูเอกสาร</span>
                                </button>
                              )}
                            </div>
                          )}

                          {leave.teacherComment && (
                            <div className={`p-3 rounded-xl border mt-2 ${
                              isDarkMode ? 'bg-slate-900/60 border-sky-500/20 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-900'
                            }`}>
                              <span className="font-bold">ความคิดเห็นจากอาจารย์:</span> {leave.teacherComment}
                            </div>
                          )}

                          <div className={`text-[10px] text-right pt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                            ยื่นเมื่อ: {new Date(leave.createdAt).toLocaleString('th-TH')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl">
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-500 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImagePreview}
              alt="Medical Certificate Preview"
              className="max-h-[80vh] w-auto rounded-2xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
