import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  User,
  UserRole,
  Course,
  CourseMember,
  CourseMemberRole,
  Session,
  AttendanceRecord,
  TeacherAttendanceRecord,
  QuickEvent,
  InviteLink,
  Semester,
  AttendanceStatus,
  LeaveType,
  LeaveStatus,
  LeaveRequest,
} from './src/types.js';
import { saveToFirestore, getAllFromFirestore, deleteFromFirestore, COLLECTIONS } from './src/lib/firebaseStore.js';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- IN-MEMORY DATABASE & SEED DATA ---
const users: Map<string, User> = new Map();
const courses: Map<string, Course> = new Map();
const courseMembers: CourseMember[] = [];
const sessions: Map<string, Session> = new Map();
const attendanceRecords: AttendanceRecord[] = [];
const teacherAttendanceRecords: TeacherAttendanceRecord[] = [];
const quickEvents: Map<string, QuickEvent> = new Map();
const inviteLinks: Map<string, InviteLink> = new Map();
const leaveRequests: LeaveRequest[] = [];

// Dynamic QR Tokens: sessionId/eventId -> { token, expiresAt, lat, lng }
interface ActiveQR {
  token: string;
  expiresAt: number;
  lat: number;
  lng: number;
  isGpsCheckEnabled?: boolean;
}
const activeQRCodes: Map<string, ActiveQR> = new Map();

// Helper: Haversine distance in meters
function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Seed Initial Users
const teacherUser: User = {
  id: 'usr_teacher_1',
  role: UserRole.TEACHER,
  title: 'อ.ดร.',
  firstNameTh: 'สมชาย',
  lastNameTh: 'ใจดี',
  firstNameEn: 'Somchai',
  lastNameEn: 'Jaidee',
  universityId: 'T1001',
  email: 'somchai@university.ac.th',
  password: '123456',
  deviceId: 'dev_teacher_1',
  createdAt: new Date().toISOString(),
};

const coTeacherUser: User = {
  id: 'usr_teacher_2',
  role: UserRole.TEACHER,
  title: 'ผศ.ดร.',
  firstNameTh: 'วนิดา',
  lastNameTh: 'เรียนดี',
  firstNameEn: 'Wanida',
  lastNameEn: 'Riandee',
  universityId: 'T1002',
  email: 'wanida@university.ac.th',
  password: '123456',
  deviceId: 'dev_teacher_2',
  createdAt: new Date().toISOString(),
};

const studentUser1: User = {
  id: 'usr_student_1',
  role: UserRole.STUDENT,
  title: 'นาย',
  firstNameTh: 'กิตติพงษ์',
  lastNameTh: 'สุขเสริฐ',
  firstNameEn: 'Kittipong',
  lastNameEn: 'Suksert',
  universityId: '66010012',
  email: '66010012@university.ac.th',
  password: '123456',
  deviceId: 'dev_student_1',
  createdAt: new Date().toISOString(),
};

const studentUser2: User = {
  id: 'usr_student_2',
  role: UserRole.STUDENT,
  title: 'นางสาว',
  firstNameTh: 'ณัฐธิดา',
  lastNameTh: 'รักเรียน',
  firstNameEn: 'Nattida',
  lastNameEn: 'Rakrien',
  universityId: '66010045',
  email: '66010045@university.ac.th',
  password: '123456',
  deviceId: 'dev_student_2',
  createdAt: new Date().toISOString(),
};

const adminUser: User = {
  id: 'usr_admin_1',
  role: UserRole.ADMIN,
  title: 'ผู้ดูแลระบบ',
  firstNameTh: 'แอดมิน',
  lastNameTh: 'คุมระบบ',
  firstNameEn: 'Admin',
  lastNameEn: 'System',
  universityId: 'ADM001',
  email: 'admin@university.ac.th',
  password: '123456',
  deviceId: 'dev_admin_1',
  createdAt: new Date().toISOString(),
};

users.set(teacherUser.id, teacherUser);
users.set(coTeacherUser.id, coTeacherUser);
users.set(studentUser1.id, studentUser1);
users.set(studentUser2.id, studentUser2);
users.set(adminUser.id, adminUser);

/**
 * Helper to bind/register or update a user device.
 * Rules:
 * - STUDENT: Maximum 3 devices allowed. Returns error if student tries to bind a 4th device without unbinding existing ones.
 * - TEACHER & ADMIN: UNLIMITED devices allowed for maximum flexibility in teaching.
 */
function bindUserDevice(
  user: User,
  deviceId: string,
  deviceName?: string,
  deviceType?: string,
  browser?: string,
  os?: string
): { success: boolean; error?: string; user: User; isNewDevice?: boolean } {
  if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้งาน', user };
  if (!deviceId) return { success: true, user };

  if (!user.devices) {
    user.devices = [];
    if (user.deviceId) {
      user.devices.push({
        id: `dev_primary_${user.id}`,
        deviceId: user.deviceId,
        deviceName: user.role === UserRole.STUDENT ? 'อุปกรณ์หลัก (Primary Phone)' : 'อุปกรณ์หลักอาจารย์ (Primary Device)',
        deviceType: 'MOBILE',
        boundAt: user.createdAt || new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        isPrimary: true,
      });
    }
  }

  const existingDevice = user.devices.find((d) => d.deviceId === deviceId);

  if (existingDevice) {
    existingDevice.lastUsedAt = new Date().toISOString();
    if (deviceName) existingDevice.deviceName = deviceName;
    if (deviceType) existingDevice.deviceType = deviceType as any;
    if (browser) existingDevice.browser = browser;
    if (os) existingDevice.os = os;
    user.deviceId = user.deviceId || deviceId;
    return { success: true, user, isNewDevice: false };
  }

  // Check limits
  const isStudent = user.role === UserRole.STUDENT;
  const MAX_STUDENT_DEVICES = 3;

  if (isStudent && user.devices.length >= MAX_STUDENT_DEVICES) {
    return {
      success: false,
      error: `[Anti-Proxy Device Limit] บัญชีนักศึกษานี้ผูกอุปกรณ์ครบ 3 เครื่องแล้ว (สิทธิ์สูงสุด 3 เครื่องสำหรับนักศึกษา) อุปกรณ์นี้ยังไม่ได้ผูกในระบบ กรุณาเข้าเมนู "ตั้งค่าบัญชี" เพื่อยกเลิกอุปกรณ์เดิม หรือติดต่ออาจารย์/แอดมินเพื่อรีเซ็ตอุปกรณ์`,
      user,
    };
  }

  // Register new device (No limit for TEACHER & ADMIN, <3 for STUDENT)
  const newDevice = {
    id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    deviceId,
    deviceName: deviceName || (isStudent ? 'อุปกรณ์นักศึกษา' : 'อุปกรณ์อาจารย์/ผู้ใช้'),
    deviceType: (deviceType as any) || 'DESKTOP',
    browser: browser || '',
    os: os || '',
    boundAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    isPrimary: user.devices.length === 0,
  };

  user.devices.push(newDevice);
  if (!user.deviceId) user.deviceId = deviceId;

  return { success: true, user, isNewDevice: true };
}

// Seed Initial Course: TEST101
const sampleCourse: Course = {
  id: 'crs_test101',
  courseCode: 'TEST101',
  courseName: 'Software Architecture & System Design',
  academicYear: 2569,
  semester: Semester.FIRST,
  coordinatorName: 'อ.ดร. สมชาย ใจดี',
  ownerId: teacherUser.id,
  ownerName: 'อ.ดร. สมชาย ใจดี',
  weeks: [
    { weekNumber: 1, topic: 'Introduction & Requirements Engineering', date: '2026-07-10' },
    { weekNumber: 2, topic: 'Microservices & RESTful API Design', date: '2026-07-17' },
    { weekNumber: 3, topic: 'Database Schema & Anti-Proxy Security', date: '2026-07-24' },
    { weekNumber: 4, topic: 'WebSockets & Dynamic QR Codes', date: '2026-07-31' },
    { weekNumber: 5, topic: 'Geofencing & PWA Deployment', date: '2026-08-07' },
  ],
  createdAt: new Date().toISOString(),
};

courses.set(sampleCourse.id, sampleCourse);

// Add course members
courseMembers.push(
  { id: 'cm_1', courseId: sampleCourse.id, userId: teacherUser.id, role: CourseMemberRole.CO_TEACHER, joinedAt: new Date().toISOString() },
  { id: 'cm_2', courseId: sampleCourse.id, userId: coTeacherUser.id, role: CourseMemberRole.CO_TEACHER, joinedAt: new Date().toISOString() },
  { id: 'cm_3', courseId: sampleCourse.id, userId: studentUser1.id, role: CourseMemberRole.STUDENT, joinedAt: new Date().toISOString() },
  { id: 'cm_4', courseId: sampleCourse.id, userId: studentUser2.id, role: CourseMemberRole.STUDENT, joinedAt: new Date().toISOString() }
);

// Seed sessions
const session1: Session = {
  id: 'ses_1',
  courseId: sampleCourse.id,
  weekNumber: 1,
  topic: 'Introduction & Requirements Engineering',
  teacherLat: 13.7563,
  teacherLng: 100.5018,
  isActive: false,
  createdAt: new Date().toISOString(),
};

const session2: Session = {
  id: 'ses_2',
  courseId: sampleCourse.id,
  weekNumber: 2,
  topic: 'Microservices & RESTful API Design',
  teacherLat: 13.7563,
  teacherLng: 100.5018,
  isActive: false,
  createdAt: new Date().toISOString(),
};

const session3: Session = {
  id: 'ses_3',
  courseId: sampleCourse.id,
  weekNumber: 3,
  topic: 'Database Schema & Anti-Proxy Security',
  teacherLat: 13.7563,
  teacherLng: 100.5018,
  isActive: true,
  createdAt: new Date().toISOString(),
};

sessions.set(session1.id, session1);
sessions.set(session2.id, session2);
sessions.set(session3.id, session3);

// Seed past attendance records
attendanceRecords.push(
  {
    id: 'rec_1',
    sessionId: session1.id,
    studentId: studentUser1.id,
    studentNameTh: 'นาย กิตติพงษ์ สุขเสริฐ',
    studentNameEn: 'Mr. Kittipong Suksert',
    studentUniversityId: '66010012',
    timestamp: '2026-07-10T09:05:12Z',
    status: AttendanceStatus.PRESENT,
    scannedLat: 13.75631,
    scannedLng: 100.50182,
    distanceMeters: 3,
    deviceId: 'dev_student_1',
  },
  {
    id: 'rec_2',
    sessionId: session1.id,
    studentId: studentUser2.id,
    studentNameTh: 'นางสาว ณัฐธิดา รักเรียน',
    studentNameEn: 'Ms. Nattida Rakrien',
    studentUniversityId: '66010045',
    timestamp: '2026-07-10T09:08:44Z',
    status: AttendanceStatus.PRESENT,
    scannedLat: 13.75629,
    scannedLng: 100.50178,
    distanceMeters: 4,
    deviceId: 'dev_student_2',
  },
  {
    id: 'rec_3',
    sessionId: session2.id,
    studentId: studentUser1.id,
    studentNameTh: 'นาย กิตติพงษ์ สุขเสริฐ',
    studentNameEn: 'Mr. Kittipong Suksert',
    studentUniversityId: '66010012',
    timestamp: '2026-07-17T09:12:00Z',
    status: AttendanceStatus.LATE,
    scannedLat: 13.75635,
    scannedLng: 100.50190,
    distanceMeters: 12,
    deviceId: 'dev_student_1',
  }
);

// Seed initial sample leave request
leaveRequests.push({
  id: 'leave_demo_1',
  studentId: 'usr_student_1',
  studentNameTh: 'นาย กิตติพงษ์ สุขเสริฐ',
  studentNameEn: 'Mr. Kittipong Suksert',
  studentUniversityId: '66010012',
  courseId: 'crs_test101',
  courseCode: 'TEST101',
  courseName: 'Software Architecture & System Design',
  weekNumber: 3,
  leaveType: LeaveType.SICK,
  leaveDate: '2026-07-24',
  reason: 'มีอาการไข้สูงและปวดศีรษะอย่างรุนแรง แพทย์ให้พักผ่อนเป็นเวลา 2 วัน',
  attachmentName: 'medical_certificate.pdf',
  status: LeaveStatus.PENDING,
  createdAt: new Date().toISOString(),
});

// --- WEBSOCKET SERVER SETUP ---
const wss = new WebSocketServer({ noServer: true });

interface WSClient extends WebSocket {
  sessionId?: string;
  eventId?: string;
  role?: string;
}

const activeWsClients: Set<WSClient> = new Set();

wss.on('connection', (ws: WSClient, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const sessionId = urlParams.get('sessionId');
  const eventId = urlParams.get('eventId');
  const role = urlParams.get('role');

  ws.sessionId = sessionId || undefined;
  ws.eventId = eventId || undefined;
  ws.role = role || undefined;
  activeWsClients.add(ws);

  // Send current active state immediately
  const targetId = sessionId || eventId;
  if (targetId && activeQRCodes.has(targetId)) {
    const qrData = activeQRCodes.get(targetId);
    ws.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
  }

  ws.on('close', () => {
    activeWsClients.delete(ws);
  });
});

// Helper to generate clean 6-character alphanumeric uppercase token (max length 6)
function generate6CharToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Periodic Dynamic QR Code Refresher (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  // Loop active sessions
  sessions.forEach((session, sId) => {
    if (session.isActive) {
      const newToken = generate6CharToken();
      const expiresAt = now + 35000; // valid for 35 seconds (30s cycle + 5s latency grace)
      const qrData: ActiveQR = {
        token: newToken,
        expiresAt,
        lat: session.teacherLat,
        lng: session.teacherLng,
        isGpsCheckEnabled: session.isGpsCheckEnabled !== false,
      };
      activeQRCodes.set(sId, qrData);

      // Broadcast to clients watching this session
      activeWsClients.forEach((client) => {
        if (client.sessionId === sId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
        }
      });
    }
  });

  // Loop active quick events
  quickEvents.forEach((qEvent, eId) => {
    if (qEvent.isActive) {
      const newToken = generate6CharToken();
      const expiresAt = now + 35000;
      const qrData: ActiveQR = {
        token: newToken,
        expiresAt,
        lat: qEvent.teacherLat,
        lng: qEvent.teacherLng,
        isGpsCheckEnabled: qEvent.isGpsCheckEnabled !== false,
      };
      activeQRCodes.set(eId, qrData);

      activeWsClients.forEach((client) => {
        if (client.eventId === eId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
        }
      });
    }
  });
}, 30000);

// Helper function to broadcast check-in updates over WebSocket
function broadcastCheckinEvent(targetId: string, record: AttendanceRecord) {
  const currentList = attendanceRecords.filter(
    (r) => r.sessionId === targetId || r.eventId === targetId
  );
  activeWsClients.forEach((client) => {
    if (
      (client.sessionId === targetId || client.eventId === targetId) &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(
        JSON.stringify({
          type: 'CHECKIN_NEW',
          record,
          totalCount: currentList.length,
          records: currentList,
        })
      );
    }
  });
}

// Upgrade HTTP server to handling WS connections
server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// --- REST API ENDPOINTS ---

// 1. Auth & Registration
app.post('/api/auth/register', (req, res) => {
  const {
    role,
    title,
    firstNameTh,
    lastNameTh,
    firstNameEn,
    lastNameEn,
    universityId,
    email,
    password,
    deviceId,
  } = req.body || {};

  const cleanEmail = (email || '').toString().trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลที่ถูกต้อง (เช่น example@gmail.com)' });
  }

  if (cleanEmail === 'nuttapat.anu@gmail.com') {
    return res.status(400).json({ error: 'อีเมล nuttapat.anu@gmail.com ต้องลงทะเบียนและเข้าสู่ระบบด้วย Google Account เท่านั้น' });
  }

  const userRole = role || UserRole.STUDENT;

  if (!firstNameTh || !lastNameTh) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อและนามสกุลภาษาไทย' });
  }

  if (userRole === UserRole.STUDENT && (!universityId || !universityId.toString().trim())) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสนักศึกษาสำหรับบัญชีนักศึกษา' });
  }

  if (!password || password.toString().trim().length < 6) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
  }

  // Check existing
  const existing = Array.from(users.values()).find((u) => u.email && u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'อีเมลนี้ถูกลงทะเบียนในระบบแล้ว' });
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    role: userRole,
    title: title || (userRole === UserRole.TEACHER ? 'อ.ดร.' : 'นาย'),
    firstNameTh: firstNameTh.toString().trim(),
    lastNameTh: lastNameTh.toString().trim(),
    firstNameEn: (firstNameEn || firstNameTh).toString().trim(),
    lastNameEn: (lastNameEn || lastNameTh).toString().trim(),
    universityId: userRole === UserRole.STUDENT ? universityId.toString().trim() : '',
    email: cleanEmail,
    password: password.toString(),
    authProvider: 'email',
    deviceId: deviceId || `dev_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  users.set(newUser.id, newUser);
  saveToFirestore(COLLECTIONS.USERS, newUser);
  res.json({ message: 'User registered successfully', user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, deviceId } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'กรุณาระบุอีเมลสำหรับเข้าสู่ระบบ' });
  }

  const cleanEmail = email.toString().trim().toLowerCase();
  const user = Array.from(users.values()).find((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานในระบบ กรุณาตรวจสอบอีเมลหรือลงทะเบียนใหม่' });
  }

  if (!password || password.toString().trim() === '') {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ' });
  }

  const expectedPassword = user.password || '123456';
  if (expectedPassword !== password) {
    return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง' });
  }

  // Update device ID or bind device if provided
  const { deviceName, deviceType, browser, os } = req.body || {};
  if (deviceId) {
    bindUserDevice(user, deviceId, deviceName, deviceType, browser, os);
    users.set(user.id, user);
    saveToFirestore(COLLECTIONS.USERS, user);
  }

  res.json({ message: 'Login successful', user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลที่ใช้ลงทะเบียน' });
  }

  const cleanEmail = email.toString().trim().toLowerCase();
  const user = Array.from(users.values()).find((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลอีเมลนี้ในฐานข้อมูลผู้ใช้งาน กรุณาตรวจสอบอีเมลหรือลงทะเบียนใหม่' });
  }

  // Simulate sending password recovery / reset link email
  return res.json({
    message: `ระบบได้ทำการส่งคำแนะนำและรหัสผ่านสำหรับการเข้าสู่ระบบไปยังอีเมล ${user.email} เรียบร้อยแล้ว`,
    email: user.email,
  });
});

app.put('/api/users/:userId/profile', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' });
  }

  const {
    title,
    firstNameTh,
    lastNameTh,
    firstNameEn,
    lastNameEn,
    universityId,
    currentPassword,
    newPassword,
  } = req.body || {};

  // Password update validation
  if (newPassword && newPassword.toString().trim() !== '') {
    const expectedPassword = user.password || '123456';
    if (currentPassword && currentPassword.toString() !== expectedPassword) {
      return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
    }
    if (newPassword.toString().length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }
    user.password = newPassword.toString();
  }

  if (title) user.title = title.toString().trim();
  if (firstNameTh) user.firstNameTh = firstNameTh.toString().trim();
  if (lastNameTh) user.lastNameTh = lastNameTh.toString().trim();
  if (firstNameEn) user.firstNameEn = firstNameEn.toString().trim();
  if (lastNameEn) user.lastNameEn = lastNameEn.toString().trim();
  if (universityId !== undefined) user.universityId = universityId.toString().trim();

  saveToFirestore(COLLECTIONS.USERS, user);
  res.json({ message: 'บันทึกการตั้งค่าโปรไฟล์เรียบร้อยแล้ว', user });
});

app.post('/api/auth/google', (req, res) => {
  const { email, name, picture, role, title, universityId, firstNameTh, lastNameTh, firstNameEn, lastNameEn, password } = req.body || {};
  const userEmail = (email || `user_${Math.floor(1000 + Math.random() * 9000)}@university.ac.th`).toString().trim().toLowerCase();

  let user = Array.from(users.values()).find((u) => u.email && u.email.toLowerCase() === userEmail);

  // Auto-detect domain rules for Mahidol & Admin
  const getForcedRole = (emailStr: string): UserRole | null => {
    if (emailStr === 'nuttapat.anu@gmail.com') {
      return UserRole.ADMIN;
    }
    if (emailStr.endsWith('@student.mahidol.ac.th')) {
      return UserRole.STUDENT;
    }
    if (emailStr.endsWith('@mahidol.ac.th')) {
      return UserRole.TEACHER;
    }
    return null;
  };

  const forcedRole = getForcedRole(userEmail);

  if (!user) {
    // If user does not exist in system yet and no role is explicitly passed
    if (!role) {
      return res.json({
        requiresOnboarding: true,
        forcedRole: forcedRole,
        email: userEmail,
        name: name || userEmail.split('@')[0],
        picture: picture || 'https://lh3.googleusercontent.com/a/default-user',
        message: forcedRole === UserRole.STUDENT
          ? 'พบอีเมลนักศึกษา (@student.mahidol.ac.th) กรุณากรอกข้อมูลสำหรับนักศึกษาเพื่อเริ่มต้นใช้งาน'
          : forcedRole === UserRole.TEACHER
          ? 'พบอีเมลอาจารย์ (@mahidol.ac.th) กรุณากรอกข้อมูลสำหรับอาจารย์เพื่อเริ่มต้นใช้งาน'
          : forcedRole === UserRole.ADMIN
          ? 'พบอีเมลผู้ดูแลระบบ (nuttapat.anu@gmail.com) กรุณากรอกข้อมูลผู้ดูแลระบบเพื่อเริ่มต้นใช้งาน'
          : 'ผู้ใช้งานใหม่ กรุณาตั้งค่าประเภทบัญชี กำหนดรหัสผ่าน และระบุข้อมูลประจำตัวเพื่อเริ่มต้นใช้งาน',
      });
    }

    // Determine effective user role: forcedRole takes precedence over requested role
    const effectiveRole = forcedRole || (role === UserRole.TEACHER ? UserRole.TEACHER : role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.STUDENT);

    // Validate Student ID if registering as Student
    if (effectiveRole === UserRole.STUDENT && (!universityId || !universityId.toString().trim())) {
      return res.status(400).json({ error: 'กรุณาระบุรหัสประจำตัวนักศึกษาที่ถูกต้อง' });
    }

    const parts = (name || 'Google User').toString().trim().split(' ');
    const fTh = firstNameTh && firstNameTh.toString().trim() ? firstNameTh.toString().trim() : (parts[0] || 'ผู้ใช้งาน');
    const lTh = lastNameTh && lastNameTh.toString().trim() ? lastNameTh.toString().trim() : (parts.slice(1).join(' ') || 'กูเกิล');
    const fEn = firstNameEn && firstNameEn.toString().trim() ? firstNameEn.toString().trim() : (parts[0] || 'Google');
    const lEn = lastNameEn && lastNameEn.toString().trim() ? lastNameEn.toString().trim() : (parts.slice(1).join(' ') || 'User');

    user = {
      id: `usr_g_${Date.now()}`,
      role: effectiveRole,
      title: title ? title.toString().trim() : (effectiveRole === UserRole.TEACHER ? 'อ.ดร.' : effectiveRole === UserRole.ADMIN ? 'แอดมิน' : 'นาย'),
      firstNameTh: fTh,
      lastNameTh: lTh,
      firstNameEn: fEn,
      lastNameEn: lEn,
      universityId: effectiveRole === UserRole.STUDENT ? universityId.toString().trim() : '',
      email: userEmail,
      password: password && password.toString().trim() ? password.toString().trim() : '123456',
      avatarUrl: picture || 'https://lh3.googleusercontent.com/a/default-user',
      authProvider: 'google',
      deviceId: `dev_g_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.set(user.id, user);
    saveToFirestore(COLLECTIONS.USERS, user);
  } else {
    // Existing user signing in with Google - link account & update avatar / password if provided
    if (picture) user.avatarUrl = picture;
    if (!user.authProvider) user.authProvider = 'google';
    if (password && password.toString().trim()) {
      user.password = password.toString().trim();
    }
    if (userEmail === 'nuttapat.anu@gmail.com') {
      user.role = UserRole.ADMIN;
    }
    saveToFirestore(COLLECTIONS.USERS, user);
  }

  res.json({ message: 'เข้าสู่ระบบด้วย Google สำเร็จ (Google Auth successful)', user });
});

app.get('/api/users/me', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = users.get(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  res.json(user);
});

// 2. Course Management
app.get('/api/courses', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = users.get(userId);

  if (!user) {
    return res.json([]);
  }

  let result: Course[] = [];

  if (user.role === UserRole.STUDENT) {
    const enrolledCourseIds = courseMembers
      .filter((m) => m.userId === userId && m.role === CourseMemberRole.STUDENT)
      .map((m) => m.courseId);
    result = Array.from(courses.values()).filter((c) => enrolledCourseIds.includes(c.id));
  } else if (user.role === UserRole.TEACHER) {
    const memberCourseIds = courseMembers
      .filter((m) => m.userId === userId)
      .map((m) => m.courseId);
    result = Array.from(courses.values()).filter(
      (c) => c.ownerId === userId || memberCourseIds.includes(c.id)
    );
  } else {
    result = [];
  }

  res.json(result);
});

app.post('/api/courses', (req, res) => {
  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks, ownerId, defaultLat, defaultLng } = req.body;

  if (!courseCode || !courseName) {
    return res.status(400).json({ error: 'Course code and name are required.' });
  }

  const reqUserId = req.headers['x-user-id'] as string;
  const owner = (ownerId && users.get(ownerId)) || (reqUserId && users.get(reqUserId));
  if (!owner) {
    return res.status(400).json({ error: 'ไม่พบอาจารย์ผู้สร้างรายวิชา' });
  }
  const lat = parseFloat(defaultLat) || 13.7988363;
  const lng = parseFloat(defaultLng) || 100.322944;

  const newCourse: Course = {
    id: `crs_${Date.now()}`,
    courseCode,
    courseName,
    academicYear: parseInt(academicYear, 10) || 2569,
    semester: semester || Semester.FIRST,
    coordinatorName: coordinatorName || owner.firstNameTh + ' ' + owner.lastNameTh,
    ownerId: owner.id,
    ownerName: `${owner.title} ${owner.firstNameTh} ${owner.lastNameTh}`,
    defaultLat: lat,
    defaultLng: lng,
    weeks: weeks || [],
    createdAt: new Date().toISOString(),
  };

  courses.set(newCourse.id, newCourse);
  saveToFirestore(COLLECTIONS.COURSES, newCourse);

  // Add owner as course member
  const ownerMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId: newCourse.id,
    userId: owner.id,
    role: CourseMemberRole.CO_TEACHER,
    joinedAt: new Date().toISOString(),
  };
  courseMembers.push(ownerMember);
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, ownerMember);

  // Automatically create session entries for each week
  newCourse.weeks.forEach((w) => {
    const sesId = `ses_${newCourse.id}_w${w.weekNumber}`;
    const newSession: Session = {
      id: sesId,
      courseId: newCourse.id,
      weekNumber: w.weekNumber,
      topic: w.topic,
      teacherLat: lat,
      teacherLng: lng,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    sessions.set(sesId, newSession);
    saveToFirestore(COLLECTIONS.SESSIONS, newSession);
  });

  res.json({ message: 'Course created successfully', course: newCourse });
});

app.get('/api/courses/:id', (req, res) => {
  const course = courses.get(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const members = courseMembers
    .filter((cm) => cm.courseId === course.id)
    .map((cm) => ({
      ...cm,
      user: users.get(cm.userId),
    }));

  const courseSessions = Array.from(sessions.values()).filter((s) => s.courseId === course.id);

  res.json({
    course,
    members,
    sessions: courseSessions,
  });
});

app.put('/api/courses/:id', (req, res) => {
  const courseId = req.params.id;
  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const reqUserId = (req.headers['x-user-id'] as string) || req.body.requesterUserId || req.body.teacherId;
  if (reqUserId) {
    const isOwner = course.ownerId === reqUserId;
    const member = courseMembers.find((m) => m.courseId === courseId && m.userId === reqUserId);
    const isCoordinator = member && (member.role === CourseMemberRole.COORDINATOR || member.role === CourseMemberRole.CO_TEACHER);
    const reqUser = users.get(reqUserId);
    const isAdmin = reqUser?.role === UserRole.ADMIN;

    if (!isOwner && !isCoordinator && !isAdmin) {
      return res.status(403).json({
        error: 'เฉพาะผู้รับผิดชอบรายวิชา (Course Coordinator) และเจ้าของรายวิชาเท่านั้นที่มีสิทธิ์แก้ไขรายวิชา',
      });
    }
  }

  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks, defaultLat, defaultLng } = req.body;

  if (courseCode) course.courseCode = courseCode;
  if (courseName) course.courseName = courseName;
  if (academicYear) course.academicYear = parseInt(academicYear, 10);
  if (semester) course.semester = semester;
  if (coordinatorName) course.coordinatorName = coordinatorName;
  if (defaultLat !== undefined) course.defaultLat = parseFloat(defaultLat);
  if (defaultLng !== undefined) course.defaultLng = parseFloat(defaultLng);

  const courseLat = course.defaultLat || 13.7988363;
  const courseLng = course.defaultLng || 100.322944;

  if (Array.isArray(weeks)) {
    course.weeks = weeks;

    // Synchronize sessions Map with updated weeks list
    const existingSessions = Array.from(sessions.values()).filter((s) => s.courseId === courseId);
    const currentWeekNumbers = new Set(weeks.map((w: any) => w.weekNumber));

    // Delete sessions for weeks that were removed
    existingSessions.forEach((s) => {
      if (!currentWeekNumbers.has(s.weekNumber)) {
        sessions.delete(s.id);
      }
    });

    // Create or update sessions for current weeks
    weeks.forEach((w: any) => {
      const existingSession = existingSessions.find((s) => s.weekNumber === w.weekNumber);
      if (existingSession) {
        existingSession.topic = w.topic;
        existingSession.teacherLat = courseLat;
        existingSession.teacherLng = courseLng;
        sessions.set(existingSession.id, existingSession);
      } else {
        const newSesId = `ses_${courseId}_w${w.weekNumber}_${Date.now()}`;
        sessions.set(newSesId, {
          id: newSesId,
          courseId,
          weekNumber: w.weekNumber,
          topic: w.topic,
          teacherLat: courseLat,
          teacherLng: courseLng,
          isActive: false,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  courses.set(courseId, course);
  const updatedSessions = Array.from(sessions.values()).filter((s) => s.courseId === courseId);

  res.json({
    message: 'Course updated successfully',
    course,
    sessions: updatedSessions,
  });
});

// Delete Course API (Requires password confirmation and Coordinator permission)
app.delete('/api/courses/:id', async (req, res) => {
  const courseId = req.params.id;
  const { teacherId, password } = req.body || {};
  const reqUserId = (req.headers['x-user-id'] as string) || teacherId;

  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในระบบ' });
  }

  // Verify Coordinator/Owner permissions
  if (reqUserId) {
    const isOwner = course.ownerId === reqUserId;
    const member = courseMembers.find((m) => m.courseId === courseId && m.userId === reqUserId);
    const isCoordinator = member && (member.role === CourseMemberRole.COORDINATOR || member.role === CourseMemberRole.CO_TEACHER);
    const reqUser = users.get(reqUserId);
    const isAdmin = reqUser?.role === UserRole.ADMIN;

    if (!isOwner && !isCoordinator && !isAdmin) {
      return res.status(403).json({
        error: 'เฉพาะผู้รับผิดชอบรายวิชา (Course Coordinator) และเจ้าของรายวิชาเท่านั้นที่มีสิทธิ์ลบรายวิชา',
      });
    }
  }

  // Find user to verify password
  const user = teacherId ? users.get(teacherId) : Array.from(users.values()).find((u) => u.id === course.ownerId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งานเจ้าของวิชา' });
  }

  if (!password || password.toString().trim() === '') {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบรายวิชา' });
  }

  const expectedPassword = user.password || '123456';
  if (password.toString().trim() !== expectedPassword) {
    return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง ไม่สามารถลบรายวิชาได้' });
  }

  // Delete course from memory and Firestore
  courses.delete(courseId);
  await deleteFromFirestore(COLLECTIONS.COURSES, courseId);

  // Delete course members
  for (let i = courseMembers.length - 1; i >= 0; i--) {
    if (courseMembers[i].courseId === courseId) {
      const member = courseMembers[i];
      courseMembers.splice(i, 1);
      await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, member.id);
    }
  }

  // Delete sessions associated with courseId
  const deletedSessionIds = new Set<string>();
  for (const [sesId, ses] of Array.from(sessions.entries())) {
    if (ses.courseId === courseId) {
      sessions.delete(sesId);
      deletedSessionIds.add(sesId);
      await deleteFromFirestore(COLLECTIONS.SESSIONS, sesId);
    }
  }

  // Delete attendances associated with deleted sessionIds
  for (let i = attendanceRecords.length - 1; i >= 0; i--) {
    if (deletedSessionIds.has(attendanceRecords[i].sessionId)) {
      const att = attendanceRecords[i];
      attendanceRecords.splice(i, 1);
      await deleteFromFirestore(COLLECTIONS.ATTENDANCE, att.id);
    }
  }

  // Delete quick events associated with teacher if any
  for (const [qId, qEvent] of Array.from(quickEvents.entries())) {
    if (qEvent.teacherId === user.id) {
      quickEvents.delete(qId);
      await deleteFromFirestore(COLLECTIONS.QUICK_EVENTS, qId);
    }
  }

  res.json({ message: 'ลบรายวิชาและข้อมูลที่เกี่ยวข้องทั้งหมดเรียบร้อยแล้ว', courseId });
});

// Teacher & Student Directory and Member Management Endpoints
app.get('/api/teachers', (req, res) => {
  const teacherUsers = Array.from(users.values())
    .filter((u) => u.role === UserRole.TEACHER || u.role === UserRole.ADMIN)
    .map(({ password, ...u }) => ({
      ...u,
      role: UserRole.TEACHER, // Mask role as 'teacher' so admin system privileges are not exposed publicly
    }));
  res.json(teacherUsers);
});

app.get('/api/students', (req, res) => {
  const studentUsers = Array.from(users.values())
    .filter((u) => u.role === UserRole.STUDENT)
    .map(({ password, ...u }) => u);
  res.json(studentUsers);
});

app.post('/api/courses/:id/members/invite-student', (req, res) => {
  const courseId = req.params.id;
  const { studentUserId } = req.body;

  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชาที่ระบุ' });
  }

  const targetStudent = users.get(studentUserId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'ไม่พบนักศึกษาที่เลือกในระบบ' });
  }

  const existingMember = courseMembers.find((m) => m.courseId === courseId && m.userId === studentUserId);

  if (existingMember) {
    existingMember.role = CourseMemberRole.STUDENT;
    saveToFirestore(COLLECTIONS.COURSE_MEMBERS, existingMember);
    return res.json({
      message: `นักศึกษา ${targetStudent.firstNameTh} ${targetStudent.lastNameTh} (${targetStudent.universityId || '-'}) มีชื่อในวิชานี้อยู่แล้ว`,
      member: { ...existingMember, user: targetStudent },
    });
  }

  const newMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId,
    userId: studentUserId,
    role: CourseMemberRole.STUDENT,
    joinedAt: new Date().toISOString(),
  };

  courseMembers.push(newMember);
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);

  res.json({
    message: `เพิ่มนักศึกษา ${targetStudent.firstNameTh} ${targetStudent.lastNameTh} (${targetStudent.universityId || '-'}) เข้าร่วมรายวิชาสำเร็จ`,
    member: { ...newMember, user: targetStudent },
  });
});

app.post('/api/courses/:id/members/invite-teacher', (req, res) => {
  const courseId = req.params.id;
  const { teacherUserId, role } = req.body;

  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชาที่ระบุ' });
  }

  const targetTeacher = users.get(teacherUserId);
  if (!targetTeacher) {
    return res.status(404).json({ error: 'ไม่พบอาจารย์ที่เลือกในระบบ' });
  }

  const validRoles = [
    CourseMemberRole.COORDINATOR,
    CourseMemberRole.CO_COORDINATOR,
    CourseMemberRole.INSTRUCTOR,
    CourseMemberRole.CO_TEACHER,
  ];

  const targetRole = validRoles.includes(role) ? role : CourseMemberRole.INSTRUCTOR;

  const existingMember = courseMembers.find((m) => m.courseId === courseId && m.userId === teacherUserId);

  if (existingMember) {
    existingMember.role = targetRole;
    saveToFirestore(COLLECTIONS.COURSE_MEMBERS, existingMember);
    return res.json({
      message: `ปรับเปลี่ยนสิทธิ์ของ ${targetTeacher.title} ${targetTeacher.firstNameTh} ${targetTeacher.lastNameTh} เป็นสิทธิ์ใหม่เรียบร้อยแล้ว`,
      member: { ...existingMember, user: targetTeacher },
    });
  }

  const newMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId,
    userId: teacherUserId,
    role: targetRole,
    joinedAt: new Date().toISOString(),
  };

  courseMembers.push(newMember);
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);

  res.json({
    message: `เพิ่ม/เชิญ ${targetTeacher.title} ${targetTeacher.firstNameTh} ${targetTeacher.lastNameTh} เข้าร่วมรายวิชาสำเร็จ`,
    member: { ...newMember, user: targetTeacher },
  });
});

app.put('/api/courses/:id/members/:memberId/role', (req, res) => {
  const { id: courseId, memberId } = req.params;
  const { role } = req.body;

  const member = courseMembers.find((m) => m.id === memberId || (m.courseId === courseId && m.userId === memberId));
  if (!member) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ในรายวิชานี้' });
  }

  member.role = role;
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, member);

  res.json({ message: 'อัปเดตสิทธิ์ของอาจารย์เรียบร้อยแล้ว', member });
});

app.delete('/api/courses/:id/members/:memberId', async (req, res) => {
  const { id: courseId, memberId } = req.params;

  const index = courseMembers.findIndex((m) => m.id === memberId || (m.courseId === courseId && m.userId === memberId));
  if (index === -1) {
    return res.status(404).json({ error: 'ไม่พบสมาชิกในรายวิชานี้' });
  }

  const removed = courseMembers.splice(index, 1)[0];
  await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, removed.id);

  res.json({ message: 'ลบสมาชิกออกจากรายวิชาเรียบร้อยแล้ว', memberId: removed.id });
});

// Helper for static 4-character invite token generation
function generateStatic4CharToken(courseId: string, role: string): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const hash = crypto.createHash('md5').update(`static_course_invite_${courseId}_${role}`).digest('hex');
  for (let i = 0; i < 4; i++) {
    const idx = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % chars.length;
    code += chars[idx];
  }
  return code;
}

// Invite link generation & acceptance
app.post('/api/courses/:id/invite', (req, res) => {
  const { role } = req.body;
  const courseId = req.params.id;

  let targetRole = CourseMemberRole.STUDENT;
  if (role === 'COORDINATOR' || role === CourseMemberRole.COORDINATOR) {
    targetRole = CourseMemberRole.COORDINATOR;
  } else if (role === 'CO_COORDINATOR' || role === CourseMemberRole.CO_COORDINATOR) {
    targetRole = CourseMemberRole.CO_COORDINATOR;
  } else if (role === 'INSTRUCTOR' || role === CourseMemberRole.INSTRUCTOR) {
    targetRole = CourseMemberRole.INSTRUCTOR;
  } else if (role === 'CO_TEACHER' || role === CourseMemberRole.CO_TEACHER) {
    targetRole = CourseMemberRole.CO_TEACHER;
  }

  // Check if static invite token already exists in memory map
  for (const [code, inv] of inviteLinks.entries()) {
    if (inv.courseId === courseId && inv.role === targetRole) {
      return res.json(inv);
    }
  }

  // Generate deterministic 4-character static token
  const code = generateStatic4CharToken(courseId, targetRole);
  const invite: InviteLink = {
    id: `inv_${courseId}_${targetRole}`,
    courseId,
    role: targetRole,
    code,
    expiresAt: '2099-12-31T23:59:59.000Z',
  };

  inviteLinks.set(code, invite);
  res.json(invite);
});

app.post('/api/invites/join', (req, res) => {
  const { code, userId } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสเชิญชวนหรือรหัสรายวิชา' });
  }

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const cleanCode = code.trim().toUpperCase();
  let invite = inviteLinks.get(cleanCode);

  if (!invite) {
    // Match against static 4-character invite token for any course
    for (const course of courses.values()) {
      for (const r of [
        CourseMemberRole.STUDENT,
        CourseMemberRole.INSTRUCTOR,
        CourseMemberRole.CO_COORDINATOR,
        CourseMemberRole.COORDINATOR,
        CourseMemberRole.CO_TEACHER,
      ]) {
        if (generateStatic4CharToken(course.id, r) === cleanCode) {
          invite = {
            id: `inv_${course.id}_${r}`,
            courseId: course.id,
            role: r,
            code: cleanCode,
            expiresAt: '2099-12-31T23:59:59.000Z',
          };
          inviteLinks.set(cleanCode, invite);
          break;
        }
      }
      if (invite) break;
    }
  }

  let targetCourseId = invite?.courseId;
  let targetRole = invite?.role || CourseMemberRole.STUDENT;

  if (!invite) {
    // Fallback: Check if user entered a Course Code (e.g. TEST101) directly
    const courseMatch = Array.from(courses.values()).find(
      (c) => c.courseCode.toUpperCase() === cleanCode || c.id.toUpperCase() === cleanCode
    );
    if (courseMatch) {
      targetCourseId = courseMatch.id;
      targetRole = CourseMemberRole.STUDENT;
    } else {
      return res.status(404).json({ error: 'ไม่พบรหัสเชิญชวนหรือรหัสวิชานี้ในระบบ กรุณาตรวจสอบรหัสอีกครั้ง' });
    }
  }

  // Check if already member
  const exists = courseMembers.some((m) => m.courseId === targetCourseId && m.userId === userId);
  if (exists) {
    return res.status(400).json({ error: 'คุณเป็นสมาชิกในรายวิชานี้อยู่แล้ว' });
  }

  const newMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId: targetCourseId!,
    userId,
    role: targetRole,
    joinedAt: new Date().toISOString(),
  };

  courseMembers.push(newMember);
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);

  res.json({ message: 'เข้าร่วมรายวิชาสำเร็จเรียบร้อยแล้ว!', courseId: targetCourseId });
});

// 3. Active Session & Dynamic QR Management
app.post('/api/sessions/:id/activate', (req, res) => {
  const { teacherLat, teacherLng, isGpsCheckEnabled = true } = req.body;
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.isActive = true;
  session.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  if (teacherLat && teacherLng) {
    session.teacherLat = parseFloat(teacherLat);
    session.teacherLng = parseFloat(teacherLng);
  }

  // Generate immediate active QR token (6 characters)
  const token = generate6CharToken();
  const expiresAt = Date.now() + 35000;
  activeQRCodes.set(session.id, {
    token,
    expiresAt,
    lat: session.teacherLat,
    lng: session.teacherLng,
    isGpsCheckEnabled: session.isGpsCheckEnabled,
  });

  res.json({ message: 'Session QR code activated', session, qrToken: token, expiresAt });
});

app.post('/api/sessions/:id/gps-toggle', (req, res) => {
  const { isGpsCheckEnabled } = req.body;
  const targetId = req.params.id;
  const session = sessions.get(targetId);
  if (session) {
    session.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  }
  const qEvt = quickEvents.get(targetId);
  if (qEvt) {
    qEvt.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  }
  const activeQR = activeQRCodes.get(targetId);
  if (activeQR) {
    activeQR.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  }
  res.json({ message: 'GPS check status updated', isGpsCheckEnabled: isGpsCheckEnabled !== false });
});

app.post('/api/sessions/:id/deactivate', (req, res) => {
  const session = sessions.get(req.params.id);
  if (session) {
    session.isActive = false;
    activeQRCodes.delete(session.id);
  }
  res.json({ message: 'Session closed', session });
});

app.get('/api/sessions/:id/records', (req, res) => {
  const records = attendanceRecords.filter((r) => r.sessionId === req.params.id);
  res.json(records);
});

app.get('/api/sessions/active', (req, res) => {
  const activeSessionsList: Array<{ session: Session; course?: Course; activeQR?: ActiveQR }> = [];
  sessions.forEach((s) => {
    if (s.isActive) {
      const course = courses.get(s.courseId);
      const qrData = activeQRCodes.get(s.id);
      activeSessionsList.push({ session: s, course, activeQR: qrData });
    }
  });
  res.json(activeSessionsList);
});

// 4. ANTI-PROXY CHECK-IN ENDPOINT
app.post('/api/checkin', (req, res) => {
  const { sessionId, qrToken, studentId, scannedLat, scannedLng, deviceId, checkinMode = 'HYBRID' } = req.body;

  if (!sessionId || !studentId) {
    return res.status(400).json({ error: 'Missing check-in parameters.' });
  }

  const student = users.get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const session = sessions.get(sessionId);
  if (!session || !session.isActive) {
    return res.status(400).json({ error: 'Check-in session is not active or has been closed by teacher.' });
  }

  const activeQR = activeQRCodes.get(sessionId);

  // Mode validation: QR_ONLY, HYBRID, or TOKEN requires valid active token
  if (checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID' || checkinMode === 'TOKEN') {
    if (!qrToken) {
      return res.status(400).json({ error: 'กรุณากรอกรหัส Token 6 หลักจากหน้าจออาจารย์' });
    }
    let inputToken = qrToken.trim();
    if (inputToken.includes(':')) {
      const parts = inputToken.split(':');
      inputToken = parts[parts.length - 1];
    }

    if (!activeQR || (activeQR.token.toUpperCase() !== inputToken.toUpperCase() && activeQR.token !== inputToken)) {
      return res.status(400).json({ error: 'รหัส Token / QR Code หมดอายุหรือไม่อยู่ในระบบ! กรุณาสแกนหรือกรอกรหัส 6 หลักล่าสุดจากหน้าจออาจารย์' });
    }
  }

  // Anti-Proxy Mechanism 1: Device Binding
  const { deviceName, deviceType, browser, os } = req.body || {};
  if (deviceId) {
    const bindResult = bindUserDevice(student, deviceId, deviceName, deviceType, browser, os);
    if (!bindResult.success) {
      return res.status(403).json({
        error: bindResult.error || `[Anti-Proxy] Device Mismatch or Limit Reached!`,
      });
    }
    users.set(student.id, student);
    saveToFirestore(COLLECTIONS.USERS, student);
  }

  // Geofence Distance Calculation
  const DEFAULT_LAT = 13.7563;
  const DEFAULT_LNG = 100.5018;

  let lat1 = activeQR ? activeQR.lat : session.teacherLat;
  let lon1 = activeQR ? activeQR.lng : session.teacherLng;
  const lat2 = parseFloat(scannedLat || lat1);
  const lon2 = parseFloat(scannedLng || lon1);

  const isTeacherDefault = Math.abs(lat1 - DEFAULT_LAT) < 0.0001 && Math.abs(lon1 - DEFAULT_LNG) < 0.0001;
  const isStudentDefault = Math.abs(lat2 - DEFAULT_LAT) < 0.0001 && Math.abs(lon2 - DEFAULT_LNG) < 0.0001;

  // Auto-calibrate teacher classroom location if teacher used default fallback while student provides real GPS
  if (isTeacherDefault && !isStudentDefault) {
    session.teacherLat = lat2;
    session.teacherLng = lon2;
    if (activeQR) {
      activeQR.lat = lat2;
      activeQR.lng = lon2;
    }
    lat1 = lat2;
    lon1 = lon2;
  }

  let distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);

  // Determine if GPS Geofence Check is required
  const sessionGpsEnabled = session.isGpsCheckEnabled !== false;
  const qrGpsEnabled = activeQR ? activeQR.isGpsCheckEnabled !== false : true;
  const isGpsCheckRequired = sessionGpsEnabled && qrGpsEnabled && checkinMode !== 'QR_ONLY';

  if (isGpsCheckRequired) {
    // If either device still uses default fallback or distance mismatch > 500m due to laptop lack of GPS
    if ((isTeacherDefault || isStudentDefault) && distanceMeters > 200) {
      // Auto allow with distance set to calibrated distance
      distanceMeters = Math.min(distanceMeters, 15);
    } else if (distanceMeters > 200) {
      return res.status(400).json({
        error: `[GPS Geofence] คุณอยู่ห่างจากห้องเรียน ${distanceMeters} เมตร (อนุญาตไม่เกิน 200 เมตร) หากอาจารย์เปิดบน MacBook ให้เปลี่ยนเป็นโหมด 'QR อย่างเดียว' ในหน้าจอผู้สอน`,
        distanceMeters,
        allowedRadius: 200,
      });
    }
  }

  // Duplicate check
  const alreadyChecked = attendanceRecords.find(
    (r) => r.sessionId === sessionId && r.studentId === studentId
  );

  if (alreadyChecked) {
    return res.status(400).json({
      error: 'คุณได้เช็คชื่อในคาบนี้ไปแล้ว!',
      record: alreadyChecked,
    });
  }

  // Record Attendance
  const newRecord: AttendanceRecord = {
    id: `rec_${Date.now()}`,
    sessionId,
    studentId: student.id,
    studentNameTh: `${student.title} ${student.firstNameTh} ${student.lastNameTh}`,
    studentNameEn: `${student.firstNameEn} ${student.lastNameEn}`,
    studentUniversityId: student.universityId,
    timestamp: new Date().toISOString(),
    status: AttendanceStatus.PRESENT,
    scannedLat: lat2,
    scannedLng: lon2,
    distanceMeters,
    deviceId: deviceId || student.deviceId || 'unknown',
    checkinMethod: checkinMode,
  };

  attendanceRecords.push(newRecord);
  saveToFirestore(COLLECTIONS.ATTENDANCE, newRecord);
  broadcastCheckinEvent(sessionId, newRecord);

  res.json({
    message: 'เช็คชื่อสำเร็จแล้ว! (Check-in Verified)',
    record: newRecord,
    distanceMeters,
    checkinMethod: checkinMode,
  });
});

// 4.5 TEACHER CHECK-IN ENDPOINT (SEPARATE DATASET)
app.post('/api/teacher/checkin', (req, res) => {
  const { teacherId, courseId, sessionId, lat, lng, deviceId, checkinMethod = 'GPS_ONLY', buildingRoom, notes } = req.body;

  const teacher = users.get(teacherId);
  if (!teacher || teacher.role !== UserRole.TEACHER) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้ของอาจารย์' });
  }

  let courseCode: string | undefined;
  let courseName: string | undefined;
  let sessionTopic: string | undefined;

  if (courseId && courses.has(courseId)) {
    const c = courses.get(courseId);
    courseCode = c?.courseCode;
    courseName = c?.courseName;
  }

  if (sessionId && sessions.has(sessionId)) {
    const s = sessions.get(sessionId);
    sessionTopic = s?.topic;
  }

  const record: TeacherAttendanceRecord = {
    id: `t_rec_${Date.now()}`,
    teacherId,
    teacherName: `${teacher.title || ''} ${teacher.firstNameTh} ${teacher.lastNameTh}`.trim(),
    courseId,
    courseCode,
    courseName,
    sessionId,
    sessionTopic,
    timestamp: new Date().toISOString(),
    lat: parseFloat(lat) || 13.7563,
    lng: parseFloat(lng) || 100.5018,
    checkinMethod,
    deviceId: deviceId || teacher.deviceId || 'unknown',
    buildingRoom,
    notes,
  };

  teacherAttendanceRecords.push(record);

  res.json({
    message: 'อาจารย์เช็คชื่อเข้าสอนสำเร็จเรียบร้อยแล้ว!',
    record,
  });
});

app.get('/api/teacher/checkin', (req, res) => {
  const { teacherId } = req.query;
  if (teacherId) {
    const filtered = teacherAttendanceRecords.filter((r) => r.teacherId === (teacherId as string));
    return res.json(filtered.reverse());
  }
  res.json([...teacherAttendanceRecords].reverse());
});

// 5. Quick Check-In (Event Mode)
app.post('/api/quick-events', (req, res) => {
  const { title, teacherId, teacherLat, teacherLng, isGpsCheckEnabled = true } = req.body;
  const reqUserId = req.headers['x-user-id'] as string;
  const newEvent: QuickEvent = {
    id: `evt_${Date.now()}`,
    title: title || 'Ad-hoc Quick Attendance Event',
    teacherId: teacherId || reqUserId || '',
    teacherLat: parseFloat(teacherLat) || 13.7563,
    teacherLng: parseFloat(teacherLng) || 100.5018,
    isActive: true,
    createdAt: new Date().toISOString(),
    isGpsCheckEnabled: isGpsCheckEnabled !== false,
  };

  quickEvents.set(newEvent.id, newEvent);

  // Active QR Token (6 characters)
  const token = generate6CharToken();
  activeQRCodes.set(newEvent.id, {
    token,
    expiresAt: Date.now() + 35000,
    lat: newEvent.teacherLat,
    lng: newEvent.teacherLng,
    isGpsCheckEnabled: newEvent.isGpsCheckEnabled,
  });

  res.json(newEvent);
});

app.get('/api/quick-events/:id/records', (req, res) => {
  const records = attendanceRecords.filter((r) => r.eventId === req.params.id);
  res.json(records);
});

app.post('/api/checkin/quick', (req, res) => {
  const { eventId, qrToken, studentId, scannedLat, scannedLng, deviceId } = req.body;

  const qEvent = quickEvents.get(eventId);
  if (!qEvent || !qEvent.isActive) {
    return res.status(400).json({ error: 'Quick Check-in event is inactive.' });
  }

  const student = users.get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // Device Binding
  const { deviceName, deviceType, browser, os } = req.body || {};
  if (deviceId) {
    const bindResult = bindUserDevice(student, deviceId, deviceName, deviceType, browser, os);
    if (!bindResult.success) {
      return res.status(403).json({
        error: bindResult.error || `[Anti-Proxy] Device Mismatch or Limit Reached!`,
      });
    }
    users.set(student.id, student);
    saveToFirestore(COLLECTIONS.USERS, student);
  }

  const activeQR = activeQRCodes.get(eventId);
  let inputToken = qrToken ? qrToken.trim() : '';
  if (inputToken.includes(':')) {
    const parts = inputToken.split(':');
    inputToken = parts[parts.length - 1];
  }

  if (!activeQR || (activeQR.token.toUpperCase() !== inputToken.toUpperCase() && activeQR.token !== inputToken)) {
    return res.status(400).json({ error: 'Invalid or expired event QR code.' });
  }

  const distanceMeters = getHaversineDistance(
    activeQR.lat,
    activeQR.lng,
    parseFloat(scannedLat || activeQR.lat),
    parseFloat(scannedLng || activeQR.lng)
  );

  const eventGpsEnabled = qEvent.isGpsCheckEnabled !== false;
  const qrGpsEnabled = activeQR ? activeQR.isGpsCheckEnabled !== false : true;
  const isGpsCheckRequired = eventGpsEnabled && qrGpsEnabled && req.body.checkinMode !== 'QR_ONLY';

  if (isGpsCheckRequired && distanceMeters > 200) {
    return res.status(400).json({
      error: `[Geofence Violation] Distance: ${distanceMeters}m (Max allowed: 200m).`,
      distanceMeters,
    });
  }

  const newRecord: AttendanceRecord = {
    id: `rec_${Date.now()}`,
    eventId,
    studentId: student.id,
    studentNameTh: `${student.title} ${student.firstNameTh} ${student.lastNameTh}`,
    studentNameEn: `${student.firstNameEn} ${student.lastNameEn}`,
    studentUniversityId: student.universityId,
    timestamp: new Date().toISOString(),
    status: AttendanceStatus.PRESENT,
    scannedLat: parseFloat(scannedLat || activeQR.lat),
    scannedLng: parseFloat(scannedLng || activeQR.lng),
    distanceMeters,
    deviceId: deviceId || 'dev_quick',
  };

  attendanceRecords.push(newRecord);
  broadcastCheckinEvent(eventId, newRecord);

  res.json({ message: 'Quick Check-in recorded!', record: newRecord });
});

// 6. CSV Export Endpoint
app.get('/api/export-csv/:courseId', (req, res) => {
  const course = courses.get(req.params.courseId);
  if (!course) {
    return res.status(404).send('Course not found');
  }

  const courseSessions = Array.from(sessions.values()).filter((s) => s.courseId === course.id);
  const members = courseMembers
    .filter((cm) => cm.courseId === course.id && cm.role === CourseMemberRole.STUDENT)
    .map((cm) => users.get(cm.userId))
    .filter(Boolean) as User[];

  // Header row: Student ID, Title, Name TH, Name EN, Email, Week 1, Week 2, ..., Overall %
  let csv = 'Student ID,Title,Full Name (TH),Full Name (EN),Email';
  courseSessions.forEach((s) => {
    csv += `,Week ${s.weekNumber} (${s.topic.replace(/,/g, ' ')})`;
  });
  csv += ',Attended Sessions,Total Sessions,Attendance Rate (%)\n';

  members.forEach((st) => {
    let attendedCount = 0;
    let weekCols = '';

    courseSessions.forEach((s) => {
      const approvedLeave = getApprovedLeaveForSession(st.id, course.id, s);
      if (approvedLeave) {
        const leaveTypeLabel =
          approvedLeave.leaveType === LeaveType.SICK
            ? 'ลาป่วย'
            : approvedLeave.leaveType === LeaveType.PERSONAL
            ? 'ลากิจ'
            : 'ลาอื่นๆ';
        weekCols += `,LEAVE (${leaveTypeLabel})`;
      } else {
        const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.studentId === st.id);
        if (rec) {
          attendedCount++;
          weekCols += `,PRESENT (${new Date(rec.timestamp).toLocaleTimeString()})`;
        } else {
          weekCols += `,ABSENT`;
        }
      }
    });

    const total = courseSessions.length || 1;
    const rate = Math.round((attendedCount / total) * 100);

    csv += `"${st.universityId}","${st.title}","${st.firstNameTh} ${st.lastNameTh}","${st.firstNameEn} ${st.lastNameEn}","${st.email}"${weekCols},${attendedCount},${total},${rate}%\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="student_attendance_${course.courseCode}_${Date.now()}.csv"`
  );
  // Add UTF-8 BOM for Thai character encoding in Excel
  res.send('\uFEFF' + csv);
});

// 6.5 Teacher Teaching Attendance CSV Export Endpoint
app.get('/api/export-teacher-csv', (req, res) => {
  const teacherId = req.query.teacherId as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  let records = [...teacherAttendanceRecords];
  if (teacherId) {
    records = records.filter((r) => r.teacherId === teacherId);
  }
  if (courseId && courseId !== 'ALL') {
    records = records.filter((r) => r.courseId === courseId || r.courseCode === courseId);
  }

  let csv = 'อาจารย์ผู้สอน,รหัสวิชา,ชื่อรายวิชา,ห้องเรียน/อาคาร,หัวข้อคาบเรียน,วิธีเช็คชื่อ,ละติจูด,ลองจิจูด,วันเวลาลงชื่อ,หมายเหตุ\n';
  records.forEach((r) => {
    const timeStr = new Date(r.timestamp).toLocaleString('th-TH');
    csv += `"${r.teacherName || ''}","${r.courseCode || ''}","${r.courseName || ''}","${r.buildingRoom || ''}","${r.sessionTopic || ''}","${r.checkinMethod || ''}",${r.lat},${r.lng},"${timeStr}","${r.notes || ''}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="teacher_teaching_report_${Date.now()}.csv"`
  );
  // Add UTF-8 BOM for Thai character encoding in Excel
  res.send('\uFEFF' + csv);
});

// 7. LEAVE REQUEST ENDPOINTS
// Submit leave request (นักศึกษาส่งใบลาเรียน)
app.post('/api/leave-requests', (req, res) => {
  const {
    studentId,
    courseId,
    weekNumber,
    leaveType,
    leaveDate,
    endDate,
    isMultiDay,
    reason,
    attachmentUrl,
    attachmentName,
  } = req.body;

  const student = users.get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลนักศึกษาในระบบ' });
  }

  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลรายวิชาในระบบ' });
  }

  if (!leaveType || !leaveDate || !reason) {
    return res.status(400).json({ error: 'กรุณาระบุประเภทการลา วันที่ลา และเหตุผลการลาให้ครบถ้วน' });
  }

  const newLeave: LeaveRequest = {
    id: `leave_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    studentId: student.id,
    studentNameTh: `${student.title || ''} ${student.firstNameTh} ${student.lastNameTh}`.trim(),
    studentNameEn: `${student.firstNameEn || ''} ${student.lastNameEn || ''}`.trim(),
    studentUniversityId: student.universityId,
    courseId: course.id,
    courseCode: course.courseCode,
    courseName: course.courseName,
    weekNumber: weekNumber ? Number(weekNumber) : undefined,
    leaveType: leaveType as LeaveType,
    leaveDate,
    endDate: isMultiDay ? endDate : undefined,
    isMultiDay: Boolean(isMultiDay),
    reason,
    attachmentUrl,
    attachmentName,
    status: LeaveStatus.PENDING,
    createdAt: new Date().toISOString(),
  };

  leaveRequests.unshift(newLeave);
  saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, newLeave);

  res.json({
    message: 'ส่งใบลาเรียนเรียบร้อยแล้ว รออาจารย์ผู้สอนพิจารณาอนุมัติ',
    leaveRequest: newLeave,
  });
});

// Get student's leave requests (ประวัติการแจ้งลาของนักศึกษา)
app.get('/api/leave-requests/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const list = leaveRequests.filter((l) => l.studentId === studentId);
  res.json(list);
});

// Get teacher's leave requests for courses taught by teacher (รายการแจ้งลาสำหรับอาจารย์)
app.get('/api/leave-requests/teacher/:teacherId', (req, res) => {
  const { teacherId } = req.params;

  // Find courses where teacher is owner or co-teacher
  const teacherCourseIds = new Set(
    Array.from(courses.values())
      .filter((c) => c.ownerId === teacherId)
      .map((c) => c.id)
  );

  courseMembers.forEach((cm) => {
    if (cm.userId === teacherId && cm.role === CourseMemberRole.CO_TEACHER) {
      teacherCourseIds.add(cm.courseId);
    }
  });

  const list = leaveRequests.filter((l) => teacherCourseIds.has(l.courseId));
  res.json(list);
});

// Update leave request status (อาจารย์อนุมัติ/ปฏิเสธใบลา)
app.put('/api/leave-requests/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, teacherComment } = req.body;

  const itemIndex = leaveRequests.findIndex((l) => l.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลใบลาที่ต้องการอัปเดต' });
  }

  if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.PENDING].includes(status)) {
    return res.status(400).json({ error: 'สถานะการลาไม่ถูกต้อง' });
  }

  leaveRequests[itemIndex] = {
    ...leaveRequests[itemIndex],
    status,
    teacherComment: teacherComment !== undefined ? teacherComment : leaveRequests[itemIndex].teacherComment,
    updatedAt: new Date().toISOString(),
  };

  const updated = leaveRequests[itemIndex];
  saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, updated);

  res.json({
    message: status === LeaveStatus.APPROVED ? 'อนุมัติการลาเรียนเรียบร้อยแล้ว' : 'ปฏิเสธใบลาเรียนเรียบร้อยแล้ว',
    leaveRequest: updated,
  });
});

// Cancel leave request (นักศึกษายกเลิกใบลาที่ยังรอดำเนินการ)
app.delete('/api/leave-requests/:id', (req, res) => {
  const { id } = req.params;
  const itemIndex = leaveRequests.findIndex((l) => l.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลใบลาที่ต้องการยกเลิก' });
  }

  if (leaveRequests[itemIndex].status !== LeaveStatus.PENDING) {
    return res.status(400).json({ error: 'ไม่สามารถยกเลิกใบลาที่ได้รับการพิจารณาไปแล้วได้' });
  }

  const [removed] = leaveRequests.splice(itemIndex, 1);
  deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, id);

  res.json({
    message: 'ยกเลิกใบลาเรียนเรียบร้อยแล้ว',
    id: removed.id,
  });
});

// Helper to check if a student has an APPROVED leave request for a given session
function getApprovedLeaveForSession(studentId: string, courseId: string, session: Session): LeaveRequest | undefined {
  return leaveRequests.find((lr) => {
    if (lr.studentId !== studentId || lr.courseId !== courseId || lr.status !== LeaveStatus.APPROVED) {
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

// Student Dashboard Stats endpoint
app.get('/api/student/:studentId/stats', (req, res) => {
  const studentId = req.params.studentId;
  const enrolledCourseIds = courseMembers
    .filter((cm) => cm.userId === studentId && cm.role === CourseMemberRole.STUDENT)
    .map((cm) => cm.courseId);

  const studentCourses = enrolledCourseIds.map((id) => courses.get(id)).filter(Boolean) as Course[];

  const courseStats = studentCourses.map((c) => {
    const cSessions = Array.from(sessions.values()).filter((s) => s.courseId === c.id);

    let attendedCount = 0;
    let approvedLeaveCount = 0;

    cSessions.forEach((s) => {
      const approvedLeave = getApprovedLeaveForSession(studentId, c.id, s);
      if (approvedLeave) {
        approvedLeaveCount++;
      } else {
        const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.studentId === studentId);
        if (rec) attendedCount++;
      }
    });

    const total = cSessions.length || 1;
    const percentage = Math.round((attendedCount / total) * 100);

    let statusColor: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (percentage < 80) statusColor = 'RED';
    else if (percentage <= 84) statusColor = 'YELLOW';

    const pastCheckins = attendanceRecords.filter((r) =>
      cSessions.some((s) => s.id === r.sessionId) && r.studentId === studentId
    );

    return {
      course: c,
      stats: {
        totalSessions: cSessions.length,
        attendedSessions: attendedCount,
        approvedLeaveSessions: approvedLeaveCount,
        lateSessions: 0,
        absentSessions: Math.max(0, cSessions.length - attendedCount - approvedLeaveCount),
        percentage,
        statusColor,
      },
      pastCheckins,
    };
  });

  res.json(courseStats);
});

// Teacher Course Overview Dashboard API
app.get('/api/teacher/courses-overview', (req, res) => {
  const teacherId = (req.query.teacherId as string) || (req.headers['x-user-id'] as string);
  const teacher = users.get(teacherId);

  if (!teacher) {
    return res.status(401).json({ error: 'ไม่พบข้อมูลอาจารย์ผู้ใช้งาน' });
  }

  const memberCourseIds = courseMembers
    .filter((m) => m.userId === teacherId)
    .map((m) => m.courseId);

  const teacherCourses = Array.from(courses.values()).filter(
    (c) => c.ownerId === teacherId || memberCourseIds.includes(c.id)
  );

  const overviewList = teacherCourses.map((course) => {
    const membersInCourse = courseMembers.filter((m) => m.courseId === course.id);
    const studentMembers = membersInCourse.filter((m) => m.role === CourseMemberRole.STUDENT);
    const coTeacherMembers = membersInCourse.filter((m) => m.role === CourseMemberRole.CO_TEACHER);

    const cSessions = Array.from(sessions.values()).filter((s) => s.courseId === course.id);

    const studentList = studentMembers.map((m) => {
      const studentUser = users.get(m.userId);
      const studentName = studentUser
        ? `${studentUser.title || ''} ${studentUser.firstNameTh || ''} ${studentUser.lastNameTh || ''}`.trim() || studentUser.email
        : 'นักศึกษา';
      const studentIdNum = studentUser?.universityId || '-';

      let attendedCount = 0;
      let approvedLeaveCount = 0;
      let lastCheckinTime: string | null = null;
      let lastCheckinMethod: string | null = null;
      const validCheckinTimes: Date[] = [];

      cSessions.forEach((s) => {
        const approvedLeave = getApprovedLeaveForSession(m.userId, course.id, s);
        if (approvedLeave) {
          approvedLeaveCount++;
        } else {
          const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.studentId === m.userId);
          if (rec) {
            attendedCount++;
            validCheckinTimes.push(new Date(rec.timestamp));
            lastCheckinTime = rec.timestamp;
            lastCheckinMethod = rec.checkinMethod;
          }
        }
      });

      const totalSessionsCount = cSessions.length || 1;
      const attendancePercent = Math.round((attendedCount / totalSessionsCount) * 100);

      let avgTimeStr = '-';
      if (validCheckinTimes.length > 0) {
        const totalMinutes = validCheckinTimes.reduce((acc, dt) => acc + (dt.getHours() * 60 + dt.getMinutes()), 0);
        const avgMin = Math.round(totalMinutes / validCheckinTimes.length);
        const hrs = Math.floor(avgMin / 60).toString().padStart(2, '0');
        const mins = (avgMin % 60).toString().padStart(2, '0');
        avgTimeStr = `${hrs}:${mins} น.`;
      }

      return {
        userId: m.userId,
        studentName,
        studentIdNum,
        email: studentUser?.email || '',
        avatarUrl: studentUser?.avatarUrl || '',
        joinedAt: m.joinedAt,
        attendedCount,
        approvedLeaveCount,
        totalSessionsCount,
        attendancePercent,
        avgTimeStr,
        lastCheckinTime,
        lastCheckinMethod,
      };
    });

    const courseSessionsList = Array.from(sessions.values()).filter((s) => s.courseId === course.id);
    const sessionDetailsList = courseSessionsList.map((s) => {
      const recordsForSession = attendanceRecords.filter((r) => r.sessionId === s.id);

      let firstCheckinTimeStr = '-';
      let lastCheckinTimeStr = '-';

      if (recordsForSession.length > 0) {
        const sorted = [...recordsForSession].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        firstCheckinTimeStr = new Date(sorted[0].timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
        lastCheckinTimeStr = new Date(sorted[sorted.length - 1].timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      }

      const attendedStudents: any[] = [];
      const absentStudents: any[] = [];

      studentMembers.forEach((m) => {
        const studentUser = users.get(m.userId);
        const studentName = studentUser
          ? `${studentUser.title || ''} ${studentUser.firstNameTh || ''} ${studentUser.lastNameTh || ''}`.trim() || studentUser.email
          : 'นักศึกษา';
        const studentIdNum = studentUser?.universityId || '-';

        const matchingLeave = getApprovedLeaveForSession(m.userId, course.id, s);

        if (matchingLeave) {
          // Approved leave overrides checkin - student is placed in absent (leave) list
          const leaveTypeLabel =
            matchingLeave.leaveType === LeaveType.SICK
              ? 'ลาป่วย'
              : matchingLeave.leaveType === LeaveType.PERSONAL
              ? 'ลากิจ'
              : matchingLeave.leaveType === LeaveType.OTHER
              ? 'ลาอื่นๆ'
              : 'ลาเรียน';

          const statusText = leaveTypeLabel;

          absentStudents.push({
            userId: m.userId,
            studentName,
            studentIdNum,
            email: studentUser?.email || '',
            avatarUrl: studentUser?.avatarUrl || '',
            isOnLeave: true,
            leaveType: matchingLeave.leaveType,
            leaveTypeLabel,
            statusText,
            leaveReason: matchingLeave.reason || '',
          });
        } else {
          const rec = recordsForSession.find((r) => r.studentId === m.userId);
          if (rec) {
            attendedStudents.push({
              userId: m.userId,
              studentName,
              studentIdNum,
              email: studentUser?.email || '',
              avatarUrl: studentUser?.avatarUrl || '',
              checkinTime: new Date(rec.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              checkinMethod: rec.checkinMethod || 'สแกน QR',
            });
          } else {
            absentStudents.push({
              userId: m.userId,
              studentName,
              studentIdNum,
              email: studentUser?.email || '',
              avatarUrl: studentUser?.avatarUrl || '',
              isOnLeave: false,
              statusText: 'ขาดเรียน',
            });
          }
        }
      });

      const checkinCount = attendedStudents.length;

      return {
        sessionId: s.id,
        weekNumber: s.weekNumber,
        topic: s.topic,
        isActive: s.isActive,
        createdAt: s.createdAt,
        checkinCount,
        registeredCount: studentMembers.length,
        attendancePercentage: studentMembers.length > 0 ? Math.round((checkinCount / studentMembers.length) * 100) : 0,
        firstCheckinTimeStr,
        lastCheckinTimeStr,
        attendedStudents,
        absentStudents,
      };
    });

    const totalRegisteredCount = studentMembers.length;
    const totalCoTeachersCount = coTeacherMembers.length + 1;
    const totalSessions = courseSessionsList.length;

    const totalPossibleCheckins = totalRegisteredCount * (totalSessions || 1);
    let totalActualCheckins = 0;

    courseSessionsList.forEach((s) => {
      studentMembers.forEach((m) => {
        const approvedLeave = getApprovedLeaveForSession(m.userId, course.id, s);
        if (!approvedLeave) {
          const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.studentId === m.userId);
          if (rec) totalActualCheckins++;
        }
      });
    });

    const courseAvgAttendanceRate = totalPossibleCheckins > 0 ? Math.round((totalActualCheckins / totalPossibleCheckins) * 100) : 0;

    return {
      course,
      totalRegisteredCount,
      totalCoTeachersCount,
      totalSessions,
      totalActualCheckins,
      courseAvgAttendanceRate,
      studentList,
      sessionDetailsList,
    };
  });

  res.json({
    teacherName: `${teacher.title} ${teacher.firstNameTh} ${teacher.lastNameTh}`,
    totalCourses: teacherCourses.length,
    overviewList,
  });
});

// Demo User IDs whitelist
const DEMO_USER_IDS = new Set(['usr_teacher_1', 'usr_teacher_2', 'usr_student_1', 'usr_student_2', 'usr_admin_1']);

// Purge all non-demo users from both Firestore and in-memory Map
async function purgeNonDemoUsers(): Promise<{ deletedCount: number; remainingUsers: string[] }> {
  let deletedCount = 0;
  
  try {
    const fsUsers = await getAllFromFirestore<User>(COLLECTIONS.USERS);
    for (const u of fsUsers) {
      if (u && u.id && !DEMO_USER_IDS.has(u.id)) {
        await deleteFromFirestore(COLLECTIONS.USERS, u.id);
        deletedCount++;
      }
    }
  } catch (err) {
    console.error('[Purge Users Warning] Firestore purge error:', err);
  }

  for (const [id] of Array.from(users.entries())) {
    if (!DEMO_USER_IDS.has(id)) {
      users.delete(id);
      deletedCount++;
    }
  }

  const remainingUsers = Array.from(users.values()).map((u) => `${u.id} (${u.email})`);
  console.log(`[Purge Users] Cleaned up non-demo users. Remaining users:`, remainingUsers);
  return { deletedCount, remainingUsers };
}

// Endpoint to manually reset/delete non-demo users from database
app.post('/api/admin/reset-users', async (req, res) => {
  try {
    const result = await purgeNonDemoUsers();
    res.json({
      message: 'ลบข้อมูลผู้ใช้งานทั้งหมดในระบบสำเร็จเรียบร้อยแล้ว (คงเหลือเฉพาะ Demo Accounts)',
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

// --- ADMIN & REALTIME DATABASE INSPECTOR ENDPOINTS ---

// Overview of all collections count and system status
app.get('/api/admin/database/overview', (req, res) => {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      collections: {
        users: users ? users.size : 0,
        courses: courses ? courses.size : 0,
        courseMembers: Array.isArray(courseMembers) ? courseMembers.length : 0,
        sessions: sessions ? sessions.size : 0,
        attendanceRecords: Array.isArray(attendanceRecords) ? attendanceRecords.length : 0,
        teacherAttendanceRecords: Array.isArray(teacherAttendanceRecords) ? teacherAttendanceRecords.length : 0,
        leaveRequests: Array.isArray(leaveRequests) ? leaveRequests.length : 0,
        quickEvents: quickEvents ? quickEvents.size : 0,
        activeQRCodes: activeQRCodes ? activeQRCodes.size : 0,
      },
      system: {
        uptime: process.uptime(),
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
      }
    });
  } catch (err: any) {
    console.error('Error fetching admin database overview:', err);
    res.status(500).json({ error: err.message || 'Error fetching database overview' });
  }
});

// Fetch documents of a specific collection
app.get('/api/admin/database/collection/:collectionName', (req, res) => {
  try {
    const { collectionName } = req.params;
    let data: any[] = [];

    switch (collectionName) {
      case 'users':
        data = users ? Array.from(users.values()).map(({ password, ...u }) => u) : [];
        break;
      case 'courses':
        data = courses ? Array.from(courses.values()) : [];
        break;
      case 'courseMembers':
        data = Array.isArray(courseMembers) ? courseMembers : [];
        break;
      case 'sessions':
        data = sessions ? Array.from(sessions.size ? sessions.values() : []) : [];
        break;
      case 'attendanceRecords':
        data = Array.isArray(attendanceRecords) ? attendanceRecords : [];
        break;
      case 'teacherAttendanceRecords':
        data = Array.isArray(teacherAttendanceRecords) ? teacherAttendanceRecords : [];
        break;
      case 'leaveRequests':
        data = Array.isArray(leaveRequests) ? leaveRequests : [];
        break;
      case 'quickEvents':
        data = quickEvents ? Array.from(quickEvents.values()) : [];
        break;
      case 'activeQRCodes':
        data = activeQRCodes ? Array.from(activeQRCodes.entries()).map(([key, val]) => ({ id: key, ...val })) : [];
        break;
      default:
        return res.status(400).json({ error: 'Collection ไม่ถูกต้อง' });
    }

    res.json({
      collectionName,
      count: data.length,
      documents: data,
    });
  } catch (err: any) {
    console.error('Error fetching admin collection:', err);
    res.status(500).json({ error: err.message || 'Error fetching collection' });
  }
});

// Create or update a document in a collection
app.post('/api/admin/database/document/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  const docData = req.body;

  if (!docData || !docData.id) {
    return res.status(400).json({ error: 'เอกสารต้องมี field "id"' });
  }

  try {
    switch (collectionName) {
      case 'users':
        users.set(docData.id, docData);
        await saveToFirestore(COLLECTIONS.USERS, docData);
        break;
      case 'courses': {
        courses.set(docData.id, docData);
        await saveToFirestore(COLLECTIONS.COURSES, docData);

        // Ensure owner is updated/added in courseMembers
        if (docData.ownerId) {
          const existingMember = courseMembers.find(
            (m) => m.courseId === docData.id && m.userId === docData.ownerId
          );
          if (!existingMember) {
            const newMember: CourseMember = {
              id: `cm_${docData.id}_${docData.ownerId}`,
              courseId: docData.id,
              userId: docData.ownerId,
              role: CourseMemberRole.COORDINATOR,
              joinedAt: new Date().toISOString(),
            };
            courseMembers.push(newMember);
            await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);
          } else {
            existingMember.role = CourseMemberRole.COORDINATOR;
            await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, existingMember);
          }
        }
        break;
      }
      case 'courseMembers': {
        const idx = courseMembers.findIndex((m) => m.id === docData.id);
        if (idx >= 0) courseMembers[idx] = docData;
        else courseMembers.push(docData);
        await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, docData);
        break;
      }
      case 'sessions':
        sessions.set(docData.id, docData);
        await saveToFirestore(COLLECTIONS.SESSIONS, docData);
        break;
      case 'attendanceRecords': {
        const idx = attendanceRecords.findIndex((a) => a.id === docData.id);
        if (idx >= 0) attendanceRecords[idx] = docData;
        else attendanceRecords.push(docData);
        await saveToFirestore(COLLECTIONS.ATTENDANCE, docData);
        break;
      }
      case 'leaveRequests': {
        const idx = leaveRequests.findIndex((l) => l.id === docData.id);
        if (idx >= 0) leaveRequests[idx] = docData;
        else leaveRequests.push(docData);
        await saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, docData);
        break;
      }
      case 'quickEvents':
        quickEvents.set(docData.id, docData);
        await saveToFirestore(COLLECTIONS.QUICK_EVENTS, docData);
        break;
      default:
        return res.status(400).json({ error: 'Collection ไม่รองรับการแก้ไขโดยตรง' });
    }

    res.json({ message: `บันทึกข้อมูลใน ${collectionName} สำเร็จ`, document: docData });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกเอกสาร' });
  }
});

// Delete a document from a collection
app.delete('/api/admin/database/document/:collectionName/:docId', async (req, res) => {
  const { collectionName, docId } = req.params;

  try {
    switch (collectionName) {
      case 'users':
        users.delete(docId);
        await deleteFromFirestore(COLLECTIONS.USERS, docId);
        break;
      case 'courses': {
        courses.delete(docId);
        await deleteFromFirestore(COLLECTIONS.COURSES, docId);

        // Cascade delete course members
        for (let i = courseMembers.length - 1; i >= 0; i--) {
          if (courseMembers[i].courseId === docId) {
            const member = courseMembers[i];
            courseMembers.splice(i, 1);
            await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, member.id);
          }
        }

        // Cascade delete sessions associated with this course
        const deletedSessionIds = new Set<string>();
        for (const [sesId, ses] of Array.from(sessions.entries())) {
          if (ses.courseId === docId) {
            sessions.delete(sesId);
            deletedSessionIds.add(sesId);
            await deleteFromFirestore(COLLECTIONS.SESSIONS, sesId);
          }
        }

        // Cascade delete attendance records
        for (let i = attendanceRecords.length - 1; i >= 0; i--) {
          if (deletedSessionIds.has(attendanceRecords[i].sessionId)) {
            const att = attendanceRecords[i];
            attendanceRecords.splice(i, 1);
            await deleteFromFirestore(COLLECTIONS.ATTENDANCE, att.id);
          }
        }

        // Cascade delete leave requests associated with this course
        for (let i = leaveRequests.length - 1; i >= 0; i--) {
          if (leaveRequests[i].courseId === docId) {
            const lr = leaveRequests[i];
            leaveRequests.splice(i, 1);
            await deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, lr.id);
          }
        }
        break;
      }
      case 'courseMembers': {
        const idx = courseMembers.findIndex((m) => m.id === docId);
        if (idx >= 0) courseMembers.splice(idx, 1);
        await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, docId);
        break;
      }
      case 'sessions':
        sessions.delete(docId);
        await deleteFromFirestore(COLLECTIONS.SESSIONS, docId);
        break;
      case 'attendanceRecords': {
        const idx = attendanceRecords.findIndex((a) => a.id === docId);
        if (idx >= 0) attendanceRecords.splice(idx, 1);
        await deleteFromFirestore(COLLECTIONS.ATTENDANCE, docId);
        break;
      }
      case 'leaveRequests': {
        const idx = leaveRequests.findIndex((l) => l.id === docId);
        if (idx >= 0) leaveRequests.splice(idx, 1);
        await deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, docId);
        break;
      }
      case 'quickEvents':
        quickEvents.delete(docId);
        await deleteFromFirestore(COLLECTIONS.QUICK_EVENTS, docId);
        break;
      default:
        return res.status(400).json({ error: 'Collection ไม่รองรับการลบโดยตรง' });
    }

    res.json({ message: `ลบเอกสาร ${docId} จาก ${collectionName} เรียบร้อยแล้ว`, docId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการลบเอกสาร' });
  }
});

// Helper to clean orphaned data
async function cleanOrphanedData() {
  const deletedSummary = {
    courseMembers: [] as string[],
    sessions: [] as string[],
    attendanceRecords: [] as string[],
    leaveRequests: [] as string[],
    quickEvents: [] as string[],
  };

  // 1. Clean courseMembers
  for (let i = courseMembers.length - 1; i >= 0; i--) {
    const cm = courseMembers[i];
    const courseExists = cm.courseId && courses.has(cm.courseId);
    const userExists = cm.userId && users.has(cm.userId);

    if (!courseExists || !userExists) {
      const reason = !courseExists ? `ไม่พบวิชา (${cm.courseId})` : `ไม่พบผู้ใช้ (${cm.userId})`;
      deletedSummary.courseMembers.push(`ID: ${cm.id} [${reason}]`);
      courseMembers.splice(i, 1);
      await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, cm.id);
    }
  }

  // 2. Clean sessions
  for (const [sesId, ses] of Array.from(sessions.entries())) {
    const courseExists = ses.courseId && courses.has(ses.courseId);
    if (!courseExists) {
      deletedSummary.sessions.push(`ID: ${sesId} [ไม่พบวิชา (${ses.courseId})]`);
      sessions.delete(sesId);
      await deleteFromFirestore(COLLECTIONS.SESSIONS, sesId);
    }
  }

  // 3. Clean attendanceRecords
  for (let i = attendanceRecords.length - 1; i >= 0; i--) {
    const att = attendanceRecords[i];
    const sessionExists = att.sessionId && sessions.has(att.sessionId);
    const studentExists = att.studentId && users.has(att.studentId);

    if (!sessionExists || !studentExists) {
      const reason = !sessionExists ? `ไม่พบคาบเรียน (${att.sessionId})` : `ไม่พบนักศึกษา (${att.studentId})`;
      deletedSummary.attendanceRecords.push(`ID: ${att.id} [${reason}]`);
      attendanceRecords.splice(i, 1);
      await deleteFromFirestore(COLLECTIONS.ATTENDANCE, att.id);
    }
  }

  // 4. Clean leaveRequests
  for (let i = leaveRequests.length - 1; i >= 0; i--) {
    const lr = leaveRequests[i];
    const courseExists = lr.courseId && courses.has(lr.courseId);
    const studentExists = lr.studentId && users.has(lr.studentId);

    if (!courseExists || !studentExists) {
      const reason = !courseExists ? `ไม่พบวิชา (${lr.courseId})` : `ไม่พบนักศึกษา (${lr.studentId})`;
      deletedSummary.leaveRequests.push(`ID: ${lr.id} [${reason}]`);
      leaveRequests.splice(i, 1);
      await deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, lr.id);
    }
  }

  // 5. Clean quickEvents
  for (const [qId, qe] of Array.from(quickEvents.entries())) {
    const teacherExists = !qe.teacherId || users.has(qe.teacherId);

    if (!teacherExists) {
      deletedSummary.quickEvents.push(`ID: ${qId} [ไม่พบอาจารย์ผู้สร้าง (${qe.teacherId})]`);
      quickEvents.delete(qId);
      await deleteFromFirestore(COLLECTIONS.QUICK_EVENTS, qId);
    }
  }

  return deletedSummary;
}

// Endpoint to trigger cleanup of orphaned data
app.post('/api/admin/clean-orphaned-data', async (req, res) => {
  try {
    const summary = await cleanOrphanedData();
    const totalDeleted =
      summary.courseMembers.length +
      summary.sessions.length +
      summary.attendanceRecords.length +
      summary.leaveRequests.length +
      summary.quickEvents.length;

    res.json({
      message: totalDeleted > 0 ? `ลบข้อมูลตกค้าง (Orphaned Data) ทั้งหมด ${totalDeleted} รายการสำเร็จ` : 'ไม่พบข้อมูลตกค้าง (Orphaned Data) ในระบบ',
      totalDeleted,
      summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการล้างข้อมูลตกค้าง' });
  }
});

// Update user role directly
app.put('/api/admin/users/:userId/role', async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  if (![UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].includes(role)) {
    return res.status(400).json({ error: 'สิทธิ์ไม่ถูกต้อง' });
  }

  targetUser.role = role;
  users.set(userId, targetUser);
  await saveToFirestore(COLLECTIONS.USERS, targetUser);

  res.json({ message: `ปรับเปลี่ยนสิทธิ์ผู้ใช้เป็น ${role} สำเร็จ`, user: targetUser });
});

// Reset device fingerprint for a user
app.put('/api/admin/users/:userId/reset-device', async (req, res) => {
  const { userId } = req.params;

  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  targetUser.deviceId = undefined;
  targetUser.devices = [];
  users.set(userId, targetUser);
  await saveToFirestore(COLLECTIONS.USERS, targetUser);

  res.json({ message: `ปลดล็อกอุปกรณ์ทั้งหมดของผู้ใช้ (${targetUser.firstNameTh}) เรียบร้อยแล้ว`, user: targetUser });
});

// -------------------- DEVICE BINDING MANAGEMENT API --------------------
// Get bound devices for a user
app.get('/api/users/:userId/devices', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  if (!user.devices) {
    user.devices = [];
    if (user.deviceId) {
      user.devices.push({
        id: `dev_primary_${user.id}`,
        deviceId: user.deviceId,
        deviceName: user.role === UserRole.STUDENT ? 'อุปกรณ์หลัก (Primary Phone)' : 'อุปกรณ์หลักอาจารย์ (Primary Device)',
        deviceType: 'MOBILE',
        boundAt: user.createdAt || new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        isPrimary: true,
      });
    }
  }

  const isStudent = user.role === UserRole.STUDENT;
  res.json({
    devices: user.devices,
    maxDevices: isStudent ? 3 : null, // null means unlimited
    role: user.role,
    userId: user.id,
  });
});

// Bind or update a device
app.post('/api/users/:userId/devices/bind', async (req, res) => {
  const { userId } = req.params;
  const { deviceId, deviceName, deviceType, browser, os } = req.body || {};

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  if (!deviceId) {
    return res.status(400).json({ error: 'กรุณาระบุ Device ID ที่ต้องการผูก' });
  }

  const result = bindUserDevice(user, deviceId, deviceName, deviceType, browser, os);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  users.set(user.id, user);
  await saveToFirestore(COLLECTIONS.USERS, user);

  res.json({
    message: result.isNewDevice ? 'ผูกอุปกรณ์ใหม่เรียบร้อยแล้ว' : 'อัปเดตข้อมูลอุปกรณ์เรียบร้อยแล้ว',
    devices: user.devices,
    user,
  });
});

// Remove a specific bound device
app.delete('/api/users/:userId/devices/:devId', async (req, res) => {
  const { userId, devId } = req.params;

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  if (!user.devices || user.devices.length === 0) {
    return res.status(400).json({ error: 'ไม่มีอุปกรณ์ที่ผูกไว้ในระบบ' });
  }

  const initialCount = user.devices.length;
  user.devices = user.devices.filter((d) => d.id !== devId && d.deviceId !== devId);

  if (user.devices.length === initialCount) {
    return res.status(404).json({ error: 'ไม่พบอุปกรณ์ที่ระบุในรายการผูกเครื่อง' });
  }

  if (user.devices.length > 0) {
    user.deviceId = user.devices[0].deviceId;
  } else {
    user.deviceId = undefined;
  }

  users.set(user.id, user);
  await saveToFirestore(COLLECTIONS.USERS, user);

  res.json({
    message: 'ยกเลิกการผูกอุปกรณ์เรียบร้อยแล้ว',
    devices: user.devices,
    user,
  });
});

// Reset all devices for a user
app.post('/api/users/:userId/devices/reset', async (req, res) => {
  const { userId } = req.params;

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  user.devices = [];
  user.deviceId = undefined;

  users.set(user.id, user);
  await saveToFirestore(COLLECTIONS.USERS, user);

  res.json({
    message: `รีเซ็ตอุปกรณ์ทั้งหมดของผู้ใช้ (${user.firstNameTh}) เรียบร้อยแล้ว`,
    devices: [],
    user,
  });
});

// Override attendance record manually
app.post('/api/admin/attendance/override', async (req, res) => {
  const { studentId, sessionId, eventId, courseId, status, checkinMethod } = req.body;

  const student = users.get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'ไม่พบนัศึกษาในระบบ' });
  }

  // Find existing record or create new
  let record = attendanceRecords.find(
    (ar) => ar.studentId === studentId && ((sessionId && ar.sessionId === sessionId) || (eventId && ar.eventId === eventId))
  );

  if (record) {
    record.status = status as AttendanceStatus;
    record.timestamp = new Date().toISOString();
  } else {
    record = {
      id: `att_admin_override_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      eventId,
      studentId: student.id,
      studentNameTh: `${student.firstNameTh} ${student.lastNameTh}`,
      studentNameEn: `${student.firstNameEn || ''} ${student.lastNameEn || ''}`.trim(),
      studentUniversityId: student.universityId,
      timestamp: new Date().toISOString(),
      status: status as AttendanceStatus,
      scannedLat: 0,
      scannedLng: 0,
      distanceMeters: 0,
      deviceId: student.deviceId || 'admin_override',
      checkinMethod: (checkinMethod as any) || 'HYBRID',
    };
    attendanceRecords.push(record);
  }

  await saveToFirestore(COLLECTIONS.ATTENDANCE, record);

  res.json({ message: 'ปรับแก้ไขข้อมูลการเช็กชื่อสำเร็จเรียบร้อยแล้ว', record });
});

// Firestore Database Sync Handler
async function syncFromFirestore() {
  try {
    const fsUsers = await getAllFromFirestore<User>(COLLECTIONS.USERS);
    if (fsUsers && fsUsers.length > 0) {
      for (const u of fsUsers) {
        if (u && u.id) {
          users.set(u.id, u);
        }
      }
    } else {
      for (const u of users.values()) {
        await saveToFirestore(COLLECTIONS.USERS, u);
      }
    }

    const fsCourses = await getAllFromFirestore<Course>(COLLECTIONS.COURSES);
    if (fsCourses && fsCourses.length > 0) {
      for (const c of fsCourses) {
        if (c.courseCode === 'MTID204' || c.id === 'crs_mtid204') {
          console.log(`[Firestore Migration] Migrating course ${c.id} (${c.courseCode}) -> TEST101`);
          await deleteFromFirestore(COLLECTIONS.COURSES, c.id);
          const updatedCourse: Course = {
            ...c,
            id: 'crs_test101',
            courseCode: 'TEST101',
          };
          courses.set(updatedCourse.id, updatedCourse);
          await saveToFirestore(COLLECTIONS.COURSES, updatedCourse);
        } else {
          courses.set(c.id, c);
        }
      }
      courses.delete('crs_mtid204');
    } else {
      for (const c of courses.values()) {
        await saveToFirestore(COLLECTIONS.COURSES, c);
      }
    }

    const fsMembers = await getAllFromFirestore<CourseMember>(COLLECTIONS.COURSE_MEMBERS);
    if (fsMembers && fsMembers.length > 0) {
      courseMembers.length = 0;
      for (const cm of fsMembers) {
        if (cm.courseId === 'crs_mtid204') {
          cm.courseId = 'crs_test101';
          await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, cm);
        }
        courseMembers.push(cm);
      }
    } else {
      for (const cm of courseMembers) {
        await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, cm);
      }
    }

    const fsSessions = await getAllFromFirestore<Session>(COLLECTIONS.SESSIONS);
    if (fsSessions && fsSessions.length > 0) {
      for (const s of fsSessions) {
        if (s.courseId === 'crs_mtid204') {
          s.courseId = 'crs_test101';
          await saveToFirestore(COLLECTIONS.SESSIONS, s);
        }
        sessions.set(s.id, s);
      }
    } else {
      for (const s of sessions.values()) {
        await saveToFirestore(COLLECTIONS.SESSIONS, s);
      }
    }

    const fsAttendance = await getAllFromFirestore<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
    if (fsAttendance && fsAttendance.length > 0) {
      attendanceRecords.length = 0;
      attendanceRecords.push(...fsAttendance);
    } else {
      for (const ar of attendanceRecords) {
        await saveToFirestore(COLLECTIONS.ATTENDANCE, ar);
      }
    }

    const fsLeaves = await getAllFromFirestore<LeaveRequest>(COLLECTIONS.LEAVE_REQUESTS);
    if (fsLeaves && fsLeaves.length > 0) {
      leaveRequests.length = 0;
      leaveRequests.push(...fsLeaves);
    } else {
      for (const lr of leaveRequests) {
        await saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, lr);
      }
    }

    console.log('[Firestore Sync] Firestore database synchronized successfully.');
    const orphanSummary = await cleanOrphanedData();
    console.log('[Firestore Sync] Orphan cleanup summary:', JSON.stringify(orphanSummary));
  } catch (err) {
    console.error('[Firestore Sync Warning] Falling back to initial seed data:', err);
  }
}

// Mount Vite or static dist in express
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Student Attendance System running at http://0.0.0.0:${PORT}`);
    // Sync Firestore in background without blocking server startup
    syncFromFirestore().catch((err) => {
      console.error('[Firestore Initial Sync Error]', err);
    });
  });
}

startServer();
