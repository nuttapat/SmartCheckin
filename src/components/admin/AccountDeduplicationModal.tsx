import React, { useState, useEffect } from 'react';
import {
  DuplicateScanReport,
  DuplicateUserCandidate,
  MergeResultReport,
  User,
} from '../../types';
import {
  scanDuplicateAccounts,
  mergeUserAccounts,
  mergeAllDuplicateAccounts,
} from '../../services/api';
import {
  GitMerge,
  Users,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldAlert,
  Sparkles,
  Mail,
  Smartphone,
  BookOpen,
  CalendarCheck,
  Check,
} from 'lucide-react';

interface AccountDeduplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  onRefreshUsers: () => void;
  onRefreshOverview: () => void;
}

export const AccountDeduplicationModal: React.FC<AccountDeduplicationModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  showToast,
  onRefreshUsers,
  onRefreshOverview,
}) => {
  const [loadingScan, setLoadingScan] = useState<boolean>(false);
  const [scanReport, setScanReport] = useState<DuplicateScanReport | null>(null);
  const [processingMergeId, setProcessingMergeId] = useState<string | null>(null);
  const [processingAllMerge, setProcessingAllMerge] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-modal custom confirmation state (to bypass iframe sandboxing where window.confirm() fails)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    candidate?: DuplicateUserCandidate;
  }>({
    isOpen: false,
    type: 'single',
  });

  const handleRunScan = async () => {
    setLoadingScan(true);
    setErrorMessage(null);
    try {
      const report = await scanDuplicateAccounts();
      setScanReport(report);
      showToast(`สแกนพบบัญชีซ้ำซ้อน ${report.duplicateGroupCount} กลุ่ม (${report.totalRedundantAccounts} บัญชีย่อย)`);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการสแกนบัญชี');
    } finally {
      setLoadingScan(false);
    }
  };

  // Auto-scan on modal open
  useEffect(() => {
    if (isOpen && !scanReport && !loadingScan) {
      handleRunScan();
    }
  }, [isOpen]);

  const initiateMergeSingle = (candidate: DuplicateUserCandidate) => {
    setErrorMessage(null);
    setConfirmDialog({
      isOpen: true,
      type: 'single',
      candidate,
    });
  };

  const initiateMergeAll = () => {
    if (!scanReport || scanReport.candidates.length === 0) return;
    setErrorMessage(null);
    setConfirmDialog({
      isOpen: true,
      type: 'all',
    });
  };

  const handleConfirmMerge = async () => {
    if (confirmDialog.type === 'single' && confirmDialog.candidate) {
      const candidate = confirmDialog.candidate;
      const secIds = candidate.secondaryUsers.map((u) => u.id);
      setConfirmDialog({ isOpen: false, type: 'single' });
      setProcessingMergeId(candidate.id);
      setErrorMessage(null);

      try {
        const res: MergeResultReport = await mergeUserAccounts(candidate.primaryUser.id, secIds);
        showToast(res.message || 'รวมบัญชีสำเร็จเรียบร้อย');

        // Update scan report state locally
        if (scanReport) {
          const remaining = scanReport.candidates.filter((c) => c.id !== candidate.id);
          setScanReport({
            ...scanReport,
            duplicateGroupCount: remaining.length,
            totalRedundantAccounts: remaining.reduce((acc, c) => acc + c.secondaryUsers.length, 0),
            candidates: remaining,
          });
        }

        onRefreshUsers();
        onRefreshOverview();
      } catch (err: any) {
        setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการรวมบัญชี');
      } finally {
        setProcessingMergeId(null);
      }
    } else if (confirmDialog.type === 'all') {
      setConfirmDialog({ isOpen: false, type: 'all' });
      setProcessingAllMerge(true);
      setErrorMessage(null);

      try {
        const res = await mergeAllDuplicateAccounts();
        showToast(res.message || 'รวมบัญชีทั้งหมดสำเร็จเรียบร้อย');
        onRefreshUsers();
        onRefreshOverview();
        // Re-scan to show 0 duplicates
        await handleRunScan();
      } catch (err: any) {
        setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการรวมบัญชีทั้งหมด');
      } finally {
        setProcessingAllMerge(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all relative ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/30 shrink-0">
              <GitMerge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  เครื่องมือสแกนและรวมบัญชีซ้ำซ้อน (Domain Transition & Deduplication)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-500 border border-sky-500/30">
                  .edu ➔ .ac.th
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                รวมบัญชีเดิมที่เป็น .edu เข้ากับ .ac.th โดยคงประวัติการเช็กชื่อและอุปกรณ์เดิมไว้ 100%
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Error message banner if any */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Info Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDarkMode ? 'bg-sky-950/30 border-sky-800/50' : 'bg-sky-50/80 border-sky-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className={isDarkMode ? 'text-sky-300' : 'text-sky-800'}>
                  หลักการทำงานของการรวมบัญชีอัจฉริยะ (Smart Zero-Loss Account Merge):
                </strong>
                <p className={`mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  1. ยกระดับบัญชีหลักเป็น <strong>@student.mahidol.ac.th</strong> พร้อมผูกอีเมล <strong>@student.mahidol.edu</strong> เป็นอีเมลสำรอง (Aliases)<br />
                  2. ย้ายข้อมูลประวัติการเช็กชื่อเข้าเรียน (Attendance Records) ทั้งหมดเข้าบัญชีหลักทันที<br />
                  3. ควบรวมรายวิชาที่ลงทะเบียน, ใบลา, และอุปกรณ์ที่เคยผูกไว้ (Device Fingerprints) เข้าด้วยกัน
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRunScan}
                disabled={loadingScan || processingAllMerge || processingMergeId !== null}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition flex items-center space-x-2 shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingScan ? 'animate-spin' : ''}`} />
                <span>{scanReport ? 'สแกนใหม่อีกครั้ง' : 'เริ่มสแกนตรวจหาบัญชีซ้ำ'}</span>
              </button>

              {scanReport && scanReport.duplicateGroupCount > 0 && (
                <button
                  type="button"
                  onClick={initiateMergeAll}
                  disabled={processingAllMerge || loadingScan || processingMergeId !== null}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition flex items-center space-x-2 shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <GitMerge className={`w-3.5 h-3.5 ${processingAllMerge ? 'animate-spin' : ''}`} />
                  <span>รวมทั้งหมด ({scanReport.duplicateGroupCount} กลุ่ม)</span>
                </button>
              )}
            </div>
          </div>

          {/* Scan Results View */}
          {!scanReport && !loadingScan && (
            <div
              className={`p-10 rounded-2xl border text-center space-y-3 ${
                isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold">ยังไม่ได้เริ่มสแกนฐานข้อมูล</h4>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  กดปุ่ม <strong>"เริ่มสแกนตรวจหาบัญชีซ้ำ"</strong> เพื่อให้ระบบค้นหาบัญชีผู้ใช้ที่มีความเชื่อมโยงกันจากการเปลี่ยนโดเมน (.edu ➔ .ac.th) หรือรหัสนักศึกษาเดียวกัน
                </p>
              </div>
            </div>
          )}

          {loadingScan && (
            <div className="p-10 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-400">
                กำลังตรวจสอบข้อมูลผู้ใช้, โดเมนอีเมล, และประวัติการเช็กชื่อ...
              </p>
            </div>
          )}

          {scanReport && !loadingScan && scanReport.duplicateGroupCount === 0 && (
            <div
              className={`p-8 rounded-2xl border text-center space-y-2 ${
                isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                ยอดเยี่ยม! ไม่พบบัญชีผู้ใช้ซ้ำซ้อนในระบบ
              </h4>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ฐานข้อมูลผู้ใช้มีความเป็นเอกภาพและถูกต้องสมบูรณ์ (ตรวจพบ {scanReport.totalUsersChecked} ผู้ใช้)
              </p>
            </div>
          )}

          {scanReport && !loadingScan && scanReport.duplicateGroupCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  พบบัญชีที่สามารถรวมได้ ({scanReport.duplicateGroupCount} กลุ่ม / {scanReport.totalRedundantAccounts} บัญชีย่อย)
                </span>
                <span className="text-[11px] font-bold text-sky-500">
                  รวมประวัติการเช็กชื่อทั้งหมด:{' '}
                  {scanReport.candidates.reduce((acc, c) => acc + c.details.totalAttendanceRecords, 0)} รายการ
                </span>
              </div>

              <div className="space-y-3">
                {scanReport.candidates.map((candidate, idx) => {
                  const isProcessing = processingMergeId === candidate.id;
                  const prim = candidate.primaryUser;
                  const secList = candidate.secondaryUsers;

                  return (
                    <div
                      key={candidate.id}
                      className={`p-4 rounded-2xl border transition hover:border-sky-500/50 ${
                        isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-[11px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm font-black">
                              {prim.title || ''} {prim.firstNameTh} {prim.lastNameTh}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              รหัส: {prim.universityId || 'ไม่มีรหัส'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                              {candidate.matchReason === 'DOMAIN_TRANSITION'
                                ? '🔄 เปลี่ยนโดเมน (.edu ➔ .ac.th)'
                                : candidate.matchReason === 'UNIVERSITY_ID_MATCH'
                                ? '🆔 รหัสนักศึกษาตรงกัน'
                                : '👤 ชื่อ-นามสกุล ตรงกัน'}
                            </span>
                          </div>

                          {/* Email Mapping Comparison */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                            <div
                              className={`p-2.5 rounded-xl border ${
                                isDarkMode
                                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              }`}
                            >
                              <span className="text-[10px] font-black block uppercase tracking-wider text-emerald-500">
                                บัญชีหลักที่จะเก็บไว้ (Primary)
                              </span>
                              <div className="font-bold flex items-center space-x-1.5 mt-0.5">
                                <Mail className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{prim.email}</span>
                              </div>
                              <span className="text-[10px] opacity-75 block mt-0.5">
                                {prim.authProvider === 'google' ? '🟢 Google Auth' : '📧 Email/Password'} | ID:{' '}
                                {prim.id}
                              </span>
                            </div>

                            <div
                              className={`p-2.5 rounded-xl border ${
                                isDarkMode
                                  ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                                  : 'bg-rose-50 border-rose-200 text-rose-800'
                              }`}
                            >
                              <span className="text-[10px] font-black block uppercase tracking-wider text-rose-500">
                                บัญชีซ้ำซ้อนที่จะนำมารวม ({secList.length} บัญชี)
                              </span>
                              <div className="space-y-1 mt-0.5">
                                {secList.map((sec) => (
                                  <div key={sec.id} className="font-bold flex items-center justify-between text-xs">
                                    <span className="truncate">{sec.email}</span>
                                    <span className="text-[10px] opacity-75 shrink-0">({sec.id})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Data to be merged summary */}
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                            <span className="flex items-center space-x-1">
                              <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span>
                                ประวัติเช็กชื่อ: <strong>{candidate.details.totalAttendanceRecords}</strong> ครั้ง
                              </span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                              <span>
                                รายวิชาที่ลง: <strong>{candidate.details.totalCoursesCount}</strong> วิชา
                              </span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                              <span>
                                อุปกรณ์ที่จะผูกรวม: <strong>{1 + secList.length}</strong> เครื่อง
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/20">
                          <button
                            type="button"
                            onClick={() => initiateMergeSingle(candidate)}
                            disabled={isProcessing || processingAllMerge}
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs transition flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50 active:scale-95"
                          >
                            <GitMerge className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                            <span>{isProcessing ? 'กำลังรวมบัญชี...' : 'รวมเข้าบัญชีหลัก'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Custom In-Modal Confirmation Overlay */}
        {confirmDialog.isOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div
              className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-500 flex items-center justify-center shrink-0">
                  <GitMerge className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {confirmDialog.type === 'all'
                      ? 'ยืนยันการรวมบัญชีซ้ำซ้อนทั้งหมด?'
                      : `ยืนยันการรวมบัญชี (${confirmDialog.candidate?.primaryUser.firstNameTh || confirmDialog.candidate?.primaryUser.email})`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {confirmDialog.type === 'all'
                      ? `ระบบจะรวมข้อมูล ${scanReport?.duplicateGroupCount} กลุ่ม (${scanReport?.totalRedundantAccounts} บัญชีย่อย) เข้าสู่โดเมน .ac.th`
                      : `โอนย้ายประวัติทั้งหมดเข้าสู่ ${confirmDialog.candidate?.primaryUser.email}`}
                  </p>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="font-bold text-sky-500 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>ความปลอดภัยในการโอนย้ายข้อมูล:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-300 dark:text-slate-300 text-slate-600">
                  <li>ระบบจะสร้าง Snapshot Auto-Backup ก่อนดำเนินการ</li>
                  <li>ประวัติการเช็กชื่อและรายวิชาทั้งหมดจะถูกโอนเข้าบัญชีหลักครบ 100%</li>
                  <li>อุปกรณ์ที่เคยผูกไว้จะถูกโอนย้ายให้ใช้งานต่อได้ทันที</li>
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog({ isOpen: false, type: 'single' })}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMerge}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 transition cursor-pointer flex items-center space-x-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {confirmDialog.type === 'all' ? 'ยืนยันรวมทั้งหมดทันที' : 'ยืนยันการรวมบัญชี'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between text-xs ${
            isDarkMode ? 'border-slate-800 bg-slate-900/80 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>ระบบทำ Auto Snapshot Backup ให้ทุกครั้งก่อนเริ่มรวมบัญชีอย่างปลอดภัย</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-bold transition border cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
