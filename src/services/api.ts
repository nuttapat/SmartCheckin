import {
  User,
  Course,
  Session,
  AttendanceRecord,
  QuickEvent,
  InviteLink,
  LeaveRequest,
  LeaveType,
  LeaveStatus,
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
  lastNameEn?: string,
  password?: string
): Promise<{ message: string; user?: User; requiresOnboarding?: boolean; forcedRole?: string | null; email?: string; name?: string; picture?: string }> {
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
      password,
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

export async function deleteCourseApi(courseId: string, teacherId: string, password?: string): Promise<{ message: string; courseId: string }> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete course');
  return data;
}

export async function fetchCourseDetails(courseId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}`);
  if (!res.ok) throw new Error('Failed to fetch course details');
  return res.json();
}

export async function activateSession(sessionId: string, lat: number, lng: number, isGpsCheckEnabled: boolean = true) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherLat: lat, teacherLng: lng, isGpsCheckEnabled }),
  });
  return res.json();
}

export async function toggleGpsCheck(targetId: string, isGpsCheckEnabled: boolean) {
  const res = await fetch(`${API_BASE}/sessions/${targetId}/gps-toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isGpsCheckEnabled }),
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
  deviceName?: string;
  deviceType?: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER';
  browser?: string;
  os?: string;
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

export async function createQuickEvent(title: string, lat: number, lng: number, teacherId: string, isGpsCheckEnabled: boolean = true): Promise<QuickEvent> {
  const res = await fetch(`${API_BASE}/quick-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, teacherLat: lat, teacherLng: lng, teacherId, isGpsCheckEnabled }),
  });
  return res.json();
}

export async function fetchTeachers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/teachers`);
  if (!res.ok) throw new Error('Failed to fetch teachers list');
  return res.json();
}

export async function fetchStudents(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/students`);
  if (!res.ok) throw new Error('Failed to fetch students list');
  return res.json();
}

export async function inviteStudentToCourse(courseId: string, studentUserId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/invite-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to invite student');
  return data;
}

export async function inviteTeacherToCourse(courseId: string, teacherUserId: string, role: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/invite-teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherUserId, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to invite teacher');
  return data;
}

export async function updateCourseMemberRole(courseId: string, memberId: string, role: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/${memberId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update member role');
  return data;
}

export async function removeCourseMember(courseId: string, memberId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/${memberId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove course member');
  return data;
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

export async function submitLeaveRequest(params: {
  studentId: string;
  courseId: string;
  weekNumber?: number;
  leaveType: LeaveType;
  leaveDate: string;
  endDate?: string;
  isMultiDay?: boolean;
  reason: string;
  attachmentUrl?: string;
  attachmentName?: string;
}): Promise<{ message: string; leaveRequest: LeaveRequest }> {
  const res = await fetch(`${API_BASE}/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit leave request');
  return data;
}

export async function fetchStudentLeaveRequests(studentId: string): Promise<LeaveRequest[]> {
  const res = await fetch(`${API_BASE}/leave-requests/student/${studentId}`);
  if (!res.ok) throw new Error('Failed to fetch student leave requests');
  return res.json();
}

export async function fetchTeacherLeaveRequests(teacherId: string): Promise<LeaveRequest[]> {
  const res = await fetch(`${API_BASE}/leave-requests/teacher/${teacherId}`);
  if (!res.ok) throw new Error('Failed to fetch teacher leave requests');
  return res.json();
}

export async function updateLeaveRequestStatus(
  leaveId: string,
  status: LeaveStatus,
  teacherComment?: string
): Promise<{ message: string; leaveRequest: LeaveRequest }> {
  const res = await fetch(`${API_BASE}/leave-requests/${leaveId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, teacherComment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update leave request status');
  return data;
}

export async function cancelLeaveRequest(leaveId: string): Promise<{ message: string; id: string }> {
  const res = await fetch(`${API_BASE}/leave-requests/${leaveId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel leave request');
  return data;
}

// --- ADMIN & REALTIME DATABASE INSPECTOR API ---

export async function fetchAdminDatabaseOverview() {
  const res = await fetch(`${API_BASE}/admin/database/overview`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch database overview');
  return data;
}

export async function fetchAdminCollection(collectionName: string) {
  const res = await fetch(`${API_BASE}/admin/database/collection/${collectionName}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to fetch collection ${collectionName}`);
  return data;
}

export async function saveAdminDocument(collectionName: string, docData: any) {
  const res = await fetch(`${API_BASE}/admin/database/document/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save document');
  return data;
}

export async function deleteAdminDocument(collectionName: string, docId: string) {
  const res = await fetch(`${API_BASE}/admin/database/document/${collectionName}/${docId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete document');
  return data;
}

export async function updateUserRole(userId: string, role: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user role');
  return data;
}

export async function resetUserDevice(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/devices/reset`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset user device');
  return data;
}

export async function getUserDevices(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/devices`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch user devices');
  return data;
}

export async function bindUserDeviceApi(userId: string, deviceInfo: {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}) {
  const res = await fetch(`${API_BASE}/users/${userId}/devices/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceInfo),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to bind device');
  return data;
}

export async function deleteUserDeviceApi(userId: string, devId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/devices/${devId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete device');
  return data;
}

export async function overrideAttendanceRecord(params: {
  studentId: string;
  sessionId?: string;
  eventId?: string;
  courseId?: string;
  status: string;
  checkinMethod?: string;
}) {
  const res = await fetch(`${API_BASE}/admin/attendance/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to override attendance');
  return data;
}

