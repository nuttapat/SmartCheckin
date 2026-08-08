import React, { useState, useEffect } from 'react';
import { X, UserPlus, Link, Copy, Check, ShieldCheck, UserCheck, Trash2, Search, User, Maximize2, Minimize2 } from 'lucide-react';
import { Course, CourseMember, CourseMemberRole, User as UserType } from '../types';
import { fetchTeachers, inviteTeacherToCourse, updateCourseMemberRole, removeCourseMember, generateInviteLink } from '../services/api';
import { useTheme } from '../context/ThemeContext';

interface TeacherInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  currentUserId: string;
  courseMembers?: CourseMember[];
  onRefresh?: () => void;
  onMembersUpdated?: () => void;
  isDarkMode?: boolean;
}

export const TeacherInviteModal: React.FC<TeacherInviteModalProps> = ({
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
  const [activeTab, setActiveTab] = useState<'db' | 'link'>('db');
  const [teachers, setTeachers] = useState<UserType[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<CourseMemberRole>(CourseMemberRole.INSTRUCTOR);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite Link State
  const [linkRole, setLinkRole] = useState<CourseMemberRole>(CourseMemberRole.INSTRUCTOR);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const triggerRefresh = () => {
    if (onRefresh) onRefresh();
    if (onMembersUpdated) onMembersUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      loadTeachers();
      setError(null);
      setSuccessMsg(null);
      fetchLinkForRole(linkRole);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'link') {
      fetchLinkForRole(linkRole);
    }
  }, [linkRole, activeTab, isOpen]);

  const fetchLinkForRole = async (roleToFetch: CourseMemberRole) => {
    try {
      setLoading(true);
      const invite = await generateInviteLink(course.id, roleToFetch);
      setGeneratedCode(invite.code);
      setCopied(false);
    } catch (err: any) {
      console.error('Failed to generate invite link:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const data = await fetchTeachers();
      // Filter out teachers who are already in the course or owner
      const filtered = data.filter((t) => t.id !== course.ownerId);
      setTeachers(filtered);
    } catch (err: any) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddTeacher = async () => {
    if (!selectedTeacherId) {
      setError('กรุณาเลือกอาจารย์ที่ต้องการเชิญจากรายชื่อในระบบ');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const res = await inviteTeacherToCourse(course.id, selectedTeacherId, selectedRole);
      setSuccessMsg(res.message || 'เพิ่มอาจารย์เข้าร่วมรายวิชาสำเร็จ');
      setSelectedTeacherId('');
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มอาจารย์');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: CourseMemberRole) => {
    try {
      setLoading(true);
      await updateCourseMemberRole(course.id, memberId, newRole);
      setSuccessMsg('ปรับเปลี่ยนบทบาทอาจารย์เรียบร้อยแล้ว');
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนบทบาท');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`คุณต้องการลบ ${name} ออกจากการเป็นอาจารย์ผู้สอนในรายวิชานี้ใช่หรือไม่?`)) {
      return;
    }
    try {
      setLoading(true);
      await removeCourseMember(course.id, memberId);
      setSuccessMsg(`ลบ ${name} ออกจากรายวิชาเรียบร้อยแล้ว`);
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการลบสมาชิก');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      const invite = await generateInviteLink(course.id, linkRole);
      setGeneratedCode(invite.code);
      setCopied(false);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถสร้างลิงก์เชิญได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    const url = `${window.location.origin}?join=${generatedCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const currentTeacherMembers = (courseMembers || []).filter(
    (m) => m && m.role !== CourseMemberRole.STUDENT && m.userId !== course.ownerId
  );

  const filteredTeachers = teachers.filter((t) => {
    const fullName = `${t.title || ''} ${t.firstNameTh} ${t.lastNameTh} ${t.email}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const getRoleLabel = (role: CourseMemberRole) => {
    switch (role) {
      case CourseMemberRole.COORDINATOR:
      case CourseMemberRole.CO_TEACHER:
        return {
          label: 'ผู้รับผิดชอบรายวิชา (Coordinator)',
          color: isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-sky-100 text-sky-800 border-sky-200',
          icon: '👑'
        };
      case CourseMemberRole.CO_COORDINATOR:
        return {
          label: 'ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)',
          color: isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-sky-100 text-sky-800 border-sky-200',
          icon: '🤝'
        };
      case CourseMemberRole.INSTRUCTOR:
        return {
          label: 'อาจารย์ผู้สอน (Instructor)',
          color: isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: '👨‍🏫'
        };
      default:
        return {
          label: 'สมาชิก',
          color: isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-200',
          icon: '👤'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className={`border shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        isMaximized
          ? 'w-full h-full max-w-none max-h-none rounded-none my-0'
          : 'w-full max-w-2xl rounded-2xl max-h-[92vh] my-auto'
      } ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`px-5 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-sky-50/70 border-sky-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 ${
              isDarkMode ? 'text-sky-400' : 'text-sky-600'
            }`}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                จัดการและเชิญอาจารย์ผู้สอน
              </h2>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                {course.courseCode} — {course.courseName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'ย่อขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
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
            <div className={`p-3 rounded-xl border text-xs font-semibold ${
              isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {error}
            </div>
          )}
          {successMsg && (
            <div className={`p-3 rounded-xl border text-xs font-semibold ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {successMsg}
            </div>
          )}

          {/* Tab Selection */}
          <div className={`flex border-b space-x-2 px-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              onClick={() => setActiveTab('db')}
              className={`pb-2.5 px-3.5 font-bold text-xs transition border-b-2 flex items-center space-x-2 rounded-t-xl cursor-pointer ${
                activeTab === 'db'
                  ? 'border-sky-600 text-sky-600 bg-sky-500/10'
                  : isDarkMode
                    ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4 text-sky-500" />
              <span>เชิญอาจารย์ในระบบ</span>
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`pb-2.5 px-3.5 font-bold text-xs transition border-b-2 flex items-center space-x-2 rounded-t-xl cursor-pointer ${
                activeTab === 'link'
                  ? 'border-sky-600 text-sky-600 bg-sky-500/10'
                  : isDarkMode
                    ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Link className="w-4 h-4 text-sky-500" />
              <span>สร้างลิงก์/รหัสเชิญ</span>
            </button>
          </div>

          {/* Tab 1: Invite from Database */}
          {activeTab === 'db' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  1. เลือกอาจารย์ที่มีรายชื่ออยู่ในฐานข้อมูล
                </label>

                {/* Search input */}
                <div className="relative">
                  <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาอาจารย์จากชื่อ หรืออีเมล..."
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border font-semibold focus:outline-none focus:border-sky-500 transition ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Select box */}
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className={`w-full p-2.5 text-xs rounded-xl border font-bold focus:outline-none focus:border-sky-500 transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- เลือกอาจารย์ผู้สอน --</option>
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || 'อ.'} {t.firstNameTh} {t.lastNameTh} ({t.email})
                    </option>
                  ))}
                </select>

                <label className={`block text-xs font-bold pt-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  2. เลือกบทบาทหน้าที่ในรายวิชา
                </label>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.COORDINATOR
                        ? 'border-sky-500 bg-sky-500/10 font-bold border-2'
                        : isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/50'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="teacherRole"
                      value={CourseMemberRole.COORDINATOR}
                      checked={selectedRole === CourseMemberRole.COORDINATOR}
                      onChange={() => setSelectedRole(CourseMemberRole.COORDINATOR)}
                      className="sr-only"
                    />
                    <span className={`font-bold flex items-center space-x-1 text-xs ${
                      selectedRole === CourseMemberRole.COORDINATOR
                        ? 'text-sky-600'
                        : isDarkMode ? 'text-sky-400' : 'text-sky-700'
                    }`}>
                      <span>👑</span> <span>ผู้รับผิดชอบรายวิชา</span>
                    </span>
                    <span className={`text-[11px] font-medium leading-tight ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      อำนาจจัดการคอร์สเทียบเท่าผู้สร้างรายวิชา จัดการวิชา/สัปดาห์/เช็คชื่อ ได้เต็มรูปแบบ
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.CO_COORDINATOR
                        ? 'border-sky-500 bg-sky-500/10 font-bold border-2'
                        : isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/50'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="teacherRole"
                      value={CourseMemberRole.CO_COORDINATOR}
                      checked={selectedRole === CourseMemberRole.CO_COORDINATOR}
                      onChange={() => setSelectedRole(CourseMemberRole.CO_COORDINATOR)}
                      className="sr-only"
                    />
                    <span className={`font-bold flex items-center space-x-1 text-xs ${
                      selectedRole === CourseMemberRole.CO_COORDINATOR
                        ? 'text-sky-600'
                        : isDarkMode ? 'text-sky-400' : 'text-sky-700'
                    }`}>
                      <span>🤝</span> <span>ผู้ร่วมรับผิดชอบรายวิชา</span>
                    </span>
                    <span className={`text-[11px] font-medium leading-tight ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      แก้ไขสถานะการเช็คชื่อตารางเรียนและเปิด QR ได้ (เพิ่ม/ลดสัปดาห์ไม่ได้)
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.INSTRUCTOR
                        ? 'border-emerald-500 bg-emerald-500/10 font-bold border-2'
                        : isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/50'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="teacherRole"
                      value={CourseMemberRole.INSTRUCTOR}
                      checked={selectedRole === CourseMemberRole.INSTRUCTOR}
                      onChange={() => setSelectedRole(CourseMemberRole.INSTRUCTOR)}
                      className="sr-only"
                    />
                    <span className={`font-bold flex items-center space-x-1 text-xs ${
                      selectedRole === CourseMemberRole.INSTRUCTOR
                        ? 'text-emerald-600'
                        : isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}>
                      <span>👨‍🏫</span> <span>อาจารย์ผู้สอน</span>
                    </span>
                    <span className={`text-[11px] font-medium leading-tight ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      เปิด QR Code เพื่อเช็คชื่อได้เท่านั้น ฟังก์ชั่นอื่นเป็น Read-only
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleAddTeacher}
                  disabled={loading || !selectedTeacherId}
                  className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ยืนยันเพิ่มอาจารย์เข้าร่วมรายวิชา</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Static Invite Link */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  เลือกสิทธิ์ที่ต้องการแสดงรหัสเชิญชวน
                </label>

                <select
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value as CourseMemberRole)}
                  className={`w-full p-2.5 text-xs rounded-xl border font-bold focus:outline-none focus:border-sky-500 transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={CourseMemberRole.INSTRUCTOR}>👨‍🏫 อาจารย์ผู้สอน (Instructor)</option>
                  <option value={CourseMemberRole.CO_COORDINATOR}>🤝 ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)</option>
                  <option value={CourseMemberRole.COORDINATOR}>👑 ผู้รับผิดชอบรายวิชา (Course Coordinator)</option>
                </select>

                {generatedCode && (
                  <div className={`mt-2 p-4 rounded-2xl border space-y-3 ${
                    isDarkMode ? 'border-sky-500/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50'
                  }`}>
                    <div className={`text-xs font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-900'}`}>
                      รหัสเชิญชวนแบบคงที่ประจำรายวิชา (Static Code 4 ตัวอักษร):
                    </div>
                    <div className={`text-2xl sm:text-3xl font-mono font-bold tracking-widest text-center py-2.5 rounded-xl border shadow-inner ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-400' : 'bg-white border-sky-200 text-sky-700'
                    }`}>
                      {generatedCode}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-slate-800 hover:bg-slate-900 text-white'
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
                )}
              </div>
            </div>
          )}

          {/* Current Instructors List */}
          <div className={`pt-3 border-t space-y-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <h3 className={`text-xs font-extrabold flex items-center justify-between uppercase tracking-wider ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <span>อาจารย์ผู้สอนทั้งหมดในรายวิชา ({currentTeacherMembers.length + 1} ท่าน)</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {/* Owner */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-sky-50 border-sky-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    👑
                  </div>
                  <div>
                    <div className={`text-xs sm:text-sm font-bold flex items-center space-x-2 ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      <span>{course.coordinatorName || course.ownerName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-extrabold bg-sky-600 text-white">
                        👑 ผู้สร้างรายวิชา (Course Creator)
                      </span>
                    </div>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      อำนาจจัดการคอร์สทั้งหมด (ไม่สามารถโอนย้ายได้ยกเว้นโดย Admin)
                    </p>
                  </div>
                </div>
              </div>

              {/* Other Teaching Members */}
              {currentTeacherMembers.map((m) => {
                const teacherName = m.user
                  ? `${m.user.title || ''} ${m.user.firstNameTh} ${m.user.lastNameTh}`
                  : `อาจารย์ (${m.userId})`;
                const roleMeta = getRoleLabel(m.role);

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 border ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        {roleMeta.icon}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-xs sm:text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {teacherName}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold border inline-block mt-0.5 ${roleMeta.color}`}>
                          {roleMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Actions if current user is owner or coordinator */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as CourseMemberRole)}
                        className={`text-xs font-bold p-1.5 rounded-lg border focus:outline-none focus:border-sky-500 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value={CourseMemberRole.COORDINATOR}>👑 ผู้รับผิดชอบรายวิชา</option>
                        <option value={CourseMemberRole.CO_COORDINATOR}>🤝 ผู้ร่วมรับผิดชอบรายวิชา</option>
                        <option value={CourseMemberRole.INSTRUCTOR}>👨‍🏫 อาจารย์ผู้สอน</option>
                      </select>

                      <button
                        onClick={() => handleRemoveMember(m.id, teacherName)}
                        className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                          isDarkMode ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/20' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title="ลบออกจากรายวิชา"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`px-5 sm:px-6 py-3.5 border-t flex justify-end shrink-0 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
