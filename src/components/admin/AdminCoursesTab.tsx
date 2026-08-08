import React, { useState, useEffect, useMemo } from 'react';
import { User, Course, CourseMember } from '../../types';
import {
  fetchAdminCollection,
  saveAdminDocument,
  deleteAdminDocument,
  fetchTeachers,
  fetchCourseDetails,
} from '../../services/api';
import { TeacherCourseCreationModal } from '../TeacherCourseCreationModal';
import { TeacherCourseEditModal } from '../TeacherCourseEditModal';
import { StudentInviteModal } from '../StudentInviteModal';
import { TeacherInviteModal } from '../TeacherInviteModal';
import {
  BookOpen,
  Search,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Layers,
  ArrowUpDown,
  X,
  Play,
  Square,
  Sparkles,
  Users,
  CheckSquare,
  Download,
  ArrowUp,
  ArrowDown,
  Sliders,
  UserPlus,
} from 'lucide-react';

interface AdminCoursesTabProps {
  adminUser: User;
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  setDeleteConfirmItem: (item: any) => void;
  onRefreshOverview: () => void;
}

export const AdminCoursesTab: React.FC<AdminCoursesTabProps> = ({
  adminUser,
  isDarkMode,
  showToast,
  setDeleteConfirmItem,
  onRefreshOverview,
}) => {
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<User[]>([]);
  const [selectedCourseForSessions, setSelectedCourseForSessions] = useState<string>('ALL');
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>('');
  const [loadingCoursesData, setLoadingCoursesData] = useState<boolean>(false);

  // Sorting
  const [courseSortField, setCourseSortField] = useState<'code' | 'year' | 'coordinator' | 'weeks' | 'sessions' | null>(null);
  const [courseSortDir, setCourseSortDir] = useState<'asc' | 'desc'>('asc');

  const [sessionSortField, setSessionSortField] = useState<'week' | 'topic' | 'status' | null>(null);
  const [sessionSortDir, setSessionSortDir] = useState<'asc' | 'desc'>('asc');

  // Column Visibility State for Courses
  const [courseVisibleCols, setCourseVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    code: true,
    year: true,
    coordinator: true,
    sessions: true,
    actions: true,
  });
  const [showCourseColPicker, setShowCourseColPicker] = useState<boolean>(false);

  const COURSE_COLUMN_CONFIG: { key: string; label: string }[] = [
    { key: 'select', label: 'กล่องเลือก (Select)' },
    { key: 'index', label: 'ลำดับ (#)' },
    { key: 'code', label: 'รหัสวิชา / ชื่อรายวิชา' },
    { key: 'year', label: 'ปีการศึกษา / เทอม' },
    { key: 'coordinator', label: 'อาจารย์ผู้สอนหลัก' },
    { key: 'sessions', label: 'จำนวนคาบเรียน' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Visibility State for Sessions
  const [sessionVisibleCols, setSessionVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    week: true,
    topic: true,
    status: true,
    actions: true,
  });
  const [showSessionColPicker, setShowSessionColPicker] = useState<boolean>(false);

  const SESSION_COLUMN_CONFIG: { key: string; label: string }[] = [
    { key: 'select', label: 'กล่องเลือก (Select)' },
    { key: 'index', label: 'ลำดับ (#)' },
    { key: 'week', label: 'วิชา / สัปดาห์' },
    { key: 'topic', label: 'หัวข้อการสอน / พิกัด' },
    { key: 'status', label: 'สถานะเช็กชื่อ' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Widths for Courses Table
  const [courseColWidths, setCourseColWidths] = useState<{ [key: string]: number }>({
    select: 40,
    index: 45,
    code: 220,
    year: 120,
    coordinator: 180,
    sessions: 130,
    actions: 280,
  });

  const handleMouseDownResizeCourse = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = courseColWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(35, startWidth + deltaX);
      setCourseColWidths((prev) => ({
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

  // Column Widths for Sessions Table
  const [sessionColWidths, setSessionColWidths] = useState<{ [key: string]: number }>({
    select: 40,
    index: 45,
    week: 160,
    topic: 260,
    status: 180,
    actions: 120,
  });

  const handleMouseDownResizeSession = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = sessionColWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(35, startWidth + deltaX);
      setSessionColWidths((prev) => ({
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

  // Bulk selection state
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [lastSelectedCourseIndex, setLastSelectedCourseIndex] = useState<number | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [lastSelectedSessionIndex, setLastSelectedSessionIndex] = useState<number | null>(null);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState<boolean>(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  const [studentModalCourse, setStudentModalCourse] = useState<any | null>(null);
  const [studentModalMembers, setStudentModalMembers] = useState<CourseMember[]>([]);

  const [teacherModalCourse, setTeacherModalCourse] = useState<any | null>(null);
  const [teacherModalMembers, setTeacherModalMembers] = useState<CourseMember[]>([]);

  const [sessionModalOpen, setSessionModalOpen] = useState<boolean>(false);
  const [editingSessionData, setEditingSessionData] = useState<any | null>(null);

  const handleOpenStudentsModal = async (course: any) => {
    setStudentModalCourse(course);
    setStudentModalMembers([]);
    try {
      const details = await fetchCourseDetails(course.id);
      setStudentModalMembers(details.members || []);
    } catch (err) {
      console.error('Failed to load course details for student modal:', err);
    }
  };

  const handleRefreshStudentModalMembers = async () => {
    if (!studentModalCourse) return;
    try {
      const details = await fetchCourseDetails(studentModalCourse.id);
      setStudentModalMembers(details.members || []);
    } catch (err) {
      console.error('Failed to refresh course members:', err);
    }
  };

  const handleOpenTeacherModal = async (course: any) => {
    setTeacherModalCourse(course);
    setTeacherModalMembers([]);
    try {
      const details = await fetchCourseDetails(course.id);
      setTeacherModalMembers(details.members || []);
    } catch (err) {
      console.error('Failed to load course details for teacher modal:', err);
    }
  };

  const handleRefreshTeacherModalMembers = async () => {
    if (!teacherModalCourse) return;
    try {
      const details = await fetchCourseDetails(teacherModalCourse.id);
      setTeacherModalMembers(details.members || []);
      loadCoursesAndSessionsData(true);
    } catch (err) {
      console.error('Failed to refresh teacher course members:', err);
    }
  };

  const loadCoursesAndSessionsData = async (silent = false) => {
    try {
      if (!silent) setLoadingCoursesData(true);
      const [cRes, sRes] = await Promise.all([
        fetchAdminCollection('courses'),
        fetchAdminCollection('sessions'),
      ]);
      setAllCourses(cRes.documents || []);
      setAllSessions(sRes.documents || []);
    } catch (err) {
      console.error('Failed to load courses & sessions:', err);
    } finally {
      if (!silent) setLoadingCoursesData(false);
    }
  };

  useEffect(() => {
    loadCoursesAndSessionsData();
  }, []);

  const handleCourseSort = (field: 'code' | 'year' | 'coordinator' | 'weeks' | 'sessions') => {
    if (courseSortField === field) {
      if (courseSortDir === 'asc') setCourseSortDir('desc');
      else {
        setCourseSortField(null);
        setCourseSortDir('asc');
      }
    } else {
      setCourseSortField(field);
      setCourseSortDir('asc');
    }
  };

  const handleSessionSort = (field: 'week' | 'topic' | 'status') => {
    if (sessionSortField === field) {
      if (sessionSortDir === 'asc') setSessionSortDir('desc');
      else {
        setSessionSortField(null);
        setSessionSortDir('asc');
      }
    } else {
      setSessionSortField(field);
      setSessionSortDir('asc');
    }
  };

  // Handlers for Course CRUD
  const handleOpenCreateCourse = async () => {
    if (teachersList.length === 0) {
      const tData = await fetchTeachers().catch(() => []);
      if (tData.length > 0) setTeachersList(tData);
    }
    setIsCreateCourseModalOpen(true);
  };

  const handleOpenEditCourse = async (course: any) => {
    if (teachersList.length === 0) {
      const tData = await fetchTeachers().catch(() => []);
      if (tData.length > 0) setTeachersList(tData);
    }
    setEditingCourse(course);
    setIsEditCourseModalOpen(true);
  };

  const handleDeleteCourseSubmit = (courseId: string, courseCode: string) => {
    setDeleteConfirmItem({
      type: 'course',
      id: courseId,
      title: `คุณต้องการลบรายวิชา "${courseCode}" ใช่หรือไม่?`,
      subtitle: 'การลบรายวิชานี้จะทำการลบสัปดาห์สอน สมาชิก ประวัติการเช็คชื่อ และใบลาที่เกี่ยวข้องทั้งหมดออกจากฐานข้อมูลถาวร',
      action: async () => {
        await deleteAdminDocument('courses', courseId);
        showToast(`ลบวิชา ${courseCode} เรียบร้อยแล้ว`);
        await loadCoursesAndSessionsData();
        onRefreshOverview();
      },
    });
  };

  const handleExecuteBulkDeleteCourses = () => {
    if (selectedCourseIds.length === 0) return;
    setDeleteConfirmItem({
      type: 'bulk_courses',
      title: `ลบรายวิชาแบบกลุ่ม (${selectedCourseIds.length} รายวิชา)`,
      subtitle: `คุณกำลังจะลบรายวิชาจำนวน ${selectedCourseIds.length} วิชาพร้อมข้อมูลที่เกี่ยวข้องทั้งหมดออกจากระบบถาวร`,
      action: async () => {
        for (const id of selectedCourseIds) {
          await deleteAdminDocument('courses', id);
        }
        showToast(`ลบรายวิชาจำนวน ${selectedCourseIds.length} วิชาเรียบร้อยแล้ว`);
        setSelectedCourseIds([]);
        await loadCoursesAndSessionsData();
        onRefreshOverview();
      },
    });
  };

  // Handlers for Sessions
  const handleOpenCreateSession = (preselectedCourseId?: string) => {
    const course = allCourses.find((c) => c.id === preselectedCourseId) || allCourses[0];
    const courseId = course?.id || '';
    const existingSessions = allSessions.filter((s) => s.courseId === courseId);
    const nextWeekNum = existingSessions.length + 1;

    const newSessionDoc = {
      id: `ses_${courseId}_w${nextWeekNum}_${Date.now()}`,
      courseId: courseId,
      weekNumber: nextWeekNum,
      topic: `การเรียนสัปดาห์ที่ ${nextWeekNum}`,
      teacherLat: course?.defaultLat || 13.7988363,
      teacherLng: course?.defaultLng || 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    setEditingSessionData(newSessionDoc);
    setSessionModalOpen(true);
  };

  const handleOpenEditSession = (session: any) => {
    setEditingSessionData(JSON.parse(JSON.stringify(session)));
    setSessionModalOpen(true);
  };

  const handleSaveSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSessionData?.courseId || !editingSessionData?.topic) {
      alert('กรุณาเลือกรายวิชาและระบุหัวข้อการเรียน');
      return;
    }
    try {
      await saveAdminDocument('sessions', editingSessionData);
      showToast(`บันทึก Session สัปดาห์ที่ ${editingSessionData.weekNumber} สำเร็จ`);
      setSessionModalOpen(false);
      await loadCoursesAndSessionsData();
      onRefreshOverview();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึก Session ได้');
    }
  };

  const handleToggleSessionActiveStatus = async (session: any) => {
    try {
      const updated = {
        ...session,
        isActive: !session.isActive,
        updatedAt: new Date().toISOString(),
      };
      await saveAdminDocument('sessions', updated);
      showToast(`${updated.isActive ? '🟢 เปิดการเช็กชื่อ' : '🔴 ปิดการเช็กชื่อ'} สัปดาห์ที่ ${session.weekNumber} สำเร็จ`);
      await loadCoursesAndSessionsData();
      onRefreshOverview();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถปรับสถานะการเช็กชื่อได้');
    }
  };

  const handleDeleteSessionSubmit = (sessionId: string, weekNum: number) => {
    setDeleteConfirmItem({
      type: 'session',
      id: sessionId,
      title: `คุณต้องการลบ Session สัปดาห์ที่ ${weekNum} ใช่หรือไม่?`,
      subtitle: 'การลบ Session นี้จะลบประวัติการเข้าเรียนในสัปดาห์นี้ถาวร',
      action: async () => {
        await deleteAdminDocument('sessions', sessionId);
        showToast(`ลบ Session สัปดาห์ที่ ${weekNum} เรียบร้อยแล้ว`);
        await loadCoursesAndSessionsData();
        onRefreshOverview();
      },
    });
  };

  const handleExecuteBulkDeleteSessions = () => {
    if (selectedSessionIds.length === 0) return;
    setDeleteConfirmItem({
      type: 'bulk_sessions',
      title: `ลบ Session แบบกลุ่ม (${selectedSessionIds.length} รายการ)`,
      subtitle: `คุณกำลังจะลบ Session การสอนจำนวน ${selectedSessionIds.length} รายการออกจากระบบถาวร`,
      action: async () => {
        for (const id of selectedSessionIds) {
          await deleteAdminDocument('sessions', id);
        }
        showToast(`ลบ Session จำนวน ${selectedSessionIds.length} รายการเรียบร้อยแล้ว`);
        setSelectedSessionIds([]);
        await loadCoursesAndSessionsData();
        onRefreshOverview();
      },
    });
  };

  const handleGenerateSessionsFromWeeks = async (course: any) => {
    if (!course) return;
    const weeksList = course.weeks && course.weeks.length > 0
      ? course.weeks
      : Array.from({ length: 15 }, (_, i) => ({
          weekNumber: i + 1,
          topic: `การเรียนสัปดาห์ที่ ${i + 1}`,
          date: new Date(Date.now() + i * 7 * 86400000).toISOString().slice(0, 10),
        }));

    const existingSessions = allSessions.filter((s) => s.courseId === course.id);
    const existingWeekNums = new Set(existingSessions.map((s) => Number(s.weekNumber)));

    let createdCount = 0;
    for (const w of weeksList) {
      const wNum = Number(w.weekNumber);
      if (!existingWeekNums.has(wNum)) {
        const newSes = {
          id: `ses_${course.id}_w${wNum}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          courseId: course.id,
          weekNumber: wNum,
          topic: w.topic || `การเรียนสัปดาห์ที่ ${wNum}`,
          teacherLat: course.defaultLat || 13.7988363,
          teacherLng: course.defaultLng || 100.322944,
          isActive: false,
          createdAt: new Date().toISOString(),
        };
        await saveAdminDocument('sessions', newSes);
        createdCount++;
      }
    }

    showToast(`สร้าง Session อัตโนมัติเพิ่ม ${createdCount} สัปดาห์ เรียบร้อยแล้ว`);
    await loadCoursesAndSessionsData();
    onRefreshOverview();
  };

  const filteredAndSortedCourses = useMemo(() => {
    return allCourses
      .filter((c) => {
        if (!courseSearchQuery.trim()) return true;
        const q = courseSearchQuery.toLowerCase().trim();
        const code = (c.courseCode || c.code || '').toLowerCase();
        const name = (c.courseName || c.nameTh || '').toLowerCase();
        const coordinator = (c.coordinatorName || '').toLowerCase();
        return code.includes(q) || name.includes(q) || coordinator.includes(q);
      })
      .sort((a, b) => {
        if (!courseSortField) return 0;
        let valA: any = '';
        let valB: any = '';

        if (courseSortField === 'code') {
          valA = a.courseCode || a.code || '';
          valB = b.courseCode || b.code || '';
        } else if (courseSortField === 'year') {
          valA = a.academicYear || 0;
          valB = b.academicYear || 0;
        } else if (courseSortField === 'coordinator') {
          valA = a.coordinatorName || '';
          valB = b.coordinatorName || '';
        } else if (courseSortField === 'weeks') {
          valA = a.weeks?.length || 0;
          valB = b.weeks?.length || 0;
        } else if (courseSortField === 'sessions') {
          valA = allSessions.filter((s) => s.courseId === a.id).length;
          valB = allSessions.filter((s) => s.courseId === b.id).length;
        }

        if (valA < valB) return courseSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return courseSortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [allCourses, courseSearchQuery, courseSortField, courseSortDir, allSessions]);

  const filteredSessions = useMemo(() => {
    return allSessions
      .filter((s) => {
        if (selectedCourseForSessions === 'ALL') return true;
        return s.courseId === selectedCourseForSessions;
      })
      .sort((a, b) => {
        if (!sessionSortField || sessionSortField === 'week') {
          const numA = Number(a.weekNumber) || 0;
          const numB = Number(b.weekNumber) || 0;
          return sessionSortDir === 'asc' ? numA - numB : numB - numA;
        }
        let valA: any = '';
        let valB: any = '';

        if (sessionSortField === 'topic') {
          valA = a.topic || '';
          valB = b.topic || '';
        } else if (sessionSortField === 'status') {
          valA = a.isActive ? 1 : 0;
          valB = b.isActive ? 1 : 0;
        }

        if (valA < valB) return sessionSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sessionSortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [allSessions, selectedCourseForSessions, sessionSortField, sessionSortDir]);

  // Course bulk handlers
  const allVisibleCoursesSelected = filteredAndSortedCourses.length > 0 && filteredAndSortedCourses.every((c) => selectedCourseIds.includes(c.id));

  const handleToggleSelectCourse = (id: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedCourseIndex !== null && index !== undefined && lastSelectedCourseIndex !== index) {
      const start = Math.min(lastSelectedCourseIndex, index);
      const end = Math.max(lastSelectedCourseIndex, index);
      const rangeIds = filteredAndSortedCourses.slice(start, end + 1).map((c) => c.id);

      const isTargetSelected = selectedCourseIds.includes(id);

      setSelectedCourseIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedCourseIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
    if (index !== undefined) {
      setLastSelectedCourseIndex(index);
    }
  };

  const handleSelectAllVisibleCourses = () => {
    if (allVisibleCoursesSelected) {
      setSelectedCourseIds([]);
      setLastSelectedCourseIndex(null);
    } else {
      setSelectedCourseIds(filteredAndSortedCourses.map((c) => c.id));
      setLastSelectedCourseIndex(null);
    }
  };

  const handleExportCoursesCSV = () => {
    const coursesToExport = selectedCourseIds.length > 0
      ? filteredAndSortedCourses.filter((c) => selectedCourseIds.includes(c.id))
      : filteredAndSortedCourses;

    if (coursesToExport.length === 0) {
      showToast('ไม่มีข้อมูลรายวิชาที่จะส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'ID วิชา', 'รหัสวิชา', 'ชื่อวิชา (TH)', 'ภาคเรียน', 'ปีการศึกษา', 'อาจารย์ผู้ประสานงาน', 'จำนวน Sessions'];
    const rows = coursesToExport.map((c, idx) => [
      idx + 1,
      c.id || '',
      c.courseCode || c.code || '',
      c.courseName || c.nameTh || '',
      c.semester || '1',
      c.academicYear || '2569',
      c.coordinatorName || 'ไม่ระบุ',
      allSessions.filter((s) => s.courseId === c.id).length
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admin_courses_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`ส่งออก CSV รายวิชาสำเร็จ (${coursesToExport.length} วิชา)`);
  };

  // Session bulk handlers
  const allVisibleSessionsSelected = filteredSessions.length > 0 && filteredSessions.every((s) => selectedSessionIds.includes(s.id));

  const handleToggleSelectSession = (id: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedSessionIndex !== null && index !== undefined && lastSelectedSessionIndex !== index) {
      const start = Math.min(lastSelectedSessionIndex, index);
      const end = Math.max(lastSelectedSessionIndex, index);
      const rangeIds = filteredSessions.slice(start, end + 1).map((s) => s.id);

      const isTargetSelected = selectedSessionIds.includes(id);

      setSelectedSessionIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedSessionIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
    if (index !== undefined) {
      setLastSelectedSessionIndex(index);
    }
  };

  const handleSelectAllVisibleSessions = () => {
    if (allVisibleSessionsSelected) {
      setSelectedSessionIds([]);
      setLastSelectedSessionIndex(null);
    } else {
      setSelectedSessionIds(filteredSessions.map((s) => s.id));
      setLastSelectedSessionIndex(null);
    }
  };

  const handleExportSessionsCSV = () => {
    const sessionsToExport = selectedSessionIds.length > 0
      ? filteredSessions.filter((s) => selectedSessionIds.includes(s.id))
      : filteredSessions;

    if (sessionsToExport.length === 0) {
      showToast('ไม่มีข้อมูล Session ที่จะส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'ID Session', 'สัปดาห์ที่', 'รหัสวิชา', 'หัวข้อการสอน (Topic)', 'สถานะเช็กชื่อ', 'วันที่', 'พิกัด Lat', 'พิกัด Lng'];
    const rows = sessionsToExport.map((s, idx) => {
      const matchedCourse = allCourses.find((c) => c.id === s.courseId);
      return [
        idx + 1,
        s.id || '',
        s.weekNumber || 1,
        matchedCourse ? (matchedCourse.courseCode || matchedCourse.code) : 'ไม่ระบุวิชา',
        s.topic || `สัปดาห์ที่ ${s.weekNumber}`,
        s.isActive ? 'กำลังเปิดรับเช็กชื่อ' : 'ปิดเช็กชื่อ',
        s.date || '',
        s.teacherLat || '',
        s.teacherLng || ''
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admin_sessions_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`ส่งออก CSV Sessions สำเร็จ (${sessionsToExport.length} รายการ)`);
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: COURSE MANAGEMENT */}
      <div className="space-y-3">
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              isDarkMode ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-100 text-purple-700 border-purple-200'
            }`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                รายวิชาในระบบทั้งหมด ({filteredAndSortedCourses.length} วิชา)
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                เพิ่ม แก้ไข ลบ รายวิชาในภาคเรียน และตั้งค่าสัปดาห์สอน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            <div className="relative min-w-0 sm:min-w-[200px] w-full">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="ค้นหารหัสวิชา, ชื่อวิชา..."
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                }`}
              />
            </div>

            {/* Column Settings Button & Popover for Courses */}
            <div className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowCourseColPicker(!showCourseColPicker)}
                className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 border whitespace-nowrap active:scale-95 ${
                  showCourseColPicker
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                }`}
                title="เลือกคอลัมน์ที่จะแสดง"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span>ตั้งค่าคอลัมน์</span>
              </button>

              {showCourseColPicker && (
                <div
                  className={`absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 p-3 rounded-2xl shadow-xl border z-30 transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                    <span className="text-xs font-black flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-500" />
                      <span>แสดง/ซ่อน คอลัมน์วิชา</span>
                    </span>
                    <button
                      onClick={() => setShowCourseColPicker(false)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {COURSE_COLUMN_CONFIG.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold transition select-none"
                      >
                        <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                        <input
                          type="checkbox"
                          checked={!!courseVisibleCols[col.key]}
                          onChange={(e) =>
                            setCourseVisibleCols((prev) => ({
                              ...prev,
                              [col.key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800 mt-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        setCourseVisibleCols({
                          select: true,
                          index: true,
                          code: true,
                          year: true,
                          coordinator: true,
                          sessions: true,
                          actions: true,
                        })
                      }
                      className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      แสดงทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCourseColPicker(false)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition cursor-pointer font-bold"
                    >
                      ตกลง
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportCoursesCSV}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
              title="ส่งออกข้อมูลรายวิชาเป็น CSV"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>ส่งออก CSV</span>
            </button>

            <button
              onClick={handleOpenCreateCourse}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-xs shadow-purple-600/30 transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>สร้างรายวิชาใหม่</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar for Courses */}
        {selectedCourseIds.length > 0 && (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-purple-600 dark:text-purple-300">
              <CheckSquare className="w-4 h-4" />
              <span>เลือกไว้แล้ว {selectedCourseIds.length} รายวิชา</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCoursesCSV}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center space-x-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออกวิชาที่เลือก (CSV)</span>
              </button>
              <button
                onClick={handleExecuteBulkDeleteCourses}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบวิชาที่เลือก ({selectedCourseIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Courses Table */}
        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[700px] text-left text-xs border-collapse">
              <colgroup>
                {courseVisibleCols.select && <col style={{ width: `${courseColWidths.select}px` }} />}
                {courseVisibleCols.index && <col style={{ width: `${courseColWidths.index}px` }} />}
                {courseVisibleCols.code && <col style={{ width: `${courseColWidths.code}px` }} />}
                {courseVisibleCols.year && <col style={{ width: `${courseColWidths.year}px` }} />}
                {courseVisibleCols.coordinator && <col style={{ width: `${courseColWidths.coordinator}px` }} />}
                {courseVisibleCols.sessions && <col style={{ width: `${courseColWidths.sessions}px` }} />}
                {courseVisibleCols.actions && <col style={{ width: `${courseColWidths.actions}px` }} />}
              </colgroup>
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800 font-extrabold'}`}>
                  {courseVisibleCols.select && (
                    <th className="p-3.5 text-center relative group select-none">
                      <button
                        onClick={handleSelectAllVisibleCourses}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        {allVisibleCoursesSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('select', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.index && (
                    <th className="p-3.5 text-center font-extrabold uppercase tracking-wider text-slate-400 relative group select-none">
                      #
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('index', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.code && (
                    <th onClick={() => handleCourseSort('code')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>รหัสวิชา / ชื่อรายวิชา</span>
                        {courseSortField === 'code' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('code', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.year && (
                    <th onClick={() => handleCourseSort('year')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>ภาคเรียน / ปี</span>
                        {courseSortField === 'year' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('year', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.coordinator && (
                    <th onClick={() => handleCourseSort('coordinator')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>อาจารย์ผู้ประสานงาน</span>
                        {courseSortField === 'coordinator' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('coordinator', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.sessions && (
                    <th onClick={() => handleCourseSort('sessions')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>จำนวน Session</span>
                        {courseSortField === 'sessions' ? (
                          courseSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('sessions', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {courseVisibleCols.actions && (
                    <th className="p-3.5 font-extrabold text-right relative group select-none">
                      จัดการ
                      <div
                        onMouseDown={(e) => handleMouseDownResizeCourse('actions', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {loadingCoursesData ? (
                  <tr>
                    <td colSpan={Object.values(courseVisibleCols).filter(Boolean).length || 1} className={`p-8 text-center font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                      กำลังโหลดข้อมูลรายวิชา...
                    </td>
                  </tr>
                ) : filteredAndSortedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(courseVisibleCols).filter(Boolean).length || 1} className={`p-8 text-center font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      ไม่พบข้อมูลรายวิชาในระบบ
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedCourses.map((crs, idx) => {
                    const sessionCount = allSessions.filter((s) => s.courseId === crs.id).length;
                    const isSelected = selectedCourseIds.includes(crs.id);
                    return (
                      <tr key={crs.id} className={`transition ${
                        isSelected
                          ? isDarkMode ? 'bg-purple-950/20' : 'bg-purple-50'
                          : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}>
                        {courseVisibleCols.select && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={(e) => handleToggleSelectCourse(crs.id, idx, e)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                            </button>
                          </td>
                        )}
                        {courseVisibleCols.index && (
                          <td className="p-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                            {idx + 1}
                          </td>
                        )}
                        {courseVisibleCols.code && (
                          <td className="p-3.5">
                            <div>
                              <div className={`font-extrabold font-mono text-xs ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                                {crs.courseCode || crs.code}
                              </div>
                              <div className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                {crs.courseName || crs.nameTh}
                              </div>
                            </div>
                          </td>
                        )}
                        {courseVisibleCols.year && (
                          <td className="p-3.5">
                            <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              ภาค {crs.semester || '1'}/{crs.academicYear || '2569'}
                            </span>
                          </td>
                        )}
                        {courseVisibleCols.coordinator && (
                          <td className="p-3.5">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {crs.coordinatorName || 'ไม่ระบุ'}
                            </span>
                          </td>
                        )}
                        {courseVisibleCols.sessions && (
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              isDarkMode ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-100 text-sky-800 border-sky-300'
                            }`}>
                              {sessionCount} Sessions
                            </span>
                          </td>
                        )}
                        {courseVisibleCols.actions && (
                          <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenTeacherModal(crs)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition ${
                                isDarkMode
                                  ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300'
                              }`}
                              title="เพิ่ม/จัดการอาจารย์ผู้สอนในรายวิชา"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>อาจารย์</span>
                            </button>
                            <button
                              onClick={() => handleOpenStudentsModal(crs)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition ${
                                isDarkMode
                                  ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30'
                                  : 'bg-sky-100 hover:bg-sky-200 text-sky-800 border-sky-300'
                              }`}
                              title="ดูรายชื่อและจัดการนักศึกษาในรายวิชา"
                            >
                              <Users className="w-3 h-3" />
                              <span>นักศึกษา</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditCourse(crs)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                              }`}
                              title="แก้ไขรายวิชา"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCourseSubmit(crs.id, crs.courseCode || crs.code)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-rose-700'
                              }`}
                              title="ลบรายวิชา"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </div>

      {/* SECTION 2: WEEKLY SESSIONS MANAGEMENT */}
      <div className={`space-y-3 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              isDarkMode ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-100 text-sky-700 border-sky-200'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                การเรียนการสอนรายสัปดาห์ (Weekly Sessions)
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                จัดการสัปดาห์เรียน, เปิด/ปิดรับเช็กชื่อประจำสัปดาห์, ปรับแต่งพิกัด GPS
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Filter by course */}
            <select
              value={selectedCourseForSessions}
              onChange={(e) => setSelectedCourseForSessions(e.target.value)}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">เลือกวิชาทั้งหมด (All Courses)</option>
              {allCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode || c.code} - {c.courseName || c.nameTh}
                </option>
              ))}
            </select>

            {/* Column Settings Button & Popover for Sessions */}
            <div className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowSessionColPicker(!showSessionColPicker)}
                className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 border whitespace-nowrap active:scale-95 ${
                  showSessionColPicker
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                }`}
                title="เลือกคอลัมน์ที่จะแสดง"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span>ตั้งค่าคอลัมน์</span>
              </button>

              {showSessionColPicker && (
                <div
                  className={`absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 p-3 rounded-2xl shadow-xl border z-30 transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                    <span className="text-xs font-black flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-500" />
                      <span>แสดง/ซ่อน คอลัมน์ Session</span>
                    </span>
                    <button
                      onClick={() => setShowSessionColPicker(false)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {SESSION_COLUMN_CONFIG.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold transition select-none"
                      >
                        <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                        <input
                          type="checkbox"
                          checked={!!sessionVisibleCols[col.key]}
                          onChange={(e) =>
                            setSessionVisibleCols((prev) => ({
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
                        setSessionVisibleCols({
                          select: true,
                          index: true,
                          week: true,
                          topic: true,
                          status: true,
                          actions: true,
                        })
                      }
                      className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      แสดงทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSessionColPicker(false)}
                      className="px-2.5 py-1 rounded-lg bg-sky-600 text-white hover:bg-sky-500 transition cursor-pointer font-bold"
                    >
                      ตกลง
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportSessionsCSV}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
              title="ส่งออกข้อมูล Sessions เป็น CSV"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>ส่งออก CSV</span>
            </button>

            <button
              onClick={() => handleOpenCreateSession(selectedCourseForSessions !== 'ALL' ? selectedCourseForSessions : undefined)}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-xs shadow-sky-600/30 transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>สร้าง Session สัปดาห์ใหม่</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar for Sessions */}
        {selectedSessionIds.length > 0 && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-sky-600 dark:text-sky-300">
              <CheckSquare className="w-4 h-4" />
              <span>เลือกไว้แล้ว {selectedSessionIds.length} รายการ</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportSessionsCSV}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center space-x-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออก Sessions ที่เลือก (CSV)</span>
              </button>
              <button
                onClick={handleExecuteBulkDeleteSessions}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ Sessions ที่เลือก ({selectedSessionIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Sessions Table */}
        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[650px] text-left text-xs border-collapse">
              <colgroup>
                {sessionVisibleCols.select && <col style={{ width: `${sessionColWidths.select}px` }} />}
                {sessionVisibleCols.index && <col style={{ width: `${sessionColWidths.index}px` }} />}
                {sessionVisibleCols.week && <col style={{ width: `${sessionColWidths.week}px` }} />}
                {sessionVisibleCols.topic && <col style={{ width: `${sessionColWidths.topic}px` }} />}
                {sessionVisibleCols.status && <col style={{ width: `${sessionColWidths.status}px` }} />}
                {sessionVisibleCols.actions && <col style={{ width: `${sessionColWidths.actions}px` }} />}
              </colgroup>
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800 font-extrabold'}`}>
                  {sessionVisibleCols.select && (
                    <th className="p-3.5 text-center relative group select-none">
                      <button
                        onClick={handleSelectAllVisibleSessions}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        {allVisibleSessionsSelected ? <CheckSquare className="w-4 h-4 text-sky-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('select', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {sessionVisibleCols.index && (
                    <th className="p-3.5 text-center font-extrabold uppercase tracking-wider text-slate-400 relative group select-none">
                      #
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('index', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {sessionVisibleCols.week && (
                    <th onClick={() => handleSessionSort('week')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>สัปดาห์ / วิชา</span>
                        {sessionSortField === 'week' || !sessionSortField ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('week', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {sessionVisibleCols.topic && (
                    <th onClick={() => handleSessionSort('topic')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>หัวข้อการสอน (Topic)</span>
                        {sessionSortField === 'topic' ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('topic', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {sessionVisibleCols.status && (
                    <th onClick={() => handleSessionSort('status')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                      <div className="flex items-center space-x-1 truncate">
                        <span>สถานะเช็กชื่อ</span>
                        {sessionSortField === 'status' ? (
                          sessionSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('status', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                  {sessionVisibleCols.actions && (
                    <th className="p-3.5 font-extrabold text-right relative group select-none">
                      จัดการ
                      <div
                        onMouseDown={(e) => handleMouseDownResizeSession('actions', e)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(sessionVisibleCols).filter(Boolean).length || 1} className={`p-8 text-center font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      ไม่พบข้อมูล Session ประจำสัปดาห์
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((ses, idx) => {
                    const matchedCourse = allCourses.find((c) => c.id === ses.courseId);
                    const isSelected = selectedSessionIds.includes(ses.id);
                    return (
                      <tr key={ses.id} className={`transition ${
                        isSelected
                          ? isDarkMode ? 'bg-sky-950/20' : 'bg-sky-50'
                          : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}>
                        {sessionVisibleCols.select && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={(e) => handleToggleSelectSession(ses.id, idx, e)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-sky-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                            </button>
                          </td>
                        )}
                        {sessionVisibleCols.index && (
                          <td className="p-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                            {idx + 1}
                          </td>
                        )}
                        {sessionVisibleCols.week && (
                          <td className="p-3.5">
                            <div className="flex items-center space-x-2">
                              <span className={`w-7 h-7 rounded-lg border font-black flex items-center justify-center shrink-0 ${
                                isDarkMode
                                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                                  : 'bg-sky-100 border-sky-300 text-sky-800'
                              }`}>
                                W{ses.weekNumber || 1}
                              </span>
                              <div>
                                <div className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                  {matchedCourse ? `${matchedCourse.courseCode || matchedCourse.code}` : 'ไม่ระบุวิชา'}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        {sessionVisibleCols.topic && (
                          <td className="p-3.5">
                            <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {ses.topic || `สัปดาห์ที่ ${ses.weekNumber}`}
                            </span>
                          </td>
                        )}
                        {sessionVisibleCols.status && (
                          <td className="p-3.5">
                            <button
                              onClick={() => handleToggleSessionActiveStatus(ses)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border flex items-center space-x-1.5 cursor-pointer transition ${
                                ses.isActive
                                  ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              {ses.isActive ? <Play className="w-3 h-3 fill-current" /> : <Square className="w-3 h-3" />}
                              <span>{ses.isActive ? '🟢 กำลังเปิดรับเช็กชื่อ' : '🔴 ปิดเช็กชื่อ'}</span>
                            </button>
                          </td>
                        )}
                        {sessionVisibleCols.actions && (
                          <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenEditSession(ses)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                              }`}
                              title="แก้ไข Session"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSessionSubmit(ses.id, ses.weekNumber)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-rose-700'
                              }`}
                              title="ลบ Session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </div>

      {/* CREATE / EDIT COURSE MODALS */}
      {isCreateCourseModalOpen && (
        <TeacherCourseCreationModal
          isOpen={isCreateCourseModalOpen}
          onClose={() => setIsCreateCourseModalOpen(false)}
          onSuccess={async (newCourse) => {
            showToast(`สร้างรายวิชา ${newCourse.courseCode} สำเร็จ`);
            setIsCreateCourseModalOpen(false);
            await loadCoursesAndSessionsData();
            onRefreshOverview();
          }}
          ownerId={adminUser?.id || ''}
          coordinatorDefault={`${adminUser?.title || ''}${adminUser?.firstNameTh || ''} ${adminUser?.lastNameTh || ''}`.trim()}
          teachersList={teachersList}
          isDarkMode={isDarkMode}
        />
      )}

      {isEditCourseModalOpen && editingCourse && (
        <TeacherCourseEditModal
          isOpen={isEditCourseModalOpen}
          onClose={() => {
            setIsEditCourseModalOpen(false);
            setEditingCourse(null);
          }}
          course={editingCourse}
          teachersList={teachersList}
          isAdmin={true}
          onSuccess={async (updated) => {
            showToast(`แก้ไขรายวิชา ${updated.courseCode} เรียบร้อยแล้ว`);
            setIsEditCourseModalOpen(false);
            setEditingCourse(null);
            await loadCoursesAndSessionsData();
            onRefreshOverview();
          }}
          onDeleteSuccess={async () => {
            showToast('ลบรายวิชาเรียบร้อยแล้ว');
            setIsEditCourseModalOpen(false);
            setEditingCourse(null);
            await loadCoursesAndSessionsData();
            onRefreshOverview();
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* CREATE / EDIT SESSION MODAL */}
      {sessionModalOpen && editingSessionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-sky-500/30 text-slate-100' : 'bg-white border-sky-200 text-slate-900'
          }`}>
            <button
              onClick={() => setSessionModalOpen(false)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-sky-500">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>
                  {editingSessionData.id.includes('w') ? `แก้ไข Session สัปดาห์ที่ ${editingSessionData.weekNumber}` : 'สร้าง Session ใหม่'}
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  ตั้งค่าสัปดาห์เรียน หัวข้อบทเรียน พิกัดสถานที่เรียน GPS
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSessionSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>เลือกรายวิชา *</label>
                <select
                  required
                  value={editingSessionData.courseId || ''}
                  onChange={(e) => setEditingSessionData({ ...editingSessionData, courseId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- เลือกรายวิชา --</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode || c.code} - {c.courseName || c.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>สัปดาห์ที่ (Week Number) *</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={editingSessionData.weekNumber || 1}
                    onChange={(e) => setEditingSessionData({ ...editingSessionData, weekNumber: parseInt(e.target.value, 10) || 1 })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>สถานะเช็กชื่อ</label>
                  <select
                    value={editingSessionData.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditingSessionData({ ...editingSessionData, isActive: e.target.value === 'active' })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="inactive">🔴 ปิดเช็กชื่อ</option>
                    <option value="active">🟢 เปิดให้เช็กชื่อ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>หัวข้อบทเรียน (Topic) *</label>
                <input
                  type="text"
                  required
                  value={editingSessionData.topic || ''}
                  onChange={(e) => setEditingSessionData({ ...editingSessionData, topic: e.target.value })}
                  placeholder="เช่น บทนำวิชาวิศวกรรมซอฟต์แวร์..."
                  className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end space-x-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-extrabold text-xs text-white bg-sky-600 hover:bg-sky-500 transition shadow-lg shadow-sky-600/30 cursor-pointer"
                >
                  บันทึก Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Management & Invite Modal for Admin */}
      {teacherModalCourse && (
        <TeacherInviteModal
          isOpen={!!teacherModalCourse}
          onClose={() => setTeacherModalCourse(null)}
          course={teacherModalCourse}
          currentUserId={adminUser.id}
          courseMembers={teacherModalMembers}
          onRefresh={handleRefreshTeacherModalMembers}
          onMembersUpdated={handleRefreshTeacherModalMembers}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Student Management & Invite Modal for Admin */}
      {studentModalCourse && (
        <StudentInviteModal
          isOpen={!!studentModalCourse}
          onClose={() => setStudentModalCourse(null)}
          course={studentModalCourse}
          courseMembers={studentModalMembers}
          onRefresh={handleRefreshStudentModalMembers}
          onMembersUpdated={handleRefreshStudentModalMembers}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};
