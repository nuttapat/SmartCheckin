import React, { useState, useEffect } from 'react';
import { User, Course, LeaveRequest, LeaveStatus, LeaveType } from '../types';
import { fetchTeacherLeaveRequests, updateLeaveRequestStatus } from '../services/api';
import { FileText, CheckCircle, XCircle, Clock, Search, Filter, Eye, X, MessageSquare, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface TeacherLeaveManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User;
  courses: Course[];
  isDarkMode?: boolean;
}

export const TeacherLeaveManagementModal: React.FC<TeacherLeaveManagementModalProps> = ({
  isOpen,
  onClose,
  teacher,
  courses,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected leave request for approval/rejection action
  const [actionItem, setActionItem] = useState<LeaveRequest | null>(null);
  const [actionStatus, setActionStatus] = useState<LeaveStatus>(LeaveStatus.APPROVED);
  const [teacherComment, setTeacherComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const openDocumentPreview = (url: string) => {
    if (!url) return;
    if (url.startsWith('data:image/')) {
      setImagePreviewUrl(url);
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

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen, teacher.id]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchTeacherLeaveRequests(teacher.id);
      setLeaveRequests(data);
    } catch (err) {
      console.error('Failed to fetch teacher leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenActionModal = (item: LeaveRequest, status: LeaveStatus) => {
    setActionItem(item);
    setActionStatus(status);
    setTeacherComment(item.teacherComment || (status === LeaveStatus.APPROVED ? 'อนุมัติการลาเรียน' : 'ไม่อนุมัติเนื่องจากเอกสารไม่ครบถ้วน'));
  };

  const handleConfirmAction = async () => {
    if (!actionItem) return;
    try {
      setSubmitting(true);
      await updateLeaveRequestStatus(actionItem.id, actionStatus, teacherComment);
      setActionItem(null);
      await loadRequests();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter list
  const filteredList = leaveRequests.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (selectedCourseId !== 'ALL' && item.courseId !== selectedCourseId) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const name = item.studentNameTh.toLowerCase();
      const studentId = item.studentUniversityId.toLowerCase();
      const code = item.courseCode.toLowerCase();
      const reason = item.reason.toLowerCase();
      return name.includes(term) || studentId.includes(term) || code.includes(term) || reason.includes(term);
    }
    return true;
  });

  const pendingCount = leaveRequests.filter((r) => r.status === LeaveStatus.PENDING).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
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
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold flex items-center space-x-2">
                <span>จัดการคำขอลาเรียนของนักศึกษา</span>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                    รออนุมัติ {pendingCount}
                  </span>
                )}
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ตรวจสอบและอนุมัติใบลาเรียน พร้อมให้ข้อคิดเห็นแก่นักศึกษา
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

        {/* Filter Toolbar */}
        <div className={`p-4 border-b grid grid-cols-1 md:grid-cols-3 gap-3 ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัสนักศึกษา, วิชา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className={`w-full p-2 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">ทุกรายวิชาที่รับผิดชอบ ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.courseCode}] {c.courseName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`w-full p-2 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">ทุกสถานะ ({leaveRequests.length})</option>
              <option value={LeaveStatus.PENDING}>⏳ รอการพิจารณา ({pendingCount})</option>
              <option value={LeaveStatus.APPROVED}>🟢 อนุมัติแล้ว</option>
              <option value={LeaveStatus.REJECTED}>🔴 ไม่อนุมัติ</option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">กำลังโหลดข้อมูลใบลาเรียน...</div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ไม่พบข้อมูลใบลาเรียนตามเงื่อนไข
              </p>
            </div>
          ) : (
            filteredList.map((item) => {
              const statusConfig =
                item.status === LeaveStatus.APPROVED
                  ? {
                      label: 'อนุมัติแล้ว',
                      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
                    }
                  : item.status === LeaveStatus.REJECTED
                  ? {
                      label: 'ไม่อนุมัติ',
                      color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                      icon: <XCircle className="w-4 h-4 text-rose-400" />,
                    }
                  : {
                      label: 'รอการพิจารณา',
                      color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                      icon: <Clock className="w-4 h-4 text-amber-400 animate-pulse" />,
                    };

              const typeLabel =
                item.leaveType === LeaveType.SICK
                  ? '🤒 ลาป่วย'
                  : item.leaveType === LeaveType.PERSONAL
                  ? '📌 ลากิจ'
                  : '📑 ลาอื่นๆ';

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isDarkMode
                      ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          {item.courseCode}
                        </span>
                        <span className="font-bold text-sm text-white">{item.studentNameTh}</span>
                        <span className="font-mono text-xs text-sky-300 font-semibold">
                          ({item.studentUniversityId})
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center space-x-3">
                        <span>{typeLabel}</span>
                        <span>•</span>
                        <span>
                          {item.isMultiDay && item.endDate
                            ? `ช่วงวันที่ลา: ${item.leaveDate} ถึง ${item.endDate}`
                            : `วันที่ลา: ${item.leaveDate}`}
                        </span>
                        {item.weekNumber && (
                          <>
                            <span>•</span>
                            <span>สัปดาห์ที่ {item.weekNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 ${statusConfig.color}`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenActionModal(item, LeaveStatus.APPROVED)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>อนุมัติ</span>
                        </button>

                        <button
                          onClick={() => handleOpenActionModal(item, LeaveStatus.REJECTED)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>ไม่อนุมัติ</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Leave Reason & Evidence */}
                  <div className="mt-3 text-xs space-y-2">
                    <p className={`${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className="font-bold text-slate-400">เหตุผลการลา:</span> {item.reason}
                    </p>

                    {item.attachmentName && (
                      <div className="flex items-center space-x-2 pt-1">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="text-sky-400 font-medium">หลักฐานประกอบ: {item.attachmentName}</span>
                        {item.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => openDocumentPreview(item.attachmentUrl!)}
                            className="text-sky-400 hover:underline flex items-center space-x-1 font-bold ml-2 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>เปิดดูเอกสารหลักฐาน</span>
                          </button>
                        )}
                      </div>
                    )}

                    {item.teacherComment && (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-sky-500/20 text-sky-300 mt-2">
                        <span className="font-bold">ข้อความอาจารย์:</span> {item.teacherComment}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 text-right pt-1">
                      ยื่นคำขอเมื่อ: {new Date(item.createdAt).toLocaleString('th-TH')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Approve/Reject Confirmation Modal */}
      {actionItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`relative w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h4 className="text-base font-extrabold flex items-center space-x-2">
              {actionStatus === LeaveStatus.APPROVED ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>ยืนยันอนุมัติใบลาเรียน</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <span>ยืนยันปฏิเสธใบลาเรียน</span>
                </>
              )}
            </h4>

            <div className="text-xs space-y-1 text-slate-300">
              <p><span className="font-bold text-slate-400">นักศึกษา:</span> {actionItem.studentNameTh} ({actionItem.studentUniversityId})</p>
              <p><span className="font-bold text-slate-400">วิชา:</span> [{actionItem.courseCode}] {actionItem.courseName}</p>
              <p>
                <span className="font-bold text-slate-400">วันที่ลา:</span>{' '}
                {actionItem.isMultiDay && actionItem.endDate
                  ? `${actionItem.leaveDate} ถึง ${actionItem.endDate}`
                  : actionItem.leaveDate}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-300">
                ข้อคิดเห็น / คำอธิบายเพิ่มเติมสำหรับนักศึกษา:
              </label>
              <textarea
                rows={3}
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="ระบุข้อความถึงนักศึกษา..."
                className={`w-full p-3 rounded-2xl border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setActionItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={submitting}
                className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow transition active:scale-95 cursor-pointer ${
                  actionStatus === LeaveStatus.APPROVED ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setImagePreviewUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl">
            <button
              onClick={() => setImagePreviewUrl(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-500 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={imagePreviewUrl}
              alt="Evidence Preview"
              className="max-h-[80vh] w-auto rounded-2xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
