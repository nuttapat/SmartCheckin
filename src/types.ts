/**
 * Smart Student Attendance System Types
 */

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export enum CourseMemberRole {
  STUDENT = 'STUDENT',
  CO_TEACHER = 'CO_TEACHER',
}

export enum Semester {
  FIRST = '1',
  SECOND = '2',
  SUMMER = 'SUMMER',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
}

export interface User {
  id: string;
  role: UserRole;
  title: string; // "นาย", "นางสาว", "นาง", "อ.ดร.", "ผศ.ดร.", "รศ.ดร.", "ศ.ดร.", or custom
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  universityId: string; // Student ID or Staff ID
  email: string;
  password?: string;
  avatarUrl?: string;
  deviceId?: string; // Device fingerprint/UUID for anti-proxy
  createdAt: string;
}

export interface TeachingWeek {
  weekNumber: number;
  topic: string;
  date: string; // YYYY-MM-DD
}

export interface Course {
  id: string;
  courseCode: string; // e.g., MTID204
  courseName: string;
  academicYear: number; // e.g., 2569
  semester: Semester;
  coordinatorName: string;
  ownerId: string;
  ownerName?: string;
  weeks: TeachingWeek[];
  createdAt: string;
}

export interface CourseMember {
  id: string;
  courseId: string;
  userId: string;
  role: CourseMemberRole;
  joinedAt: string;
  user?: User;
}

export interface Session {
  id: string;
  courseId: string;
  weekNumber: number;
  topic: string;
  teacherLat: number;
  teacherLng: number;
  isActive: boolean;
  qrSecretToken?: string;
  qrExpiresAt?: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId?: string; // Optional if quick check-in event
  eventId?: string; // For Quick Check-in event
  studentId: string;
  studentNameTh: string;
  studentNameEn: string;
  studentUniversityId: string;
  timestamp: string;
  status: AttendanceStatus;
  scannedLat: number;
  scannedLng: number;
  distanceMeters: number;
  deviceId: string;
  checkinMethod?: 'QR_ONLY' | 'GPS_ONLY' | 'HYBRID';
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  sessionId?: string;
  sessionTopic?: string;
  timestamp: string;
  lat: number;
  lng: number;
  checkinMethod: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID';
  deviceId: string;
  buildingRoom?: string;
  notes?: string;
}

export interface QuickEvent {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  teacherLat: number;
  teacherLng: number;
  isActive: boolean;
  createdAt: string;
}

export interface InviteLink {
  id: string;
  courseId: string;
  role: CourseMemberRole;
  code: string;
  expiresAt: string;
}

export interface GeofenceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AttendanceStats {
  totalSessions: number;
  attendedSessions: number;
  lateSessions: number;
  absentSessions: number;
  percentage: number;
  statusColor: 'GREEN' | 'YELLOW' | 'RED';
}

export interface QRTokenPayload {
  sessionId?: string;
  eventId?: string;
  token: string;
  expiresAt: number;
  lat: number;
  lng: number;
}
