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
} from './src/types.js';
import { saveToFirestore, getAllFromFirestore, COLLECTIONS } from './src/lib/firebaseStore.js';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// --- IN-MEMORY DATABASE & SEED DATA ---
const users: Map<string, User> = new Map();
const courses: Map<string, Course> = new Map();
const courseMembers: CourseMember[] = [];
const sessions: Map<string, Session> = new Map();
const attendanceRecords: AttendanceRecord[] = [];
const teacherAttendanceRecords: TeacherAttendanceRecord[] = [];
const quickEvents: Map<string, QuickEvent> = new Map();
const inviteLinks: Map<string, InviteLink> = new Map();

// Dynamic QR Tokens: sessionId/eventId -> { token, expiresAt, lat, lng }
interface ActiveQR {
  token: string;
  expiresAt: number;
  lat: number;
  lng: number;
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

users.set(teacherUser.id, teacherUser);
users.set(coTeacherUser.id, coTeacherUser);
users.set(studentUser1.id, studentUser1);
users.set(studentUser2.id, studentUser2);

// Seed Initial Course: MTID204
const sampleCourse: Course = {
  id: 'crs_mtid204',
  courseCode: 'MTID204',
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

// Periodic Dynamic QR Code Refresher (every 5 seconds)
setInterval(() => {
  const now = Date.now();
  // Loop active sessions
  sessions.forEach((session, sId) => {
    if (session.isActive) {
      const newToken = crypto.randomUUID();
      const expiresAt = now + 8000; // valid for 8 seconds
      const qrData: ActiveQR = {
        token: newToken,
        expiresAt,
        lat: session.teacherLat,
        lng: session.teacherLng,
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
      const newToken = crypto.randomUUID();
      const expiresAt = now + 8000;
      const qrData: ActiveQR = {
        token: newToken,
        expiresAt,
        lat: qEvent.teacherLat,
        lng: qEvent.teacherLng,
      };
      activeQRCodes.set(eId, qrData);

      activeWsClients.forEach((client) => {
        if (client.eventId === eId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
        }
      });
    }
  });
}, 5000);

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

  // Update device ID if provided
  if (deviceId && !user.deviceId) {
    user.deviceId = deviceId;
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
  const { email, name, picture, role } = req.body || {};
  const userEmail = (email || `user_${Math.floor(1000 + Math.random() * 9000)}@university.ac.th`).toString().trim().toLowerCase();

  let user = Array.from(users.values()).find((u) => u.email && u.email.toLowerCase() === userEmail);

  if (!user) {
    const parts = (name || 'Google User').toString().trim().split(' ');
    user = {
      id: `usr_g_${Date.now()}`,
      role: role || UserRole.STUDENT,
      title: role === UserRole.TEACHER ? 'อ.ดร.' : 'นาย',
      firstNameTh: parts[0] || 'กิตติ',
      lastNameTh: parts[1] || 'มั่งคั่ง',
      firstNameEn: parts[0] || 'Kitti',
      lastNameEn: parts[1] || 'Mungkung',
      universityId: `660${Math.floor(1000 + Math.random() * 9000)}`,
      email: userEmail,
      avatarUrl: picture || 'https://lh3.googleusercontent.com/a/default-user',
      deviceId: `dev_g_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.set(user.id, user);
    saveToFirestore(COLLECTIONS.USERS, user);
  }

  res.json({ message: 'Google Auth successful', user });
});

app.get('/api/users/me', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = users.get(userId) || teacherUser; // default to teacher if unset
  res.json(user);
});

// 2. Course Management
app.get('/api/courses', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = users.get(userId);

  let result = Array.from(courses.values());

  if (user && user.role === UserRole.STUDENT) {
    const enrolledCourseIds = courseMembers
      .filter((m) => m.userId === userId && m.role === CourseMemberRole.STUDENT)
      .map((m) => m.courseId);
    result = result.filter((c) => enrolledCourseIds.includes(c.id));
  }

  res.json(result);
});

app.post('/api/courses', (req, res) => {
  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks, ownerId } = req.body;

  if (!courseCode || !courseName) {
    return res.status(400).json({ error: 'Course code and name are required.' });
  }

  const owner = users.get(ownerId) || teacherUser;

  const newCourse: Course = {
    id: `crs_${Date.now()}`,
    courseCode,
    courseName,
    academicYear: parseInt(academicYear, 10) || 2569,
    semester: semester || Semester.FIRST,
    coordinatorName: coordinatorName || owner.firstNameTh + ' ' + owner.lastNameTh,
    ownerId: owner.id,
    ownerName: `${owner.title} ${owner.firstNameTh} ${owner.lastNameTh}`,
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
      teacherLat: 13.7563, // Default latitude (Bangkok campus)
      teacherLng: 100.5018, // Default longitude
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

  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks } = req.body;

  if (courseCode) course.courseCode = courseCode;
  if (courseName) course.courseName = courseName;
  if (academicYear) course.academicYear = parseInt(academicYear, 10);
  if (semester) course.semester = semester;
  if (coordinatorName) course.coordinatorName = coordinatorName;

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
        sessions.set(existingSession.id, existingSession);
      } else {
        const newSesId = `ses_${courseId}_w${w.weekNumber}_${Date.now()}`;
        sessions.set(newSesId, {
          id: newSesId,
          courseId,
          weekNumber: w.weekNumber,
          topic: w.topic,
          teacherLat: 13.7563,
          teacherLng: 100.5018,
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

// Invite link generation & acceptance
app.post('/api/courses/:id/invite', (req, res) => {
  const { role } = req.body;
  const courseId = req.params.id;
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();

  const invite: InviteLink = {
    id: `inv_${Date.now()}`,
    courseId,
    role: role === 'CO_TEACHER' ? CourseMemberRole.CO_TEACHER : CourseMemberRole.STUDENT,
    code,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  inviteLinks.set(code, invite);
  res.json(invite);
});

app.post('/api/invites/join', (req, res) => {
  const { code, userId } = req.body;
  const invite = inviteLinks.get(code?.toUpperCase());

  if (!invite) {
    return res.status(404).json({ error: 'Invalid or expired invite code.' });
  }

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Check if already member
  const exists = courseMembers.some((m) => m.courseId === invite.courseId && m.userId === userId);
  if (exists) {
    return res.status(400).json({ error: 'Already enrolled in this course.' });
  }

  const newMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId: invite.courseId,
    userId,
    role: invite.role,
    joinedAt: new Date().toISOString(),
  };

  courseMembers.push(newMember);
  saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);

  res.json({ message: 'Successfully joined course!', courseId: invite.courseId });
});

// 3. Active Session & Dynamic QR Management
app.post('/api/sessions/:id/activate', (req, res) => {
  const { teacherLat, teacherLng } = req.body;
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.isActive = true;
  if (teacherLat && teacherLng) {
    session.teacherLat = parseFloat(teacherLat);
    session.teacherLng = parseFloat(teacherLng);
  }

  // Generate immediate active QR token
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 8000;
  activeQRCodes.set(session.id, {
    token,
    expiresAt,
    lat: session.teacherLat,
    lng: session.teacherLng,
  });

  res.json({ message: 'Session QR code activated', session, qrToken: token, expiresAt });
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

  // Mode validation: QR_ONLY or HYBRID requires valid active QR token
  if (checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID') {
    if (!qrToken) {
      return res.status(400).json({ error: 'QR Token is required for QR code check-in.' });
    }
    if (!activeQR || activeQR.token !== qrToken) {
      return res.status(400).json({ error: 'Expired QR code! Please scan the live refreshing QR on the screen.' });
    }
  }

  // Anti-Proxy Mechanism 1: Device Binding
  if (student.deviceId && deviceId && student.deviceId !== deviceId) {
    return res.status(403).json({
      error: `[Anti-Proxy] Device Mismatch! This student account is bound to another physical mobile device (${student.deviceId.slice(0, 8)}...). Checking in for another person is strictly prohibited.`,
    });
  }

  if (!student.deviceId && deviceId) {
    student.deviceId = deviceId;
  }

  // Geofence Distance Calculation
  const lat1 = activeQR ? activeQR.lat : session.teacherLat;
  const lon1 = activeQR ? activeQR.lng : session.teacherLng;
  const lat2 = parseFloat(scannedLat || lat1);
  const lon2 = parseFloat(scannedLng || lon1);

  const distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);

  // Mode validation: GPS_ONLY or HYBRID requires <= 50m geofence radius
  if (checkinMode === 'GPS_ONLY' || checkinMode === 'HYBRID') {
    if (distanceMeters > 50) {
      return res.status(400).json({
        error: `[GPS Geofence Failed] คุณอยู่ห่างจากห้องเรียน ${distanceMeters} เมตร (อนุญาตไม่เกิน 50 เมตร)`,
        distanceMeters,
        allowedRadius: 50,
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
  const { title, teacherId, teacherLat, teacherLng } = req.body;
  const newEvent: QuickEvent = {
    id: `evt_${Date.now()}`,
    title: title || 'Ad-hoc Quick Attendance Event',
    teacherId: teacherId || teacherUser.id,
    teacherLat: parseFloat(teacherLat) || 13.7563,
    teacherLng: parseFloat(teacherLng) || 100.5018,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  quickEvents.set(newEvent.id, newEvent);

  // Active QR Token
  const token = crypto.randomUUID();
  activeQRCodes.set(newEvent.id, {
    token,
    expiresAt: Date.now() + 8000,
    lat: newEvent.teacherLat,
    lng: newEvent.teacherLng,
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

  const activeQR = activeQRCodes.get(eventId);
  if (!activeQR || activeQR.token !== qrToken) {
    return res.status(400).json({ error: 'Invalid or expired event QR code.' });
  }

  const distanceMeters = getHaversineDistance(
    activeQR.lat,
    activeQR.lng,
    parseFloat(scannedLat || activeQR.lat),
    parseFloat(scannedLng || activeQR.lng)
  );

  if (distanceMeters > 50) {
    return res.status(400).json({
      error: `[Geofence Violation] Distance: ${distanceMeters}m (Max allowed: 50m).`,
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
      const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.studentId === st.id);
      if (rec) {
        attendedCount++;
        weekCols += `,PRESENT (${new Date(rec.timestamp).toLocaleTimeString()})`;
      } else {
        weekCols += `,ABSENT`;
      }
    });

    const total = courseSessions.length || 1;
    const rate = Math.round((attendedCount / total) * 100);

    csv += `"${st.universityId}","${st.title}","${st.firstNameTh} ${st.lastNameTh}","${st.firstNameEn} ${st.lastNameEn}","${st.email}"${weekCols},${attendedCount},${total},${rate}%\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance_${course.courseCode}_${Date.now()}.csv"`
  );
  // Add UTF-8 BOM for Thai character encoding in Excel
  res.send('\uFEFF' + csv);
});

// Student Dashboard Stats endpoint
app.get('/api/student/:studentId/stats', (req, res) => {
  const studentId = req.params.studentId;
  const enrolledCourseIds = courseMembers
    .filter((cm) => cm.userId === studentId && cm.role === CourseMemberRole.STUDENT)
    .map((cm) => cm.courseId);

  const studentCourses = enrolledCourseIds.map((id) => courses.get(id)).filter(Boolean) as Course[];

  const courseStats = studentCourses.map((c) => {
    const cSessions = Array.from(sessions.values()).filter((s) => s.courseId === c.id);
    const attended = cSessions.filter((s) =>
      attendanceRecords.some((r) => r.sessionId === s.id && r.studentId === studentId)
    );

    const total = cSessions.length || 1;
    const percentage = Math.round((attended.length / total) * 100);

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
        attendedSessions: attended.length,
        lateSessions: 0,
        absentSessions: cSessions.length - attended.length,
        percentage,
        statusColor,
      },
      pastCheckins,
    };
  });

  res.json(courseStats);
});

// Firestore Database Sync Handler
async function syncFromFirestore() {
  try {
    const fsUsers = await getAllFromFirestore<User>(COLLECTIONS.USERS);
    if (fsUsers && fsUsers.length > 0) {
      fsUsers.forEach((u) => users.set(u.id, u));
    } else {
      for (const u of users.values()) {
        await saveToFirestore(COLLECTIONS.USERS, u);
      }
    }

    const fsCourses = await getAllFromFirestore<Course>(COLLECTIONS.COURSES);
    if (fsCourses && fsCourses.length > 0) {
      fsCourses.forEach((c) => courses.set(c.id, c));
    } else {
      for (const c of courses.values()) {
        await saveToFirestore(COLLECTIONS.COURSES, c);
      }
    }

    const fsMembers = await getAllFromFirestore<CourseMember>(COLLECTIONS.COURSE_MEMBERS);
    if (fsMembers && fsMembers.length > 0) {
      courseMembers.length = 0;
      courseMembers.push(...fsMembers);
    } else {
      for (const cm of courseMembers) {
        await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, cm);
      }
    }

    const fsSessions = await getAllFromFirestore<Session>(COLLECTIONS.SESSIONS);
    if (fsSessions && fsSessions.length > 0) {
      fsSessions.forEach((s) => sessions.set(s.id, s));
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

    console.log('[Firestore Sync] Firestore database synchronized successfully.');
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
