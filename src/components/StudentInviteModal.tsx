import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Link,
  Copy,
  Check,
  Users,
  Search,
  Trash2,
  GraduationCap,
  UserCheck,
  Maximize2,
  Minimize2,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  ListChecks,
  CheckCircle2,
} from 'lucide-react';
import { Course, CourseMember, CourseMemberRole, User as UserType } from '../types';
import {
  fetchStudents,
  inviteStudentToCourse,
  inviteStudentsBatchToCourse,
  removeCourseMember,
  removeCourseMembersBatch,
  generateInviteLink,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

interface StudentInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  currentUserId?: string;
  courseMembers?: CourseMember[];
  onRefresh?: () => void;
  onMembersUpdated?: () => void;
  isDarkMode?: boolean;
}

export const StudentInviteModal: React.FC<StudentInviteModalProps> = ({
  isOpen,
  onClose,
  course,
  currentUserId,
  courseMembers = [],
  onRefresh,
  onMembersUpdated,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [mainTab, setMainTab] = useState<'enrolled' | 'add'>('enrolled');
  const [addMethodTab, setAddMethodTab] = useState<'db' | 'paste' | 'link'>('db');
  const [students, setStudents] = useState<UserType[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedAvailableStudentIds, setSelectedAvailableStudentIds] = useState<string[]>([]);
  const [lastSelectedAvailableStudentIndex, setLastSelectedAvailableStudentIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bulk Paste / Match State
  const [pasteText, setPasteText] = useState<string>('');
  const [parsedMatchedStudents, setParsedMatchedStudents] = useState<UserType[]>([]);
  const [parsedUnmatchedTokens, setParsedUnmatchedTokens] = useState<string[]>([]);
  const [hasParsed, setHasParsed] = useState<boolean>(false);

  // Selection & Bulk Delete state
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [lastSelectedMemberIndex, setLastSelectedMemberIndex] = useState<number | null>(null);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState<boolean>(false);
  const [deleteTargetMembers, setDeleteTargetMembers] = useState<CourseMember[]>([]);
  const [teacherPassword, setTeacherPassword] = useState<string>('');

  // Invite Link State
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const triggerRefresh = () => {
    if (onRefresh) onRefresh();
    if (onMembersUpdated) onMembersUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      setMainTab('enrolled');
      setAddMethodTab('db');
      loadStudents();
      setError(null);
      setSuccessMsg(null);
      setSelectedMemberIds([]);
      setSelectedAvailableStudentIds([]);
      setPasteText('');
      setParsedMatchedStudents([]);
      setParsedUnmatchedTokens([]);
      setHasParsed(false);
      fetchStudentInviteLink();
    }
  }, [isOpen]);

  const fetchStudentInviteLink = async () => {
    try {
      setLoading(true);
      const invite = await generateInviteLink(course.id, CourseMemberRole.STUDENT);
      setGeneratedCode(invite.code);
      setCopied(false);
    } catch (err: any) {
      console.error('Failed to generate student invite link:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await fetchStudents();
      setStudents(data);
    } catch (err: any) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddSingleStudent = async () => {
    if (!selectedStudentId) {
      setError('กรุณาเลือกนักศึกษาที่ต้องการเพิ่มจากรายชื่อในระบบ');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const res = await inviteStudentToCourse(course.id, selectedStudentId);
      setSuccessMsg(res.message || 'เพิ่มนักศึกษาเข้าร่วมรายวิชาสำเร็จ');
      setSelectedStudentId('');
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มนักศึกษา');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSelectedAvailableStudents = async () => {
    if (selectedAvailableStudentIds.length === 0) {
      setError('กรุณาเลือกนักศึกษาอย่างน้อย 1 คน');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const res = await inviteStudentsBatchToCourse(course.id, selectedAvailableStudentIds);
      setSuccessMsg(res.message || `เพิ่มนักศึกษาจำนวน ${selectedAvailableStudentIds.length} คน เข้าร่วมรายวิชาสำเร็จ`);
      setSelectedAvailableStudentIds([]);
      setSelectedStudentId('');
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มนักศึกษาแบบกลุ่ม');
    } finally {
      setLoading(false);
    }
  };

  const handleParsePasteText = () => {
    setError(null);
    setSuccessMsg(null);
    if (!pasteText.trim()) {
      setError('กรุณาป้อนหรือวางรหัสนักศึกษา/อีเมลก่อนทำการตรวจสอบ');
      return;
    }

    const tokens = pasteText
      .split(/[\n,\t\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tokens.length === 0) {
      setError('ไม่พบข้อมูลรหัสนักศึกษาหรืออีเมลในข้อความที่วาง');
      return;
    }

    const matched: UserType[] = [];
    const unmatched: string[] = [];
    const matchedSet = new Set<string>();

    tokens.forEach((token) => {
      const lower = token.toLowerCase();
      const found = availableStudents.find(
        (s) =>
          (s.universityId && s.universityId.toLowerCase() === lower) ||
          (s.email && s.email.toLowerCase() === lower)
      );

      if (found) {
        if (!matchedSet.has(found.id)) {
          matchedSet.add(found.id);
          matched.push(found);
        }
      } else {
        if (!unmatched.includes(token)) {
          unmatched.push(token);
        }
      }
    });

    setParsedMatchedStudents(matched);
    setParsedUnmatchedTokens(unmatched);
    setHasParsed(true);
  };

  const handleAddParsedStudents = async () => {
    if (parsedMatchedStudents.length === 0) {
      setError('ไม่พบรายชื่อนักศึกษาที่ตรงกับระบบเพื่อทำการเพิ่ม');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const studentIds = parsedMatchedStudents.map((s) => s.id);
      const res = await inviteStudentsBatchToCourse(course.id, studentIds);
      setSuccessMsg(res.message || `เพิ่มนักศึกษาจำนวน ${studentIds.length} คน เข้าร่วมรายวิชาสำเร็จ`);
      setPasteText('');
      setParsedMatchedStudents([]);
      setParsedUnmatchedTokens([]);
      setHasParsed(false);
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มนักศึกษา');
    } finally {
      setLoading(false);
    }
  };

  // Filter existing enrolled student members (deduplicated by userId)
  const rawStudentMembers = (courseMembers || []).filter(
    (m) => m && m.courseId === course.id && m.role === CourseMemberRole.STUDENT
  );
  const studentMap = new Map<string, CourseMember>();
  for (const m of rawStudentMembers) {
    if (!m.userId) continue;
    if (!studentMap.has(m.userId)) {
      studentMap.set(m.userId, m);
    }
  }
  const studentMembersInCourse = Array.from(studentMap.values());

  const enrolledUserIds = new Set(studentMembersInCourse.map((m) => m.userId));

  // Available students not yet enrolled
  const availableStudents = students.filter((s) => !enrolledUserIds.has(s.id));

  const filteredAvailableStudents = availableStudents.filter((s) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${s.title || ''} ${s.firstNameTh || ''} ${s.lastNameTh || ''} ${s.firstNameEn || ''} ${s.lastNameEn || ''}`.toLowerCase();
    const universityId = (s.universityId || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    return fullName.includes(q) || universityId.includes(q) || email.includes(q);
  });

  const toggleSelectAllAvailable = () => {
    const filteredIds = filteredAvailableStudents.map((s) => s.id);
    const isAllSelected = filteredIds.every((id) => selectedAvailableStudentIds.includes(id));

    if (isAllSelected) {
      setSelectedAvailableStudentIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedAvailableStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelectAvailableStudent = (studentId: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedAvailableStudentIndex !== null && index !== undefined && lastSelectedAvailableStudentIndex !== index) {
      const start = Math.min(lastSelectedAvailableStudentIndex, index);
      const end = Math.max(lastSelectedAvailableStudentIndex, index);
      const rangeIds = filteredAvailableStudents.slice(start, end + 1).map((s) => s.id);

      const isTargetSelected = selectedAvailableStudentIds.includes(studentId);

      setSelectedAvailableStudentIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedAvailableStudentIds((prev) =>
        prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
      );
    }
    if (index !== undefined) {
      setLastSelectedAvailableStudentIndex(index);
    }
  };

  const filteredEnrolledStudents = studentMembersInCourse.filter((m) => {
    const u = m.user;
    if (!u) return true;
    const q = listSearchQuery.toLowerCase();
    const fullName = `${u.title || ''} ${u.firstNameTh || ''} ${u.lastNameTh || ''} ${u.firstNameEn || ''} ${u.lastNameEn || ''}`.toLowerCase();
    const universityId = (u.universityId || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return fullName.includes(q) || universityId.includes(q) || email.includes(q);
  });

  // Checkbox selection handlers for enrolled list
  const toggleSelectAll = () => {
    const filteredIds = filteredEnrolledStudents.map((m) => m.id);
    const isAllSelected = filteredIds.every((id) => selectedMemberIds.includes(id));

    if (isAllSelected) {
      setSelectedMemberIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      setLastSelectedMemberIndex(null);
    } else {
      setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
      setLastSelectedMemberIndex(null);
    }
  };

  const toggleSelectMember = (memberId: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedMemberIndex !== null && index !== undefined && lastSelectedMemberIndex !== index) {
      const start = Math.min(lastSelectedMemberIndex, index);
      const end = Math.max(lastSelectedMemberIndex, index);
      const rangeIds = filteredEnrolledStudents.slice(start, end + 1).map((m) => m.id);

      const isTargetSelected = selectedMemberIds.includes(memberId);

      setSelectedMemberIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedMemberIds((prev) =>
        prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
      );
    }
    if (index !== undefined) {
      setLastSelectedMemberIndex(index);
    }
  };

  const handleRequestSingleDelete = (member: CourseMember) => {
    setDeleteTargetMembers([member]);
    setTeacherPassword('');
    setDeleteConfirmModalOpen(true);
  };

  const handleRequestBulkDelete = () => {
    const targets = studentMembersInCourse.filter((m) => selectedMemberIds.includes(m.id));
    if (targets.length === 0) return;
    setDeleteTargetMembers(targets);
    setTeacherPassword('');
    setDeleteConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetMembers.length === 0) return;
    if (!teacherPassword || teacherPassword.trim() === '') {
      setError('กรุณากรอกรหัสผ่านเพื่อยืนยันการลบนักศึกษา');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      if (deleteTargetMembers.length === 1) {
        const target = deleteTargetMembers[0];
        const u = target.user;
        const name = u ? `${u.title || ''} ${u.firstNameTh || ''} ${u.lastNameTh || ''}`.trim() : 'นักศึกษา';
        await removeCourseMember(course.id, target.id, currentUserId, teacherPassword.trim());
        setSuccessMsg(`ลบ ${name} ออกจากรายวิชาเรียบร้อยแล้ว`);
      } else {
        const targetIds = deleteTargetMembers.map((m) => m.id);
        const res = await removeCourseMembersBatch(course.id, targetIds, currentUserId, teacherPassword.trim());
        setSuccessMsg(res.message || `ลบนักศึกษาจำนวน ${deleteTargetMembers.length} คน เรียบร้อยแล้ว`);
      }

      const deletedSet = new Set(deleteTargetMembers.map((m) => m.id));
      setSelectedMemberIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      setDeleteConfirmModalOpen(false);
      setDeleteTargetMembers([]);
      setTeacherPassword('');
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการลบสมาชิกออกจากรายวิชา');
    } finally {
      setLoading(false);
    }
  };

  const courseCodeStr = course.courseCode || course.code || '';
  const courseNameStr = course.courseName || course.nameTh || '';

  const isAllFilteredSelected =
    filteredEnrolledStudents.length > 0 &&
    filteredEnrolledStudents.every((m) => selectedMemberIds.includes(m.id));

  const isAllAvailableSelected =
    filteredAvailableStudents.length > 0 &&
    filteredAvailableStudents.every((s) => selectedAvailableStudentIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div
        className={`border shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
            : 'w-full max-w-3xl rounded-2xl max-h-[92vh] my-auto'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-sky-50/70 border-sky-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 ${
                isDarkMode ? 'text-sky-400' : 'text-sky-600'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                จัดการและเชิญนักศึกษาเข้ารายวิชา
              </h2>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                {courseCodeStr} — {courseNameStr}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className={`p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          {/* Status Alerts */}
          {error && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold ${
                isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {error}
            </div>
          )}
          {successMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold ${
                isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {successMsg}
            </div>
          )}

          {/* Main Top Navigation Tabs */}
          <div className={`flex border-b space-x-1 sm:space-x-2 px-1 overflow-x-auto ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setMainTab('enrolled')}
              className={`pb-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm transition border-b-2 flex items-center space-x-2 rounded-t-xl cursor-pointer whitespace-nowrap ${
                mainTab === 'enrolled'
                  ? 'border-sky-600 text-sky-600 bg-sky-500/10'
                  : isDarkMode
                  ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 text-sky-500" />
              <span>นักศึกษาในรายวิชา</span>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold transition ${
                  mainTab === 'enrolled'
                    ? 'bg-sky-600 text-white'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {studentMembersInCourse.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('add')}
              className={`pb-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm transition border-b-2 flex items-center space-x-2 rounded-t-xl cursor-pointer whitespace-nowrap ${
                mainTab === 'add'
                  ? 'border-sky-600 text-sky-600 bg-sky-500/10'
                  : isDarkMode
                  ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-500" />
              <span>เพิ่ม / เชิญนักศึกษาเข้ารายวิชา</span>
            </button>
          </div>

          {/* MAIN TAB 1: Enrolled Students List */}
          {mainTab === 'enrolled' && (
            <div className="space-y-3">
              {/* Header Filter & Quick Add Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative w-full sm:w-72">
                  <Search
                    className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ, รหัสนักศึกษา, อีเมล..."
                    className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border font-semibold focus:outline-none focus:border-sky-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setMainTab('add')}
                  className="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-sky-600/20 flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มนักศึกษาใหม่</span>
                </button>
              </div>

              {/* Bulk Selection and Action Bar */}
              {filteredEnrolledStudents.length > 0 && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className={`flex items-center space-x-2 text-xs font-bold transition cursor-pointer select-none ${
                        isDarkMode ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-500" />
                      ) : (
                        <Square className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      )}
                      <span>
                        เลือกทั้งหมด {listSearchQuery.trim() ? `(${filteredEnrolledStudents.length} คนที่ค้นพบ)` : ''}
                      </span>
                    </button>

                    {selectedMemberIds.length > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                          isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        เลือกแล้ว {selectedMemberIds.length} คน
                      </span>
                    )}
                  </div>

                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRequestBulkDelete}
                      disabled={loading}
                      className="py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer active:scale-95 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบที่เลือก ({selectedMemberIds.length} คน)</span>
                    </button>
                  )}
                </div>
              )}

              {/* List of Enrolled Students */}
              {studentMembersInCourse.length === 0 ? (
                <div
                  className={`p-8 rounded-2xl text-center space-y-3 border border-dashed ${
                    isDarkMode
                      ? 'border-slate-800 text-slate-400 bg-slate-800/20'
                      : 'border-slate-300 text-slate-500 bg-slate-50'
                  }`}
                >
                  <GraduationCap className="w-10 h-10 mx-auto opacity-40 text-sky-500" />
                  <p className="text-xs font-semibold">
                    ยังไม่มีนักศึกษาลงทะเบียนในรายวิชานี้ สามารถกดปุ่มเพิ่มนักศึกษาเพื่อเลือกนักศึกษาจากฐานข้อมูล
                    หรือสร้างรหัสเชิญชวนส่งให้นักศึกษาได้
                  </p>
                  <button
                    type="button"
                    onClick={() => setMainTab('add')}
                    className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-sky-600/20 inline-flex items-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ไปที่หน้าเพิ่มนักศึกษา</span>
                  </button>
                </div>
              ) : filteredEnrolledStudents.length === 0 ? (
                <div
                  className={`p-6 rounded-2xl text-center text-xs font-semibold border ${
                    isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  ไม่พบรายชื่อนักศึกษาที่ตรงกับคำค้นหา "{listSearchQuery}"
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {filteredEnrolledStudents.map((m, idx) => {
                    const u = m.user;
                    const displayName = u
                      ? `${u.title || ''} ${u.firstNameTh || ''} ${u.lastNameTh || ''}`.trim() || u.email
                      : `นักศึกษา (${m.userId})`;
                    const codeStr = u?.universityId || '';
                    const isSelected = selectedMemberIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={(e) => toggleSelectMember(m.id, idx, e)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
                              : 'bg-sky-50/90 border-sky-300 shadow-sm'
                            : isDarkMode
                            ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Checkbox */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectMember(m.id, idx, e);
                            }}
                            className="shrink-0 cursor-pointer p-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-sky-500" />
                            ) : (
                              <Square
                                className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                              />
                            )}
                          </div>

                          <div
                            className={`w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center font-bold text-sm shrink-0 ${
                              isDarkMode ? 'text-sky-400' : 'text-sky-600'
                            }`}
                          >
                            🎓
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-xs sm:text-sm font-bold truncate ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {displayName}
                            </div>
                            <p
                              className={`text-xs font-medium truncate ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {codeStr ? `รหัสนักศึกษา: ${codeStr} • ` : ''}
                              {u?.email || ''}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestSingleDelete(m);
                          }}
                          className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                            isDarkMode
                              ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/20'
                              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="ลบออกจากรายวิชา"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MAIN TAB 2: Add / Invite Students Options */}
          {mainTab === 'add' && (
            <div className="space-y-4">
              {/* Sub-Tab Selection */}
              <div
                className={`p-1 rounded-xl border flex space-x-1 ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAddMethodTab('db')}
                  className={`flex-1 py-2 px-2 font-bold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    addMethodTab === 'db'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">1. เลือกจากฐานข้อมูล</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddMethodTab('paste')}
                  className={`flex-1 py-2 px-2 font-bold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    addMethodTab === 'paste'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">2. วางรหัส/อีเมล (Bulk Paste)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddMethodTab('link')}
                  className={`flex-1 py-2 px-2 font-bold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    addMethodTab === 'link'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Link className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">3. สร้างลิงก์/รหัสเชิญ</span>
                </button>
              </div>

              {/* Sub-Tab 1: Invite from Database */}
              {addMethodTab === 'db' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        ค้นหาและเลือกนักศึกษา (สามารถเลือกพร้อมกันหลายคนได้)
                      </label>

                      {/* Dropdown for quick single select */}
                      <div className="w-full sm:w-auto">
                        <select
                          value={selectedStudentId}
                          onChange={(e) => {
                            setSelectedStudentId(e.target.value);
                            if (e.target.value && !selectedAvailableStudentIds.includes(e.target.value)) {
                              setSelectedAvailableStudentIds((prev) => [...prev, e.target.value]);
                            }
                          }}
                          className={`w-full sm:w-64 p-2 text-xs rounded-xl border font-bold focus:outline-none focus:border-sky-500 transition ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="">-- เลือกเร็วรายบุคคล ({filteredAvailableStudents.length} คน) --</option>
                          {filteredAvailableStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.universityId ? `[${s.universityId}] ` : ''}
                              {s.title || ''} {s.firstNameTh} {s.lastNameTh} ({s.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Search input */}
                    <div className="relative">
                      <Search
                        className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหานักศึกษาจากชื่อ, รหัสนักศึกษา หรืออีเมล..."
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border font-semibold focus:outline-none focus:border-sky-500 transition ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>

                    {/* Multi-select controls */}
                    {filteredAvailableStudents.length > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={toggleSelectAllAvailable}
                          className={`flex items-center space-x-2 text-xs font-bold transition cursor-pointer select-none ${
                            isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-900'
                          }`}
                        >
                          {isAllAvailableSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-500" />
                          ) : (
                            <Square className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          )}
                          <span>
                            เลือกทั้งหมด {searchQuery.trim() ? `(${filteredAvailableStudents.length} คนจากคำค้นหา)` : `(${filteredAvailableStudents.length} คน)`}
                          </span>
                        </button>

                        <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                          เลือกไว้ {selectedAvailableStudentIds.length} คน
                        </span>
                      </div>
                    )}

                    {/* Scrollable list of available students with checkboxes */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 pt-1">
                      {filteredAvailableStudents.length === 0 ? (
                        <div className={`p-4 text-center text-xs font-semibold rounded-xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'}`}>
                          {searchQuery.trim() ? `ไม่พบนักศึกษาที่ตรงกับคำค้นหา "${searchQuery}"` : 'นักศึกษาทั้งหมดในระบบอยู่ในวิชานี้เรียบร้อยแล้ว'}
                        </div>
                      ) : (
                        filteredAvailableStudents.map((s, idx) => {
                          const isSelected = selectedAvailableStudentIds.includes(s.id);
                          const displayName = `${s.title || ''} ${s.firstNameTh || ''} ${s.lastNameTh || ''}`.trim() || s.email;

                          return (
                            <div
                              key={s.id}
                              onClick={(e) => toggleSelectAvailableStudent(s.id, idx, e)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                                isSelected
                                  ? isDarkMode
                                    ? 'bg-sky-950/50 border-sky-500/50 text-white'
                                    : 'bg-sky-50 border-sky-300 text-slate-900'
                                  : isDarkMode
                                  ? 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-800 text-slate-300'
                                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="shrink-0 p-0.5">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-sky-500" />
                                  ) : (
                                    <Square className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{displayName}</div>
                                  <div className={`text-[11px] font-medium truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {s.universityId ? `รหัส: ${s.universityId} • ` : ''}
                                    {s.email}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-500 border border-sky-500/30 shrink-0 ml-2">
                                  เลือกแล้ว
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-2 flex items-center space-x-2">
                      <button
                        onClick={handleAddSelectedAvailableStudents}
                        disabled={loading || selectedAvailableStudentIds.length === 0}
                        className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>
                          {selectedAvailableStudentIds.length > 0
                            ? `ยืนยันเพิ่มนักศึกษาที่เลือก (${selectedAvailableStudentIds.length} คน) เข้าร่วมรายวิชา`
                            : 'ยืนยันเพิ่มนักศึกษาเข้าร่วมรายวิชา'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Bulk Paste */}
              {addMethodTab === 'paste' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        ป้อนหรือวางรหัสนักศึกษา หรือ อีเมล (แยกด้วยบรรทัดใหม่ คอมมา หรือเว้นวรรค)
                      </label>
                      <p className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        ระบบจะแมตช์รหัสนักศึกษากับฐานข้อมูลให้อัตโนมัติและแสดงรายการที่พบให้กดยืนยันเพิ่ม
                      </p>
                    </div>

                    <textarea
                      rows={5}
                      value={pasteText}
                      onChange={(e) => {
                        setPasteText(e.target.value);
                        setHasParsed(false);
                      }}
                      placeholder={`ตัวอย่างเช่น:\n64010001\n64010002\n64010003\nstudent1@university.ac.th, student2@university.ac.th`}
                      className={`w-full p-3 text-xs font-mono rounded-xl border focus:outline-none focus:border-sky-500 transition ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleParsePasteText}
                        disabled={!pasteText.trim()}
                        className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
                          isDarkMode
                            ? 'bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/30'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                        }`}
                      >
                        <ListChecks className="w-4 h-4" />
                        <span>ตรวจสอบและค้นหารายชื่อในระบบ</span>
                      </button>
                      {pasteText.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setPasteText('');
                            setParsedMatchedStudents([]);
                            setParsedUnmatchedTokens([]);
                            setHasParsed(false);
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ล้างข้อมูล
                        </button>
                      )}
                    </div>

                    {/* Parsed Results Preview */}
                    {hasParsed && (
                      <div className="space-y-3 pt-2">
                        {/* Matched Students List */}
                        <div
                          className={`p-3 rounded-xl border space-y-2 ${
                            isDarkMode ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold flex items-center space-x-1.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>พบรหัสนักศึกษาในฐานข้อมูล: {parsedMatchedStudents.length} คน</span>
                            </span>
                          </div>

                          {parsedMatchedStudents.length === 0 ? (
                            <div className={`text-xs font-medium py-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              ไม่พบนักศึกษาที่แมตช์ตรงกับฐานข้อมูลจากข้อมูลที่วางไว้
                            </div>
                          ) : (
                            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                              {parsedMatchedStudents.map((s) => (
                                <div
                                  key={s.id}
                                  className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                    isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                                  }`}
                                >
                                  <div className="truncate font-semibold">
                                    {s.universityId ? `[${s.universityId}] ` : ''}
                                    {s.title || ''} {s.firstNameTh} {s.lastNameTh}
                                  </div>
                                  <div className={`text-[11px] font-mono shrink-0 ml-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {s.email}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Unmatched Warning List */}
                        {parsedUnmatchedTokens.length > 0 && (
                          <div
                            className={`p-3 rounded-xl border space-y-1 ${
                              isDarkMode ? 'bg-amber-950/30 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className={`text-xs font-bold flex items-center space-x-1.5 ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              <span>ไม่พบในฐานข้อมูล ({parsedUnmatchedTokens.length} รายการ):</span>
                            </div>
                            <div className={`text-[11px] font-mono leading-relaxed truncate ${isDarkMode ? 'text-amber-200/80' : 'text-amber-900'}`}>
                              {parsedUnmatchedTokens.join(', ')}
                            </div>
                          </div>
                        )}

                        {/* Final Add Action Button */}
                        {parsedMatchedStudents.length > 0 && (
                          <button
                            onClick={handleAddParsedStudents}
                            disabled={loading}
                            className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>ยืนยันเพิ่มนักศึกษาที่พบ ({parsedMatchedStudents.length} คน) เข้าร่วมรายวิชา</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Static Invite Link */}
              {addMethodTab === 'link' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      รหัสเชิญชวนนักศึกษาเข้าร่วมชั้นเรียน
                    </label>

                    {generatedCode ? (
                      <div
                        className={`mt-2 p-4 rounded-2xl border space-y-3 ${
                          isDarkMode ? 'border-sky-500/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50'
                        }`}
                      >
                        <div className={`text-xs font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-900'}`}>
                          รหัสเชิญชวนประจำรายวิชา (Static Code 4 ตัวอักษร):
                        </div>
                        <div
                          className={`text-2xl sm:text-3xl font-mono font-bold tracking-widest text-center py-2.5 rounded-xl border shadow-inner ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-400' : 'bg-white border-sky-200 text-sky-700'
                          }`}
                        >
                          {generatedCode}
                        </div>

                        <p className={`text-xs text-center font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          ส่งรหัส 4 หลักนี้ หรือคัดลอกลิงก์ให้นักศึกษาป้อนในหน้ารายวิชาเพื่อลงทะเบียนเข้าเรียน
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedCode);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer ${
                              isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                          >
                            <Copy className="w-4 h-4" />
                            <span>คัดลอกรหัส 4 หลัก</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}?join=${generatedCode}`;
                              navigator.clipboard.writeText(url);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer shadow-sm"
                          >
                            <Link className="w-4 h-4" />
                            <span>คัดลอกลิงก์เต็ม</span>
                          </button>
                        </div>

                        {copied && (
                          <p className={`text-xs font-bold text-center ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            ✓ คัดลอกข้อมูลเรียบร้อยแล้ว
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className={`text-center py-6 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        กำลังดึงรหัสเชิญชวน...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 sm:px-6 py-3.5 border-t flex justify-between items-center shrink-0 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}
        >
          <div className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {selectedMemberIds.length > 0 ? `เลือกไว้ ${selectedMemberIds.length} รายการ` : ''}
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog Modal */}
      {deleteConfirmModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
              isDarkMode ? 'bg-slate-900 border-rose-500/30 text-white' : 'bg-white border-rose-200 text-slate-900'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-rose-500">
                  ยืนยันการลบนักศึกษาออกจากรายวิชา
                </h3>
                <p className={`text-xs mt-1 font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  คุณกำลังจะลบนักศึกษา{' '}
                  <strong className="text-rose-500 font-bold">
                    {deleteTargetMembers.length} คน
                  </strong>{' '}
                  ออกจากรายวิชา{' '}
                  <span className="font-bold">
                    {courseCodeStr} - {courseNameStr}
                  </span>
                </p>
              </div>
            </div>

            {/* List Preview */}
            <div
              className={`p-3 rounded-xl border max-h-36 overflow-y-auto space-y-1.5 text-xs ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className={`font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                รายชื่อนักศึกษาที่จะถูกลบ:
              </div>
              {deleteTargetMembers.map((m) => {
                const u = m.user;
                const displayName = u
                  ? `${u.title || ''} ${u.firstNameTh || ''} ${u.lastNameTh || ''}`.trim() || u.email
                  : `นักศึกษา (${m.userId})`;
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs font-semibold">
                    <span className="truncate">• {displayName}</span>
                    <span className={`text-[11px] font-mono shrink-0 ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {u?.universityId ? `[${u.universityId}]` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className={`text-[11px] font-bold ${isDarkMode ? 'text-rose-400/80' : 'text-rose-600'}`}>
              ⚠️ การลบจะทำให้สิทธิ์การเข้าร่วมวิชาและการเช็กชื่อของนักศึกษาถูกลบออก
            </p>

            {/* Teacher Password Confirmation Input */}
            <div className="space-y-1.5 pt-1">
              <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                กรอกรหัสผ่านของคุณเพื่อยืนยันการลบ <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                placeholder="ป้อนรหัสผ่านอาจารย์ผู้ดำเนินการ"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && teacherPassword.trim()) {
                    handleConfirmDelete();
                  }
                }}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmModalOpen(false);
                  setDeleteTargetMembers([]);
                  setTeacherPassword('');
                  setError(null);
                }}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading || !teacherPassword.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{loading ? 'กำลังลบ...' : 'ยืนยันลบออกจากรายวิชา'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
