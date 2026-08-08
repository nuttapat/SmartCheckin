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
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  LayoutGrid,
  Table,
} from 'lucide-react';

interface AdminOverrideTabProps {
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  setDeleteConfirmItem?: (item: any) => void;
  onRefreshOverview: () => void;
}

export const AdminOverrideTab: React.FC<AdminOverrideTabProps> = ({
  isDarkMode,
  showToast,
  setDeleteConfirmItem,
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
  const [logFilterYear, setLogFilterYear] = useState<string>('ALL');
  const [logFilterSemester, setLogFilterSemester] = useState<string>('ALL');
  const [logFilterWeek, setLogFilterWeek] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<'studentId' | 'user' | 'course' | 'term' | 'week' | 'status' | 'method' | 'time'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Column Visibility State
  const [visibleCols, setVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    studentId: true,
    user: true,
    course: true,
    term: true,
    week: true,
    status: true,
    method: true,
    time: true,
    actions: true,
  });
  const [showColPicker, setShowColPicker] = useState<boolean>(false);
  const [viewDisplayMode, setViewDisplayMode] = useState<'COMPACT' | 'CARDS' | 'FULL'>('COMPACT');

  const COLUMN_CONFIG: { key: string; label: string }[] = [
    { key: 'select', label: 'กล่องเลือก (Select)' },
    { key: 'index', label: 'ลำดับ (#)' },
    { key: 'studentId', label: 'รหัสประจำตัว' },
    { key: 'user', label: 'ผู้ใช้งาน' },
    { key: 'course', label: 'วิชา' },
    { key: 'term', label: 'ปีการศึกษา/ภาคเรียน' },
    { key: 'week', label: 'สัปดาห์' },
    { key: 'status', label: 'สถานะเข้าเรียน' },
    { key: 'method', label: 'วิธีเช็กชื่อ/เหตุผล' },
    { key: 'time', label: 'เวลาที่บันทึก' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Table Column Widths & Drag Resize Handler
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({
    select: 40,
    index: 45,
    studentId: 120,
    user: 160,
    course: 160,
    term: 140,
    week: 85,
    status: 125,
    method: 155,
    time: 140,
    actions: 90,
  });

  const handleMouseDownResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(35, startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Edit & Delete Log Modal State
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editCourseId, setEditCourseId] = useState<string>('');
  const [editWeekNumber, setEditWeekNumber] = useState<number | string>(1);
  const [editStatus, setEditStatus] = useState<string>('PRESENT');
  const [editLeaveType, setEditLeaveType] = useState<LeaveType>(LeaveType.SICK);
  const [editLeaveStatus, setEditLeaveStatus] = useState<LeaveStatus>(LeaveStatus.APPROVED);
  const [editMethod, setEditMethod] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Bulk Edit Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState<boolean>(false);
  const [bulkChangeCourse, setBulkChangeCourse] = useState<boolean>(false);
  const [bulkCourseId, setBulkCourseId] = useState<string>('');
  const [bulkChangeWeek, setBulkChangeWeek] = useState<boolean>(false);
  const [bulkWeekNumber, setBulkWeekNumber] = useState<number | string>(1);
  const [bulkChangeStatus, setBulkChangeStatus] = useState<boolean>(false);
  const [bulkStatus, setBulkStatus] = useState<string>('PRESENT');
  const [bulkChangeMethod, setBulkChangeMethod] = useState<boolean>(false);
  const [bulkMethod, setBulkMethod] = useState<string>('ADMIN_BULK_EDIT');
  const [bulkChangeReason, setBulkChangeReason] = useState<boolean>(false);
  const [bulkReason, setBulkReason] = useState<string>('');
  const [isSavingBulkEdit, setIsSavingBulkEdit] = useState<boolean>(false);

  const [deletingLog, setDeletingLog] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleOpenEdit = (log: any) => {
    setEditingLog(log);
    setEditCourseId(log.courseId || (allCourses[0]?.id || ''));
    setEditWeekNumber(log.weekNumber || 1);
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
      const targetCourseId = editCourseId || editingLog.courseId;
      const targetWeekNumber = Number(editWeekNumber) || Number(editingLog.weekNumber) || 1;
      const courseObj = allCourses.find((c) => c.id === targetCourseId);
      const sessionObj =
        allSessions.find((s) => s.courseId === targetCourseId && Number(s.weekNumber) === targetWeekNumber) ||
        allSessions.find((s) => s.id === editingLog.sessionId);
      const targetSessionId = sessionObj?.id || editingLog.sessionId || '';

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
                l.courseId === targetCourseId &&
                (l.sessionId === targetSessionId || Number(l.weekNumber) === targetWeekNumber)
            );

        const leaveData: any = {
          id: existingLeave ? existingLeave.id : realLeaveId || `leave_admin_${Date.now()}`,
          studentId: editingLog.targetUserId || editingLog.studentId || editingLog.userId,
          studentNameTh: editingLog.displayName || 'นักศึกษา',
          studentUniversityId: editingLog.displayId || '',
          courseId: targetCourseId,
          courseCode: courseObj?.courseCode || courseObj?.code || '',
          courseName: courseObj?.courseName || courseObj?.nameTh || '',
          weekNumber: targetWeekNumber,
          sessionId: targetSessionId,
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
              courseId: targetCourseId,
              weekNumber: targetWeekNumber,
              sessionId: targetSessionId,
              status: AttendanceStatus.LEAVE,
              checkinMethod: editMethod || `ใบลา (${leaveTypeTh})`,
              reason: editReason,
              timestamp: new Date().toISOString(),
            });
          } else {
            await overrideAttendanceRecord({
              studentId: editingLog.targetUserId || editingLog.studentId,
              sessionId: targetSessionId || undefined,
              courseId: targetCourseId || undefined,
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
            sessionId: targetSessionId || undefined,
            courseId: targetCourseId || undefined,
            status: editStatus,
            checkinMethod: editMethod || 'ADMIN_EDIT',
          });
        } else if (editingLog.logType === 'TEACHER') {
          await saveAdminDocument('teacherAttendanceRecords', {
            ...editingLog,
            courseId: targetCourseId,
            weekNumber: targetWeekNumber,
            sessionId: targetSessionId,
            status: editStatus,
            checkinMethod: editMethod,
            note: editReason,
            timestamp: new Date().toISOString(),
          });
        } else {
          await saveAdminDocument('attendanceRecords', {
            ...editingLog,
            courseId: targetCourseId,
            weekNumber: targetWeekNumber,
            sessionId: targetSessionId,
            status: editStatus,
            checkinMethod: editMethod,
            reason: editReason,
            timestamp: new Date().toISOString(),
          });
        }
      }

      showToast('แก้ไขข้อมูลและเชื่อมโยงระบบเรียบร้อยแล้ว');
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

  const handleSaveBulkEdit = async () => {
    if (selectedLogIds.length === 0) return;
    setIsSavingBulkEdit(true);
    try {
      let updatedCount = 0;
      for (const id of selectedLogIds) {
        const log = combinedAttendanceLogs.find((l) => l.id === id);
        if (!log) continue;

        const targetCourseId = bulkChangeCourse && bulkCourseId ? bulkCourseId : log.courseId;
        const targetWeekNumber = bulkChangeWeek ? Number(bulkWeekNumber) : (Number(log.weekNumber) || 1);
        const targetStatus = bulkChangeStatus ? bulkStatus : log.status;
        const targetMethod = bulkChangeMethod ? bulkMethod : (log.checkinMethod || log.method || 'BULK_EDIT');
        const targetReason = bulkChangeReason ? bulkReason : (log.reason || log.note || '');

        const courseObj = allCourses.find((c) => c.id === targetCourseId);
        const sessionObj =
          allSessions.find((s) => s.courseId === targetCourseId && Number(s.weekNumber) === targetWeekNumber) ||
          allSessions.find((s) => s.id === log.sessionId);
        const targetSessionId = sessionObj?.id || log.sessionId || '';

        if (log.isLeaveRequestRecord) {
          const realId = log.id.startsWith('leave_') ? log.id.replace('leave_', '') : log.id;
          const existingLeave = allLeaveRequests.find((l) => l.id === realId);
          const leaveData: any = {
            ...(existingLeave || log),
            id: realId,
            courseId: targetCourseId,
            courseCode: courseObj?.courseCode || courseObj?.code || '',
            courseName: courseObj?.courseName || courseObj?.nameTh || '',
            weekNumber: targetWeekNumber,
            sessionId: targetSessionId,
            status: bulkChangeStatus ? (targetStatus === 'LEAVE' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED) : (existingLeave?.status || LeaveStatus.APPROVED),
            reason: targetReason || existingLeave?.reason,
            teacherComment: targetReason || existingLeave?.teacherComment || 'แก้ไขแบบกลุ่มโดยแอดมิน',
            updatedAt: new Date().toISOString(),
          };

          await saveAdminDocument('leaveRequests', leaveData);

          if (bulkChangeStatus && targetStatus !== 'LEAVE') {
            await overrideAttendanceRecord({
              studentId: log.targetUserId || log.studentId,
              courseId: targetCourseId,
              sessionId: targetSessionId,
              status: targetStatus,
              checkinMethod: targetMethod,
            });
          }
        } else if (log.logType === 'TEACHER') {
          await saveAdminDocument('teacherAttendanceRecords', {
            ...log,
            courseId: targetCourseId,
            weekNumber: targetWeekNumber,
            sessionId: targetSessionId,
            status: targetStatus,
            checkinMethod: targetMethod,
            note: targetReason,
            timestamp: new Date().toISOString(),
          });
        } else {
          await saveAdminDocument('attendanceRecords', {
            ...log,
            courseId: targetCourseId,
            weekNumber: targetWeekNumber,
            sessionId: targetSessionId,
            status: targetStatus,
            checkinMethod: targetMethod,
            reason: targetReason,
            timestamp: new Date().toISOString(),
          });
        }
        updatedCount++;
      }

      showToast(`แก้ไขข้อมูลแบบกลุ่มจำนวน ${updatedCount} รายการเรียบร้อยแล้ว`);
      setIsBulkEditOpen(false);
      setSelectedLogIds([]);
      await loadOverrideTabData(true);
      onRefreshOverview();
    } catch (err: any) {
      console.error('Failed to save bulk edit:', err);
      showToast(`เกิดข้อผิดพลาดในการแก้ไขแบบกลุ่ม: ${err.message || 'ไม่สามารถบันทึกได้'}`);
    } finally {
      setIsSavingBulkEdit(false);
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
  const handleSort = (col: 'studentId' | 'user' | 'course' | 'term' | 'week' | 'status' | 'method' | 'time') => {
    if (sortColumn === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  // Derived available academic years from courses
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allCourses.forEach((c) => {
      if (c.academicYear) years.add(Number(c.academicYear));
    });
    if (years.size === 0) {
      years.add(2569);
      years.add(2568);
      years.add(2567);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allCourses]);

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

    const tLogs = teacherAttendance.map((a) => {
      const sess = allSessions.find((s) => s.id === a.sessionId);
      const courseId = a.courseId || sess?.courseId;
      const weekNumber = a.weekNumber || sess?.weekNumber;
      return {
        ...a,
        courseId,
        weekNumber,
        logType: 'TEACHER',
        displayName: a.teacherNameTh || 'อาจารย์ผู้สอน',
        displayId: a.teacherId || a.userId,
        targetUserId: a.teacherId || a.userId,
      };
    });

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

        // Academic Year Filter
        if (logFilterYear !== 'ALL') {
          const matchedCourse = allCourses.find((c) => c.id === log.courseId);
          if (!matchedCourse || String(matchedCourse.academicYear) !== String(logFilterYear)) {
            return false;
          }
        }

        // Semester Filter
        if (logFilterSemester !== 'ALL') {
          const matchedCourse = allCourses.find((c) => c.id === log.courseId);
          if (!matchedCourse || String(matchedCourse.semester) !== String(logFilterSemester)) {
            return false;
          }
        }

        // Week Number Filter
        if (logFilterWeek !== 'ALL') {
          if (String(log.weekNumber) !== String(logFilterWeek)) {
            return false;
          }
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

        if (sortColumn === 'studentId') {
          valA = (a.displayId || '').toLowerCase();
          valB = (b.displayId || '').toLowerCase();
        } else if (sortColumn === 'user') {
          valA = (a.displayName || '').toLowerCase();
          valB = (b.displayName || '').toLowerCase();
        } else if (sortColumn === 'course') {
          const courseA = allCourses.find((c) => c.id === a.courseId);
          const courseB = allCourses.find((c) => c.id === b.courseId);
          valA = (courseA?.courseCode || courseA?.code || a.courseId || '').toLowerCase();
          valB = (courseB?.courseCode || courseB?.code || b.courseId || '').toLowerCase();
        } else if (sortColumn === 'term') {
          const courseA = allCourses.find((c) => c.id === a.courseId);
          const courseB = allCourses.find((c) => c.id === b.courseId);
          valA = courseA ? `${courseA.academicYear}/${courseA.semester}` : '';
          valB = courseB ? `${courseB.academicYear}/${courseB.semester}` : '';
        } else if (sortColumn === 'week') {
          const wA = Number(a.weekNumber || 0);
          const wB = Number(b.weekNumber || 0);
          return sortDir === 'desc' ? wB - wA : wA - wB;
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
    logFilterYear,
    logFilterSemester,
    logFilterWeek,
    logSearchQuery,
    sortColumn,
    sortDir,
    allCourses,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeLogTab,
    logFilterCourse,
    logFilterStatus,
    logFilterYear,
    logFilterSemester,
    logFilterWeek,
    logSearchQuery,
    sortColumn,
    sortDir,
  ]);

  // Pagination calculation
  const totalItems = combinedAttendanceLogs.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    if (pageSize === -1) return combinedAttendanceLogs;
    const start = (currentPage - 1) * pageSize;
    return combinedAttendanceLogs.slice(start, start + pageSize);
  }, [combinedAttendanceLogs, currentPage, pageSize]);

  // Selection state for log table
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const allPaginatedLogsSelected = paginatedLogs.length > 0 && paginatedLogs.every((l) => selectedLogIds.includes(l.id));

  const handleToggleSelectLog = (id: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedIndex !== null && index !== undefined && lastSelectedIndex !== index) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = paginatedLogs.slice(start, end + 1).map((l) => l.id);

      const isTargetSelected = selectedLogIds.includes(id);

      setSelectedLogIds((prev) => {
        if (!isTargetSelected) {
          const newSet = new Set([...prev, ...rangeIds]);
          return Array.from(newSet);
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedLogIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  };

  const handleSelectAllPaginatedLogs = () => {
    if (allPaginatedLogsSelected) {
      setSelectedLogIds([]);
      setLastSelectedIndex(null);
    } else {
      setSelectedLogIds(paginatedLogs.map((l) => l.id));
      setLastSelectedIndex(null);
    }
  };

  // Export attendance records to CSV
  const handleExportCSV = () => {
    const logsToExport = selectedLogIds.length > 0
      ? combinedAttendanceLogs.filter((log) => selectedLogIds.includes(log.id))
      : combinedAttendanceLogs;

    if (logsToExport.length === 0) {
      showToast('ไม่มีข้อมูลสถานะการเข้าชั้นเรียนสำหรับส่งออก');
      return;
    }

    const headers = [
      'ลำดับ',
      'ประเภท',
      'รหัสประจำตัวนักศึกษา',
      'ชื่อ-นามสกุลผู้ใช้งาน',
      'รหัสวิชา',
      'ชื่อวิชา',
      'ปีการศึกษา',
      'ภาคเรียน',
      'สัปดาห์ที่',
      'สถานะการเข้าเรียน',
      'วิธีเช็กชื่อ/ประเภทการลา',
      'เหตุผล/บันทึก',
      'เวลาที่บันทึก',
    ];

    const rows = logsToExport.map((log, index) => {
      const matchedCourse = allCourses.find((c) => c.id === log.courseId);
      const courseCode = matchedCourse ? (matchedCourse.courseCode || matchedCourse.code || '') : (log.courseId || '');
      const courseName = matchedCourse ? (matchedCourse.courseName || matchedCourse.nameTh || '') : '';
      const academicYear = matchedCourse ? (matchedCourse.academicYear || '') : '';
      const semester = matchedCourse ? (matchedCourse.semester || '') : '';
      const userType = log.logType === 'TEACHER' ? 'อาจารย์' : 'นักศึกษา';
      const statusTh =
        log.status === AttendanceStatus.PRESENT || log.status === 'PRESENT'
          ? 'มาเรียน (PRESENT)'
          : log.status === AttendanceStatus.LATE || log.status === 'LATE'
          ? 'สาย (LATE)'
          : log.status === AttendanceStatus.LEAVE || log.status === 'LEAVE'
          ? 'ลา (LEAVE)'
          : 'ขาด (ABSENT)';

      const timeStr = log.timestamp
        ? new Date(log.timestamp).toLocaleString('th-TH')
        : log.createdAt
        ? new Date(log.createdAt).toLocaleString('th-TH')
        : '-';

      return [
        index + 1,
        userType,
        log.displayId || '',
        log.displayName || '',
        courseCode,
        courseName,
        academicYear,
        semester,
        log.weekNumber ? `สัปดาห์ที่ ${log.weekNumber}` : '-',
        statusTh,
        log.checkinMethod || log.method || 'ADMIN_OVERRIDE',
        log.reason || log.note || '-',
        timeStr,
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((field) => {
              const str = String(field ?? '').replace(/"/g, '""');
              return `"${str}"`;
            })
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `attendance_statuses_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`ส่งออกข้อมูล CSV เรียบร้อยแล้ว (${logsToExport.length} รายการ)`);
  };

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
          <div className="flex flex-col gap-3.5 mb-4">
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

            {/* Filter Tabs & Export CSV Button */}
            <div className="flex flex-wrap items-center justify-start gap-2">
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

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-2xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer flex items-center space-x-1.5 border border-emerald-500/30 shrink-0"
                title="ส่งออกข้อมูลตารางนี้เป็นไฟล์ CSV"
              >
                <Download className="w-4 h-4" />
                <span>ส่งออก CSV</span>
              </button>
            </div>
          </div>

          {/* Filters Bar: Search & Select Dropdowns */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Search Box */}
              <div className="relative">
                <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="ค้นชื่อ, รหัสนักศึกษา, วิชา..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border transition ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Academic Year Filter */}
              <div className="relative">
                <select
                  value={logFilterYear}
                  onChange={(e) => setLogFilterYear(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">ปีการศึกษาทั้งหมด</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      ปีการศึกษา {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="relative">
                <select
                  value={logFilterSemester}
                  onChange={(e) => setLogFilterSemester(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">ภาคการศึกษาทั้งหมด</option>
                  <option value="1">ภาคการศึกษาที่ 1</option>
                  <option value="2">ภาคการศึกษาที่ 2</option>
                  <option value="3">ภาคการศึกษาที่ 3 (ฤดูร้อน)</option>
                </select>
              </div>

              {/* Week Number Filter */}
              <div className="relative">
                <select
                  value={logFilterWeek}
                  onChange={(e) => setLogFilterWeek(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">สัปดาห์ทั้งหมด</option>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      สัปดาห์ที่ {w}
                    </option>
                  ))}
                </select>
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
            </div>

            {/* Clear Filters / Result Count / Column Settings / Export CSV */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-1">
              <span className="text-xs font-bold text-slate-500">
                พบ <span className="text-sky-600 dark:text-sky-400 font-extrabold">{totalItems}</span> รายการ
              </span>
              {(logSearchQuery ||
                logFilterCourse !== 'ALL' ||
                logFilterStatus !== 'ALL' ||
                logFilterYear !== 'ALL' ||
                logFilterSemester !== 'ALL' ||
                logFilterWeek !== 'ALL') && (
                <button
                  onClick={() => {
                    setLogSearchQuery('');
                    setLogFilterCourse('ALL');
                    setLogFilterStatus('ALL');
                    setLogFilterYear('ALL');
                    setLogFilterSemester('ALL');
                    setLogFilterWeek('ALL');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}

              {/* View Display Mode Selector */}
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('COMPACT')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    viewDisplayMode === 'COMPACT'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="โหมดตารางกะทัดรัด (พอดีหน้าจอ ไม่ต้อง scrolling)"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>ตารางกะทัดรัด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('CARDS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    viewDisplayMode === 'CARDS'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="โหมดการ์ด (Card View - เหมาะสำหรับมือถือ/แท็บเล็ต)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>การ์ด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('FULL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    viewDisplayMode === 'FULL'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="โหมดตารางเต็มรูปแบบ (มี Scrollbar และปรับขนาดคอลัมน์ได้)"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>ตารางเต็ม</span>
                </button>
              </div>

              {/* Column Settings Button & Popover */}
              {viewDisplayMode === 'FULL' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColPicker(!showColPicker)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center space-x-1 border ${
                      showColPicker
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                    }`}
                    title="เลือกคอลัมน์ที่จะแสดง"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>ตั้งค่าคอลัมน์</span>
                  </button>

                  {showColPicker && (
                    <div
                      className={`absolute right-0 mt-2 w-64 p-3 rounded-2xl shadow-xl border z-30 transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="text-xs font-black flex items-center space-x-1.5">
                          <Sliders className="w-3.5 h-3.5 text-sky-500" />
                          <span>แสดง/ซ่อน คอลัมน์</span>
                        </span>
                        <button
                          onClick={() => setShowColPicker(false)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {COLUMN_CONFIG.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold transition select-none"
                          >
                            <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                            <input
                              type="checkbox"
                              checked={!!visibleCols[col.key]}
                              onChange={(e) =>
                                setVisibleCols((prev) => ({
                                  ...prev,
                                  [col.key]: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800 mt-2 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCols({
                              select: true,
                              index: true,
                              studentId: true,
                              user: true,
                              course: true,
                              term: true,
                              week: true,
                              status: true,
                              method: true,
                              time: true,
                              actions: true,
                            })
                          }
                          className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          แสดงทั้งหมด
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowColPicker(false)}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 text-white hover:bg-sky-500 transition cursor-pointer font-bold"
                        >
                          ตกลง
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer flex items-center space-x-1"
                title="ส่งออกข้อมูลเป็น CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedLogIds.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-sky-600 dark:text-sky-400">
              <CheckSquare className="w-4 h-4" />
              <span>เลือกไว้แล้ว {selectedLogIds.length} รายการ</span>
            </div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {/* Bulk Edit Button */}
              <button
                onClick={() => {
                  setBulkCourseId(allCourses[0]?.id || '');
                  setBulkWeekNumber(1);
                  setBulkStatus('PRESENT');
                  setBulkMethod('ADMIN_BULK_EDIT');
                  setBulkReason('');
                  setBulkChangeCourse(false);
                  setBulkChangeWeek(false);
                  setBulkChangeStatus(true);
                  setBulkChangeMethod(false);
                  setBulkChangeReason(false);
                  setIsBulkEditOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>แก้ไขรายการที่เลือก ({selectedLogIds.length})</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออกรายการที่เลือก (CSV)</span>
              </button>

              <button
                onClick={() => {
                  const bulkDeleteAction = async () => {
                    for (const id of selectedLogIds) {
                      const matched = combinedAttendanceLogs.find((l) => l.id === id);
                      if (matched) {
                        if (matched.isLeaveRequestRecord) {
                          const realId = matched.id.startsWith('leave_') ? matched.id.replace('leave_', '') : matched.id;
                          await deleteAdminDocument('leaveRequests', realId);
                        } else if (matched.logType === 'TEACHER') {
                          await deleteAdminDocument('teacherAttendanceRecords', matched.id);
                        } else {
                          await deleteAdminDocument('attendanceRecords', matched.id);
                        }
                      }
                    }
                    showToast(`ลบประวัติการเข้าเรียน/ลาจำนวน ${selectedLogIds.length} รายการเรียบร้อยแล้ว`);
                    setSelectedLogIds([]);
                    await loadOverrideTabData(true);
                    onRefreshOverview();
                  };

                  if (setDeleteConfirmItem) {
                    setDeleteConfirmItem({
                      type: 'bulk_attendance_logs',
                      title: `ลบรายการเช็กชื่อ/ลาแบบกลุ่ม (${selectedLogIds.length} รายการ)`,
                      subtitle: `คุณกำลังจะลบข้อมูลการเช็กชื่อและประวัติการลาจำนวน ${selectedLogIds.length} รายการออกจากระบบถาวร`,
                      action: bulkDeleteAction,
                    });
                  } else {
                    if (window.confirm(`ยืนยันการลบรายการเช็กชื่อ/ลาจำนวน ${selectedLogIds.length} รายการ?`)) {
                      bulkDeleteAction();
                    }
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายการที่เลือก ({selectedLogIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Table / Card Display */}
        <div
          className={`rounded-3xl border overflow-hidden shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* 1. COMPACT MODE (Default: Fits Screen, No Horizontal Scrolling) */}
          {viewDisplayMode === 'COMPACT' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b select-none ${
                      isDarkMode ? 'bg-slate-800/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800 font-extrabold'
                    }`}
                  >
                    <th className="p-3 text-center w-10">
                      <button
                        onClick={handleSelectAllPaginatedLogs}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        {allPaginatedLogsSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 text-center text-slate-400 w-10">#</th>
                    <th className="p-3 font-extrabold uppercase">
                      <div onClick={() => handleSort('user')} className="flex items-center space-x-1 cursor-pointer">
                        <span>ผู้ใช้งาน / รหัสประจำตัว</span>
                        {sortColumn === 'user' || sortColumn === 'studentId' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 font-extrabold uppercase">
                      <div onClick={() => handleSort('course')} className="flex items-center space-x-1 cursor-pointer">
                        <span>วิชา / สัปดาห์ / ภาคเรียน</span>
                        {sortColumn === 'course' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 font-extrabold uppercase text-center">
                      <div onClick={() => handleSort('status')} className="flex items-center justify-center space-x-1 cursor-pointer">
                        <span>สถานะ</span>
                        {sortColumn === 'status' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 font-extrabold uppercase">
                      <div onClick={() => handleSort('time')} className="flex items-center space-x-1 cursor-pointer">
                        <span>วิธีเช็กชื่อ / เวลาที่บันทึก</span>
                        {sortColumn === 'time' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 font-extrabold uppercase text-center w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <UserIcon className="w-8 h-8 text-slate-500 opacity-40" />
                          <p>ไม่พบข้อมูลสถานะการเข้าชั้นเรียนตามเงื่อนไขที่กำหนด</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => {
                      const matchedCourse = allCourses.find((c) => c.id === log.courseId);
                      const isFocused =
                        overrideSelectedUser &&
                        (log.targetUserId === overrideSelectedUser.id || log.displayId === overrideSelectedUser.universityId);
                      const isSelected = selectedLogIds.includes(log.id);

                      return (
                        <tr
                          key={log.id}
                          className={`transition ${
                            isSelected
                              ? isDarkMode ? 'bg-sky-950/30 hover:bg-sky-950/40' : 'bg-sky-50 hover:bg-sky-100/80'
                              : isFocused
                              ? isDarkMode
                                ? 'bg-purple-950/30 hover:bg-purple-950/40'
                                : 'bg-purple-50/70 hover:bg-purple-100/80'
                              : isDarkMode
                              ? 'hover:bg-slate-800/40'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => handleToggleSelectLog(log.id, idx, e)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-sky-500" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Index */}
                          <td className="p-3 text-center font-mono font-bold text-slate-400 text-xs">
                            {(currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1}
                          </td>

                          {/* Merged User Name & University ID */}
                          <td className="p-3">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{log.displayName}</span>
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
                            <div className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                              {log.displayId || '-'}
                            </div>
                          </td>

                          {/* Merged Course, Week & Term */}
                          <td className="p-3">
                            <div className="font-extrabold text-purple-600 dark:text-purple-400 truncate max-w-[220px]" title={matchedCourse ? `${matchedCourse.courseCode || matchedCourse.code} - ${matchedCourse.courseName || matchedCourse.nameTh}` : log.courseId}>
                              {matchedCourse ? `${matchedCourse.courseCode || matchedCourse.code} - ${matchedCourse.courseName || matchedCourse.nameTh}` : log.courseId}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {log.weekNumber ? `สัปดาห์ที่ ${log.weekNumber}` : 'สัปดาห์ -'} {matchedCourse ? `(ปี ${matchedCourse.academicYear} / ภาค ${matchedCourse.semester})` : ''}
                            </div>
                          </td>

                          {/* Compact Status Badge */}
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-black border whitespace-nowrap ${
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
                                ? '🟢 มาเรียน'
                                : log.status === AttendanceStatus.LATE || log.status === 'LATE'
                                ? '🟡 สาย'
                                : log.status === AttendanceStatus.LEAVE || log.status === 'LEAVE'
                                ? '🔵 ลา'
                                : '🔴 ขาด'}
                            </span>
                          </td>

                          {/* Merged Method & Timestamp */}
                          <td className="p-3">
                            <div className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={log.checkinMethod || log.method}>
                              {log.checkinMethod || log.method || 'ADMIN_OVERRIDE'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : '-'}
                            </div>
                            {(log.reason || log.note) && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={log.reason || log.note}>
                                {log.reason || log.note}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleOpenEdit(log)}
                                title="แก้ไข"
                                className="p-1.5 rounded-lg font-bold text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition flex items-center space-x-1 cursor-pointer active:scale-95"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingLog(log)}
                                title="ลบ"
                                className="p-1.5 rounded-lg font-bold text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex items-center space-x-1 cursor-pointer active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* 2. CARDS MODE (Card View for Mobile/Tablet or Visual Preference) */}
          {viewDisplayMode === 'CARDS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4">
              {paginatedLogs.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-400 font-semibold">
                  <UserIcon className="w-8 h-8 text-slate-500 opacity-40 mx-auto mb-2" />
                  <p>ไม่พบข้อมูลสถานะการเข้าชั้นเรียนตามเงื่อนไขที่กำหนด</p>
                </div>
              ) : (
                paginatedLogs.map((log, idx) => {
                  const matchedCourse = allCourses.find((c) => c.id === log.courseId);
                  const isSelected = selectedLogIds.includes(log.id);

                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-sky-950/40 border-sky-500/50 shadow-md'
                            : 'bg-sky-50/80 border-sky-400 shadow-sm'
                          : isDarkMode
                          ? 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                          : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-start space-x-2">
                          <button
                            onClick={(e) => handleToggleSelectLog(log.id, idx, e)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer mt-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-sky-500" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">{log.displayName}</span>
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
                            <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                              {log.displayId || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleOpenEdit(log)}
                            title="แก้ไข"
                            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingLog(log)}
                            title="ลบ"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black border ${
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
                              ? '🟢 มาเรียน'
                              : log.status === AttendanceStatus.LATE || log.status === 'LATE'
                              ? '🟡 สาย'
                              : log.status === AttendanceStatus.LEAVE || log.status === 'LEAVE'
                              ? '🔵 ลา'
                              : '🔴 ขาด'}
                          </span>
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                            {log.weekNumber ? `สัปดาห์ที่ ${log.weekNumber}` : '-'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs space-y-0.5 border border-slate-200/60 dark:border-slate-700/50">
                          <div className="font-extrabold text-purple-600 dark:text-purple-400">
                            {matchedCourse ? `${matchedCourse.courseCode || matchedCourse.code} - ${matchedCourse.courseName || matchedCourse.nameTh}` : log.courseId}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            ปีการศึกษา {matchedCourse?.academicYear || '-'} / ภาคเรียนที่ {matchedCourse?.semester || '-'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <span className="font-mono font-bold truncate max-w-[150px]">{log.checkinMethod || log.method || 'ADMIN'}</span>
                          <span className="font-mono">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : '-'}
                          </span>
                        </div>

                        {(log.reason || log.note) && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-slate-200/50 dark:bg-slate-800/50 p-2 rounded-lg">
                            "{log.reason || log.note}"
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. FULL MODE (Original 11-column resizable table with horizontal scroll) */}
          {viewDisplayMode === 'FULL' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <colgroup>
                  {visibleCols.select && <col style={{ width: `${colWidths.select}px` }} />}
                  {visibleCols.index && <col style={{ width: `${colWidths.index}px` }} />}
                  {visibleCols.studentId && <col style={{ width: `${colWidths.studentId}px` }} />}
                  {visibleCols.user && <col style={{ width: `${colWidths.user}px` }} />}
                  {visibleCols.course && <col style={{ width: `${colWidths.course}px` }} />}
                  {visibleCols.term && <col style={{ width: `${colWidths.term}px` }} />}
                  {visibleCols.week && <col style={{ width: `${colWidths.week}px` }} />}
                  {visibleCols.status && <col style={{ width: `${colWidths.status}px` }} />}
                  {visibleCols.method && <col style={{ width: `${colWidths.method}px` }} />}
                  {visibleCols.time && <col style={{ width: `${colWidths.time}px` }} />}
                  {visibleCols.actions && <col style={{ width: `${colWidths.actions}px` }} />}
                </colgroup>
                <thead>
                  <tr
                    className={`border-b select-none ${
                      isDarkMode ? 'bg-slate-800/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800 font-extrabold'
                    }`}
                  >
                    {/* Bulk Select Checkbox Header */}
                    {visibleCols.select && (
                      <th className="p-3 text-center relative group">
                        <button
                          onClick={handleSelectAllPaginatedLogs}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          {allPaginatedLogsSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('select', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Row Number Header */}
                    {visibleCols.index && (
                      <th className="p-3 text-center font-extrabold uppercase text-slate-400 relative group">
                        #
                        <div
                          onMouseDown={(e) => handleMouseDownResize('index', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 1: Student ID */}
                    {visibleCols.studentId && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('studentId')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">รหัสประจำตัว</span>
                          {sortColumn === 'studentId' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('studentId', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 2: User Name */}
                    {visibleCols.user && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('user')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">ผู้ใช้งาน</span>
                          {sortColumn === 'user' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('user', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 3: Course */}
                    {visibleCols.course && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('course')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">วิชา</span>
                          {sortColumn === 'course' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('course', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 4: Academic Year / Semester */}
                    {visibleCols.term && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('term')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">ปีการศึกษา/ภาคเรียน</span>
                          {sortColumn === 'term' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('term', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 5: Week */}
                    {visibleCols.week && (
                      <th className="p-2.5 font-extrabold uppercase relative group text-center">
                        <div
                          onClick={() => handleSort('week')}
                          className="flex items-center justify-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">สัปดาห์</span>
                          {sortColumn === 'week' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('week', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 6: Status */}
                    {visibleCols.status && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('status')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">สถานะเข้าเรียน</span>
                          {sortColumn === 'status' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('status', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 7: Checkin Method & Reason */}
                    {visibleCols.method && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('method')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">วิธีเช็กชื่อ/เหตุผล</span>
                          {sortColumn === 'method' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('method', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 8: Timestamp */}
                    {visibleCols.time && (
                      <th className="p-2.5 font-extrabold uppercase relative group">
                        <div
                          onClick={() => handleSort('time')}
                          className="flex items-center space-x-1 cursor-pointer hover:bg-slate-700/20 transition p-1 rounded overflow-hidden"
                        >
                          <span className="truncate">เวลาที่บันทึก</span>
                          {sortColumn === 'time' ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('time', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}

                    {/* Column 9: Actions */}
                    {visibleCols.actions && (
                      <th className="p-2.5 font-extrabold uppercase text-center relative group">
                        <span className="truncate">จัดการ</span>
                        <div
                          onMouseDown={(e) => handleMouseDownResize('actions', e)}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                          title="ลากเพื่อปรับขนาดคอลัมน์"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-400/40 group-hover:bg-sky-400" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleCols).filter(Boolean).length || 1} className="p-12 text-center text-slate-400 font-semibold">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <UserIcon className="w-8 h-8 text-slate-500 opacity-40" />
                          <p>ไม่พบข้อมูลสถานะการเข้าชั้นเรียนตามเงื่อนไขที่กำหนด</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => {
                      const matchedCourse = allCourses.find((c) => c.id === log.courseId);
                      const isFocused =
                        overrideSelectedUser &&
                        (log.targetUserId === overrideSelectedUser.id || log.displayId === overrideSelectedUser.universityId);
                      const isSelected = selectedLogIds.includes(log.id);

                      return (
                        <tr
                          key={log.id}
                          className={`transition ${
                            isSelected
                              ? isDarkMode ? 'bg-sky-950/30 hover:bg-sky-950/40' : 'bg-sky-50 hover:bg-sky-100/80'
                              : isFocused
                              ? isDarkMode
                                ? 'bg-purple-950/30 hover:bg-purple-950/40'
                                : 'bg-purple-50/70 hover:bg-purple-100/80'
                              : isDarkMode
                              ? 'hover:bg-slate-800/40'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Checkbox */}
                          {visibleCols.select && (
                            <td className="p-3.5 text-center">
                              <button
                                onClick={(e) => handleToggleSelectLog(log.id, idx, e)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-sky-500" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>
                          )}

                          {/* Row Number */}
                          {visibleCols.index && (
                            <td className="p-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                              {(currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1}
                            </td>
                          )}

                          {/* Student ID */}
                          {visibleCols.studentId && (
                            <td className="p-3.5 font-mono font-bold text-sky-600 dark:text-sky-400 text-xs whitespace-nowrap">
                              {log.displayId || '-'}
                            </td>
                          )}

                          {/* User info */}
                          {visibleCols.user && (
                            <td className="p-3.5">
                              <div className="flex items-center space-x-1.5">
                                <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{log.displayName}</span>
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
                            </td>
                          )}

                          {/* Course */}
                          {visibleCols.course && (
                            <td className="p-3.5">
                              <div className="font-bold text-purple-600 dark:text-purple-400">
                                {matchedCourse ? matchedCourse.courseCode || matchedCourse.code : log.courseId}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                {matchedCourse ? matchedCourse.courseName || matchedCourse.nameTh : ''}
                              </div>
                            </td>
                          )}

                          {/* Academic Year / Semester */}
                          {visibleCols.term && (
                            <td className="p-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {matchedCourse ? `${matchedCourse.academicYear} / ภาค ${matchedCourse.semester}` : '-'}
                            </td>
                          )}

                          {/* Week */}
                          {visibleCols.week && (
                            <td className="p-3.5 text-center font-extrabold text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {log.weekNumber ? `สัปดาห์ที่ ${log.weekNumber}` : '-'}
                            </td>
                          )}

                          {/* Status badge */}
                          {visibleCols.status && (
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
                          )}

                          {/* Method & Reason */}
                          {visibleCols.method && (
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
                          )}

                          {/* Time */}
                          {visibleCols.time && (
                            <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : '-'}
                            </td>
                          )}

                          {/* Actions */}
                          {visibleCols.actions && (
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
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

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
                  <span className="text-slate-400 font-bold">วิชา/สัปดาห์ เดิม:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {editingLog.courseId} {editingLog.weekNumber ? `(สัปดาห์ที่ ${editingLog.weekNumber})` : ''}
                  </span>
                </div>
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                  รายวิชา (Course)
                </label>
                <select
                  value={editCourseId}
                  onChange={(e) => setEditCourseId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode || c.code} - {c.courseName || c.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              {/* Week Number Selection */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5 text-slate-700 dark:text-slate-300">
                  สัปดาห์เรียน (Week Number)
                </label>
                <select
                  value={editWeekNumber}
                  onChange={(e) => setEditWeekNumber(Number(e.target.value))}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      สัปดาห์ที่ {w}
                    </option>
                  ))}
                </select>
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

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
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
                  <h3 className="font-extrabold text-base">แก้ไขข้อมูลแบบกลุ่ม (Bulk Edit)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกหัวข้อที่ต้องการเปลี่ยนแปลงสำหรับผู้เช็กชื่อ {selectedLogIds.length} รายการ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Option 1: Course */}
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkChangeCourse}
                    onChange={(e) => setBulkChangeCourse(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    เปลี่ยนรายวิชา (Course)
                  </span>
                </label>
                {bulkChangeCourse && (
                  <select
                    value={bulkCourseId}
                    onChange={(e) => setBulkCourseId(e.target.value)}
                    className={`w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {allCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseCode || c.code} - {c.courseName || c.nameTh}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Option 2: Week */}
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkChangeWeek}
                    onChange={(e) => setBulkChangeWeek(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    เปลี่ยนสัปดาห์เรียน (Week Number)
                  </span>
                </label>
                {bulkChangeWeek && (
                  <select
                    value={bulkWeekNumber}
                    onChange={(e) => setBulkWeekNumber(Number(e.target.value))}
                    className={`w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                      <option key={w} value={w}>
                        สัปดาห์ที่ {w}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Option 3: Status */}
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkChangeStatus}
                    onChange={(e) => setBulkChangeStatus(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    เปลี่ยนสถานะการเข้าเรียน (Status)
                  </span>
                </label>
                {bulkChangeStatus && (
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className={`w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="PRESENT">🟢 มาเรียน (PRESENT)</option>
                    <option value="LATE">🟡 สาย (LATE)</option>
                    <option value="LEAVE">🔵 ลา (LEAVE)</option>
                    <option value="ABSENT">🔴 ขาด (ABSENT)</option>
                  </select>
                )}
              </div>

              {/* Option 4: Method */}
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkChangeMethod}
                    onChange={(e) => setBulkChangeMethod(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    เปลี่ยนวิธีเช็กชื่อ / ช่องทาง (Method)
                  </span>
                </label>
                {bulkChangeMethod && (
                  <input
                    type="text"
                    value={bulkMethod}
                    onChange={(e) => setBulkMethod(e.target.value)}
                    placeholder="เช่น ADMIN_BULK_EDIT, PASSCODE, QR_CODE"
                    className={`w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                )}
              </div>

              {/* Option 5: Reason */}
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkChangeReason}
                    onChange={(e) => setBulkChangeReason(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    เปลี่ยนเหตุผล / หมายเหตุ (Reason / Note)
                  </span>
                </label>
                {bulkChangeReason && (
                  <textarea
                    rows={2}
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="ระบุเหตุผลการแก้ไขแบบกลุ่ม..."
                    className={`w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveBulkEdit}
                disabled={isSavingBulkEdit || (!bulkChangeCourse && !bulkChangeWeek && !bulkChangeStatus && !bulkChangeMethod && !bulkChangeReason)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 active:scale-95 transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingBulkEdit ? 'กำลังบันทึก...' : `บันทึกการแก้ไข (${selectedLogIds.length} รายการ)`}</span>
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

