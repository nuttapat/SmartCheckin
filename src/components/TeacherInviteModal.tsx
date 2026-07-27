import React, { useState, useEffect } from 'react';
import { X, UserPlus, Link, Copy, Check, ShieldCheck, UserCheck, Trash2, Search, User } from 'lucide-react';
import { Course, CourseMember, CourseMemberRole, User as UserType } from '../types';
import { fetchTeachers, inviteTeacherToCourse, updateCourseMemberRole, removeCourseMember, generateInviteLink } from '../services/api';

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
  isDarkMode = false,
}) => {
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
    }
  }, [isOpen]);

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
        return { label: 'ผู้รับผิดชอบรายวิชา (Coordinator)', color: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50', icon: '👑' };
      case CourseMemberRole.CO_COORDINATOR:
        return { label: 'ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)', color: 'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/50', icon: '🤝' };
      case CourseMemberRole.INSTRUCTOR:
        return { label: 'อาจารย์ผู้สอน (Instructor)', color: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/50', icon: '👨‍🏫' };
      default:
        return { label: 'สมาชิก', color: 'bg-slate-200 text-slate-950 border-slate-300', icon: '👤' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border-2 transition-colors my-auto ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
      }`}>
        {/* Header - Fixed top */}
        <div className={`flex items-center justify-between border-b-2 px-6 py-4 shrink-0 rounded-t-2xl ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-r from-blue-50 via-sky-50 to-emerald-50/40 border-slate-200'
        }`}>
          <div>
            <h2 className="text-xl font-black flex items-center space-x-2 text-slate-950 dark:text-white">
              <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>จัดการและเชิญอาจารย์ผู้สอน</span>
            </h2>
            <p className="text-sm font-extrabold text-blue-900 dark:text-slate-200 mt-0.5">
              {course.courseCode} — {course.courseName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-800 hover:text-black dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className={`flex-1 overflow-y-auto px-6 py-4 space-y-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          {/* Status Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl text-sm font-black bg-rose-100 text-rose-950 dark:bg-rose-950/70 dark:text-rose-200 border-2 border-rose-400 dark:border-rose-800 shadow-sm">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 rounded-xl text-sm font-black bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-2 border-emerald-400 dark:border-emerald-800 shadow-sm">
              {successMsg}
            </div>
          )}

          {/* Tab Selection */}
          <div className="flex border-b-2 border-slate-200 dark:border-slate-800 space-x-4">
            <button
              onClick={() => setActiveTab('db')}
              className={`pb-3 px-3 font-black text-sm transition border-b-2 cursor-pointer flex items-center space-x-2 rounded-t-lg ${
                activeTab === 'db'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/60 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-950/40'
                  : 'border-transparent text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>เชิญอาจารย์ในระบบ</span>
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`pb-3 px-3 font-black text-sm transition border-b-2 cursor-pointer flex items-center space-x-2 rounded-t-lg ${
                activeTab === 'link'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/60 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-950/40'
                  : 'border-transparent text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200'
              }`}
            >
              <Link className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>สร้างลิงก์/รหัสเชิญ</span>
            </button>
          </div>

          {/* Tab 1: Invite from Database */}
          {activeTab === 'db' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border-2 space-y-3 shadow-xs ${
                isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/90 border-slate-300'
              }`}>
                <label className="block text-xs font-black text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                  1. เลือกอาจารย์ที่มีรายชื่ออยู่ในฐานข้อมูล
                </label>

                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-600 dark:text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาอาจารย์จากชื่อ หรืออีเมล..."
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border-2 font-black focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-950 placeholder-slate-500'
                    }`}
                  />
                </div>

                {/* Select box */}
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className={`w-full p-2.5 text-sm rounded-xl border-2 font-black focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                  }`}
                >
                  <option value="">-- เลือกอาจารย์ผู้สอน --</option>
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || 'อ.'} {t.firstNameTh} {t.lastNameTh} ({t.email})
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-black text-slate-950 dark:text-slate-100 uppercase tracking-wider pt-2">
                  2. เลือกบทบาทหน้าที่ในรายวิชา
                </label>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.COORDINATOR
                        ? 'border-blue-600 bg-blue-50 text-slate-950 ring-2 ring-blue-600'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-blue-50/40 text-slate-950 dark:text-slate-100'
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
                    <span className="font-black text-blue-900 dark:text-blue-200 flex items-center space-x-1 text-xs">
                      <span>👑</span> <span>ผู้รับผิดชอบรายวิชา</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-950 dark:text-slate-300 leading-tight">
                      แก้ไขและลบวิชาได้ สิทธิ์ระดับสูงสุด
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.CO_COORDINATOR
                        ? 'border-sky-600 bg-sky-50 text-slate-950 ring-2 ring-sky-600'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50/40 text-slate-950 dark:text-slate-100'
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
                    <span className="font-black text-sky-900 dark:text-sky-200 flex items-center space-x-1 text-xs">
                      <span>🤝</span> <span>ผู้ร่วมรับผิดชอบรายวิชา</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-950 dark:text-slate-300 leading-tight">
                      สร้าง QR/เช็คชื่อได้ ไม่สามารถแก้ไขหรือลบวิชาได้
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col space-y-1.5 ${
                      selectedRole === CourseMemberRole.INSTRUCTOR
                        ? 'border-emerald-600 bg-emerald-50 text-slate-950 ring-2 ring-emerald-600'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-emerald-50/40 text-slate-950 dark:text-slate-100'
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
                    <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center space-x-1 text-xs">
                      <span>👨‍🏫</span> <span>อาจารย์ผู้สอน</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-950 dark:text-slate-300 leading-tight">
                      สร้าง QR/เช็คชื่อและดูรายชื่อนักศึกษาได้
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleAddTeacher}
                  disabled={loading || !selectedTeacherId}
                  className="w-full mt-3 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2 active:scale-98"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ยืนยันเพิ่มอาจารย์เข้าร่วมรายวิชา</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Generate Link */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border-2 space-y-3 shadow-xs ${
                isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/90 border-slate-300'
              }`}>
                <label className="block text-xs font-black text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                  เลือกประเภทสิทธิ์ที่ต้องการสร้างลิงก์เชิญ
                </label>

                <select
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value as CourseMemberRole)}
                  className={`w-full p-2.5 text-sm rounded-xl border-2 font-black focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                  }`}
                >
                  <option value={CourseMemberRole.COORDINATOR}>👑 ผู้รับผิดชอบรายวิชา (Course Coordinator)</option>
                  <option value={CourseMemberRole.CO_COORDINATOR}>🤝 ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)</option>
                  <option value={CourseMemberRole.INSTRUCTOR}>👨‍🏫 อาจารย์ผู้สอน (Instructor)</option>
                  <option value={CourseMemberRole.STUDENT}>🎓 นักศึกษา (Student)</option>
                </select>

                <button
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center space-x-2 active:scale-98"
                >
                  <Link className="w-4 h-4" />
                  <span>สร้างรหัสเชิญสำหรับสิทธิ์นี้</span>
                </button>

                {generatedCode && (
                  <div className="mt-4 p-4 rounded-2xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 space-y-2">
                    <div className="text-xs font-black text-blue-950 dark:text-blue-200">
                      รหัสเชิญชวน (Invite Code):
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-mono font-black tracking-wider text-blue-950 dark:text-blue-100">
                        {generatedCode}
                      </span>
                      <button
                        onClick={handleCopy}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอกลิงก์'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Instructors List */}
          <div className="mt-4 border-t-2 pt-4 border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center justify-between">
              <span>อาจารย์ผู้สอนทั้งหมดในรายวิชา ({currentTeacherMembers.length + 1} ท่าน)</span>
            </h3>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {/* Owner */}
              <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-blue-50/90 border-blue-300'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    👑
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-950 dark:text-white flex items-center space-x-2">
                      <span>{course.coordinatorName || course.ownerName}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-blue-600 text-white border border-blue-700">
                        เจ้าของรายวิชา/ผู้รับผิดชอบ
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-300">สิทธิ์ผู้สร้างและจัดการหลัก</p>
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
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between ${
                      isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0 border border-slate-200 dark:border-slate-600">
                        {roleMeta.icon}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-950 dark:text-white">{teacherName}</div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border inline-block mt-0.5 ${roleMeta.color}`}>
                          {roleMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Actions if current user is owner or coordinator */}
                    <div className="flex items-center space-x-2">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as CourseMemberRole)}
                        className={`text-xs font-black p-1.5 rounded-lg border-2 focus:ring-1 focus:ring-blue-500 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                        }`}
                      >
                        <option value={CourseMemberRole.COORDINATOR}>👑 ผู้รับผิดชอบรายวิชา</option>
                        <option value={CourseMemberRole.CO_COORDINATOR}>🤝 ผู้ร่วมรับผิดชอบรายวิชา</option>
                        <option value={CourseMemberRole.INSTRUCTOR}>👨‍🏫 อาจารย์ผู้สอน</option>
                      </select>

                      <button
                        onClick={() => handleRemoveMember(m.id, teacherName)}
                        className="p-1.5 rounded-lg text-rose-700 hover:text-rose-900 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition cursor-pointer"
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

        {/* Modal Footer - Fixed bottom */}
        <div className={`px-6 py-4 border-t-2 flex justify-end shrink-0 rounded-b-2xl ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-black text-sm bg-slate-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 transition cursor-pointer shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
