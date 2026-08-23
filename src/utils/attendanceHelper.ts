import { Course, Session, AttendanceRecord, LeaveRequest, AttendanceStatus, LeaveStatus, User } from '../types';

export interface StudentAttendanceStats {
  totalSessions: number;
  conductedSessions: number;
  attendedSessions: number;
  approvedLeaveSessions: number;
  lateSessions: number;
  absentSessions: number;
  percentage: number;
  statusColor: 'GREEN' | 'YELLOW' | 'RED';
  statusText: string;
  maxAllowedAbsences: number;
  remainingAbsenceQuota: number;
  examEligibilityStatus: 'ELIGIBLE' | 'WARNING' | 'INELIGIBLE';
}

/**
 * Checks if a session has been conducted (active, past date, or has records)
 */
export function isSessionConducted(session: Session, course?: Course, allAttendance?: AttendanceRecord[]): boolean {
  if (!session) return false;
  if (session.isActive) return true;
  if (session.activatedAt) return true;

  if (allAttendance && allAttendance.length > 0) {
    const hasAttendance = allAttendance.some(
      (r) => r.sessionId === session.id || (r.courseId === session.courseId && Number(r.weekNumber) === Number(session.weekNumber))
    );
    if (hasAttendance) return true;
  }

  const matchedWeek = course?.weeks?.find((w) => Number(w.weekNumber) === Number(session.weekNumber));
  const weekDate = matchedWeek?.date;
  if (weekDate && /^\d{4}-\d{2}-\d{2}$/.test(weekDate)) {
    const todayBkk = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    if (weekDate <= todayBkk) {
      return true;
    }
  }

  return false;
}

/**
 * Finds a student's attendance record for a specific session
 */
export function findStudentAttendanceRecord(
  studentId: string,
  courseId: string,
  session: Session,
  records: AttendanceRecord[],
  studentUniversityId?: string
): AttendanceRecord | undefined {
  return records.find((r) => {
    const isStudentMatch =
      r.studentId === studentId ||
      (studentUniversityId && (
        r.studentUniversityId === studentUniversityId ||
        r.studentId === studentUniversityId ||
        r.studentId === `usr_std_${studentUniversityId}`
      ));
    if (!isStudentMatch) return false;

    if (session.id && r.sessionId === session.id) return true;
    if (r.courseId && r.courseId === courseId && Number(r.weekNumber) === Number(session.weekNumber)) return true;

    return false;
  });
}

/**
 * Finds if a student has an approved leave request for a specific session
 */
export function getApprovedLeaveForSession(
  studentId: string,
  courseId: string,
  session: Session,
  leaves: LeaveRequest[],
  studentUniversityId?: string
): LeaveRequest | undefined {
  return leaves.find((lr) => {
    const isStudentMatch =
      lr.studentId === studentId ||
      (studentUniversityId && (
        lr.studentUniversityId === studentUniversityId ||
        lr.studentId === studentUniversityId ||
        lr.studentId === `usr_std_${studentUniversityId}`
      ));
    if (!isStudentMatch || lr.courseId !== courseId || (lr.status !== LeaveStatus.APPROVED && (lr.status as string) !== 'APPROVED')) {
      return false;
    }
    if (lr.weekNumber && session.weekNumber && Number(lr.weekNumber) === Number(session.weekNumber)) {
      return true;
    }
    const sDate = session.createdAt ? session.createdAt.split('T')[0] : '';
    if (sDate && lr.leaveDate) {
      if (lr.leaveDate === sDate) return true;
      if (lr.isMultiDay && lr.endDate && sDate >= lr.leaveDate && sDate <= lr.endDate) return true;
    }
    return false;
  });
}

/**
 * Calculates standard attendance stats for a student in a course
 */
export function calculateAttendanceStats(params: {
  course: Course;
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  studentId: string;
  studentUniversityId?: string;
}): StudentAttendanceStats {
  const { course, sessions, attendanceRecords, leaveRequests, studentId, studentUniversityId } = params;

  const sortedSessions = [...sessions].sort(
    (a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0)
  );
  const totalSessions = sortedSessions.length || 1;
  const conductedSessionsList = sortedSessions.filter((s) => isSessionConducted(s, course, attendanceRecords));
  const conductedSessions = conductedSessionsList.length;

  let attendedCount = 0;
  let approvedLeaveCount = 0;
  let lateCount = 0;

  conductedSessionsList.forEach((s) => {
    const approvedLeave = getApprovedLeaveForSession(studentId, course.id, s, leaveRequests, studentUniversityId);
    if (approvedLeave) {
      approvedLeaveCount++;
    } else {
      const rec = findStudentAttendanceRecord(studentId, course.id, s, attendanceRecords, studentUniversityId);
      if (rec) {
        attendedCount++;
        if (rec.status === AttendanceStatus.LATE || Boolean((rec as any).isLate)) {
          lateCount++;
        }
      }
    }
  });

  const absentSessions = Math.max(0, conductedSessions - attendedCount - approvedLeaveCount);
  const maxAllowedAbsences = Math.floor(totalSessions * 0.20);
  const remainingAbsenceQuota = Math.max(0, maxAllowedAbsences - absentSessions);
  const isExceededAbsenceQuota = absentSessions > maxAllowedAbsences;

  const percentage = conductedSessions === 0 ? 100 : Math.round((attendedCount / conductedSessions) * 100);

  let statusColor: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let statusText = 'มีสิทธิ์สอบปกติ';

  if (isExceededAbsenceQuota || (conductedSessions > 0 && percentage < 80)) {
    statusColor = 'RED';
    statusText = 'เสี่ยงหมดสิทธิ์สอบ';
  } else if ((remainingAbsenceQuota <= 1 && conductedSessions >= 3) || (conductedSessions > 0 && percentage <= 84)) {
    statusColor = 'YELLOW';
    statusText = 'เฝ้าระวัง';
  }

  return {
    totalSessions,
    conductedSessions,
    attendedSessions: attendedCount,
    approvedLeaveSessions: approvedLeaveCount,
    lateSessions: lateCount,
    absentSessions,
    percentage,
    statusColor,
    statusText,
    maxAllowedAbsences,
    remainingAbsenceQuota,
    examEligibilityStatus: statusColor === 'RED' ? 'INELIGIBLE' : statusColor === 'YELLOW' ? 'WARNING' : 'ELIGIBLE',
  };
}
