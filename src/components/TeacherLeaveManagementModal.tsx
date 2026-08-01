import React, { useState, useEffect } from 'react';
import { User, Course, LeaveRequest, LeaveStatus, LeaveType } from '../types';
import { fetchTeacherLeaveRequests, updateLeaveRequestStatus } from '../services/api';
import { FileText, CheckCircle, XCircle, Clock, Search, Filter, Eye, X, MessageSquare, AlertCircle, Sparkles, UserCheck, Download, Maximize2, Minimize2 } from 'lucide-react';
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

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
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

  const downloadDocument = (url: string, fileName?: string) => {
    if (!url) return;
    const defaultName = fileName || 'leave_attachment';
    try {
      if (url.startsWith('data:')) {
        const parts = url.split(',');
        if (parts.length === 2) {
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = defaultName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          return;
        }
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(url, '_blank');
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
        className={`relative w-full transition-all duration-300 flex flex-col border shadow-2xl overflow-hidden ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'max-w-4xl max-h-[90vh] rounded-3xl'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 sm:p-6 border-b ${
            isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-sky-50/60 border-sky-100'
          }`}
        >
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 pr-2">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
              isDarkMode ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-100 border-sky-200 text-sky-700'
            }`}>
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <h3 className={`text-base sm:text-lg font-extrabold truncate ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  จัดการคำขอลาเรียน
                </h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] shrink-0">
                    รออนุมัติ {pendingCount}
                  </span>
                )}
              </div>
              <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                อนุมัติใบลาเรียนและข้อคิดเห็นแก่นักศึกษา
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
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

        {/* Filter Toolbar */}
        <div className={`p-3 sm:p-4 border-b grid grid-cols-1 sm:grid-cols-3 gap-2.5 ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัสนักศึกษา, วิชา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
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
              <option value="ALL" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                ทุกรายวิชา ({courses.length})
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
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
              <option value="ALL" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                ทุกสถานะ ({leaveRequests.length})
              </option>
              <option value={LeaveStatus.PENDING} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                ⏳ รอการพิจารณา ({pendingCount})
              </option>
              <option value={LeaveStatus.APPROVED} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                🟢 อนุมัติแล้ว
              </option>
              <option value={LeaveStatus.REJECTED} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>
                🔴 ไม่อนุมัติ
              </option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5">
          {loading ? (
            <div className={`py-12 text-center text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>กำลังโหลดข้อมูลใบลาเรียน...</div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'
              }`}>
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
                      color: isDarkMode
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold',
                      icon: <CheckCircle className={`w-3.5 h-3.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} />,
                    }
                  : item.status === LeaveStatus.REJECTED
                  ? {
                      label: 'ไม่อนุมัติ',
                      color: isDarkMode
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold',
                      icon: <XCircle className={`w-3.5 h-3.5 ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`} />,
                    }
                  : {
                      label: 'รอการพิจารณา',
                      color: isDarkMode
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold',
                      icon: <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'} animate-pulse`} />,
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
                  className={`p-3.5 sm:p-5 rounded-2xl border transition-all ${
                    isDarkMode
                      ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Card Top Header: Course & Status */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700/60">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                      isDarkMode ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' : 'text-sky-800 bg-sky-100 border-sky-300'
                    }`}>
                      {item.courseCode}
                    </span>

                    <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center space-x-1 shrink-0 ${statusConfig.color}`}>
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* Student Info & Metadata */}
                  <div className="pt-2.5 space-y-1.5">
                    <div className="flex items-baseline space-x-1.5 flex-wrap">
                      <span className={`font-extrabold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {item.studentNameTh}
                      </span>
                      <span className={`font-mono text-xs font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                        ({item.studentUniversityId})
                      </span>
                    </div>

                    {/* Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`px-2 py-0.5 rounded-md font-medium border text-[11px] ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {typeLabel}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium border text-[11px] ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        📅 {item.isMultiDay && item.endDate ? `${item.leaveDate} ถึง ${item.endDate}` : item.leaveDate}
                      </span>
                      {item.weekNumber && (
                        <span className={`px-2 py-0.5 rounded-md font-medium border text-[11px] ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}>
                          สัปดาห์ที่ {item.weekNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Leave Reason */}
                  <div className="mt-3 text-xs space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>เหตุผลการลา:</span> {item.reason}
                    </p>

                    {item.attachmentName && (
                      <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`} />
                          <span className={`font-medium text-xs truncate ${isDarkMode ? 'text-sky-300' : 'text-sky-900'}`}>
                            {item.attachmentName}
                          </span>
                        </div>
                        {item.attachmentUrl && (
                          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(item.attachmentUrl!)}
                              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1 transition cursor-pointer ${
                                isDarkMode ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูเอกสาร</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadDocument(item.attachmentUrl!, item.attachmentName || `หลักฐานการลา_${item.studentUniversityId}`)}
                              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1 transition cursor-pointer ${
                                isDarkMode ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}
                              title="ดาวน์โหลดเอกสารลงในเครื่อง"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>ดาวน์โหลด</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {item.teacherComment && (
                      <div className={`p-2.5 rounded-xl border mt-2 ${
                        isDarkMode ? 'bg-slate-900/60 border-sky-500/20 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-900'
                      }`}>
                        <span className="font-bold">ข้อความอาจารย์:</span> {item.teacherComment}
                      </div>
                    )}

                    <div className={`text-[10px] text-right pt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      ยื่นคำขอเมื่อ: {new Date(item.createdAt).toLocaleString('th-TH')}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    {item.status === LeaveStatus.PENDING ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenActionModal(item, LeaveStatus.APPROVED)}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>อนุมัติ</span>
                        </button>

                        <button
                          onClick={() => handleOpenActionModal(item, LeaveStatus.REJECTED)}
                          className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>ไม่อนุมัติ</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold flex items-center space-x-1 ${
                          item.status === LeaveStatus.APPROVED ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {item.status === LeaveStatus.APPROVED ? (
                            <CheckCircle className="w-3.5 h-3.5 inline shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 inline shrink-0" />
                          )}
                          <span>สถานะ: {statusConfig.label}</span>
                        </span>
                        <button
                          onClick={() => handleOpenActionModal(item, item.status)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                            isDarkMode 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>แก้ไขผลการพิจารณา / ข้อความ</span>
                        </button>
                      </div>
                    )}
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
            <h4 className={`text-base font-extrabold flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <UserCheck className="w-5 h-5 text-sky-500" />
              <span>จัดการผลการพิจารณาใบลาเรียน</span>
            </h4>

            <div className={`text-xs space-y-1 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <p><span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>นักศึกษา:</span> {actionItem.studentNameTh} ({actionItem.studentUniversityId})</p>
              <p><span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>วิชา:</span> [{actionItem.courseCode}] {actionItem.courseName}</p>
              <p>
                <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>วันที่ลา:</span>{' '}
                {actionItem.isMultiDay && actionItem.endDate
                  ? `${actionItem.leaveDate} ถึง ${actionItem.endDate}`
                  : actionItem.leaveDate}
              </p>
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5">
              <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                ผลการพิจารณา:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActionStatus(LeaveStatus.APPROVED)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                    actionStatus === LeaveStatus.APPROVED
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                      : isDarkMode
                      ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>อนุมัติ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionStatus(LeaveStatus.REJECTED)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                    actionStatus === LeaveStatus.REJECTED
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20'
                      : isDarkMode
                      ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>ไม่อนุมัติ</span>
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                ข้อคิดเห็น / คำอธิบายเพิ่มเติมสำหรับนักศึกษา:
              </label>
              <textarea
                rows={3}
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="ระบุข้อความถึงนักศึกษา..."
                className={`w-full p-3 rounded-2xl border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                }`}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setActionItem(null)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
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
          <div 
            className="relative max-w-2xl max-h-[85vh] p-3 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImagePreviewUrl(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-500 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={imagePreviewUrl}
              alt="Evidence Preview"
              className="max-h-[72vh] w-auto rounded-2xl object-contain mx-auto"
            />
            <button
              onClick={() => downloadDocument(imagePreviewUrl, 'หลักฐานการลา.png')}
              className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดรูปภาพหลักฐาน</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
