import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, AttendanceStatus, LeaveType, LeaveStatus } from '../../types';
import {
  fetchAdminCollection,
  overrideAttendanceRecord,
  saveAdminDocument,
  deleteAdminDocument,
} from '../../services/api';
import {
  Sliders,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  GraduationCap,
  Calendar,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  Target,
  Filter,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Edit,
  Trash2,
  Save,
  X,
  FileText,
} from 'lucide-react';

interface AdminOverrideTabProps {
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  onRefreshOverview: () => void;
}

export const AdminOverrideTab: React.FC<AdminOverrideTabProps> = ({
  isDarkMode,
  showToast,
  onRefreshOverview,
}) => {
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<any[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<any[]>([]);
  const [loadingOverrideData, setLoadingOverrideData] = useState<boolean>(false);

  // Override Form state
  const [overrideUserType, setOverrideUserType] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [overrideUserSearch, setOverrideUserSearch] = useState<string>('');
  const [overrideSelectedUser, setOverrideSelectedUser] = useState<User | null>(null);
  const [overrideCourseId, setOverrideCourseId] = useState<string>('');
  const [overrideSessionId, setOverrideSessionId] = useState<string>('');
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [overrideLeaveType, setOverrideLeaveType] = useState<LeaveType>(LeaveType.SICK);
  const [overrideLeaveStatus, setOverrideLeaveStatus] = useState<LeaveStatus>(LeaveStatus.APPROVED);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideMsg, setOverrideMsg] = useState<string>('');
  const [overrideErrorMsg, setOverrideErrorMsg] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);

  // Attendance Statuses Table State
  const [activeLogTab, setActiveLogTab] = useState<'ALL' | 'STUDENT' | 'TEACHER' | 'FOCUS'>('ALL');
  const [logFilterCourse, setLogFilterCourse] = useState<string>('ALL');
  const [logFilterStatus, setLogFilterStatus] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<'user' | 'course' | 'status' | 'method' | 'time'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Edit & Delete Log Modal State
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>('PRESENT');
  const [editLeaveType, setEditLeaveType] = useState<LeaveType>(LeaveType.SICK);
  const [editLeaveStatus, setEditLeaveStatus] = useState<LeaveStatus>(LeaveStatus.APPROVED);
  const [editMethod, setEditMethod] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [deletingLog, setDeletingLog] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleOpenEdit = (log: any) => {
    setEditingLog(log);
    setEditStatus(log.status || 'PRESENT');
    setEditLeaveType(log.leaveType || LeaveType.SICK);
    setEditLeaveStatus(log.leaveStatus || log.leaveRequestStatus || LeaveStatus.APPROVED);
    setEditMethod(log.checkinMethod || log.method || 'ADMIN_EDIT');
    setEditReason(log.reason || log.note || log.teacherComment || '');
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setIsSavingEdit(true);
    try {
      const leaveTypeTh =
        editLeaveType === LeaveType.SICK
          ? 'ลาป่วย'
          : editLeaveType === LeaveType.PERSONAL
          ? 'ลากิจ'
          : 'ลาอื่นๆ';

      const leaveStatusTh =
        editLeaveStatus === LeaveStatus.APPROVED
          ? 'อนุมัติแล้ว'
          : editLeaveStatus === LeaveStatus.PENDING
          ? 'รอพิจารณา'
          : 'ไม่อนุมัติ';

      if (editStatus === AttendanceStatus.LEAVE || editStatus === 'LEAVE') {
        const realLeaveId = editingLog.isLeaveRequestRecord && editingLog.id.startsWith('leave_')
          ? editingLog.id.replace('leave_', '')
          : null;

        const existingLeave = realLeaveId
          ? allLeaveRequests.find((l) => l.id === realLeaveId)
          : allLeaveRequests.find(
              (l) =>
                l.studentId === (editingLog.targetUserId || editingLog.studentId) &&
                l.courseId === editingLog.courseId &&
                (l.sessionId === editingLog.sessionId || Number(l.weekNumber) === Number(editingLog.weekNumber))
            );

        const courseObj = allCourses.find((c) => c.id === editingLog.courseId);
        const sessionObj = allSessions.find((s) => s.id === editingLog.sessionId);

        const leaveData: any = {
          id: existingLeave ? existingLeave.id : realLeaveId || `leave_admin_${Date.now()}`,
          studentId: editingLog.targetUserId || editingLog.studentId || editingLog.userId,
          studentNameTh: editingLog.displayName || 'นักศึกษา',
          studentUniversityId: editingLog.displayId || '',
          courseId: editingLog.courseId,
          courseCode: courseObj?.courseCode || courseObj?.code || '',
          courseName: courseObj?.courseName || courseObj?.nameTh || '',
          weekNumber: editingLog.weekNumber || sessionObj?.weekNumber || 1,
          leaveType: editLeaveType,
          leaveDate: sessionObj?.date || new Date().toISOString().split('T')[0],
          reason: editReason || existingLeave?.reason || `ปรับสถานะการลาโดยแอดมิน (${leaveTypeTh})`,
          status: editLeaveStatus,
          teacherComment: editReason || `แก้ไขข้อมูลการลาโดยแอดมิน (${leaveStatusTh})`,
          createdAt: existingLeave?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveAdminDocument('leaveRequests', leaveData);

        if (editLeaveStatus === LeaveStatus.APPROVED) {
          if (editingLog.id && !editingLog.id.startsWith('leave_') && !editingLog.id.startsWith('att_admin_')) {
            await saveAdminDocument('attendanceRecords', {
              ...editingLog,
              status: AttendanceStatus.LEAVE,
              checkinMethod: editMethod || `ใบลา (${leaveTypeTh})`,
              reason: editReason,
              timestamp: new Date().toISOString(),
            });
          } else {
            await overrideAttendanceRecord({
              studentId: editingLog.targetUserId || editingLog.studentId,
              sessionId: editingLog.sessionId || undefined,
              courseId: editingLog.courseId || undefined,
              status: AttendanceStatus.LEAVE,
              checkinMethod: editMethod || `ใบลา (${leaveTypeTh})`,
            });
          }
        }
      } else {
        if (editingLog.isLeaveRequestRecord) {
          const realId = editingLog.id.startsWith('leave_') ? editingLog.id.replace('leave_', '') : editingLog.id;
          const leaveDoc = allLeaveRequests.find((l) => l.id === realId);
          if (leaveDoc) {
            await saveAdminDocument('leaveRequests', {
              ...leaveDoc,
              status: LeaveStatus.REJECTED,
              teacherComment: editReason || 'ปรับสถานะการเช็กชื่อเป็นอย่างอื่นโดยแอดมิน',
              updatedAt: new Date().toISOString(),
            });
          }
          await overrideAttendanceRecord({
            studentId: editingLog.targetUserId || editingLog.studentId,
            sessionId: editingLog.sessionId || undefined,
            courseId: editingLog.courseId || undefined,
            status: editStatus,
            checkinMethod: editMethod || 'ADMIN_EDIT',
          });
        } else if (editingLog.logType === 'TEACHER') {
          await saveAdminDocument('teacherAttendanceRecords', {
            ...editingLog,
            status: editStatus,
            checkinMethod: editMethod,
            note: editReason,
            timestamp: new Date().toISOString(),
          });
        } else {
          await saveAdminDocument('attendanceRecords', {
            ...editingLog,
            status: editStatus,
            checkinMethod: editMethod,
            reason: editReason,
            timestamp: new Date().toISOString(),
          });
        }
      }

      showToast('แก้ไขข้อมูลและเชื่อมโยงระบบลาเรียบร้อยแล้ว');
      setEditingLog(null);
      await loadOverrideTabData(true);
      onRefreshOverview();
    } catch (err: any) {
      console.error('Failed to save edit:', err);
      showToast(`เกิดข้อผิดพลาดในการแก้ไข: ${err.message || 'ไม่สามารถบันทึกได้'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    setIsDeleting(true);
    try {
      if (deletingLog.isLeaveRequestRecord) {
        const realId = deletingLog.id.startsWith('leave_') ? deletingLog.id.replace('leave_', '') : deletingLog.id;
        await deleteAdminDocument('leaveRequests', realId);
      } else if (deletingLog.logType === 'TEACHER') {
        await deleteAdminDocument('teacherAttendanceRecords', deletingLog.id);
      } else {
        await deleteAdminDocument('attendanceRecords', deletingLog.id);
      }

      showToast('ลบรายการเช็กชื่อเรียบร้อยแล้ว');
      setDeletingLog(null);
      await loadOverrideTabData(true);
      onRefreshOverview();
    } catch (err: any) {
      console.error('Failed to delete log:', err);
      showToast(`เกิดข้อผิดพลาดในการลบ: ${err.message || 'ไม่สามารถลบข้อมูลได้'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadOverrideTabData = async (silent = false) => {
    try {
      if (!silent) setLoadingOverrideData(true);
      const [usersRes, coursesRes, sessionsRes, attRes, teacherAttRes, leaveRes] = await Promise.all([
        fetchAdminCollection('users'),
        fetchAdminCollection('courses'),
        fetchAdminCollection('sessions'),
        fetchAdminCollection('attendanceRecords'),
        fetchAdminCollection('teacherAttendanceRecords').catch(() => ({ documents: [] })),
        fetchAdminCollection('leaveRequests').catch(() => ({ documents: [] })),
      ]);
      setAllUsersList(usersRes.documents || []);
      setAllCourses(coursesRes.documents || []);
      setAllSessions(sessionsRes.documents || []);
      setStudentAttendance(attRes.documents || []);
      setTeacherAttendance(teacherAttRes.documents || []);
      setAllLeaveRequests(leaveRes.documents || []);
    } catch (err) {
      console.error('Failed to load override tab data:', err);
    } finally {
      if (!silent) setLoadingOverrideData(false);
    }
  };

  useEffect(() => {
    loadOverrideTabData();
  }, []);

  const filteredUsersForOverride = useMemo(() => {
    return allUsersList.filter((u) => {
      if (overrideUserType === 'STUDENT' && u.role !== UserRole.STUDENT) return false;
      if (overrideUserType === 'TEACHER' && u.role !== UserRole.TEACHER) return false;

      if (!overrideUserSearch.trim()) return true;

      const q = overrideUserSearch.toLowerCase().trim();
      const fullName = `${u.title || ''}${u.firstNameTh || ''} ${u.lastNameTh || ''}`.toLowerCase();
      const uniId = (u.universityId || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();

      return fullName.includes(q) || uniId.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [allUsersList, overrideUserType, overrideUserSearch]);

  const sessionsForSelectedCourse = useMemo(() => {
    if (!overrideCourseId) return [];
    return allSessions.filter((s) => s.courseId === overrideCourseId);
  }, [allSessions, overrideCourseId]);

  const handleOverrideAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideMsg('');
    setOverrideErrorMsg('');

    if (!overrideSelectedUser) {
      setOverrideErrorMsg('กรุณาเลือกผู้ใช้งานที่ต้องการปรับแก้ไขสถานะ');
      return;
    }
    if (!overrideCourseId) {
      setOverrideErrorMsg('กรุณาเลือกรายวิชา');
      return;
    }
    if (!overrideSessionId) {
      setOverrideErrorMsg('กรุณาเลือกสัปดาห์ / Session การเรียน');
      return;
    }

    setIsSubmittingOverride(true);
    try {
      if (overrideStatus === AttendanceStatus.LEAVE || overrideStatus === 'LEAVE') {
        const sessionObj = allSessions.find((s) => s.id === overrideSessionId);
        const courseObj = allCourses.find((c) => c.id === overrideCourseId);

        const leaveTypeTh =
          overrideLeaveType === LeaveType.SICK
            ? 'ลาป่วย'
            : overrideLeaveType === LeaveType.PERSONAL
            ? 'ลากิจ'
            : 'ลาอื่นๆ';

        const leaveStatusTh =
          overrideLeaveStatus === LeaveStatus.APPROVED
            ? 'อนุมัติแล้ว'
            : overrideLeaveStatus === LeaveStatus.PENDING
            ? 'รอพิจารณา'
            : 'ไม่อนุมัติ';

        const existingLeave = allLeaveRequests.find(
          (l) =>
            l.studentId === overrideSelectedUser.id &&
            l.courseId === overrideCourseId &&
            (l.sessionId === overrideSessionId || Number(l.weekNumber) === Number(sessionObj?.weekNumber))
        );

        const leaveData: any = {
          id: existingLeave ? existingLeave.id : `leave_admin_${Date.now()}`,
          studentId: overrideSelectedUser.id,
          studentNameTh: `${overrideSelectedUser.title || ''}${overrideSelectedUser.firstNameTh} ${overrideSelectedUser.lastNameTh}`.trim(),
          studentUniversityId: overrideSelectedUser.universityId || '',
          courseId: overrideCourseId,
          courseCode: courseObj?.courseCode || courseObj?.code || '',
          courseName: courseObj?.courseName || courseObj?.nameTh || '',
          weekNumber: sessionObj?.weekNumber || 1,
          leaveType: overrideLeaveType,
          leaveDate: sessionObj?.date || sessionObj?.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
          reason: overrideReason || `ปรับสถานะการลาโดยแอดมิน (${leaveTypeTh})`,
          status: overrideLeaveStatus,
          teacherComment: `ปรับสถานะโดยแอดมิน (Admin Override) - สถานะ: ${leaveStatusTh}`,
          createdAt: existingLeave?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveAdminDocument('leaveRequests', leaveData);

        if (overrideLeaveStatus === LeaveStatus.APPROVED) {
          await overrideAttendanceRecord({
            studentId: overrideSelectedUser.id,
            courseId: overrideCourseId,
            sessionId: overrideSessionId,
            status: AttendanceStatus.LEAVE,
            checkinMethod: `ใบลา (${leaveTypeTh})`,
          });
        }
      } else {
        await overrideAttendanceRecord({
          studentId: overrideSelectedUser.id,
          courseId: overrideCourseId,
          sessionId: overrideSessionId,
          status: overrideStatus,
          checkinMethod: 'ADMIN_OVERRIDE',
        });

        // Sync existing leave request if present
        const sessionObj = allSessions.find((s) => s.id === overrideSessionId);
        const existingLeave = allLeaveRequests.find(
          (l) =>
            l.studentId === overrideSelectedUser.id &&
            l.courseId === overrideCourseId &&
            (l.sessionId === overrideSessionId || Number(l.weekNumber) === Number(sessionObj?.weekNumber))
        );
        if (existingLeave && existingLeave.status === LeaveStatus.APPROVED) {
          await saveAdminDocument('leaveRequests', {
            ...existingLeave,
            status: LeaveStatus.REJECTED,
            teacherComment: `ยกเลิกการลาและปรับสถานะเป็น ${overrideStatus} โดยแอดมิน`,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setOverrideMsg('ปรับแก้ไขสถานะการเช็กชื่อและเชื่อมโยงระบบลาเรียบร้อยแล้ว');
      showToast('ปรับแก้ไขสถานะการเช็กชื่อเรียบร้อยแล้ว');
      setOverrideReason('');
      await loadOverrideTabData(true);
      onRefreshOverview();
    } catch (err: any) {
      setOverrideErrorMsg(err.message || 'เกิดข้อผิดพลาดในการปรับแก้ไขสถานะ');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Toggle sort direction or column
  const handleSort = (col: 'user' | 'course' | 'status' | 'method' | 'time') => {
    if (sortColumn === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  // Combined and filtered attendance logs
  const combinedAttendanceLogs = useMemo(() => {
    const sLogs = studentAttendance.map((a) => {
      const sess = allSessions.find((s) => s.id === a.sessionId);
      const courseId = a.courseId || sess?.courseId;
      const weekNumber = a.weekNumber || sess?.weekNumber;
      return {
        ...a,
        courseId,
        weekNumber,
        logType: 'STUDENT',
        displayName: a.studentNameTh || 'นักศึกษา',
        displayId: a.studentUniversityId || a.studentId || a.userId,
        targetUserId: a.studentId || a.userId,
      };
    });

    const tLogs = teacherAttendance.map((a) => ({
      ...a,
      logType: 'TEACHER',
      displayName: a.teacherNameTh || 'อาจารย์ผู้สอน',
      displayId: a.teacherId || a.userId,
      targetUserId: a.teacherId || a.userId,
    }));

    // Map approved leave requests into LEAVE attendance records
    const leaveLogs = allLeaveRequests
      .filter((l) => l.status === LeaveStatus.APPROVED || l.status === 'APPROVED')
      .map((l) => {
        const u = allUsersList.find((usr) => usr.id === l.studentId || usr.universityId === l.studentUniversityId);
        const name = l.studentNameTh || (u ? `${u.title || ''}${u.firstNameTh} ${u.lastNameTh}`.trim() : 'นักศึกษา');
        const uniId = l.studentUniversityId || u?.universityId || l.studentId;
        const leaveLabel = l.leaveType === 'SICK' ? 'ลาป่วย' : l.leaveType === 'PERSONAL' ? 'ลากิจ' : 'ลาเรียน';

        const sess = allSessions.find(
          (s) => s.courseId === l.courseId && Number(s.weekNumber) === Number(l.weekNumber)
        );

        return {
          id: `leave_${l.id}`,
          sessionId: sess?.id || '',
          studentId: l.studentId,
          userId: l.studentId,
          targetUserId: l.studentId,
          displayName: name,
          displayId: uniId,
          courseId: l.courseId,
          weekNumber: l.weekNumber || sess?.weekNumber || 1,
          status: AttendanceStatus.LEAVE,
          checkinMethod: `อนุมัติใบลา (${leaveLabel})`,
          reason: l.reason
            ? `เหตุผล: ${l.reason}${l.teacherComment ? ` | อาจารย์: ${l.teacherComment}` : ''}`
            : (l.teacherComment || 'อนุมัติการลาเรียน'),
          timestamp: l.updatedAt || l.createdAt || new Date().toISOString(),
          createdAt: l.createdAt || new Date().toISOString(),
          logType: 'STUDENT',
          isLeaveRequestRecord: true,
        };
      });

    // Remove duplicates from sLogs if an approved leave record is present for the same user + course + week/session
    const filteredSLogs = sLogs.filter((s) => {
      const matchesLeave = leaveLogs.some(
        (l) =>
          l.targetUserId === s.targetUserId &&
          l.courseId === s.courseId &&
          (l.weekNumber === s.weekNumber || (l.sessionId && l.sessionId === s.sessionId))
      );
      if (matchesLeave && s.status !== AttendanceStatus.PRESENT && s.status !== 'PRESENT') {
        return false; // Leave request log takes precedence
      }
      return true;
    });

    return [...filteredSLogs, ...tLogs, ...leaveLogs]
      .filter((log) => {
        // Tab Filter
        if (activeLogTab === 'STUDENT' && log.logType !== 'STUDENT') return false;
        if (activeLogTab === 'TEACHER' && log.logType !== 'TEACHER') return false;
        if (activeLogTab === 'FOCUS' && overrideSelectedUser) {
          const targetId = overrideSelectedUser.id;
          const targetUniId = overrideSelectedUser.universityId;
          const isMatch =
            log.targetUserId === targetId ||
            log.userId === targetId ||
            log.studentId === targetId ||
            log.teacherId === targetId ||
            (targetUniId && log.displayId === targetUniId);
          if (!isMatch) return false;
        }

        // Course Filter
        if (logFilterCourse !== 'ALL' && log.courseId !== logFilterCourse) return false;

        // Status Filter
        if (logFilterStatus !== 'ALL' && log.status !== logFilterStatus) return false;

        // Search Query Filter
        if (!logSearchQuery.trim()) return true;
        const q = logSearchQuery.toLowerCase().trim();
        const name = (log.displayName || '').toLowerCase();
        const id = (log.displayId || '').toLowerCase();
        const status = (log.status || '').toLowerCase();
        const method = (log.checkinMethod || log.method || '').toLowerCase();
        const reason = (log.reason || log.note || '').toLowerCase();

        return (
          name.includes(q) ||
          id.includes(q) ||
          status.includes(q) ||
          method.includes(q) ||
          reason.includes(q)
        );
      })
      .sort((a, b) => {
        let valA = '';
        let valB = '';

        if (sortColumn === 'user') {
          valA = (a.displayName || '').toLowerCase();
          valB = (b.displayName || '').toLowerCase();
        } else if (sortColumn === 'course') {
          const courseA = allCourses.find((c) => c.id === a.courseId);
          const courseB = allCourses.find((c) => c.id === b.courseId);
          valA = (courseA?.courseCode || courseA?.code || a.courseId || '').toLowerCase();
          valB = (courseB?.courseCode || courseB?.code || b.courseId || '').toLowerCase();
        } else if (sortColumn === 'status') {
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
        } else if (sortColumn === 'method') {
          valA = (a.checkinMethod || a.method || '').toLowerCase();
          valB = (b.checkinMethod || b.method || '').toLowerCase();
        } else if (sortColumn === 'time') {
          const tA = new Date(a.timestamp || a.createdAt || 0).getTime();
          const tB = new Date(b.timestamp || b.createdAt || 0).getTime();
          return sortDir === 'desc' ? tB - tA : tA - tB;
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    studentAttendance,
    teacherAttendance,
    allLeaveRequests,
    allSessions,
    allUsersList,
    activeLogTab,
    overrideSelectedUser,
    logFilterCourse,
    logFilterStatus,
    logSearchQuery,
    sortColumn,
    sortDir,
    allCourses,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeLogTab, logFilterCourse, logFilterStatus, logSearchQuery, sortColumn, sortDir]);

  // Pagination calculation
  const totalItems = combinedAttendanceLogs.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    if (pageSize === -1) return combinedAttendanceLogs;
    const start = (currentPage - 1) * pageSize;
    return combinedAttendanceLogs.slice(start, start + pageSize);
  }, [combinedAttendanceLogs, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Override Attendance Form */}
        <div
          className={`p-6 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <h3 className="text-base font-extrabold flex items-center space-x-2 mb-4">
            <Sliders className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
            <span>ปรับแก้ไขสถานะการเช็กชื่อ (Attendance Override)</span>
          </h3>

          {overrideMsg && (
            <div
              className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
                isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{overrideMsg}</span>
            </div>
          )}

          {overrideErrorMsg && (
            <div
              className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
                isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{overrideErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleOverrideAttendanceSubmit} className="space-y-4 text-xs">
            {/* 1. Target User Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  1. เลือกผู้ใช้ (นักศึกษา / อาจารย์) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setOverrideUserType('ALL')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      overrideUserType === 'ALL' ? 'bg-sky-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideUserType('STUDENT')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      overrideUserType === 'STUDENT' ? 'bg-sky-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    นักศึกษา
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideUserType('TEACHER')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      overrideUserType === 'TEACHER' ? 'bg-sky-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    อาจารย์
                  </button>
                </div>
              </div>

              {overrideSelectedUser ? (
                <div
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    isDarkMode ? 'bg-sky-500/10 border-sky-500/30 text-white' : 'bg-sky-50/80 border-sky-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                        overrideSelectedUser.role === UserRole.TEACHER ? 'bg-amber-500' : 'bg-sky-600'
                      }`}
                    >
                      {overrideSelectedUser.role === UserRole.TEACHER ? <UserCheck className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-extrabold flex items-center space-x-1.5">
                        <span>
                          {overrideSelectedUser.title || ''}
                          {overrideSelectedUser.firstNameTh} {overrideSelectedUser.lastNameTh}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                            overrideSelectedUser.role === UserRole.TEACHER
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {overrideSelectedUser.role === UserRole.TEACHER ? 'อาจารย์' : 'นักศึกษา'}
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 font-mono">
                        {overrideSelectedUser.universityId ? `รหัส: ${overrideSelectedUser.universityId} | ` : ''}ID: {overrideSelectedUser.id}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideSelectedUser(null);
                      setOverrideUserSearch('');
                      if (activeLogTab === 'FOCUS') setActiveLogTab('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                      isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-rose-500/30' : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                    }`}
                  >
                    ✕ เปลี่ยนผู้ใช้
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="พิมพ์รหัสนักศึกษา, User ID, ชื่อ-นามสกุล หรือ อีเมล..."
                      value={overrideUserSearch}
                      onChange={(e) => setOverrideUserSearch(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-2xl border font-mono text-xs ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 font-semibold placeholder-slate-400'
                      }`}
                    />
                  </div>

                  <div
                    className={`max-h-40 overflow-y-auto rounded-2xl border divide-y ${
                      isDarkMode ? 'bg-slate-800/90 border-slate-700 divide-slate-700/50' : 'bg-slate-50 border-slate-200 divide-slate-200'
                    }`}
                  >
                    {filteredUsersForOverride.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-[11px]">ไม่พบข้อมูลผู้ใช้ที่ตรงกับเงื่อนไข</div>
                    ) : (
                      filteredUsersForOverride.slice(0, 10).map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setOverrideSelectedUser(u);
                            setOverrideErrorMsg('');
                            setActiveLogTab('FOCUS'); // Auto switch to Focus mode in table
                          }}
                          className={`p-2.5 hover:bg-sky-500/10 transition cursor-pointer flex items-center justify-between text-xs ${
                            isDarkMode ? 'hover:text-sky-300' : 'hover:text-sky-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                u.role === UserRole.TEACHER ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                              }`}
                            >
                              {u.role === UserRole.TEACHER ? 'อาจารย์' : 'นักศึกษา'}
                            </span>
                            <span className="font-bold">
                              {u.title || ''}
                              {u.firstNameTh} {u.lastNameTh}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {u.universityId ? `รหัส: ${u.universityId}` : `ID: ${u.id}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Select Course & Session */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">2. เลือกรายวิชา *</label>
                <select
                  value={overrideCourseId}
                  onChange={(e) => {
                    setOverrideCourseId(e.target.value);
                    setOverrideSessionId('');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- เลือกวิชา --</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode || c.code} - {c.courseName || c.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">3. สัปดาห์ / Session *</label>
                <select
                  value={overrideSessionId}
                  onChange={(e) => setOverrideSessionId(e.target.value)}
                  disabled={!overrideCourseId}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- เลือก Session --</option>
                  {sessionsForSelectedCourse.map((s) => (
                    <option key={s.id} value={s.id}>
                      สัปดาห์ที่ {s.weekNumber}: {s.topic || 'ไม่มีหัวข้อ'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Select New Status */}
            <div>
              <label className="block font-bold mb-1">4. สถานะที่ต้องการปรับ *</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { status: AttendanceStatus.PRESENT, label: '🟢 มาเรียน (Present)', color: 'emerald' },
                  { status: AttendanceStatus.LATE, label: '🟡 สาย (Late)', color: 'amber' },
                  { status: AttendanceStatus.LEAVE, label: '🔵 ลา (Leave)', color: 'sky' },
                  { status: AttendanceStatus.ABSENT, label: '🔴 ขาด (Absent)', color: 'rose' },
                ].map((st) => (
                  <button
                    type="button"
                    key={st.status}
                    onClick={() => setOverrideStatus(st.status)}
                    className={`py-2 px-1 rounded-xl font-bold text-[11px] border transition cursor-pointer text-center ${
                      overrideStatus === st.status
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave Details Sub-fields when LEAVE is selected */}
            {(overrideStatus === AttendanceStatus.LEAVE || overrideStatus === 'LEAVE') && (
              <div className={`p-4 rounded-2xl border space-y-3.5 animate-fade-in ${isDarkMode ? 'bg-sky-950/30 border-sky-800/50' : 'bg-sky-50/80 border-sky-200'}`}>
                <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-extrabold text-xs">
                  <FileText className="w-4 h-4" />
                  <span>รายละเอียดการลา (ระบบลา / Leave Details)</span>
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                    ประเภทการลา *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: LeaveType.SICK, label: '🏥 ลาป่วย' },
                      { type: LeaveType.PERSONAL, label: '💼 ลากิจ' },
                      { type: LeaveType.OTHER, label: '📝 ลาอื่นๆ' },
                    ].map((lt) => (
                      <button
                        type="button"
                        key={lt.type}
                        onClick={() => setOverrideLeaveType(lt.type)}
                        className={`py-2 px-2 rounded-xl font-bold text-xs border transition cursor-pointer text-center ${
                          overrideLeaveType === lt.type
                            ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/30'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {lt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leave Approval Status */}
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                    สถานะการอนุมัติใบลา *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { status: LeaveStatus.APPROVED, label: '✅ อนุมัติแล้ว' },
                      { status: LeaveStatus.PENDING, label: '⏳ รอพิจารณา' },
                      { status: LeaveStatus.REJECTED, label: '❌ ไม่อนุมัติ' },
                    ].map((ls) => (
                      <button
                        type="button"
                        key={ls.status}
                        onClick={() => setOverrideLeaveStatus(ls.status)}
                        className={`py-2 px-2 rounded-xl font-bold text-xs border transition cursor-pointer text-center ${
                          overrideLeaveStatus === ls.status
                            ? ls.status === LeaveStatus.APPROVED
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                              : ls.status === LeaveStatus.PENDING
                              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                              : 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Reason */}
            <div>
              <label className="block font-bold mb-1">5. เหตุผลการปรับสถานะ (Audit Trail)</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="เช่น ใบลาป่วยได้รับการอนุมัติ, สแกนไม่ผ่านเนื่องจากสัญญาณ..."
                className={`w-full p-2.5 rounded-xl border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingOverride}
              className="w-full py-3 rounded-2xl font-extrabold text-xs text-white bg-sky-600 hover:bg-sky-500 transition shadow-lg shadow-sky-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingOverride ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการปรับสถานะเช็กชื่อ'}
            </button>
          </form>
        </div>

        {/* History / Audit Logs Overview */}
        <div
          className={`p-6 rounded-3xl border shadow-xl flex flex-col justify-between ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <h3 className="text-base font-extrabold flex items-center space-x-2 mb-4">
              <History className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span>สรุปภาพรวมประวัติการเข้าเรียน (Attendance Summary)</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold text-slate-400 block">นักศึกษาเช็กชื่อแล้ว</span>
                <span className="text-2xl font-black text-emerald-500">{studentAttendance.length}</span>
                <span className="text-[10px] text-slate-500 block mt-1">รายการทั้งหมด</span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold text-slate-400 block">อาจารย์เช็กชื่อสอน</span>
                <span className="text-2xl font-black text-amber-500">{teacherAttendance.length}</span>
                <span className="text-[10px] text-slate-500 block mt-1">รายการทั้งหมด</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/50 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <h4 className="font-extrabold text-purple-600 dark:text-purple-400">💡 หมายเหตุการทำงาน:</h4>
              <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                <li>การบันทึก Override จะสร้างหรืออัปเดตเอกสารในฐานข้อมูล Realtime ทันที</li>
                <li>นักศึกษาและอาจารย์จะเห็นสถานะที่ปรับเปลี่ยนทันทีบนหน้าแอปพลิเคชัน</li>
                <li>ทุกการปรับเปลี่ยนสถานะจะระบุเหตุผลและผู้ดำเนินการ Admin เพื่อความโปร่งใส</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => loadOverrideTabData()}
              disabled={loadingOverrideData}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 cursor-pointer ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverrideData ? 'animate-spin' : ''}`} />
              <span>รีเฟรชประวัติ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ALL ATTENDANCE STATUSES TABLE (ตารางสถานะการเข้าชั้นเรียนทั้งหมด) */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        {/* Table Title and Control Tabs */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    สถานะการเข้าชั้นเรียนทั้งหมด (All Attendance Statuses)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    แสดงสถานะการเช็กชื่อของนักศึกษาและอาจารย์ทั้งหมด สามารถเรียงลำดับ กรองข้อมูล หรือโฟกัสรายบุคคลได้
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Tabs (including User Focus tab) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setActiveLogTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeLogTab === 'ALL'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>ทั้งหมด</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                  {studentAttendance.length + teacherAttendance.length}
                </span>
              </button>

              <button
                onClick={() => setActiveLogTab('STUDENT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeLogTab === 'STUDENT'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>นักศึกษา</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 font-mono">
                  {studentAttendance.length}
                </span>
              </button>

              <button
                onClick={() => setActiveLogTab('TEACHER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeLogTab === 'TEACHER'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>อาจารย์</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 font-mono">
                  {teacherAttendance.length}
                </span>
              </button>

              {/* Dynamic Focused User Tab */}
              {overrideSelectedUser && (
                <button
                  onClick={() => setActiveLogTab('FOCUS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 border ${
                    activeLogTab === 'FOCUS'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>
                    {overrideSelectedUser.title || ''}
                    {overrideSelectedUser.firstNameTh} {overrideSelectedUser.lastNameTh}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar: Search & Select Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            {/* Search Box */}
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="ค้นชื่อ, รหัสนักศึกษา, วิชา, เหตุผล..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border transition ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Course Filter */}
            <div className="relative">
              <select
                value={logFilterCourse}
                onChange={(e) => setLogFilterCourse(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">วิชาทั้งหมด ({allCourses.length})</option>
                {allCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode || c.code} - {c.courseName || c.nameTh}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={logFilterStatus}
                onChange={(e) => setLogFilterStatus(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">สถานะทั้งหมด</option>
                <option value="PRESENT">🟢 มาเรียน (PRESENT)</option>
                <option value="LATE">🟡 สาย (LATE)</option>
                <option value="LEAVE">🔵 ลา (LEAVE)</option>
                <option value="ABSENT">🔴 ขาด (ABSENT)</option>
              </select>
            </div>

            {/* Clear Filters / Result Count */}
            <div className="flex items-center justify-between sm:justify-end space-x-2">
              <span className="text-xs font-bold text-slate-500">
                พบ <span className="text-sky-600 dark:text-sky-400 font-extrabold">{totalItems}</span> รายการ
              </span>
              {(logSearchQuery || logFilterCourse !== 'ALL' || logFilterStatus !== 'ALL') && (
                <button
                  onClick={() => {
                    setLogSearchQuery('');
                    setLogFilterCourse('ALL');
                    setLogFilterStatus('ALL');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Display */}
        <div
          className={`rounded-3xl border overflow-hidden shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr
                  className={`border-b select-none ${
                    isDarkMode ? 'bg-slate-800/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800 font-extrabold'
                  }`}
                >
                  {/* Column 1: User */}
                  <th
                    onClick={() => handleSort('user')}
                    className="p-3.5 font-extrabold uppercase cursor-pointer hover:bg-slate-700/20 transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>ผู้ใช้งาน</span>
                      {sortColumn === 'user' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Column 2: Course / Session */}
                  <th
                    onClick={() => handleSort('course')}
                    className="p-3.5 font-extrabold uppercase cursor-pointer hover:bg-slate-700/20 transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>วิชา / สัปดาห์</span>
                      {sortColumn === 'course' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Column 3: Status */}
                  <th
                    onClick={() => handleSort('status')}
                    className="p-3.5 font-extrabold uppercase cursor-pointer hover:bg-slate-700/20 transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>สถานะเข้าเรียน</span>
                      {sortColumn === 'status' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Column 4: Checkin Method & Reason */}
                  <th
                    onClick={() => handleSort('method')}
                    className="p-3.5 font-extrabold uppercase cursor-pointer hover:bg-slate-700/20 transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>วิธีเช็กชื่อ / เหตุผล</span>
                      {sortColumn === 'method' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Column 5: Timestamp */}
                  <th
                    onClick={() => handleSort('time')}
                    className="p-3.5 font-extrabold uppercase cursor-pointer hover:bg-slate-700/20 transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>เวลาที่บันทึก</span>
                      {sortColumn === 'time' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Column 6: Actions */}
                  <th className="p-3.5 font-extrabold uppercase text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 font-semibold">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <UserIcon className="w-8 h-8 text-slate-500 opacity-40" />
                        <p>ไม่พบข้อมูลสถานะการเข้าชั้นเรียนตามเงื่อนไขที่กำหนด</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const matchedCourse = allCourses.find((c) => c.id === log.courseId);
                    const isFocused =
                      overrideSelectedUser &&
                      (log.targetUserId === overrideSelectedUser.id || log.displayId === overrideSelectedUser.universityId);

                    return (
                      <tr
                        key={log.id}
                        className={`transition ${
                          isFocused
                            ? isDarkMode
                              ? 'bg-purple-950/30 hover:bg-purple-950/40'
                              : 'bg-purple-50/70 hover:bg-purple-100/80'
                            : isDarkMode
                            ? 'hover:bg-slate-800/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* User info */}
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                                log.logType === 'TEACHER' ? 'bg-amber-500' : 'bg-sky-600'
                              }`}
                            >
                              {log.logType === 'TEACHER' ? <UserCheck className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-extrabold flex items-center space-x-1.5">
                                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{log.displayName}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                    log.logType === 'TEACHER'
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                                  }`}
                                >
                                  {log.logType === 'TEACHER' ? 'อาจารย์' : 'นักศึกษา'}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">{log.displayId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Course & Session */}
                        <td className="p-3.5">
                          <div className="font-bold text-purple-600 dark:text-purple-400">
                            {matchedCourse ? matchedCourse.courseCode || matchedCourse.code : log.courseId}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {matchedCourse ? matchedCourse.courseName || matchedCourse.nameTh : ''}
                            {log.weekNumber ? ` (สัปดาห์ที่ ${log.weekNumber})` : ''}
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-black border ${
                              log.status === AttendanceStatus.PRESENT || log.status === 'PRESENT'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : log.status === AttendanceStatus.LATE || log.status === 'LATE'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : log.status === AttendanceStatus.LEAVE || log.status === 'LEAVE'
                                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {log.status === AttendanceStatus.PRESENT || log.status === 'PRESENT'
                              ? '🟢 มาเรียน (PRESENT)'
                              : log.status === AttendanceStatus.LATE || log.status === 'LATE'
                              ? '🟡 สาย (LATE)'
                              : log.status === AttendanceStatus.LEAVE || log.status === 'LEAVE'
                              ? '🔵 ลา (LEAVE)'
                              : '🔴 ขาด (ABSENT)'}
                          </span>
                        </td>

                        {/* Method & Reason */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          <div className="font-mono text-[11px] font-bold">
                            {log.checkinMethod || log.method || 'ADMIN_OVERRIDE'}
                          </div>
                          {(log.reason || log.note) && (
                            <div className="text-[10px] text-slate-400 truncate max-w-xs" title={log.reason || log.note}>
                              {log.reason || log.note}
                            </div>
                          )}
                        </td>

                        {/* Time */}
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : '-'}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEdit(log)}
                              title="แก้ไข"
                              className="p-1.5 rounded-lg font-bold text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition flex items-center space-x-1 cursor-pointer active:scale-95"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">แก้ไข</span>
                            </button>
                            <button
                              onClick={() => setDeletingLog(log)}
                              title="ลบ"
                              className="p-1.5 rounded-lg font-bold text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex items-center space-x-1 cursor-pointer active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">ลบ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div
            className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <span>แสดงจำนวน:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value={10}>10 รายการ</option>
                <option value={15}>15 รายการ</option>
                <option value={30}>30 รายการ</option>
                <option value={50}>50 รายการ</option>
                <option value={-1}>ทั้งหมด ({totalItems})</option>
              </select>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-extrabold px-2">
                  หน้า {currentPage} จาก {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">แก้ไขสถานะการเข้าชั้นเรียน</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingLog.displayName} ({editingLog.displayId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Info preview */}
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">ประเภท:</span>
                  <span className="font-extrabold text-sky-600 dark:text-sky-400">
                    {editingLog.logType === 'TEACHER' ? 'อาจารย์' : 'นักศึกษา'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">วิชา/สัปดาห์:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {editingLog.courseId} {editingLog.weekNumber ? `(สัปดาห์ที่ ${editingLog.weekNumber})` : ''}
                  </span>
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                  สถานะการเข้าเรียน
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="PRESENT">🟢 มาเรียน (PRESENT)</option>
                  <option value="LATE">🟡 สาย (LATE)</option>
                  <option value="LEAVE">🔵 ลา (LEAVE)</option>
                  <option value="ABSENT">🔴 ขาด (ABSENT)</option>
                </select>
              </div>

              {/* Leave Details when status is LEAVE */}
              {(editStatus === 'LEAVE' || editStatus === AttendanceStatus.LEAVE) && (
                <div className={`p-3.5 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-sky-950/30 border-sky-800/50' : 'bg-sky-50/80 border-sky-200'}`}>
                  <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-extrabold text-xs">
                    <FileText className="w-4 h-4" />
                    <span>รายละเอียดการลา (Leave Details)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                      ประเภทการลา
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: LeaveType.SICK, label: '🏥 ลาป่วย' },
                        { type: LeaveType.PERSONAL, label: '💼 ลากิจ' },
                        { type: LeaveType.OTHER, label: '📝 ลาอื่นๆ' },
                      ].map((lt) => (
                        <button
                          type="button"
                          key={lt.type}
                          onClick={() => setEditLeaveType(lt.type)}
                          className={`py-1.5 px-2 rounded-xl font-bold text-xs border transition cursor-pointer text-center ${
                            editLeaveType === lt.type
                              ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                              : isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-300'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {lt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                      สถานะการอนุมัติใบลา
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { status: LeaveStatus.APPROVED, label: '✅ อนุมัติแล้ว' },
                        { status: LeaveStatus.PENDING, label: '⏳ รอพิจารณา' },
                        { status: LeaveStatus.REJECTED, label: '❌ ไม่อนุมัติ' },
                      ].map((ls) => (
                        <button
                          type="button"
                          key={ls.status}
                          onClick={() => setEditLeaveStatus(ls.status)}
                          className={`py-1.5 px-2 rounded-xl font-bold text-xs border transition cursor-pointer text-center ${
                            editLeaveStatus === ls.status
                              ? ls.status === LeaveStatus.APPROVED
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                                : ls.status === LeaveStatus.PENDING
                                ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                                : 'bg-rose-600 text-white border-rose-500 shadow-md'
                              : isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-300'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {ls.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Checkin Method */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                  วิธีเช็กชื่อ / ช่องทาง
                </label>
                <input
                  type="text"
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  placeholder="เช่น ADMIN_EDIT, PASSCODE, BEACON, QR_CODE"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border transition ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Reason / Note */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                  เหตุผล / หมายเหตุ
                </label>
                <textarea
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="ระบุเหตุผลการแก้ไข (ถ้ามี)..."
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border transition ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 active:scale-95 transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">ยืนยันการลบรายการเข้าเรียน</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {deletingLog.displayName} ({deletingLog.displayId})
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border text-xs mb-5 ${isDarkMode ? 'bg-rose-950/20 border-rose-800/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              คุณแน่ใจหรือว่าต้องการลบรายการเช็กชื่อนี้ออกอย่างถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95 transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

