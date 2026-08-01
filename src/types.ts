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
  LEAVE = 'LEAVE',
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
  department?: string; // Major/Department code or name
  isSuspended?: boolean; // Account suspended flag
  suspendedReason?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TeachingWeek {
  weekNumber: number;
  topic: string;
  date: string; // YYYY-MM-DD
}

export interface Course {
  id: string;
  courseCode: string; // e.g., MTID204, MTCM303, MTID626
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
  curriculums?: string[]; // Multiple curriculum names/codes (e.g. ["วิทยาศาสตร์มหาบัณฑิต (เทคนิคการแพทย์)", "ปรัชญาดุษฎีบัณฑิต (เทคนิคการแพทย์)"])
  facultyCode?: string; // 'MT'
  departmentCode?: string; // 'ID', 'CM', 'CH', 'MI', 'MS', 'RT'
  majorCode?: string; // 'MTMT' or 'MTRT'
  degreeLevel?: string; // 'ปริญญาตรี' or 'บัณฑิตศึกษา'
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
  qrRefreshIntervalSeconds?: number; // Custom QR refresh interval in seconds (e.g. 10, 15, 30, 60, 120)
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
  isLate?: boolean;
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
  qrRefreshIntervalSeconds?: number;
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

export interface SystemSettings {
  id: string; // 'global_config'
  academicYear?: number; // e.g. 2569
  academicSemester?: Semester; // '1', '2', 'SUMMER'
  defaultGpsRadiusMeters?: number; // e.g. 100
  dynamicQrIntervalSeconds?: number; // e.g. 30

  // Maintenance & Announcement
  maintenanceMode?: boolean; // Maintenance toggle
  systemMaintenanceMode?: boolean; // Maintenance toggle alias
  maintenanceMessage?: string;
  announcementMessage?: string; // Banner broadcast message
  systemAnnouncement?: string; // Banner broadcast message alias

  // Security & Devices
  allowGoogleAutoRegister?: boolean;
  maxDevicesPerUser?: number; // e.g. 1
  singleDeviceLockEnabled?: boolean;
  gpsCheckinRequired?: boolean;
  gpsRadiusMeters?: number;
  dynamicQrRotationSeconds?: number;

  // Domain & Registration Rules
  allowTeacherSelfRegister?: boolean;
  allowStudentSelfRegister?: boolean;
  allowOtherDomainsSelfRegister?: boolean;
  allowOtherDomains?: boolean; // alias
  teacherDomains?: string[]; // e.g. ['mahidol.ac.th', 'mahidol.edu']
  studentDomains?: string[]; // e.g. ['student.mahidol.ac.th', 'student.mahidol.edu']
  teacherDomain?: string; // e.g. 'mahidol.ac.th'
  studentDomain?: string; // e.g. 'student.mahidol.ac.th'

  updatedAt?: string;
  updatedBy?: string;
}

export interface MasterUniversity {
  id: string;
  code: string; // e.g. 'MU'
  nameTh: string; // 'มหาวิทยาลัยมหิดล'
  nameEn: string; // 'Mahidol University'
}

export interface MasterFaculty {
  id: string;
  universityId: string; // 'MU'
  code: string; // 'MT'
  nameTh: string; // 'คณะเทคนิคการแพทย์'
  nameEn: string; // 'Faculty of Medical Technology'
}

export interface MasterMajor {
  id: string;
  facultyCode: string; // 'MT'
  code: string; // 'MTMT', 'MTRT'
  nameTh: string; // 'สาขาวิชาเทคนิคการแพทย์', 'สาขาวิชารังสีเทคนิค'
  nameEn: string; // 'Medical Technology', 'Radiological Technology'
}

export interface MasterDepartment {
  id: string;
  code: string; // e.g., 'CH', 'MI', 'MS', 'CM', 'RT', 'ID'
  nameTh: string; // e.g. 'ภาควิชาเคมีคลินิก'
  nameEn: string; // e.g. 'Department of Clinical Chemistry'
  facultyTh?: string; // 'คณะเทคนิคการแพทย์'
  facultyCode?: string; // 'MT'
  majorCode?: string; // 'MTMT', 'MTRT', or 'ALL'
  majorNameTh?: string; // 'สาขาวิชาเทคนิคการแพทย์' / 'สาขาวิชารังสีเทคนิค'
  createdAt?: string;
}

export interface MasterDegreeLevel {
  id: string;
  code: string; // 'BACHELOR', 'GRADUATE'
  nameTh: string; // 'ปริญญาตรี', 'บัณฑิตศึกษา'
  nameEn: string; // 'Undergraduate', 'Graduate'
}

export interface MasterCurriculum {
  id: string;
  code: string; // e.g. 'CURR_BS_MT', 'CURR_MS_MT', 'CURR_PHD_MT'
  nameTh: string; // e.g. 'วิทยาศาสตร์บัณฑิต (เทคนิคการแพทย์)', 'วิทยาศาสตร์มหาบัณฑิต (เทคนิคการแพทย์)', 'ปรัชญาดุษฎีบัณฑิต (เทคนิคการแพทย์)'
  titleTh?: string;
  nameEn: string;
  facultyCode: string; // 'MT'
  majorCode: string; // 'MTMT' or 'MTRT'
  degreeLevel: string; // 'ปริญญาตรี' or 'บัณฑิตศึกษา'
  createdAt?: string;
}

export interface MasterPrefix {
  id: string;
  titleTh: string; // e.g., 'นาย', 'นางสาว', 'อ.ดร.'
  titleEn: string; // e.g., 'Mr.', 'Miss', 'Dr.'
  category: 'STUDENT' | 'TEACHER' | 'BOTH';
}
