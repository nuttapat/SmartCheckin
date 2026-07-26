import {
  User,
  Course,
  Session,
  AttendanceRecord,
  QuickEvent,
  InviteLink,
} from '../types';

export const API_BASE = '/api';

export async function fetchCurrentUser(userId?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
}

export async function registerUser(userData: Partial<User>): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function loginUser(email: string, password?: string, deviceId?: string): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function forgotPassword(email: string): Promise<{ message: string; email: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function updateUserProfile(
  userId: string,
  profileData: {
    title?: string;
    firstNameTh?: string;
    lastNameTh?: string;
    firstNameEn?: string;
    lastNameEn?: string;
    universityId?: string;
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/users/${userId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile');
  return data;
}

export async function googleLogin(
  email: string,
  name?: string,
  picture?: string,
  role?: string,
  title?: string,
  universityId?: string,
  firstNameTh?: string,
  lastNameTh?: string,
  firstNameEn?: string,
  lastNameEn?: string
): Promise<{ message: string; user?: User; requiresOnboarding?: boolean; email?: string; name?: string; picture?: string }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
      picture,
      role,
      title,
      universityId,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Google login failed');
  return data;
}

export async function fetchCourses(userId: string): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/courses`, {
    headers: { 'x-user-id': userId },
  });
  if (!res.ok) throw new Error('Failed to fetch courses');
  return res.json();
}

export async function createCourse(courseData: Partial<Course>): Promise<{ course: Course }> {
  const res = await fetch(`${API_BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create course');
  return data;
}

export async function updateCourse(courseId: string, courseData: Partial<Course>): Promise<{ course: Course; sessions: Session[] }> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update course');
  return data;
}

export async function fetchCourseDetails(courseId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}`);
  if (!res.ok) throw new Error('Failed to fetch course details');
  return res.json();
}

export async function activateSession(sessionId: string, lat: number, lng: number) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherLat: lat, teacherLng: lng }),
  });
  return res.json();
}

export async function deactivateSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/deactivate`, {
    method: 'POST',
  });
  return res.json();
}

export async function fetchActiveSessions() {
  const res = await fetch(`${API_BASE}/sessions/active`);
  if (!res.ok) throw new Error('Failed to fetch active sessions');
  return res.json();
}

export async function submitCheckin(params: {
  sessionId?: string;
  eventId?: string;
  qrToken?: string;
  studentId: string;
  scannedLat: number;
  scannedLng: number;
  deviceId: string;
  checkinMode?: 'QR_ONLY' | 'GPS_ONLY' | 'HYBRID';
}) {
  const url = params.eventId ? `${API_BASE}/checkin/quick` : `${API_BASE}/checkin`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Check-in failed');
  }
  return data;
}

export async function createQuickEvent(title: string, lat: number, lng: number, teacherId: string): Promise<QuickEvent> {
  const res = await fetch(`${API_BASE}/quick-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, teacherLat: lat, teacherLng: lng, teacherId }),
  });
  return res.json();
}

export async function generateInviteLink(courseId: string, role: string): Promise<InviteLink> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return res.json();
}

export async function joinCourseByInvite(code: string, userId: string) {
  const res = await fetch(`${API_BASE}/invites/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to join course');
  return data;
}

export async function submitTeacherCheckin(params: {
  teacherId: string;
  courseId?: string;
  sessionId?: string;
  lat: number;
  lng: number;
  deviceId: string;
  checkinMethod?: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID' | 'TOKEN';
  buildingRoom?: string;
  notes?: string;
}) {
  const res = await fetch(`${API_BASE}/teacher/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Teacher check-in failed');
  return data;
}

export async function fetchTeacherCheckinRecords(teacherId: string) {
  const res = await fetch(`${API_BASE}/teacher/checkin?teacherId=${teacherId}`);
  if (!res.ok) throw new Error('Failed to fetch teacher check-in records');
  return res.json();
}

export async function fetchStudentStats(studentId: string) {
  const res = await fetch(`${API_BASE}/student/${studentId}/stats`);
  if (!res.ok) throw new Error('Failed to fetch student stats');
  return res.json();
}

export async function fetchTeacherCoursesOverview(teacherId: string) {
  const res = await fetch(`${API_BASE}/teacher/courses-overview?teacherId=${teacherId}`);
  if (!res.ok) throw new Error('Failed to fetch teacher courses overview');
  return res.json();
}
