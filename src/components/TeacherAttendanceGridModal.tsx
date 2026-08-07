import React, { useState, useEffect, useMemo } from 'react';
import { Course, Session } from '../types';
import { overrideAttendanceRecord } from '../services/api';
import {
  X,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  BookOpen,
  Save,
  RotateCcw,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface StudentAttendanceGridItem {
  userId: string;
  studentName: string;
  studentIdNum: string;
  email?: string;
  avatarUrl?: string;
  sessionStatuses: {
    sessionId?: string;
    weekNumber: number;
    topic?: string;
    status: 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' | string;
    statusText?: string;
    shortStatus?: string;
    checkinTime?: string | null;
    checkinTimeBangkok?: string | null;
  }[];
  attendedCount?: number;
  totalSessionsCount?: number;
  attendancePercent?: number;
}

interface TeacherAttendanceGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  studentList: StudentAttendanceGridItem[];
  sessions?: Session[];
  onRefresh?: () => void;
  isDarkMode?: boolean;
}

export const TeacherAttendanceGridModal: React.FC<TeacherAttendanceGridModalProps> = ({
  isOpen,
  onClose,
  course,
  studentList: initialStudentList,
  sessions = [],
  onRefresh,
  isDarkMode: propIsDarkMode,
}) => {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [showStatsOnMobile, setShowStatsOnMobile] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [studentsData, setStudentsData] = useState<StudentAttendanceGridItem[]>([]);
  
  // Pending draft changes map: key = `${studentId}_${weekNumber}`, value = 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'
  const [pendingChanges, setPendingChanges] = useState<Record<string, 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'>>({});

  // Sorting state for grid table
  const [gridSortColumn, setGridSortColumn] = useState<'studentIdNum' | 'studentName' | 'summary' | number>('studentIdNum');
  const [gridSortDirection, setGridSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleGridSort = (col: 'studentIdNum' | 'studentName' | 'summary' | number) => {
    if (gridSortColumn === col) {
      setGridSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setGridSortColumn(col);
      setGridSortDirection(col === 'summary' ? 'desc' : 'asc');
    }
  };
  
  // Original statuses snapshot map to check if change was reverted
  const [originalStatuses, setOriginalStatuses] = useState<Record<string, 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'>>({});

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState<boolean>(false);

  // Sync initial student data on modal open or prop change
  useEffect(() => {
    if (isOpen && initialStudentList && initialStudentList.length > 0) {
      const cloned: StudentAttendanceGridItem[] = JSON.parse(JSON.stringify(initialStudentList));
      setStudentsData(cloned);

      // Snapshot original statuses
      const origMap: Record<string, 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'> = {};
      cloned.forEach((st) => {
        if (st.sessionStatuses) {
          st.sessionStatuses.forEach((ss) => {
            const raw = ss.status;
            let norm: 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' = 'ABSENT';
            if (raw === 'PRESENT') norm = 'PRESENT';
            else if (raw === 'LATE') norm = 'LATE';
            else if (raw === 'LEAVE' || raw === 'APPROVED') norm = 'LEAVE';
            else norm = 'ABSENT';

            origMap[`${st.userId}_${ss.weekNumber}`] = norm;
          });
        }
      });
      setOriginalStatuses(origMap);
      setPendingChanges({});
      setStatusMessage(null);
      setShowUnsavedConfirm(false);
    } else if (!isOpen) {
      setStudentsData([]);
      setPendingChanges({});
      setOriginalStatuses({});
      setStatusMessage(null);
      setShowUnsavedConfirm(false);
    }
  }, [initialStudentList, isOpen]);

  // Determine teaching weeks columns list
  const weekList = useMemo(() => {
    if (course?.weeks && course.weeks.length > 0) {
      return [...course.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
    }
    // Fallback: derive weeks from sessions if course.weeks is empty
    if (sessions && sessions.length > 0) {
      return sessions.map((s) => ({
        weekNumber: s.weekNumber,
        topic: s.topic || `สัปดาห์ที่ ${s.weekNumber}`,
        date: s.createdAt ? s.createdAt.split('T')[0] : '',
      })).sort((a, b) => a.weekNumber - b.weekNumber);
    }
    // Fallback: Default 10 weeks
    return Array.from({ length: 10 }, (_, i) => ({
      weekNumber: i + 1,
      topic: `สัปดาห์ที่ ${i + 1}`,
      date: '',
    }));
  }, [course, sessions]);

  // Map of session IDs by weekNumber
  const sessionByWeekMap = useMemo(() => {
    const map = new Map<number, string>();
    if (sessions && sessions.length > 0) {
      sessions.forEach((s) => {
        if (s.weekNumber && s.id) {
          map.set(Number(s.weekNumber), s.id);
        }
      });
    }
    return map;
  }, [sessions]);

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsData;
    const q = searchQuery.trim().toLowerCase();
    return studentsData.filter(
      (st) =>
        st.studentName.toLowerCase().includes(q) ||
        st.studentIdNum.toLowerCase().includes(q) ||
        (st.email && st.email.toLowerCase().includes(q))
    );
  }, [studentsData, searchQuery]);

  // Count of pending unsaved changes
  const pendingCount = useMemo(() => Object.keys(pendingChanges).length, [pendingChanges]);

  // Helper to get effective status for a student cell (includes draft changes)
  const getEffectiveStatus = (studentId: string, weekNumber: number, originalStatusFromList: string): 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' => {
    const key = `${studentId}_${weekNumber}`;
    if (pendingChanges[key] !== undefined) {
      return pendingChanges[key];
    }
    if (originalStatusFromList === 'PRESENT') return 'PRESENT';
    if (originalStatusFromList === 'LATE') return 'LATE';
    if (originalStatusFromList === 'LEAVE' || originalStatusFromList === 'APPROVED') return 'LEAVE';
    return 'ABSENT';
  };

  // Sorted list based on column header selection
  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    list.sort((a, b) => {
      if (gridSortColumn === 'studentIdNum') {
        const cmp = (a.studentIdNum || '').localeCompare(b.studentIdNum || '');
        return gridSortDirection === 'asc' ? cmp : -cmp;
      }
      if (gridSortColumn === 'studentName') {
        const cmp = (a.studentName || '').localeCompare(b.studentName || '', 'th');
        return gridSortDirection === 'asc' ? cmp : -cmp;
      }
      if (gridSortColumn === 'summary') {
        const weeksCount = weekList.length || 1;
        let aAttended = 0;
        let bAttended = 0;

        const aStatusByWeek = new Map<number, string>();
        a.sessionStatuses?.forEach((ss) => ss.weekNumber && aStatusByWeek.set(Number(ss.weekNumber), ss.status));
        const bStatusByWeek = new Map<number, string>();
        b.sessionStatuses?.forEach((ss) => ss.weekNumber && bStatusByWeek.set(Number(ss.weekNumber), ss.status));

        weekList.forEach((wk) => {
          const aEff = getEffectiveStatus(a.userId, wk.weekNumber, aStatusByWeek.get(wk.weekNumber) || 'ABSENT');
          if (aEff === 'PRESENT' || aEff === 'LATE') aAttended++;
          const bEff = getEffectiveStatus(b.userId, wk.weekNumber, bStatusByWeek.get(wk.weekNumber) || 'ABSENT');
          if (bEff === 'PRESENT' || bEff === 'LATE') bAttended++;
        });

        const aPct = Math.round((aAttended / weeksCount) * 100);
        const bPct = Math.round((bAttended / weeksCount) * 100);

        return gridSortDirection === 'asc' ? aPct - bPct : bPct - aPct;
      }
      if (typeof gridSortColumn === 'number') {
        const weekNum = gridSortColumn;
        const statusWeight: Record<string, number> = { PRESENT: 1, LATE: 2, LEAVE: 3, ABSENT: 4 };

        const aStatus = a.sessionStatuses?.find((ss) => Number(ss.weekNumber) === weekNum)?.status || 'ABSENT';
        const bStatus = b.sessionStatuses?.find((ss) => Number(ss.weekNumber) === weekNum)?.status || 'ABSENT';

        const aEff = getEffectiveStatus(a.userId, weekNum, aStatus);
        const bEff = getEffectiveStatus(b.userId, weekNum, bStatus);

        const aWeight = statusWeight[aEff] || 4;
        const bWeight = statusWeight[bEff] || 4;

        return gridSortDirection === 'asc' ? aWeight - bWeight : bWeight - aWeight;
      }
      return 0;
    });
    return list;
  }, [filteredStudents, gridSortColumn, gridSortDirection, weekList, pendingChanges]);

  // Overall statistics incorporating draft changes
  const stats = useMemo(() => {
    const totalStudents = studentsData.length;
    let totalPercentSum = 0;
    let eligibleCount = 0;

    studentsData.forEach((st) => {
      const weeksCount = weekList.length || 1;
      let attended = 0;

      const statusByWeek = new Map<number, string>();
      if (st.sessionStatuses) {
        st.sessionStatuses.forEach((ss) => {
          if (ss.weekNumber) {
            statusByWeek.set(Number(ss.weekNumber), ss.status);
          }
        });
      }

      weekList.forEach((wk) => {
        const origRaw = statusByWeek.get(wk.weekNumber) || 'ABSENT';
        const eff = getEffectiveStatus(st.userId, wk.weekNumber, origRaw);
        if (eff === 'PRESENT' || eff === 'LATE') {
          attended++;
        }
      });

      const pct = Math.round((attended / weeksCount) * 100);
      totalPercentSum += pct;
      if (pct >= 80) eligibleCount++;
    });

    const avgAttendancePercent = totalStudents > 0 ? Math.round(totalPercentSum / totalStudents) : 0;
    return {
      totalStudents,
      avgAttendancePercent,
      eligibleCount,
      ineligibleCount: totalStudents - eligibleCount,
    };
  }, [studentsData, weekList, pendingChanges]);

  if (!isOpen) return null;

  // Handle local draft selection change (No server call yet)
  const handleDraftStatusChange = (
    studentId: string,
    weekNumber: number,
    newStatus: 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'
  ) => {
    setStatusMessage(null);
    const key = `${studentId}_${weekNumber}`;
    const orig = originalStatuses[key] || 'ABSENT';

    if (orig === 'LEAVE') {
      setStatusMessage({
        text: 'สถานะลาเรียนที่ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขโดยตรงได้จากตารางนี้',
        type: 'error',
      });
      return;
    }

    setPendingChanges((prev) => {
      const next = { ...prev };
      if (newStatus === orig) {
        delete next[key];
      } else {
        next[key] = newStatus;
      }
      return next;
    });
  };

  // Reset all pending changes back to initial
  const handleResetChanges = () => {
    setPendingChanges({});
    setStatusMessage({
      text: 'ล้างการแก้ไขที่ยังไม่ได้บันทึกเรียบร้อยแล้ว',
      type: 'success',
    });
  };

  // Batch Save all pending changes to Backend
  const handleSaveChanges = async () => {
    const pendingKeys = Object.keys(pendingChanges);
    if (pendingKeys.length === 0) return;

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress({ current: 0, total: pendingKeys.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingKeys.length; i++) {
      const key = pendingKeys[i];
      const [studentId, weekStr] = key.split('_');
      const weekNumber = Number(weekStr);
      const targetStatus = pendingChanges[key];
      const targetSessionId = sessionByWeekMap.get(weekNumber);

      try {
        await overrideAttendanceRecord({
          studentId,
          sessionId: targetSessionId,
          courseId: course.id,
          weekNumber,
          status: targetStatus,
          checkinMethod: 'HYBRID',
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to override status for student ${studentId} week ${weekNumber}:`, err);
        failCount++;
      }

      setSaveProgress({ current: i + 1, total: pendingKeys.length });
    }

    // Apply saved pending changes to studentsData and originalStatuses
    setStudentsData((prev) =>
      prev.map((st) => {
        let updatedStatuses = [...(st.sessionStatuses || [])];

        weekList.forEach((wk) => {
          const key = `${st.userId}_${wk.weekNumber}`;
          if (pendingChanges[key] !== undefined) {
            const newStatus = pendingChanges[key];
            const targetSessionId = sessionByWeekMap.get(wk.weekNumber);
            const existingIdx = updatedStatuses.findIndex((s) => Number(s.weekNumber) === Number(wk.weekNumber));

            const newObj = {
              sessionId: targetSessionId,
              weekNumber: wk.weekNumber,
              status: newStatus,
              statusText:
                newStatus === 'PRESENT'
                  ? 'มาเรียน (บันทึกโดยอาจารย์)'
                  : newStatus === 'LATE'
                  ? 'มาสาย (บันทึกโดยอาจารย์)'
                  : newStatus === 'LEAVE'
                  ? 'ลาเรียน (บันทึกโดยอาจารย์)'
                  : 'ขาดเรียน (บันทึกโดยอาจารย์)',
              shortStatus:
                newStatus === 'PRESENT'
                  ? 'มาเรียน'
                  : newStatus === 'LATE'
                  ? 'มาสาย'
                  : newStatus === 'LEAVE'
                  ? 'ลาเรียน'
                  : 'ขาดเรียน',
              checkinTime: new Date().toISOString(),
              checkinTimeBangkok: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            };

            if (existingIdx >= 0) {
              updatedStatuses[existingIdx] = { ...updatedStatuses[existingIdx], ...newObj };
            } else {
              updatedStatuses.push(newObj);
            }
          }
        });

        const totalWeeks = weekList.length || 1;
        const attendedCount = updatedStatuses.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
        const attendancePercent = Math.round((attendedCount / totalWeeks) * 100);

        return {
          ...st,
          sessionStatuses: updatedStatuses,
          attendedCount,
          totalSessionsCount: totalWeeks,
          attendancePercent,
        };
      })
    );

    // Update originalStatuses snapshot
    setOriginalStatuses((prev) => {
      const next = { ...prev };
      Object.keys(pendingChanges).forEach((key) => {
        next[key] = pendingChanges[key];
      });
      return next;
    });

    setPendingChanges({});
    setIsSaving(false);
    setSaveProgress(null);

    if (failCount === 0) {
      setStatusMessage({
        text: `บันทึกข้อมูลการเช็คชื่อสำเร็จจำนวน ${successCount} รายการเรียบร้อยแล้ว`,
        type: 'success',
      });
    } else {
      setStatusMessage({
        text: `บันทึกสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`,
        type: 'error',
      });
    }

    if (onRefresh) {
      onRefresh();
    }
  };

  // Close modal with unsaved protection check
  const handleClose = () => {
    if (pendingCount > 0) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  // Export current grid attendance matrix as CSV file
  const handleExportCSV = () => {
    if (!course) return;

    let csv = `ตารางสรุปการเข้าเรียนรายวิชา,${course.courseCode} - ${course.courseName}\n`;
    csv += `ผู้สอน/อาจารย์ผู้รับผิดชอบ,${course.coordinatorName || course.ownerName || '-'}\n`;
    csv += `จำนวนนักศึกษาทั้งหมด,${studentsData.length} คน,จำนวนสัปดาห์เรียนทั้งหมด,${weekList.length} สัปดาห์\n\n`;

    // Header row
    const sessionHeaders = weekList.map((wk) => {
      const topicStr = wk.topic ? ` (${wk.topic.replace(/,/g, ' ')})` : '';
      return `"สัปดาห์ที่ ${wk.weekNumber}${topicStr}"`;
    });

    const headers = [
      'ลำดับ',
      'รหัสนักศึกษา',
      'ชื่อ-นามสกุล',
      'อีเมล',
      ...sessionHeaders,
      'จำนวนคาบที่เข้าเรียน',
      'จำนวนคาบที่ลา',
      'คาบทั้งหมด',
      'อัตราการเข้าเรียน (%)',
      'สถานะสิทธิ์สอบ',
    ];

    csv += headers.join(',') + '\n';

    // Data rows
    sortedStudents.forEach((st, idx) => {
      const stStatusByWeek = new Map<number, { status: string; statusText?: string; checkinTime?: string | null; checkinTimeBangkok?: string | null }>();
      st.sessionStatuses?.forEach((ss) => {
        if (ss.weekNumber) {
          stStatusByWeek.set(Number(ss.weekNumber), ss);
        }
      });

      let attendedCount = 0;
      let leaveCount = 0;

      const weekCols = weekList.map((wk) => {
        const origSS = stStatusByWeek.get(wk.weekNumber);
        const effStatus = getEffectiveStatus(st.userId, wk.weekNumber, origSS?.status || 'ABSENT');

        if (effStatus === 'PRESENT') {
          attendedCount++;
          const timeStr = origSS?.checkinTimeBangkok || origSS?.checkinTime ? ` (${origSS.checkinTimeBangkok || origSS.checkinTime})` : '';
          return `"มาเรียน${timeStr}"`;
        } else if (effStatus === 'LATE') {
          attendedCount++;
          const timeStr = origSS?.checkinTimeBangkok || origSS?.checkinTime ? ` (${origSS.checkinTimeBangkok || origSS.checkinTime})` : '';
          return `"มาสาย${timeStr}"`;
        } else if (effStatus === 'LEAVE') {
          leaveCount++;
          return `"ลาเรียน"`;
        } else {
          return `"ขาดเรียน"`;
        }
      });

      const totalWeeks = weekList.length || 1;
      const pct = Math.round((attendedCount / totalWeeks) * 100);
      const examEligibility = pct >= 80 ? 'มีสิทธิ์สอบ (80%+)' : 'เสี่ยงหมดสิทธิ์สอบ (ต่ำกว่า 80%)';

      const row = [
        idx + 1,
        `"${st.studentIdNum || '-'}"`,
        `"${st.studentName || '-'}"`,
        `"${st.email || '-'}"`,
        ...weekCols,
        attendedCount,
        leaveCount,
        totalWeeks,
        `"${pct}%"`,
        `"${examEligibility}"`,
      ];

      csv += row.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Grid_${course.courseCode}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full transition-all duration-300 rounded-xl sm:rounded-2xl border flex flex-col shadow-2xl overflow-hidden ${
          isMaximized ? 'h-[98vh] max-w-[98vw]' : 'h-[96dvh] md:h-[92vh] max-w-7xl max-h-[100dvh]'
        } ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
      >
        {/* Modal Header */}
        <div
          className={`p-3 sm:p-5 border-b flex items-start justify-between gap-2.5 shrink-0 ${
            isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="px-2.5 py-0.5 rounded-lg font-mono text-xs font-black bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                {course.courseCode}
              </span>
              <h2 className={`text-sm sm:text-lg font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {course.courseName}
              </h2>
              <span className="text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                ปีการศึกษา {course.academicYear} / ภาคเรียน {course.semester}
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs flex items-center space-x-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
              <span className="truncate sm:whitespace-normal">ตารางเช็คชื่อและจัดการสถานะการเข้าเรียน</span>
            </p>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition border shadow-xs ${
                isDarkMode 
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300/80'
              }`}
              title="ส่งออกรายงานการเข้าเรียนเป็นไฟล์ CSV"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden text-[11px]">Export</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-1.5 sm:p-2 rounded-xl border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={isMaximized ? 'ย่อหน้าต่าง' : 'ขยายเต็มจอ'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pending Unsaved Changes Action Banner */}
        {pendingCount > 0 && (
          <div className="px-3 py-2 sm:px-4 sm:py-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center space-x-2 text-xs font-extrabold">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
              <span>
                มีการเปลี่ยนสถานะที่ยังไม่ได้บันทึกรวม <strong className="text-amber-600 dark:text-amber-200 text-sm">{pendingCount}</strong> รายการ
              </span>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={handleResetChanges}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl border border-amber-500/40 hover:bg-amber-500/20 text-xs font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition shadow-md shadow-sky-600/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึก ({saveProgress?.current}/{saveProgress?.total})...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>บันทึก ({pendingCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Status Message Notification Bar */}
        {statusMessage && (
          <div
            className={`px-3 py-2 text-xs font-bold flex items-center justify-between shrink-0 border-b animate-in slide-in-from-top-2 duration-150 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Control Bar: Search & Status Legend & Quick Summary Stats */}
        <div
          className={`p-3 sm:p-4 border-b space-y-2.5 sm:space-y-3 shrink-0 max-h-[40vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา..."
                className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                  isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile / Tablet Toggle Button for Stats & Legend */}
            <button
              type="button"
              onClick={() => setShowStatsOnMobile((prev) => !prev)}
              className="md:hidden w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <BarChart3 className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="truncate">
                  สถิติ & สัญลักษณ์ ({stats.totalStudents} คน | เข้าเรียนเฉลี่ย {stats.avgAttendancePercent}%)
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-[10px] text-slate-400 font-normal">{showStatsOnMobile ? 'ซ่อน' : 'แสดง'}</span>
                {showStatsOnMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Status Color Legend (Always visible on Desktop, Collapsible on Mobile) */}
            <div className={`items-center space-x-2 text-[11px] font-extrabold flex-wrap gap-y-1 ${showStatsOnMobile ? 'flex' : 'hidden md:flex'}`}>
              <span className="text-slate-500 dark:text-slate-400 mr-1">สัญลักษณ์:</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                <span>🟢</span>
                <span>มาเรียน (Present)</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                <span>🟡</span>
                <span>มาสาย (Late)</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center space-x-1">
                <span>🔵</span>
                <span>ลาเรียน (Leave)</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                <span>🔴</span>
                <span>ขาดเรียน (Absent)</span>
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>รอการบันทึก</span>
              </span>
            </div>
          </div>

          {/* Quick Stats Grid (Always visible on Desktop, Collapsible on Mobile) */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs ${showStatsOnMobile ? 'grid' : 'hidden md:grid'}`}>
            <div className={`p-2.5 rounded-xl border flex items-center space-x-3 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <Users className="w-5 h-5 text-sky-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">นักศึกษาทั้งหมด</div>
                <div className="font-extrabold text-sm">{stats.totalStudents} คน</div>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center space-x-3 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">เข้าเรียนเฉลี่ยรวม</div>
                <div className="font-extrabold text-sm text-emerald-500">{stats.avgAttendancePercent}%</div>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center space-x-3 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <BookOpen className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">มีสิทธิ์สอบ (80%+)</div>
                <div className="font-extrabold text-sm text-sky-500">{stats.eligibleCount} คน</div>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center space-x-3 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">เสี่ยงหมดสิทธิ์สอบ (&lt;80%)</div>
                <div className="font-extrabold text-sm text-rose-500">{stats.ineligibleCount} คน</div>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Table Body */}
        <div className="flex-1 overflow-auto p-1.5 sm:p-5 min-h-[220px] sm:min-h-[300px]">
          {filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-500 opacity-50" />
              <p className="font-bold">ไม่พบข้อมูลนักศึกษาตรงตามเงื่อนไข</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl sm:rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs touch-pan-x">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-extrabold uppercase sticky top-0 z-20 ${
                      isDarkMode ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <th className="p-2 sm:p-3 text-center border-r border-slate-200 dark:border-slate-800 w-10 sm:w-12 shrink-0 hidden sm:table-cell">
                      ลำดับที่
                    </th>
                    <th
                      onClick={() => handleGridSort('studentIdNum')}
                      className="p-2 sm:p-3 border-r border-slate-200 dark:border-slate-800 min-w-[130px] hidden md:table-cell cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                      title="กดเพื่อจัดเรียงตามรหัสนักศึกษา"
                    >
                      <div className="flex items-center space-x-1">
                        <span>รหัสประจำตัวนักศึกษา</span>
                        {gridSortColumn === 'studentIdNum' ? (
                          gridSortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleGridSort('studentName')}
                      className="p-2 sm:p-3 border-r border-slate-200 dark:border-slate-800 min-w-[125px] sm:min-w-[200px] max-w-[150px] sm:max-w-none sticky left-0 z-30 shadow-xs backdrop-blur-md bg-slate-100 dark:bg-slate-950 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-900 select-none transition"
                      title="กดเพื่อจัดเรียงตามชื่อ-นามสกุล"
                    >
                      <div className="flex items-center space-x-1">
                        <span>ชื่อ-นามสกุล</span>
                        {gridSortColumn === 'studentName' ? (
                          gridSortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Dynamic Teaching Weeks Columns */}
                    {weekList.map((wk) => (
                      <th
                        key={wk.weekNumber}
                        onClick={() => handleGridSort(wk.weekNumber)}
                        className="p-2 sm:p-2.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[110px] sm:min-w-[145px] cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-900 select-none transition"
                        title={`${wk.topic || ''} (กดเพื่อจัดเรียงตามสถานะประจำสัปดาห์)`}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-[11px] sm:text-xs">
                            สัปดาห์ที่ {wk.weekNumber}
                          </span>
                          {gridSortColumn === wk.weekNumber ? (
                            gridSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                          )}
                        </div>
                        <div className="text-[9px] font-medium text-slate-400 line-clamp-1 max-w-[100px] sm:max-w-[130px] mx-auto">
                          {wk.topic || `การสอนครั้งที่ ${wk.weekNumber}`}
                        </div>
                      </th>
                    ))}

                    <th
                      onClick={() => handleGridSort('summary')}
                      className="p-2 sm:p-3 text-center min-w-[110px] sm:min-w-[140px] bg-slate-200/60 dark:bg-slate-900/80 cursor-pointer hover:bg-slate-300/60 dark:hover:bg-slate-800 select-none transition"
                      title="กดเพื่อจัดเรียงตามเปอร์เซ็นต์เข้าเรียน"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>สรุปเข้าเรียน (%)</span>
                        {gridSortColumn === 'summary' ? (
                          gridSortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sortedStudents.map((student, idx) => {
                    const studentStatuses = student.sessionStatuses || [];
                    const statusByWeek = new Map<number, string>();
                    studentStatuses.forEach((ss) => {
                      if (ss.weekNumber) {
                        statusByWeek.set(Number(ss.weekNumber), ss.status);
                      }
                    });

                    // Calculate total attended count incorporating draft changes
                    const totalWeeksCount = weekList.length || 1;
                    let attendedWeeksCount = 0;
                    weekList.forEach((wk) => {
                      const origRaw = statusByWeek.get(wk.weekNumber) || 'ABSENT';
                      const eff = getEffectiveStatus(student.userId, wk.weekNumber, origRaw);
                      if (eff === 'PRESENT' || eff === 'LATE') {
                        attendedWeeksCount++;
                      }
                    });
                    const pct = Math.round((attendedWeeksCount / totalWeeksCount) * 100);
                    const isEligible = pct >= 80;

                    return (
                      <tr
                        key={student.userId || idx}
                        className={`transition hover:bg-sky-500/5 ${
                          isDarkMode ? 'odd:bg-slate-900/40 even:bg-slate-900/90' : 'odd:bg-white even:bg-slate-50/60'
                        }`}
                      >
                        {/* 1. ลำดับที่ */}
                        <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800 hidden sm:table-cell">
                          {idx + 1}
                        </td>

                        {/* 2. รหัสประจำตัวนักศึกษา */}
                        <td className="p-2 sm:p-3 font-mono font-bold text-sky-600 dark:text-sky-400 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap hidden md:table-cell">
                          {student.studentIdNum || '-'}
                        </td>

                        {/* 3. ชื่อ-นามสกุล (Sticky Left) */}
                        <td className="p-2 sm:p-3 font-bold border-r border-slate-200 dark:border-slate-800 whitespace-nowrap sticky left-0 z-10 backdrop-blur-sm bg-white dark:bg-slate-900 min-w-[125px] sm:min-w-[200px] max-w-[150px] sm:max-w-none shadow-md">
                          <div className="flex items-center space-x-1.5 sm:space-x-2">
                            {student.avatarUrl ? (
                              <img src={student.avatarUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-500/10 text-sky-500 font-bold flex items-center justify-center text-[10px] shrink-0">
                                {student.studentName.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className={`text-xs truncate font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                {student.studentName}
                              </div>
                              <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 md:hidden font-extrabold truncate">
                                {student.studentIdNum || '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Column สัปดาห์เรียนแต่ละครั้ง */}
                        {weekList.map((wk) => {
                          const origRaw = statusByWeek.get(wk.weekNumber) || 'ABSENT';
                          const effectiveStatus = getEffectiveStatus(student.userId, wk.weekNumber, origRaw);
                          const cellKey = `${student.userId}_${wk.weekNumber}`;
                          const isPending = pendingChanges[cellKey] !== undefined;

                          return (
                            <td
                              key={wk.weekNumber}
                              className={`p-1.5 sm:p-2 text-center border-r border-slate-200 dark:border-slate-800 align-middle ${
                                isPending ? 'bg-amber-500/10 dark:bg-amber-500/15' : ''
                              }`}
                            >
                              <div className="relative inline-block w-full min-w-[100px] sm:min-w-[125px]">
                                {isPending && (
                                  <span className="absolute -top-1 -right-1 z-10 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" title="แก้ไขแล้ว (รอการกดบันทึก)" />
                                )}
                                {originalStatuses[cellKey] === 'LEAVE' ? (
                                  <div
                                    className="w-full text-[11px] font-black px-1.5 sm:px-2 py-1.5 rounded-xl border bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/40 flex items-center justify-center space-x-1 cursor-not-allowed select-none shadow-xs"
                                    title="สถานะลาเรียนที่ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้โดยตรงจากตาราง (ต้องผ่านระบบจัดการใบลา)"
                                  >
                                    <Lock className="w-3 h-3 text-sky-500 shrink-0" />
                                    <span className="truncate">🔵 ลาเรียน</span>
                                  </div>
                                ) : (
                                  <select
                                    value={effectiveStatus}
                                    onChange={(e) =>
                                      handleDraftStatusChange(
                                        student.userId,
                                        wk.weekNumber,
                                        e.target.value as 'PRESENT' | 'LATE' | 'ABSENT'
                                      )
                                    }
                                    className={`w-full text-[11px] font-extrabold px-1.5 sm:px-2 py-1.5 rounded-xl border transition cursor-pointer text-center focus:outline-none focus:ring-2 ${
                                      isPending ? 'border-amber-500 ring-1 ring-amber-500/40 font-black' : ''
                                    } ${
                                      effectiveStatus === 'PRESENT'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                                        : effectiveStatus === 'LATE'
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25'
                                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/25'
                                    }`}
                                  >
                                    <option value="PRESENT" className={isDarkMode ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-700'}>
                                      🟢 มาเรียน
                                    </option>
                                    <option value="LATE" className={isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-white text-amber-700'}>
                                      🟡 มาสาย
                                    </option>
                                    <option value="ABSENT" className={isDarkMode ? 'bg-slate-900 text-rose-400' : 'bg-white text-rose-700'}>
                                      🔴 ขาดเรียน
                                    </option>
                                  </select>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Summary Column */}
                        <td className="p-2 sm:p-3 text-center bg-slate-100/50 dark:bg-slate-900/60 font-mono">
                          <div className="font-extrabold text-xs">
                            <span className={isEligible ? 'text-emerald-500' : 'text-rose-500'}>{pct}%</span>
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({attendedWeeksCount}/{totalWeeksCount})
                            </span>
                          </div>
                          <div className="mt-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block ${
                                isEligible
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {isEligible ? 'สิทธิ์สอบ' : 'หมดสิทธิ์สอบ'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${
            isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
            <span>
              {pendingCount > 0
                ? `* มีการปรับเปลี่ยน ${pendingCount} รายการ — กรุณากดปุ่ม "บันทึกการเปลี่ยนแปลง" เพื่อลงบันทึกในระบบส่วนกลาง`
                : '* เลือกเปลี่ยนสถานะในตาราง แล้วกดปุ่ม "บันทึกการเปลี่ยนแปลง" เพื่อยืนยันลงระบบ'}
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleResetChanges}
              disabled={isSaving || pendingCount === 0}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ยกเลิกการแก้ไข</span>
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving || pendingCount === 0}
              className={`px-4 sm:px-5 py-2 rounded-xl text-white font-extrabold text-xs transition shadow-md active:scale-95 flex items-center space-x-1.5 ${
                pendingCount > 0
                  ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30 cursor-pointer'
                  : 'bg-sky-600/50 opacity-50 cursor-not-allowed shadow-none'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก ({saveProgress?.current}/{saveProgress?.total})...</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกการเปลี่ยนแปลง ({pendingCount})</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกการเปลี่ยนแปลง</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Closing with Unsaved Changes */}
        {showUnsavedConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className={`p-6 rounded-2xl border max-w-md w-full space-y-4 shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center space-x-3 text-amber-500">
                <AlertTriangle className="w-7 h-7 shrink-0" />
                <h3 className="text-base font-extrabold">มีการเปลี่ยนสถานะที่ยังไม่ได้บันทึก!</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                คุณมีการเปลี่ยนสถานะการเข้าเรียนที่ยังไม่ได้บันทึกลงระบบจำนวน <strong className="text-amber-500">{pendingCount}</strong> รายการ หากปิดหน้าต่างตอนนี้ ข้อมูลที่คุณแก้ไขไว้จะไม่ถูกบันทึก
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-bold transition cursor-pointer"
                >
                  ละทิ้งการแก้ไข & ปิด
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsavedConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  กลับไปบันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
