/**
 * Smart Student Attendance System Types
 */

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
}

export enum CourseMemberRole {
  STUDENT = 'STUDENT',
  CO_TEACHER = 'CO_TEACHER',
  COORDINATOR = 'COORDINATOR', // ผู้รับผิดชอบรายวิชา (Course Coordinator)
  CO_COORDINATOR = 'CO_COORDINATOR', // ผู้ร่วมรับผิดชอบรายวิชา (Co-coordinator)
  INSTRUCTOR = 'INSTRUCTOR', // อาจารย์ผู้สอน (Instructor)
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

export enum LeaveType {
  SICK = 'SICK', // ลาป่วย
  PERSONAL = 'PERSONAL', // ลากิจ
  OTHER = 'OTHER', // อื่นๆ
}

export enum LeaveStatus {
  PENDING = 'PENDING', // รอพิจารณา / รออนุมัติ
  APPROVED = 'APPROVED', // อนุมัติแล้ว
  REJECTED = 'REJECTED', // ไม่อนุมัติ / ปฏิเสธ
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentNameTh: string;
  studentNameEn?: string;
  studentUniversityId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  weekNumber?: number; // สัปดาห์ที่ขอลาเรียน (ถ้ามี)
  leaveType: LeaveType;
  leaveDate: string; // YYYY-MM-DD หรือระบุวันที่ลา
  endDate?: string; // YYYY-MM-DD (กรณีลาหลายวัน/ช่วงวันที่)
  isMultiDay?: boolean; // ธงระบุว่าเป็นการลาหลายวันหรือไม่
  reason: string; // เหตุผลการลา
  attachmentUrl?: string; // เอกสารประกอบ / ใบรับรองแพทย์ / รูปภาพ (Data URL)
  attachmentName?: string;
  status: LeaveStatus;
  teacherComment?: string; // ข้อความ/เหตุผลจากอาจารย์
  createdAt: string;
  updatedAt?: string;
}

export interface UserDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType?: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER';
  browser?: string;
  os?: string;
  boundAt: string;
  lastUsedAt: string;
  isPrimary?: boolean;
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
  authProvider?: 'google' | 'email';
  deviceId?: string; // Legacy primary device fingerprint/UUID
  devices?: UserDevice[]; // List of bound devices
  createdAt: string;
}

export interface TeachingWeek {
  weekNumber: number;
  topic: string;
  date: string; // YYYY-MM-DD
}

export interface Course {
  id: string;
  courseCode: string; // e.g., TEST101
  courseName: string;
  academicYear: number; // e.g., 2569
  semester: Semester;
  coordinatorName: string;
  ownerId: string;
  ownerName?: string;
  defaultLat?: number;
  defaultLng?: number;
  allowedGpsRadius?: number;
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
  activatedAt?: string;
  sessionDurationMinutes?: number; // e.g. 30 minutes
  lateThresholdMinutes?: number; // e.g. 15 minutes
  isStaticQr?: boolean; // false for Dynamic QR (30s rotation), true for Static QR
  qrSecretToken?: string;
  qrExpiresAt?: number;
  createdAt: string;
  isGpsCheckEnabled?: boolean;
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
  checkinMethod?: 'QR_ONLY' | 'GPS_ONLY' | 'HYBRID' | 'TOKEN';
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
  checkinMethod: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID' | 'TOKEN';
  deviceId: string;
  buildingRoom?: string;
  notes?: string;
  distanceMeters?: number;
  qrToken?: string;
}

export interface QuickEvent {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  teacherLat: number;
  teacherLng: number;
  isActive: boolean;
  activatedAt?: string;
  sessionDurationMinutes?: number;
  lateThresholdMinutes?: number;
  isStaticQr?: boolean;
  createdAt: string;
  isGpsCheckEnabled?: boolean;
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
