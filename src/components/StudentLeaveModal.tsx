import React, { useState, useEffect } from 'react';
import { User, Course, LeaveRequest, LeaveType, LeaveStatus } from '../types';
import { submitLeaveRequest, fetchStudentLeaveRequests, cancelLeaveRequest } from '../services/api';
import { FileText, Calendar, Clock, AlertCircle, CheckCircle, XCircle, Upload, Plus, Trash2, X, Eye, FileCheck, ShieldAlert, Sparkles } from 'lucide-react';

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
  isDarkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [weekNumber, setWeekNumber] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.SICK);
  const [leaveDate, setLeaveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const [formError, setFormError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      if (courses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courses[0].id);
      }
    }
  }, [isOpen, student.id]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setAttachmentName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAttachmentUrl(result);
    };
    reader.readAsDataURL(file);
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
    if (!confirm('คุณต้องการยกเลิกใบลาเรียนนี้ใช่หรือไม่?')) return;
    try {
      await cancelLeaveRequest(leaveId);
      await loadHistory();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการยกเลิกใบลา');
    }
  };

  if (!isOpen) return null;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
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
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold flex items-center space-x-2">
                <span>ระบบแจ้งลาเรียน (Student Leave System)</span>
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ยื่นใบลาป่วย/ลากิจ และติดตามสถานะการพิจารณาจากอาจารย์ผู้สอน
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`flex border-b px-6 pt-3 gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 ${
              activeTab === 'NEW'
                ? isDarkMode
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-sky-600 text-white shadow-md'
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
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 relative ${
              activeTab === 'HISTORY'
                ? isDarkMode
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-sky-600 text-white shadow-md'
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
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  เลือกรายวิชาที่ต้องการแจ้งลา <span className="text-rose-500">*</span>
                </label>
                {courses.length === 0 ? (
                  <p className="text-xs text-amber-500">คุณยังไม่ได้ลงทะเบียนในรายวิชาใดๆ กรุณาเพิ่มรายวิชาก่อนส่งใบลา</p>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setWeekNumber('');
                    }}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.courseCode}] {c.courseName} (อาจารย์: {c.coordinatorName || c.ownerName || '-'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Leave Type and Date Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Leave Type */}
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ประเภทการลา <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={LeaveType.SICK}>🤒 ลาป่วย (Sick Leave)</option>
                    <option value={LeaveType.PERSONAL}>📌 ลากิจ (Personal Leave)</option>
                    <option value={LeaveType.OTHER}>📑 ลาอื่นๆ (Other)</option>
                  </select>
                </div>

                {/* Leave Date */}
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    วันที่ขอลา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Optional Teaching Week */}
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    สัปดาห์เรียน (ถ้าทราบ)
                  </label>
                  <select
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(e.target.value)}
                    className={`w-full p-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {selectedCourse?.weeks?.map((w) => (
                      <option key={w.weekNumber} value={w.weekNumber}>
                        สัปดาห์ที่ {w.weekNumber}: {w.topic}
                      </option>
                    )) || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((w) => (
                      <option key={w} value={w}>สัปดาห์ที่ {w}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
                    <div className="flex items-center justify-between p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                      <div className="flex items-center space-x-2 truncate">
                        <FileCheck className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-medium truncate">{attachmentName}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {attachmentUrl.startsWith('data:image/') && (
                          <button
                            type="button"
                            onClick={() => setSelectedImagePreview(attachmentUrl)}
                            className="p-1 hover:bg-sky-500/20 rounded-lg text-sky-400 transition"
                            title="ดูตัวอย่างรูปภาพ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentName('');
                            setAttachmentUrl('');
                          }}
                          className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-400 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center py-3">
                      <Upload className="w-8 h-8 text-sky-500 mb-2 animate-bounce" />
                      <span className="text-xs font-bold text-sky-500">กดเพื่ออัปโหลดไฟล์ / ถ่ายภาพใบรับรองแพทย์</span>
                      <span className="text-[11px] text-slate-400 mt-1">รองรับ JPG, PNG, PDF ขนาดไม่เกิน 5MB</span>
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
                <div className="py-12 text-center text-slate-400 text-xs">กำลังโหลดประวัติการแจ้งลา...</div>
              ) : leaveRequests.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    ยังไม่มีประวัติการยื่นใบลาเรียน
                  </p>
                  <p className="text-xs text-slate-400">คุณสามารถส่งใบลาใหม่ผ่านแท็บ "กรอกใบลาเรียนใหม่"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests.map((leave) => {
                    const statusConfig =
                      leave.status === LeaveStatus.APPROVED
                        ? {
                            label: 'อนุมัติแล้ว',
                            color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                            icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
                          }
                        : leave.status === LeaveStatus.REJECTED
                        ? {
                            label: 'ไม่อนุมัติ',
                            color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                            icon: <XCircle className="w-4 h-4 text-rose-400" />,
                          }
                        : {
                            label: 'รออนุมัติ',
                            color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                            icon: <Clock className="w-4 h-4 text-amber-400 animate-pulse" />,
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
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/50">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                                {leave.courseCode}
                              </span>
                              <span className="font-bold text-sm text-white">{leave.courseName}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center space-x-3">
                              <span>{typeLabel}</span>
                              <span>•</span>
                              <span>วันที่ลา: {leave.leaveDate}</span>
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

                            {leave.status === LeaveStatus.PENDING && (
                              <button
                                onClick={() => handleCancelLeave(leave.id)}
                                className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
                                title="ยกเลิกใบลา"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Leave Detail */}
                        <div className="mt-3 text-xs space-y-2">
                          <p className={`${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            <span className="font-bold text-slate-400">เหตุผลการลา:</span> {leave.reason}
                          </p>

                          {leave.attachmentName && (
                            <div className="flex items-center space-x-2 pt-1">
                              <FileCheck className="w-4 h-4 text-sky-400 shrink-0" />
                              <span className="text-sky-400 font-medium">เอกสารประกอบ: {leave.attachmentName}</span>
                              {leave.attachmentUrl && leave.attachmentUrl.startsWith('data:image/') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedImagePreview(leave.attachmentUrl!)}
                                  className="text-sky-400 hover:underline flex items-center space-x-1 font-bold ml-2"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>ดูรูปภาพ</span>
                                </button>
                              )}
                            </div>
                          )}

                          {leave.teacherComment && (
                            <div className="p-3 rounded-xl bg-slate-900/60 border border-sky-500/20 text-sky-300 mt-2">
                              <span className="font-bold">ความคิดเห็นจากอาจารย์:</span> {leave.teacherComment}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-500 text-right pt-1">
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
