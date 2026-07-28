import React, { useState } from 'react';
import { Course } from '../types';
import { deleteCourseApi } from '../services/api';
import { Trash2, AlertTriangle, Lock, Eye, EyeOff, ShieldAlert, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface DeleteCourseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  teacherId: string;
  onSuccess: (deletedCourseId: string) => void;
  isDarkMode?: boolean;
}

export const DeleteCourseConfirmModal: React.FC<DeleteCourseConfirmModalProps> = ({
  isOpen,
  onClose,
  course,
  teacherId,
  onSuccess,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      await deleteCourseApi(course.id, teacherId, password);
      onSuccess(course.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถลบรายวิชาได้ กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`border rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-rose-500/30 text-slate-100'
            : 'bg-white border-rose-200 text-slate-900'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className={`absolute right-4 top-4 p-2 rounded-full transition ${
            isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 text-rose-500">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-500">ยืนยันการลบรายวิชาถาวร</h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              จะไม่สามารถกู้คืนข้อมูลรายวิชานี้กลับมาได้อีก
            </p>
          </div>
        </div>

        {/* Course Info Card */}
        <div className={`p-3.5 rounded-2xl border ${
          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="text-[11px] text-slate-400 block font-semibold">รายวิชาที่จะลบ:</span>
          <div className="font-mono text-sm font-bold text-sky-400 mt-0.5">
            {course.courseCode}
          </div>
          <div className="text-xs font-semibold mt-0.5">
            {course.courseName}
          </div>
        </div>

        {/* Danger Warning Box */}
        <div
          className={`p-4 border rounded-2xl text-xs space-y-1.5 ${
            isDarkMode
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="space-y-1">
              <p className="font-bold text-rose-500">⚠️ คำเตือนสำคัญ:</p>
              <p className="leading-relaxed text-[11px] opacity-90">
                การลบรายวิชานี้จะลบข้อมูลสัปดาห์สอน ประวัติการเช็คชื่อเข้าเรียนของนักศึกษา คลาสเรียน และลิงก์เชิญทั้งหมดออกจากระบบอย่างถาวร
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Delete Form */}
        <form onSubmit={handleConfirmDelete} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>ยืนยันรหัสผ่านเพื่อดำเนินการลบ:</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านบัญชีผู้ใช้ของคุณ..."
                required
                autoFocus
                className={`w-full border rounded-xl pl-3 pr-10 py-2.5 text-xs focus:outline-none focus:border-rose-500 ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              *ต้องใส่รหัสผ่านถูกต้องจึงจะลบรายวิชาได้
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'กำลังลบ...' : 'ยืนยันลบรายวิชาถาวร'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
