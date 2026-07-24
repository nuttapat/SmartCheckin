import React, { useState } from 'react';
import { joinCourseByInvite } from '../services/api';
import { X, KeyRound, CheckCircle2 } from 'lucide-react';

interface JoinCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  isDarkMode?: boolean;
}

export const JoinCourseModal: React.FC<JoinCourseModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
  isDarkMode = true,
}) => {
  const [code, setCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setLoading(true);
      setErrorMsg('');
      await joinCourseByInvite(code.trim(), userId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className={`border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-emerald-500" />
            <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>เข้าร่วมวิชาเรียน (Join Course)</h3>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              ป้อนรหัสเชิญชวนจากอาจารย์ (Invite Code)
            </label>
            <input
              type="text"
              placeholder="เช่น 8-Character Invite Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className={`w-full border rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-teal-500 uppercase ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <div className={`flex justify-end space-x-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <span>กำลังตรวจสอบ...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>เข้าร่วมรายวิชา</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
