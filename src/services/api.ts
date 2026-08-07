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

/**
 * Safely parses API responses to handle non-JSON / HTML error pages gracefully
 * and avoid raw SyntaxError exceptions like "Unexpected token '<', ...".
 */
async function parseResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const isHtml = text.trim().startsWith('<') || text.includes('<html>');
        if (isHtml) {
          data = { error: `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (${res.status} ${res.statusText || 'Error'})` };
        } else {
          data = { error: text.length > 250 ? `เกิดข้อผิดพลาดในการประมวลผล (${res.status})` : text };
        }
      }
    }
  }

  if (!res.ok) {
    const rawError = data?.error || data?.message || `เกิดข้อผิดพลาดในการทำรายการ (${res.status})`;
    const cleanError = typeof rawError === 'string' && (rawError.includes('Unexpected token') || rawError.includes('is not valid JSON'))
      ? `เกิดข้อผิดพลาดในการเชื่อมต่อระบบ (${res.status})`
      : rawError;
    throw new Error(cleanError);
  }

  return data as T;
}

export async function fetchCurrentUser(userId?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
  return parseResponse<User>(res);
}

export async function registerUser(userData: Partial<User>): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return parseResponse<{ message: string; user: User }>(res);
}

export async function loginUser(email: string, password?: string, deviceId?: string): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceId }),
  });
  return parseResponse<{ message: string; user: User }>(res);
}

export async function forgotPassword(email: string): Promise<{ message: string; email: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ message: string; email: string }>(res);
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
    isGoogleOrFirstPasswordSet?: boolean;
  }
): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/users/${userId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });
  return parseResponse<{ message: string; user: User }>(res);
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
  return parseResponse(res);
}

export async function fetchCourses(userId: string): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/courses`, {
    headers: { 'x-user-id': userId },
  });
  return parseResponse<Course[]>(res);
}

export async function createCourse(courseData: Partial<Course>): Promise<{ course: Course }> {
  const res = await fetch(`${API_BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData),
  });
  return parseResponse<{ course: Course }>(res);
}

export async function updateCourse(courseId: string, courseData: Partial<Course>): Promise<{ course: Course; sessions: Session[] }> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData),
  });
  return parseResponse<{ course: Course; sessions: Session[] }>(res);
}

export async function deleteCourseApi(courseId: string, teacherId: string, password?: string): Promise<{ message: string; courseId: string }> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId, password }),
  });
  return parseResponse<{ message: string; courseId: string }>(res);
}

export async function fetchCourseDetails(courseId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}`);
  return parseResponse(res);
}

export async function activateSession(
  sessionId: string,
  lat: number,
  lng: number,
  isGpsCheckEnabled: boolean = true,
  sessionDurationMinutes: number = 30,
  lateThresholdMinutes: number = 15,
  isStaticQr: boolean = false,
  qrRefreshIntervalSeconds: number = 30
) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherLat: lat,
      teacherLng: lng,
      isGpsCheckEnabled,
      sessionDurationMinutes,
      lateThresholdMinutes,
      isStaticQr,
      qrRefreshIntervalSeconds,
    }),
  });
  return parseResponse(res);
}

export async function toggleGpsCheck(targetId: string, isGpsCheckEnabled: boolean) {
  const res = await fetch(`${API_BASE}/sessions/${targetId}/gps-toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isGpsCheckEnabled }),
  });
  return parseResponse(res);
}

export async function toggleQrMode(targetId: string, isStatic: boolean) {
  const res = await fetch(`${API_BASE}/sessions/${targetId}/qr-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isStatic }),
  });
  return parseResponse(res);
}

export async function updateQrInterval(targetId: string, qrRefreshIntervalSeconds: number) {
  const res = await fetch(`${API_BASE}/sessions/${targetId}/qr-interval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrRefreshIntervalSeconds }),
  });
  return parseResponse(res);
}

export async function deactivateSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/deactivate`, {
    method: 'POST',
  });
  return parseResponse(res);
}

export async function fetchActiveSessions() {
  const res = await fetch(`${API_BASE}/sessions/active`);
  return parseResponse(res);
}

export async function submitCheckin(params: {
  sessionId?: string;
  eventId?: string;
  qrToken?: string;
  studentId: string;
  scannedLat?: number;
  scannedLng?: number;
  deviceId: string;
  deviceName?: string;
  deviceType?: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER';
  browser?: string;
  os?: string;
  checkinMode?: 'QR_ONLY' | 'GPS_ONLY' | 'HYBRID' | 'TOKEN';
}) {
  const url = params.eventId ? `${API_BASE}/checkin/quick` : `${API_BASE}/checkin`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseResponse(res);
}

export async function createQuickEvent(title: string, lat: number, lng: number, teacherId: string, isGpsCheckEnabled: boolean = true): Promise<QuickEvent> {
  const res = await fetch(`${API_BASE}/quick-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, teacherLat: lat, teacherLng: lng, teacherId, isGpsCheckEnabled }),
  });
  return parseResponse<QuickEvent>(res);
}

export async function fetchTeachers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/teachers`);
  return parseResponse<User[]>(res);
}

export async function fetchStudents(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/students`);
  return parseResponse<User[]>(res);
}

export async function inviteStudentToCourse(courseId: string, studentUserId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/invite-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentUserId }),
  });
  return parseResponse(res);
}

export async function inviteStudentsBatchToCourse(courseId: string, studentUserIds: string[]) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/invite-students-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentUserIds }),
  });
  return parseResponse<{ message: string; addedCount: number; updatedCount: number; total: number }>(res);
}

export async function inviteTeacherToCourse(courseId: string, teacherUserId: string, role: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/invite-teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherUserId, role }),
  });
  return parseResponse(res);
}

export async function updateCourseMemberRole(courseId: string, memberId: string, role: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/${memberId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return parseResponse(res);
}

export async function removeCourseMember(courseId: string, memberId: string) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/${memberId}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
}

export async function removeCourseMembersBatch(courseId: string, memberIds: string[]) {
  const res = await fetch(`${API_BASE}/courses/${courseId}/members/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberIds }),
  });
  return parseResponse(res);
}

export async function generateInviteLink(courseId: string, role: string): Promise<InviteLink> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return parseResponse<InviteLink>(res);
}

export async function joinCourseByInvite(code: string, userId: string) {
  const res = await fetch(`${API_BASE}/invites/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, userId }),
  });
  return parseResponse(res);
}

export async function submitTeacherCheckin(params: {
  teacherId: string;
  courseId?: string;
  sessionId?: string;
  lat?: number;
  lng?: number;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  checkinMethod?: 'GPS_ONLY' | 'QR_ONLY' | 'HYBRID' | 'TOKEN';
  qrToken?: string;
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
  try {
    const res = await fetch(`${API_BASE}/admin/database/overview`);
    return await parseResponse(res);
  } catch (err: any) {
    console.warn('fetchAdminDatabaseOverview failed, using fallback metrics:', err);
    return {
      timestamp: new Date().toISOString(),
      collections: {
        users: 0,
        courses: 0,
        courseMembers: 0,
        sessions: 0,
        attendanceRecords: 0,
        teacherAttendanceRecords: 0,
        leaveRequests: 0,
        quickEvents: 0,
        activeQRCodes: 0,
      },
      system: {
        uptime: 0,
        nodeEnv: 'development',
        port: 3000,
      },
    };
  }
}

export async function fetchAdminCollection(collectionName: string) {
  try {
    const res = await fetch(`${API_BASE}/admin/database/collection/${collectionName}`);
    return await parseResponse(res);
  } catch (err: any) {
    console.warn(`fetchAdminCollection ${collectionName} failed:`, err);
    return { collection: collectionName, documents: [], total: 0 };
  }
}

export async function saveAdminDocument(collectionName: string, docData: any) {
  const res = await fetch(`${API_BASE}/admin/database/document/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData),
  });
  return parseResponse(res);
}

export async function deleteAdminDocument(collectionName: string, docId: string) {
  const res = await fetch(`${API_BASE}/admin/database/document/${collectionName}/${docId}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
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

export async function adminResetUserPassword(userId: string, newPassword: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  return data;
}

export async function adminUpdateUserDetails(userId: string, userDetails: any) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/details`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userDetails),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user details');
  return data;
}

export async function adminToggleUserStatus(userId: string, isSuspended: boolean, suspendedReason?: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isSuspended, suspendedReason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to change user status');
  return data;
}

export async function adminDeleteUser(userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
}

export async function adminBulkUserRole(userIds: string[], role: string) {
  const res = await fetch(`${API_BASE}/admin/users/bulk-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to perform bulk role update');
  return data;
}

export async function adminBulkUserStatus(userIds: string[], isSuspended: boolean, suspendedReason?: string) {
  const res = await fetch(`${API_BASE}/admin/users/bulk-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, isSuspended, suspendedReason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to perform bulk status update');
  return data;
}

export async function adminBulkDeleteUsers(userIds: string[]) {
  const res = await fetch(`${API_BASE}/admin/users/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to perform bulk delete');
  return data;
}

export async function adminBulkResetDevices(userIds: string[]) {
  const res = await fetch(`${API_BASE}/admin/users/bulk-reset-devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to perform bulk device reset');
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
  const targetDevId = devId || '';

  // Try POST endpoint first to prevent URL encoding path issues in iframe/sandboxed environments
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/devices/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devId: targetDevId, targetId: targetDevId, deviceId: targetDevId }),
    });
    const data = await res.json();
    if (res.ok) return data;
  } catch (err) {
    console.warn('POST device delete failed, trying DELETE fallback', err);
  }

  // Fallback DELETE endpoint
  const res = await fetch(`${API_BASE}/users/${userId}/devices/${encodeURIComponent(targetDevId)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'ไม่สามารถยกเลิกการผูกอุปกรณ์ได้');
  return data;
}

export async function overrideAttendanceRecord(params: {
  studentId: string;
  sessionId?: string;
  eventId?: string;
  courseId?: string;
  weekNumber?: number;
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

// System Settings API
export async function fetchSystemSettings() {
  try {
    const res = await fetch(`${API_BASE}/system/settings`);
    return await parseResponse(res);
  } catch (err) {
    return {
      id: 'global_config',
      academicYear: 2569,
      academicSemester: 'FIRST',
      defaultGpsRadiusMeters: 100,
      dynamicQrIntervalSeconds: 30,
      maintenanceMode: false,
      systemMaintenanceMode: false,
      maintenanceMessage: 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก',
      announcementMessage: '',
      systemAnnouncement: '',
      allowGoogleAutoRegister: true,
      maxDevicesPerUser: 1,
      singleDeviceLockEnabled: true,
      allowTeacherSelfRegister: true,
      allowStudentSelfRegister: true,
      allowOtherDomainsSelfRegister: false,
      allowOtherDomains: false,
      teacherDomains: ['mahidol.ac.th', 'mahidol.edu'],
      studentDomains: ['student.mahidol.ac.th', 'student.mahidol.edu'],
      teacherDomain: 'mahidol.ac.th, mahidol.edu',
      studentDomain: 'student.mahidol.ac.th, student.mahidol.edu',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }
}

export async function updateSystemSettings(settings: any) {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return parseResponse(res);
}

// Master Departments API
export async function fetchMasterDepartments() {
  const res = await fetch(`${API_BASE}/admin/master/departments`);
  return parseResponse(res);
}

export async function saveMasterDepartment(dep: any) {
  const res = await fetch(`${API_BASE}/admin/master/departments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dep),
  });
  return parseResponse(res);
}

export async function deleteMasterDepartment(id: string) {
  const res = await fetch(`${API_BASE}/admin/master/departments/${id}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
}

// Master Curriculums API
export async function fetchMasterCurriculums() {
  const res = await fetch(`${API_BASE}/admin/master/curriculums`);
  return parseResponse(res);
}

export async function saveMasterCurriculum(curr: any) {
  const res = await fetch(`${API_BASE}/admin/master/curriculums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(curr),
  });
  return parseResponse(res);
}

export async function deleteMasterCurriculum(id: string) {
  const res = await fetch(`${API_BASE}/admin/master/curriculums/${id}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
}

// Master Prefixes API
export async function fetchMasterPrefixes() {
  const res = await fetch(`${API_BASE}/admin/master/prefixes`);
  return parseResponse(res);
}

export async function saveMasterPrefix(prefix: any) {
  const res = await fetch(`${API_BASE}/admin/master/prefixes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefix),
  });
  return parseResponse(res);
}

export async function deleteMasterPrefix(id: string) {
  const res = await fetch(`${API_BASE}/admin/master/prefixes/${id}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
}

// Backup & Data Security API
export async function fetchSystemBackups() {
  const res = await fetch(`${API_BASE}/admin/backups`);
  return parseResponse(res);
}

export async function createSystemBackup(label?: string) {
  const res = await fetch(`${API_BASE}/admin/backups/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  return parseResponse(res);
}

export async function restoreSystemBackup(backupId: string) {
  const res = await fetch(`${API_BASE}/admin/backups/restore/${backupId}`, {
    method: 'POST',
  });
  return parseResponse(res);
}

export async function deleteSystemBackup(backupId: string) {
  const res = await fetch(`${API_BASE}/admin/backups/${backupId}`, {
    method: 'DELETE',
  });
  return parseResponse(res);
}

export async function triggerAutoHealDatabase() {
  const res = await fetch(`${API_BASE}/admin/database/auto-heal`, {
    method: 'POST',
  });
  return parseResponse(res);
}



