import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  User,
  UserRole,
  Course,
  TeachingWeek,
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
  SystemSettings,
  MasterDepartment,
  MasterPrefix,
  MasterCurriculum,
  MasterUniversity,
  MasterFaculty,
  MasterMajor,
  MasterDegreeLevel,
  NotificationItem,
} from './src/types.js';
import { saveToFirestore, batchSaveToFirestore, getAllFromFirestore, deleteFromFirestore, COLLECTIONS } from './src/lib/firebaseStore.js';

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
const masterUniversities: Map<string, MasterUniversity> = new Map();
const masterFaculties: Map<string, MasterFaculty> = new Map();
const masterDepartments: Map<string, MasterDepartment> = new Map();
const masterCurriculums: Map<string, MasterCurriculum> = new Map();
const masterPrefixes: Map<string, MasterPrefix> = new Map();
const notifications: Map<string, NotificationItem> = new Map();
// Pointer mapping for merged accounts (secondaryUserId -> primaryUserId)
const mergedUserPointers: Map<string, string> = new Map();

// Helper to resolve an active user, chasing merge pointers if necessary
export function resolveActiveUser(userId?: string): User | undefined {
  if (!userId) return undefined;
  const cleanId = String(userId).trim();

  // 1. Direct hit in active users
  const direct = users.get(cleanId);
  if (direct) return direct;

  // 2. Chase pointer chain
  let currentId: string | undefined = cleanId;
  const visited = new Set<string>();
  while (currentId && mergedUserPointers.has(currentId)) {
    if (visited.has(currentId)) break; // Prevent circular reference
    visited.add(currentId);
    currentId = mergedUserPointers.get(currentId);
    if (currentId && users.has(currentId)) {
      return users.get(currentId);
    }
  }

  // 3. Fallback: Lookup by email or university ID
  const allUsers = Array.from(users.values());
  const byEmail = allUsers.find(
    (u) =>
      (u.email && u.email.toLowerCase() === cleanId.toLowerCase()) ||
      (Array.isArray(u.emailAliases) && u.emailAliases.some((a) => a.toLowerCase() === cleanId.toLowerCase()))
  );
  if (byEmail) return byEmail;

  const byUniId = allUsers.find((u) => u.universityId && u.universityId.trim() === cleanId);
  if (byUniId) return byUniId;

  return undefined;
}

/**
 * Deduplicates course members list, resolving any merged accounts to primary accounts
 * and eliminating duplicate course enrollment entries while preserving highest role privilege.
 */
export async function deduplicateCourseMembers(): Promise<number> {
  const seen = new Map<string, CourseMember>();
  const toDeleteIds: string[] = [];

  const rolePriority: Record<string, number> = {
    [CourseMemberRole.COORDINATOR]: 4,
    [CourseMemberRole.CO_TEACHER]: 3,
    [CourseMemberRole.CO_COORDINATOR]: 3,
    [CourseMemberRole.INSTRUCTOR]: 2,
    [CourseMemberRole.STUDENT]: 1,
  };

  for (const cm of courseMembers) {
    if (!cm || !cm.id || !cm.courseId || !cm.userId) continue;

    // Resolve active userId in case it was merged
    const resolvedUser = resolveActiveUser(cm.userId);
    const effectiveUserId = resolvedUser ? resolvedUser.id : cm.userId;
    const key = `${cm.courseId}_${effectiveUserId}`;

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if ((rolePriority[cm.role] || 0) > (rolePriority[existing.role] || 0)) {
        toDeleteIds.push(existing.id);
        seen.set(key, { ...cm, userId: effectiveUserId });
      } else {
        toDeleteIds.push(cm.id);
      }
    } else {
      seen.set(key, { ...cm, userId: effectiveUserId });
    }
  }

  courseMembers.length = 0;
  courseMembers.push(...seen.values());

  if (toDeleteIds.length > 0) {
    for (const delId of toDeleteIds) {
      deletedMemberIds.add(delId);
      await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, delId).catch(() => {});
    }
  }
  return toDeleteIds.length;
}

// Universal User Resolution Express Middleware
app.use((req, _res, next) => {
  const headerUserId = req.headers['x-user-id'] as string;
  if (headerUserId) {
    const resolved = resolveActiveUser(headerUserId);
    if (resolved) {
      req.headers['x-user-id'] = resolved.id;
      (req as any).user = resolved;
    }
  }
  next();
});

// --- LOCAL PERSISTENCE & TOMBSTONE TRACKING ENGINE ---
const LOCAL_CACHE_PATH = path.join(process.cwd(), 'local_db_cache.json');
const deletedCourseIds = new Set<string>();
const deletedMemberIds = new Set<string>();
const deletedSessionIds = new Set<string>();
const deletedUserIds = new Set<string>();
const deletedLeaveIds = new Set<string>();
const deletedAttendanceIds = new Set<string>();
const deletedQuickEventIds = new Set<string>();

export function saveLocalCache() {
  try {
    const data = {
      users: Array.from(users.values()),
      courses: Array.from(courses.values()),
      courseMembers,
      sessions: Array.from(sessions.values()),
      attendanceRecords,
      teacherAttendanceRecords,
      quickEvents: Array.from(quickEvents.values()),
      inviteLinks: Array.from(inviteLinks.values()),
      leaveRequests,
      masterUniversities: Array.from(masterUniversities.values()),
      masterFaculties: Array.from(masterFaculties.values()),
      masterDepartments: Array.from(masterDepartments.values()),
      masterCurriculums: Array.from(masterCurriculums.values()),
      masterPrefixes: Array.from(masterPrefixes.values()),
      notifications: Array.from(notifications.values()),
      mergedUserPointers: Array.from(mergedUserPointers.entries()),
      systemSettings,
      deletedCourseIds: Array.from(deletedCourseIds),
      deletedMemberIds: Array.from(deletedMemberIds),
      deletedSessionIds: Array.from(deletedSessionIds),
      deletedUserIds: Array.from(deletedUserIds),
      deletedLeaveIds: Array.from(deletedLeaveIds),
      deletedAttendanceIds: Array.from(deletedAttendanceIds),
      deletedQuickEventIds: Array.from(deletedQuickEventIds),
    };
    fs.writeFileSync(LOCAL_CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Local Cache Save Error]', err);
  }
}

export async function saveTombstonesToFirestore() {
  try {
    await saveToFirestore(COLLECTIONS.SYSTEM_SETTINGS, {
      id: 'tombstones',
      deletedCourseIds: Array.from(deletedCourseIds),
      deletedMemberIds: Array.from(deletedMemberIds),
      deletedSessionIds: Array.from(deletedSessionIds),
      deletedUserIds: Array.from(deletedUserIds),
      deletedLeaveIds: Array.from(deletedLeaveIds),
      deletedAttendanceIds: Array.from(deletedAttendanceIds),
      deletedQuickEventIds: Array.from(deletedQuickEventIds),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Save Tombstones Error]', err);
  }
}

export function seedDefaultMasterData() {
  if (masterUniversities.size === 0) {
    const defaultUnivs: MasterUniversity[] = [
      { id: 'univ_mu', code: 'MU', nameTh: 'มหาวิทยาลัยมหิดล', nameEn: 'Mahidol University' },
      { id: 'univ_cu', code: 'CU', nameTh: 'จุฬาลงกรณ์มหาวิทยาลัย', nameEn: 'Chulalongkorn University' },
      { id: 'univ_ku', code: 'KU', nameTh: 'มหาวิทยาลัยเกษตรศาสตร์', nameEn: 'Kasetsart University' },
      { id: 'univ_cmu', code: 'CMU', nameTh: 'มหาวิทยาลัยเชียงใหม่', nameEn: 'Chiang Mai University' },
      { id: 'univ_kku', code: 'KKU', nameTh: 'มหาวิทยาลัยขอนแก่น', nameEn: 'Khon Kaen University' },
      { id: 'univ_psu', code: 'PSU', nameTh: 'มหาวิทยาลัยสงขลานครินทร์', nameEn: 'Prince of Songkla University' },
    ];
    defaultUnivs.forEach((u) => {
      masterUniversities.set(u.id, u);
      saveToFirestore(COLLECTIONS.MASTER_UNIVERSITIES, u);
    });
  }

  if (masterFaculties.size === 0) {
    const defaultFacs: MasterFaculty[] = [
      { id: 'fac_mt', universityId: 'univ_mu', code: 'MT', nameTh: 'คณะเทคนิคการแพทย์', nameEn: 'Faculty of Medical Technology' },
      { id: 'fac_ns', universityId: 'univ_mu', code: 'NS', nameTh: 'คณะพยาบาลศาสตร์', nameEn: 'Faculty of Nursing' },
      { id: 'fac_ph', universityId: 'univ_mu', code: 'PH', nameTh: 'คณะสาธารณสุขศาสตร์', nameEn: 'Faculty of Public Health' },
      { id: 'fac_sc', universityId: 'univ_mu', code: 'SC', nameTh: 'คณะวิทยาศาสตร์', nameEn: 'Faculty of Science' },
      { id: 'fac_eg', universityId: 'univ_mu', code: 'EG', nameTh: 'คณะวิศวกรรมศาสตร์', nameEn: 'Faculty of Engineering' },
      { id: 'fac_si', universityId: 'univ_mu', code: 'SI', nameTh: 'คณะแพทยศาสตร์ศิริราชพยาบาล', nameEn: 'Faculty of Medicine Siriraj Hospital' },
      { id: 'fac_ra', universityId: 'univ_mu', code: 'RA', nameTh: 'คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี', nameEn: 'Faculty of Medicine Ramathibodi Hospital' },
    ];
    defaultFacs.forEach((f) => {
      masterFaculties.set(f.id, f);
      saveToFirestore(COLLECTIONS.MASTER_FACULTIES, f);
    });
  }

  if (masterDepartments.size === 0) {
    const defaultDeps: MasterDepartment[] = [
      { id: 'dep_ch', code: 'CH', nameTh: 'ภาควิชาเคมีคลินิก', nameEn: 'Department of Clinical Chemistry', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
      { id: 'dep_mi', code: 'MI', nameTh: 'ภาควิชาจุลชีววิทยาคลินิก', nameEn: 'Department of Clinical Microbiology', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
      { id: 'dep_ms', code: 'MS', nameTh: 'ภาควิชาเวชศาสตร์การบริการโลหิตและจุลทรรศนศาสตร์คลินิก', nameEn: 'Department of Transfusion Medicine and Clinical Microbiology', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
      { id: 'dep_cm', code: 'CM', nameTh: 'ภาควิชาจุลทรรศนศาสตร์คลินิก', nameEn: 'Department of Clinical Microscopy', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
      { id: 'dep_rt', code: 'RT', nameTh: 'ภาควิชารังสีเทคนิค', nameEn: 'Department of Radiological Technology', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
      { id: 'dep_id', code: 'ID', nameTh: 'ภาควิชาศูนย์วิจัยและนวัตกรรม', nameEn: 'Center of Research and Innovation', facultyCode: 'MT', facultyTh: 'คณะเทคนิคการแพทย์' },
    ];
    defaultDeps.forEach((d) => {
      masterDepartments.set(d.id, d);
      saveToFirestore(COLLECTIONS.MASTER_DEPARTMENTS, d);
    });
  }

  if (masterCurriculums.size === 0) {
    const defaultCurrs: MasterCurriculum[] = [
      { id: 'curr_bs_mt', code: 'CURR_BS_MT', nameTh: 'วิทยาศาสตร์บัณฑิต (เทคนิคการแพทย์)', nameEn: 'Bachelor of Science (Medical Technology)', facultyCode: 'MT', degreeLevel: 'ปริญญาตรี', majorCode: 'MTMT' },
      { id: 'curr_bs_rt', code: 'CURR_BS_RT', nameTh: 'วิทยาศาสตร์บัณฑิต (รังสีเทคนิค)', nameEn: 'Bachelor of Science (Radiological Technology)', facultyCode: 'MT', degreeLevel: 'ปริญญาตรี', majorCode: 'MTRT' },
      { id: 'curr_ms_mt', code: 'CURR_MS_MT', nameTh: 'วิทยาศาสตร์มหาบัณฑิต (เทคนิคการแพทย์)', nameEn: 'Master of Science (Medical Technology)', facultyCode: 'MT', degreeLevel: 'บัณฑิตศึกษา', majorCode: 'MTMT' },
      { id: 'curr_ms_bct', code: 'CURR_MS_BCT', nameTh: 'วิทยาศาสตร์มหาบัณฑิต (เทคโนโลยีชีวภาพทางคลินิก)', nameEn: 'Master of Science (Clinical Biotechnology)', facultyCode: 'MT', degreeLevel: 'บัณฑิตศึกษา', majorCode: 'MTMT' },
      { id: 'curr_phd_mt', code: 'CURR_PHD_MT', nameTh: 'ปรัชญาดุษฎีบัณฑิต (เทคนิคการแพทย์)', nameEn: 'Doctor of Philosophy (Medical Technology)', facultyCode: 'MT', degreeLevel: 'บัณฑิตศึกษา', majorCode: 'MTMT' },
    ];
    defaultCurrs.forEach((c) => {
      masterCurriculums.set(c.id, c);
      saveToFirestore(COLLECTIONS.MASTER_CURRICULUMS, c);
    });
  }

  if (masterPrefixes.size === 0) {
    const defaultPrefixes: MasterPrefix[] = [
      { id: 'pref_mr', titleTh: 'นาย', titleEn: 'Mr.', category: 'BOTH' },
      { id: 'pref_miss', titleTh: 'นางสาว', titleEn: 'Miss', category: 'BOTH' },
      { id: 'pref_mrs', titleTh: 'นาง', titleEn: 'Mrs.', category: 'BOTH' },
      { id: 'pref_dr', titleTh: 'อ.ดร.', titleEn: 'Dr.', category: 'TEACHER' },
      { id: 'pref_asst_prof', titleTh: 'ผศ.ดร.', titleEn: 'Asst. Prof. Dr.', category: 'TEACHER' },
      { id: 'pref_assoc_prof', titleTh: 'รศ.ดร.', titleEn: 'Assoc. Prof. Dr.', category: 'TEACHER' },
      { id: 'pref_prof', titleTh: 'ศ.ดร.', titleEn: 'Prof. Dr.', category: 'TEACHER' },
    ];
    defaultPrefixes.forEach((p) => {
      masterPrefixes.set(p.id, p);
      saveToFirestore(COLLECTIONS.MASTER_PREFIXES, p);
    });
  }
}

export function loadLocalCache(): boolean {
  try {
    if (!fs.existsSync(LOCAL_CACHE_PATH)) {
      return false;
    }
    const raw = fs.readFileSync(LOCAL_CACHE_PATH, 'utf-8');
    const data = JSON.parse(raw);

    if (Array.isArray(data.deletedCourseIds)) {
      deletedCourseIds.clear();
      data.deletedCourseIds.forEach((id: string) => deletedCourseIds.add(id));
    }
    if (Array.isArray(data.deletedMemberIds)) {
      deletedMemberIds.clear();
      data.deletedMemberIds.forEach((id: string) => deletedMemberIds.add(id));
    }
    if (Array.isArray(data.deletedSessionIds)) {
      deletedSessionIds.clear();
      data.deletedSessionIds.forEach((id: string) => deletedSessionIds.add(id));
    }
    if (Array.isArray(data.deletedUserIds)) {
      deletedUserIds.clear();
      data.deletedUserIds.forEach((id: string) => deletedUserIds.add(id));
    }
    if (Array.isArray(data.deletedLeaveIds)) {
      deletedLeaveIds.clear();
      data.deletedLeaveIds.forEach((id: string) => deletedLeaveIds.add(id));
    }
    if (Array.isArray(data.deletedAttendanceIds)) {
      deletedAttendanceIds.clear();
      data.deletedAttendanceIds.forEach((id: string) => deletedAttendanceIds.add(id));
    }
    if (Array.isArray(data.deletedQuickEventIds)) {
      deletedQuickEventIds.clear();
      data.deletedQuickEventIds.forEach((id: string) => deletedQuickEventIds.add(id));
    }

    if (Array.isArray(data.users)) {
      users.clear();
      data.users.forEach((u: User) => {
        if (u && u.id && !deletedUserIds.has(u.id)) users.set(u.id, u);
      });
    }
    if (Array.isArray(data.courses)) {
      courses.clear();
      data.courses.forEach((c: Course) => {
        if (c && c.id && !deletedCourseIds.has(c.id)) courses.set(c.id, c);
      });
    }
    if (Array.isArray(data.courseMembers)) {
      courseMembers.length = 0;
      courseMembers.push(...data.courseMembers.filter((m: CourseMember) => m && m.id && !deletedMemberIds.has(m.id)));
    }
    if (Array.isArray(data.sessions)) {
      sessions.clear();
      data.sessions.forEach((s: Session) => {
        if (s && s.id && !deletedSessionIds.has(s.id)) sessions.set(s.id, s);
      });
    }
    if (Array.isArray(data.attendanceRecords)) {
      attendanceRecords.length = 0;
      data.attendanceRecords.forEach((a: AttendanceRecord) => {
        if (a.sessionId === 'ses_crs_1785480472793_w1' && a.timestamp) {
          const d = new Date(a.timestamp);
          if (d.getUTCHours() === 13) {
            d.setUTCHours(d.getUTCHours() - 7);
            a.timestamp = d.toISOString();
          }
        }
        attendanceRecords.push(a);
      });
    }
    if (Array.isArray(data.teacherAttendanceRecords)) {
      teacherAttendanceRecords.length = 0;
      teacherAttendanceRecords.push(...data.teacherAttendanceRecords);
    }
    if (Array.isArray(data.quickEvents)) {
      quickEvents.clear();
      data.quickEvents.forEach((q: QuickEvent) => quickEvents.set(q.id, q));
    }
    if (Array.isArray(data.inviteLinks)) {
      inviteLinks.clear();
      data.inviteLinks.forEach((l: InviteLink) => inviteLinks.set(l.id, l));
    }
    if (Array.isArray(data.leaveRequests)) {
      leaveRequests.length = 0;
      leaveRequests.push(...data.leaveRequests.filter((l: LeaveRequest) => l && l.id && !deletedLeaveIds.has(l.id)));
    }
    if (Array.isArray(data.masterUniversities)) {
      masterUniversities.clear();
      data.masterUniversities.forEach((u: MasterUniversity) => masterUniversities.set(u.id, u));
    }
    if (Array.isArray(data.masterFaculties)) {
      masterFaculties.clear();
      data.masterFaculties.forEach((f: MasterFaculty) => masterFaculties.set(f.id, f));
    }
    if (Array.isArray(data.masterDepartments)) {
      masterDepartments.clear();
      data.masterDepartments.forEach((d: MasterDepartment) => masterDepartments.set(d.id, d));
    }
    if (Array.isArray(data.masterCurriculums)) {
      masterCurriculums.clear();
      data.masterCurriculums.forEach((c: MasterCurriculum) => masterCurriculums.set(c.id, c));
    }
    if (Array.isArray(data.masterPrefixes)) {
      masterPrefixes.clear();
      data.masterPrefixes.forEach((p: MasterPrefix) => masterPrefixes.set(p.id, p));
    }
    if (Array.isArray(data.notifications)) {
      notifications.clear();
      data.notifications.forEach((n: NotificationItem) => notifications.set(n.id, n));
    }
    if (Array.isArray(data.mergedUserPointers)) {
      mergedUserPointers.clear();
      data.mergedUserPointers.forEach(([secId, priId]: [string, string]) => {
        if (secId && priId) mergedUserPointers.set(secId, priId);
      });
    }
    if (data.systemSettings) {
      systemSettings = { ...systemSettings, ...data.systemSettings };
    }
    return true;
  } catch (err) {
    console.error('[Local Cache Load Error]', err);
    return false;
  }
}

// --- DATA BACKUP & MAXIMUM INTEGRITY ENGINE ---
export interface SystemBackup {
  id: string;
  timestamp: string;
  label: string;
  creator: string;
  type?: 'manual' | 'auto';
  counts: {
    users: number;
    courses: number;
    courseMembers: number;
    sessions: number;
    attendanceRecords: number;
    teacherAttendanceRecords: number;
    leaveRequests: number;
    quickEvents: number;
  };
  data?: {
    users: User[];
    courses: Course[];
    courseMembers: CourseMember[];
    sessions: Session[];
    attendanceRecords: AttendanceRecord[];
    teacherAttendanceRecords: TeacherAttendanceRecord[];
    leaveRequests: LeaveRequest[];
    quickEvents: QuickEvent[];
  };
}

const systemBackups: SystemBackup[] = [];

function getBackupType(b: { type?: string; creator?: string; label?: string }): 'manual' | 'auto' {
  if (b.type === 'manual' || b.type === 'auto') return b.type;
  if (b.creator === 'Admin User' || (b.label && b.label.toLowerCase().includes('manual'))) {
    return 'manual';
  }
  return 'auto';
}

function sanitizeBackupDataForFirestore(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeBackupDataForFirestore);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === 'string' &&
      value.length > 1500 &&
      (value.startsWith('data:') ||
        key.toLowerCase().includes('image') ||
        key.toLowerCase().includes('avatar') ||
        key.toLowerCase().includes('photo') ||
        key.toLowerCase().includes('file') ||
        key.toLowerCase().includes('proof') ||
        key.toLowerCase().includes('attachment'))
    ) {
      result[key] = '[ATTACHMENT_TRUNCATED_FOR_BACKUP_SNAPSHOT]';
    } else if (value !== null && typeof value === 'object') {
      result[key] = sanitizeBackupDataForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function createSnapshotBackup(
  label: string,
  creator = 'System Integrity Engine',
  type: 'manual' | 'auto' = 'auto'
): Promise<SystemBackup> {
  // Fetch existing backups to enforce manual limits and auto-pruning accurately
  let fsBackups: SystemBackup[] = [];
  try {
    const loaded = await getAllFromFirestore<SystemBackup>('SYSTEM_BACKUPS');
    if (loaded && loaded.length > 0) {
      fsBackups = loaded;
    }
  } catch (err) {
    // ignore
  }

  const backupMap = new Map<string, SystemBackup>();
  fsBackups.forEach((b) => backupMap.set(b.id, { ...b, type: getBackupType(b) }));
  systemBackups.forEach((b) => backupMap.set(b.id, { ...b, type: getBackupType(b) }));

  const allExisting = Array.from(backupMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const existingManual = allExisting.filter((b) => getBackupType(b) === 'manual');
  const existingAuto = allExisting.filter((b) => getBackupType(b) === 'auto');

  if (type === 'manual' && existingManual.length >= 5) {
    throw new Error('ไม่สามารถสร้าง Manual Snapshot เพิ่มได้เนื่องจากครบโควต้าสูงสุด 5 จุดแล้ว กรุณาลบ Manual Snapshot เก่าออกก่อน');
  }

  const backup: SystemBackup = {
    id: `backup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString(),
    label,
    creator,
    type,
    counts: {
      users: users ? users.size : 0,
      courses: courses ? courses.size : 0,
      courseMembers: Array.isArray(courseMembers) ? courseMembers.length : 0,
      sessions: sessions ? sessions.size : 0,
      attendanceRecords: Array.isArray(attendanceRecords) ? attendanceRecords.length : 0,
      teacherAttendanceRecords: Array.isArray(teacherAttendanceRecords) ? teacherAttendanceRecords.length : 0,
      leaveRequests: Array.isArray(leaveRequests) ? leaveRequests.length : 0,
      quickEvents: quickEvents ? quickEvents.size : 0,
    },
    data: {
      users: users ? Array.from(users.values()) : [],
      courses: courses ? Array.from(courses.values()) : [],
      courseMembers: Array.isArray(courseMembers) ? [...courseMembers] : [],
      sessions: sessions ? Array.from(sessions.values()) : [],
      attendanceRecords: Array.isArray(attendanceRecords) ? [...attendanceRecords] : [],
      teacherAttendanceRecords: Array.isArray(teacherAttendanceRecords) ? [...teacherAttendanceRecords] : [],
      leaveRequests: Array.isArray(leaveRequests) ? [...leaveRequests] : [],
      quickEvents: quickEvents ? Array.from(quickEvents.values()) : [],
    },
  };

  systemBackups.unshift(backup);

  // Save metadata & sanitized snapshot to Firestore to keep document size light (<1MB)
  try {
    const sanitizedData = sanitizeBackupDataForFirestore(backup.data);
    await saveToFirestore('SYSTEM_BACKUPS', {
      id: backup.id,
      timestamp: backup.timestamp,
      label: backup.label,
      creator: backup.creator,
      type: backup.type,
      counts: backup.counts,
      data: sanitizedData,
    });
  } catch (err) {
    console.warn('[System Backup] Saved to memory cache, Firestore save pending:', err);
  }

  // Automatic Snapshot Auto-Prune (keep up to 20 newest automatic snapshots)
  if (type === 'auto') {
    const updatedAutoList = [backup, ...existingAuto].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (updatedAutoList.length > 20) {
      const toDelete = updatedAutoList.slice(20);
      for (const oldBackup of toDelete) {
        await deleteFromFirestore('SYSTEM_BACKUPS', oldBackup.id).catch(() => {});
        const idx = systemBackups.findIndex((b) => b.id === oldBackup.id);
        if (idx >= 0) {
          systemBackups.splice(idx, 1);
        }
        console.log(`[Snapshot Auto-Prune] Removed oldest auto snapshot: ${oldBackup.id} (${oldBackup.label})`);
      }
    }
  }

  console.log(`[System Backup Created] ID: ${backup.id} | Type: ${type} | Label: ${label} | Attendance Count: ${backup.counts.attendanceRecords}`);
  return backup;
}

async function restoreSnapshotBackup(backupId: string): Promise<{ restoredCounts: Record<string, number> }> {
  let backup = systemBackups.find((b) => b.id === backupId);
  if (!backup || !backup.data) {
    const fsBackups = await getAllFromFirestore<SystemBackup>('SYSTEM_BACKUPS');
    if (fsBackups) {
      backup = fsBackups.find((b) => b.id === backupId);
    }
  }

  if (!backup || !backup.data) {
    throw new Error('ไม่พบข้อมูล สำรอง (Backup snapshot) ที่ระบุ');
  }

  // Restore memory collections
  users.clear();
  if (Array.isArray(backup.data.users)) {
    backup.data.users.forEach((u) => users.set(u.id, u));
  }

  courses.clear();
  if (Array.isArray(backup.data.courses)) {
    backup.data.courses.forEach((c) => courses.set(c.id, c));
  }

  courseMembers.length = 0;
  if (Array.isArray(backup.data.courseMembers)) {
    courseMembers.push(...backup.data.courseMembers);
  }

  sessions.clear();
  if (Array.isArray(backup.data.sessions)) {
    backup.data.sessions.forEach((s) => sessions.set(s.id, s));
  }

  attendanceRecords.length = 0;
  if (Array.isArray(backup.data.attendanceRecords)) {
    attendanceRecords.push(...backup.data.attendanceRecords);
  }

  teacherAttendanceRecords.length = 0;
  if (Array.isArray(backup.data.teacherAttendanceRecords)) {
    teacherAttendanceRecords.push(...backup.data.teacherAttendanceRecords);
  }

  leaveRequests.length = 0;
  if (Array.isArray(backup.data.leaveRequests)) {
    leaveRequests.push(...backup.data.leaveRequests);
  }

  quickEvents.clear();
  if (Array.isArray(backup.data.quickEvents)) {
    backup.data.quickEvents.forEach((q) => quickEvents.set(q.id, q));
  }

  // Sync restored data to Firestore in background batches
  await Promise.all([
    batchSaveToFirestore(COLLECTIONS.USERS, Array.from(users.values())),
    batchSaveToFirestore(COLLECTIONS.COURSES, Array.from(courses.values())),
    batchSaveToFirestore(COLLECTIONS.COURSE_MEMBERS, courseMembers),
    batchSaveToFirestore(COLLECTIONS.SESSIONS, Array.from(sessions.values())),
    batchSaveToFirestore(COLLECTIONS.ATTENDANCE, attendanceRecords),
    batchSaveToFirestore(COLLECTIONS.TEACHER_ATTENDANCE, teacherAttendanceRecords),
    batchSaveToFirestore(COLLECTIONS.LEAVE_REQUESTS, leaveRequests),
    batchSaveToFirestore(COLLECTIONS.QUICK_EVENTS, Array.from(quickEvents.values())),
  ]);

  console.log(`[Snapshot Restored] Backup ID: ${backupId} | Attendance restored: ${attendanceRecords.length}`);
  return {
    restoredCounts: backup.counts,
  };
}


// Default Global System Settings
let systemSettings: SystemSettings = {
  id: 'global_config',
  academicYear: 2569,
  academicSemester: Semester.FIRST,
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

// Bangkok Timezone (Asia/Bangkok, UTC+7) Helper Functions
function formatBangkokDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'ยังไม่เคยสแกน';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return 'ยังไม่เคยสแกน';
    return dt.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return 'ยังไม่เคยสแกน';
  }
}

function formatBangkokTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' น.';
  } catch (e) {
    return '-';
  }
}

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'nuttapat.anu@gmail.com').trim().toLowerCase();

/**
 * Returns all equivalent email variants for a given email address
 * by cross-mapping legacy institutional domains (.edu <-> .ac.th)
 */
function getEmailDomainVariants(emailStr: string): string[] {
  if (!emailStr || !emailStr.includes('@')) return [emailStr.trim().toLowerCase()];
  const clean = emailStr.trim().toLowerCase();
  const [username, domain] = clean.split('@');
  const variants = new Set<string>([clean]);

  // Mahidol Student domain mapping
  if (domain === 'student.mahidol.edu') {
    variants.add(`${username}@student.mahidol.ac.th`);
  } else if (domain === 'student.mahidol.ac.th') {
    variants.add(`${username}@student.mahidol.edu`);
  }

  // Mahidol Teacher/Staff domain mapping
  if (domain === 'mahidol.edu') {
    variants.add(`${username}@mahidol.ac.th`);
  } else if (domain === 'mahidol.ac.th') {
    variants.add(`${username}@mahidol.edu`);
  }

  // Generic .edu <-> .ac.th fallback
  if (domain.endsWith('.edu')) {
    variants.add(`${username}@${domain.replace(/\.edu$/, '.ac.th')}`);
  } else if (domain.endsWith('.ac.th')) {
    variants.add(`${username}@${domain.replace(/\.ac\.th$/, '.edu')}`);
  }

  return Array.from(variants);
}

/**
 * Normalizes an incoming email to prefer the canonical modern .ac.th domain
 */
function getCanonicalUniversityEmail(emailStr: string): string {
  if (!emailStr || !emailStr.includes('@')) return (emailStr || '').trim().toLowerCase();
  const clean = emailStr.trim().toLowerCase();
  const [username, domain] = clean.split('@');

  if (domain === 'student.mahidol.edu') {
    return `${username}@student.mahidol.ac.th`;
  }
  if (domain === 'mahidol.edu') {
    return `${username}@mahidol.ac.th`;
  }
  if (domain.endsWith('.edu')) {
    return `${username}@${domain.replace(/\.edu$/, '.ac.th')}`;
  }
  return clean;
}

/**
 * Multi-Factor User Resolution:
 * Finds an existing user by exact email, alias email, or domain transition equivalent,
 * or by (universityId + role)
 */
function findUserByIdentity(emailStr?: string, universityIdStr?: string, role?: UserRole): User | undefined {
  const allUsers = Array.from(users.values());

  if (emailStr) {
    const cleanEmail = emailStr.trim().toLowerCase();
    const variants = getEmailDomainVariants(cleanEmail);

    // 1. Exact email match
    const exact = allUsers.find((u) => u && u.email && u.email.trim().toLowerCase() === cleanEmail);
    if (exact) return exact;

    // 2. Email aliases match
    const byAlias = allUsers.find((u) => {
      if (!u) return false;
      if (Array.isArray(u.emailAliases)) {
        return u.emailAliases.some((alias) => alias.trim().toLowerCase() === cleanEmail);
      }
      return false;
    });
    if (byAlias) return byAlias;

    // 3. Domain transition variants match
    const byVariant = allUsers.find((u) => {
      if (!u || !u.email) return false;
      const uEmail = u.email.trim().toLowerCase();
      if (variants.includes(uEmail)) return true;
      if (Array.isArray(u.emailAliases)) {
        return u.emailAliases.some((alias) => variants.includes(alias.trim().toLowerCase()));
      }
      return false;
    });
    if (byVariant) return byVariant;
  }

  // 4. Match by Student/University ID if provided
  if (universityIdStr && universityIdStr.trim()) {
    const cleanUId = universityIdStr.trim();
    const byUId = allUsers.find((u) => {
      if (!u || !u.universityId) return false;
      if (u.universityId.trim() === cleanUId) {
        if (role) return u.role === role;
        return true;
      }
      return false;
    });
    if (byUId) return byUId;
  }

  return undefined;
}

// Domain check helper function for new user registration
const checkRegistrationDomain = (emailStr: string): { allowed: boolean; forcedRole: UserRole | null; reason?: string } => {
  const cleanEmail = emailStr.trim().toLowerCase();
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return { allowed: true, forcedRole: UserRole.ADMIN };
  }

  // Check if user is an existing user in the system (Admin, Teacher, or Student)
  const existingUser = Array.from(users.values()).find((u) => u && u.email && u.email.trim().toLowerCase() === cleanEmail);
  if (existingUser) {
    return { allowed: true, forcedRole: existingUser.role };
  }

  // Parse student domains list
  let studentDomains: string[] = [];
  if (Array.isArray(systemSettings.studentDomains) && systemSettings.studentDomains.length > 0) {
    studentDomains = systemSettings.studentDomains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  } else if (systemSettings.studentDomain) {
    studentDomains = systemSettings.studentDomain.split(/[,;\s]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  }
  if (studentDomains.length === 0) {
    studentDomains = ['student.mahidol.ac.th', 'student.mahidol.edu'];
  }

  // Parse teacher domains list
  let teacherDomains: string[] = [];
  if (Array.isArray(systemSettings.teacherDomains) && systemSettings.teacherDomains.length > 0) {
    teacherDomains = systemSettings.teacherDomains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  } else if (systemSettings.teacherDomain) {
    teacherDomains = systemSettings.teacherDomain.split(/[,;\s]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  }
  if (teacherDomains.length === 0) {
    teacherDomains = ['mahidol.ac.th', 'mahidol.edu'];
  }

  const allowOther = systemSettings.allowOtherDomainsSelfRegister ?? systemSettings.allowOtherDomains ?? false;

  const parts = cleanEmail.split('@');
  const emailDomain = parts.length > 1 ? parts[1] : '';

  // Student domain check
  const isStudent = studentDomains.some((d) => emailDomain === d || emailDomain.endsWith('.' + d));
  if (isStudent) {
    if (systemSettings.allowStudentSelfRegister === false) {
      return { allowed: false, forcedRole: null, reason: 'ระบบปิดการลงทะเบียนบัญชีนักศึกษาใหม่ชั่วคราว (กรุณาติดต่อผู้ดูแลระบบ)' };
    }
    return { allowed: true, forcedRole: UserRole.STUDENT };
  }

  // Teacher domain check
  const isTeacher = teacherDomains.some((d) => emailDomain === d || emailDomain.endsWith('.' + d));
  if (isTeacher) {
    if (systemSettings.allowTeacherSelfRegister === false) {
      return { allowed: false, forcedRole: null, reason: 'ระบบปิดการลงทะเบียนบัญชีอาจารย์ใหม่ชั่วคราว (กรุณาติดต่อผู้ดูแลระบบ)' };
    }
    return { allowed: true, forcedRole: UserRole.TEACHER };
  }

  // Other domains toggle check or Google Auto-register enabled
  if (allowOther || systemSettings.allowGoogleAutoRegister !== false) {
    return { allowed: true, forcedRole: null };
  }

  const allowedStudentStr = studentDomains.map((d) => `@${d}`).join(', ');
  const allowedTeacherStr = teacherDomains.map((d) => `@${d}`).join(', ');
  const allowedList = [allowedStudentStr, allowedTeacherStr].filter(Boolean).join(' และ ');
  return {
    allowed: false,
    forcedRole: null,
    reason: `🚫 โดเมนอีเมล @${emailDomain} ไม่ได้รับอนุญาตให้ลงทะเบียนเข้าใช้งานระบบ (ระบบไม่อนุญาตให้ใช้บัญชีทั่วไป เช่น @gmail.com หรือ @hotmail.com อนุญาตเฉพาะโดเมนสถาบัน: ${allowedList || 'ตามที่กำหนด'} เท่านั้น หรือติดต่อผู้ดูแลระบบเพื่อขอเปิดสิทธิ์ยกเว้น)`,
  };
};

// Dynamic QR Tokens: sessionId/eventId -> { token, expiresAt, lat, lng }
interface ActiveQR {
  token: string;
  expiresAt: number;
  refreshIntervalSeconds?: number;
  nextRefreshAt?: number;
  lat: number;
  lng: number;
  isGpsCheckEnabled?: boolean;
  isStatic?: boolean;
  previousTokens?: Array<{ token: string; expiresAt: number }>;
}
const activeQRCodes: Map<string, ActiveQR> = new Map();

function getGraceBufferMs(intervalSec: number): number {
  if (intervalSec <= 10) return 10000;  // 10s cycle -> 10s buffer (total 20s window)
  if (intervalSec <= 15) return 12000;  // 15s cycle -> 12s buffer (total 27s window)
  if (intervalSec <= 30) return 20000;  // 30s cycle -> 20s buffer (total 50s window)
  if (intervalSec <= 60) return 30000;  // 1m cycle  -> 30s buffer (total 90s window)
  return 40000;                         // 2m+ cycle -> 40s buffer (total 160s window)
}

function parseCleanToken(rawInput: string): string {
  if (!rawInput) return '';
  let inputToken = rawInput.trim();
  
  // Clean URL params if present
  if (inputToken.includes('checkin=')) {
    const match = inputToken.match(/checkin=([^&]+)/);
    if (match && match[1]) {
      inputToken = decodeURIComponent(match[1]).trim();
    }
  }
  if (inputToken.includes('token=')) {
    const match = inputToken.match(/token=([^&]+)/);
    if (match && match[1]) {
      inputToken = decodeURIComponent(match[1]).trim();
    }
  }
  // Strip SES:sessionId: or EVT:eventId: prefix
  if (inputToken.includes(':')) {
    const parts = inputToken.split(':');
    inputToken = parts[parts.length - 1].trim();
  }
  // Strip trailing URL paths if raw URL was passed
  if (inputToken.includes('/')) {
    const parts = inputToken.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0].trim();
    if (lastPart) inputToken = lastPart;
  }

  // Normalize ambiguous characters if manually typed (0 -> O, 1 -> I etc if needed, uppercase)
  return inputToken.toUpperCase();
}

function isValidActiveToken(activeQR: ActiveQR | undefined, rawInputToken: string): boolean {
  if (!activeQR) return false;
  const cleanInput = parseCleanToken(rawInputToken);
  if (!cleanInput) return false;

  // 1. Check current active token
  if (activeQR.token.toUpperCase() === cleanInput) {
    return true;
  }

  // 2. Check previous tokens buffer (40s grace period for scanner delay & GPS acquisition)
  if (activeQR.previousTokens && Array.isArray(activeQR.previousTokens)) {
    const now = Date.now();
    const found = activeQR.previousTokens.find(
      (pt) => pt.token.toUpperCase() === cleanInput && pt.expiresAt > now
    );
    if (found) return true;
  }

  return false;
}

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

// Seed Initial Users & Courses Function
function initDefaultSeedData() {
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
    isDemo: true,
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
    isDemo: true,
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
    isDemo: true,
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
    isDemo: true,
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
    isDemo: true,
    createdAt: new Date().toISOString(),
  };

  users.set(teacherUser.id, teacherUser);
  users.set(coTeacherUser.id, coTeacherUser);
  users.set(studentUser1.id, studentUser1);
  users.set(studentUser2.id, studentUser2);
  users.set(adminUser.id, adminUser);

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
    defaultLat: 13.7988363,
    defaultLng: 100.322944,
    allowedGpsRadius: 200,
    weeks: [
      { weekNumber: 1, topic: 'Introduction & Requirements Engineering', date: '2026-07-10' },
      { weekNumber: 2, topic: 'Microservices & RESTful API Design', date: '2026-07-17' },
      { weekNumber: 3, topic: 'Database Schema & Anti-Proxy Security', date: '2026-07-24' },
      { weekNumber: 4, topic: 'WebSockets & Dynamic QR Codes', date: '2026-07-31' },
      { weekNumber: 5, topic: 'Geofencing & PWA Deployment', date: '2026-08-07' },
    ],
    createdAt: new Date().toISOString(),
  };

  if (!deletedCourseIds.has(sampleCourse.id)) {
    courses.set(sampleCourse.id, sampleCourse);
  }

  // Seed Academic Structure Sample Courses (Faculty of Medical Technology)
  const bioinfoCourse: Course = {
    id: 'crs_mtid626',
    courseCode: 'MTID626',
    courseName: 'Advanced Bioinformatics',
    academicYear: 2569,
    semester: Semester.FIRST,
    coordinatorName: 'อ.ดร. สมชาย ใจดี',
    ownerId: teacherUser.id,
    ownerName: 'อ.ดร. สมชาย ใจดี',
    facultyCode: 'MT',
    departmentCode: 'ID',
    majorCode: 'MTMT',
    degreeLevel: 'บัณฑิตศึกษา',
    curriculums: [
      'วิทยาศาสตร์มหาบัณฑิต (เทคนิคการแพทย์)',
      'ปรัชญาดุษฎีบัณฑิต (เทคนิคการแพทย์)'
    ],
    defaultLat: 13.7988363,
    defaultLng: 100.322944,
    allowedGpsRadius: 200,
    weeks: [
      { weekNumber: 1, topic: 'Genomics & High-Throughput Sequencing Data', date: '2026-07-10' },
      { weekNumber: 2, topic: 'Machine Learning in Computational Biology', date: '2026-07-17' },
      { weekNumber: 3, topic: 'Structural Bioinformatics & Molecular Docking', date: '2026-07-24' },
    ],
    createdAt: new Date().toISOString(),
  };

  const dataMgmtCourse: Course = {
    id: 'crs_mtid204',
    courseCode: 'MTID204',
    courseName: 'Data Management with Computer',
    academicYear: 2569,
    semester: Semester.FIRST,
    coordinatorName: 'ผศ.ดร. วนิดา เรียนดี',
    ownerId: coTeacherUser.id,
    ownerName: 'ผศ.ดร. วนิดา เรียนดี',
    facultyCode: 'MT',
    departmentCode: 'ID',
    majorCode: 'MTMT',
    degreeLevel: 'ปริญญาตรี',
    curriculums: [
      'วิทยาศาสตร์บัณฑิต (เทคนิคการแพทย์)',
      'วิทยาศาสตร์บัณฑิต (รังสีเทคนิค)'
    ],
    defaultLat: 13.7988363,
    defaultLng: 100.322944,
    allowedGpsRadius: 200,
    weeks: [
      { weekNumber: 1, topic: 'Database Fundamentals in Medical Context', date: '2026-07-12' },
      { weekNumber: 2, topic: 'Healthcare Information Systems & Security', date: '2026-07-19' },
    ],
    createdAt: new Date().toISOString(),
  };

  const commTechCourse: Course = {
    id: 'crs_mtcm303',
    courseCode: 'MTCM303',
    courseName: 'Community Medical Technology',
    academicYear: 2569,
    semester: Semester.FIRST,
    coordinatorName: 'อ.ดร. สมชาย ใจดี',
    ownerId: teacherUser.id,
    ownerName: 'อ.ดร. สมชาย ใจดี',
    facultyCode: 'MT',
    departmentCode: 'CM',
    majorCode: 'MTMT',
    degreeLevel: 'ปริญญาตรี',
    curriculums: [
      'วิทยาศาสตร์บัณฑิต (เทคนิคการแพทย์)'
    ],
    defaultLat: 13.7988363,
    defaultLng: 100.322944,
    allowedGpsRadius: 200,
    weeks: [
      { weekNumber: 1, topic: 'Principles of Primary Health Care & Field Work', date: '2026-07-15' },
    ],
    createdAt: new Date().toISOString(),
  };

  if (!deletedCourseIds.has(bioinfoCourse.id)) courses.set(bioinfoCourse.id, bioinfoCourse);
  if (!deletedCourseIds.has(dataMgmtCourse.id)) courses.set(dataMgmtCourse.id, dataMgmtCourse);
  if (!deletedCourseIds.has(commTechCourse.id)) courses.set(commTechCourse.id, commTechCourse);

  // Add course members
  if (!deletedCourseIds.has(sampleCourse.id)) {
    courseMembers.push(
      { id: 'cm_1', courseId: sampleCourse.id, userId: teacherUser.id, role: CourseMemberRole.CO_TEACHER, joinedAt: new Date().toISOString() },
      { id: 'cm_2', courseId: sampleCourse.id, userId: coTeacherUser.id, role: CourseMemberRole.CO_TEACHER, joinedAt: new Date().toISOString() },
      { id: 'cm_3', courseId: sampleCourse.id, userId: studentUser1.id, role: CourseMemberRole.STUDENT, joinedAt: new Date().toISOString() },
      { id: 'cm_4', courseId: sampleCourse.id, userId: studentUser2.id, role: CourseMemberRole.STUDENT, joinedAt: new Date().toISOString() }
    );
  }

  // Seed sessions
  if (!deletedCourseIds.has(sampleCourse.id)) {
    const session1: Session = {
      id: 'ses_1',
      courseId: sampleCourse.id,
      weekNumber: 1,
      topic: 'Introduction & Requirements Engineering',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    const session2: Session = {
      id: 'ses_2',
      courseId: sampleCourse.id,
      weekNumber: 2,
      topic: 'Microservices & RESTful API Design',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    const session3: Session = {
      id: 'ses_3',
      courseId: sampleCourse.id,
      weekNumber: 3,
      topic: 'Database Schema & Anti-Proxy Security',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    sessions.set(session1.id, session1);
    sessions.set(session2.id, session2);
    sessions.set(session3.id, session3);
  }
}

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

  // Extract hardware fingerprint hash if present (e.g. fp_a1b2c3d4)
  const incomingFp = deviceId.match(/fp_[a-f0-9]+/)?.[0];

  // 1. Find existing device by exact ID, or hardware fingerprint, or identical OS + Browser + DeviceName signature
  const existingDevice = user.devices.find((d) => {
    if (d.deviceId === deviceId) return true;
    if (incomingFp && d.deviceId) {
      const existingFp = d.deviceId.match(/fp_[a-f0-9]+/)?.[0];
      if (existingFp && existingFp === incomingFp) return true;
    }
    // Matching by identical OS + Browser + DeviceName
    if (deviceName && d.deviceName === deviceName && os && d.os === os && browser && d.browser === browser) {
      return true;
    }
    return false;
  });

  if (existingDevice) {
    existingDevice.lastUsedAt = new Date().toISOString();
    if (deviceName) existingDevice.deviceName = deviceName;
    if (deviceType) existingDevice.deviceType = deviceType as any;
    if (browser) existingDevice.browser = browser;
    if (os) existingDevice.os = os;
    // Update deviceId with latest fingerprint if needed
    if (incomingFp && !existingDevice.deviceId.includes(incomingFp)) {
      existingDevice.deviceId = deviceId;
    }
    user.deviceId = user.deviceId || deviceId;
    return { success: true, user, isNewDevice: false };
  }

  // Check limits
  const isStudent = user.role === UserRole.STUDENT;
  const isLockEnabled = systemSettings.singleDeviceLockEnabled ?? true;
  const maxAllowedDevices = systemSettings.maxDevicesPerUser || 1;

  if (isStudent && isLockEnabled && user.devices.length >= maxAllowedDevices) {
    // Check if we can auto-merge with the oldest inactive device of the same OS/type to handle incognito fallback
    const sameOsDevice = user.devices.find((d) => os && d.os === os);
    if (sameOsDevice) {
      sameOsDevice.lastUsedAt = new Date().toISOString();
      sameOsDevice.deviceId = deviceId;
      if (deviceName) sameOsDevice.deviceName = deviceName;
      if (browser) sameOsDevice.browser = browser;
      return { success: true, user, isNewDevice: false };
    }

    return {
      success: false,
      error: `[Anti-Proxy Device Limit] บัญชีนักศึกษานี้ผูกอุปกรณ์ครบ ${maxAllowedDevices} เครื่องแล้ว (สิทธิ์สูงสุด ${maxAllowedDevices} เครื่องตามนโยบายระบบ) อุปกรณ์นี้ยังไม่ได้ผูกในระบบ กรุณาเข้าเมนู "ตั้งค่าบัญชี" -> "การผูกอุปกรณ์" เพื่อยกเลิกอุปกรณ์เดิม หรือติดต่ออาจารย์/แอดมินเพื่อรีเซ็ตอุปกรณ์`,
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

// Boot Initialization: Load Local Cache or Seed Initial Data
const isCacheLoaded = loadLocalCache();
if (!isCacheLoaded) {
  initDefaultSeedData();
  saveLocalCache();
}

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

  // Send current active state & attendance records immediately
  const targetId = sessionId || eventId;
  if (targetId) {
    if (activeQRCodes.has(targetId)) {
      const qrData = activeQRCodes.get(targetId);
      ws.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
    }
    const currentRecords = attendanceRecords.filter(
      (r) => r.sessionId === targetId || r.eventId === targetId
    );
    ws.send(
      JSON.stringify({
        type: 'CHECKIN_NEW',
        records: currentRecords,
        totalCount: currentRecords.length,
      })
    );
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

// Periodic Dynamic QR Code Refresher (runs every 2 seconds to check custom refresh intervals)
setInterval(() => {
  const now = Date.now();

  const processQrRefresh = (
    targetId: string,
    lat: number,
    lng: number,
    isGpsCheckEnabled: boolean,
    customIntervalSec?: number,
    isEvent: boolean = false
  ) => {
    let existingQR = activeQRCodes.get(targetId);

    if (existingQR && existingQR.isStatic) {
      if (existingQR.expiresAt - now < 3600000) {
        existingQR.expiresAt = now + 86400000;
        activeQRCodes.set(targetId, existingQR);
      }
      return;
    }

    const intervalSec = customIntervalSec || existingQR?.refreshIntervalSeconds || systemSettings.dynamicQrIntervalSeconds || 30;
    const nextRefresh = existingQR?.nextRefreshAt || 0;

    // Refresh if no QR exists or if time for next refresh has passed
    if (!existingQR || now >= nextRefresh) {
      const newToken = generate6CharToken();
      const expiresAt = now + (intervalSec * 1000) + 5000; // 5s grace period for latency
      const nextRefreshAt = now + (intervalSec * 1000);

      const bufferMs = getGraceBufferMs(intervalSec);
      const previousTokens = existingQR?.previousTokens ? [...existingQR.previousTokens] : [];
      if (existingQR?.token) {
        previousTokens.push({
          token: existingQR.token,
          expiresAt: now + bufferMs, // dynamic grace period based on refresh cycle
        });
      }
      const validPrevious = previousTokens
        .filter((pt) => pt.expiresAt > now)
        .slice(-10);

      const qrData: ActiveQR = {
        token: newToken,
        expiresAt,
        refreshIntervalSeconds: intervalSec,
        nextRefreshAt,
        lat,
        lng,
        isGpsCheckEnabled,
        isStatic: false,
        previousTokens: validPrevious,
      };
      activeQRCodes.set(targetId, qrData);

      // Broadcast to WebSocket clients watching this target
      activeWsClients.forEach((client) => {
        const matches = isEvent ? client.eventId === targetId : client.sessionId === targetId;
        if (matches && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'QR_REFRESH', data: qrData }));
        }
      });
    }
  };

  // Loop active sessions
  sessions.forEach((session, sId) => {
    if (session.isActive) {
      processQrRefresh(
        sId,
        session.teacherLat,
        session.teacherLng,
        session.isGpsCheckEnabled !== false,
        session.qrRefreshIntervalSeconds,
        false
      );
    }
  });

  // Loop active quick events
  quickEvents.forEach((qEvent, eId) => {
    if (qEvent.isActive) {
      processQrRefresh(
        eId,
        qEvent.teacherLat,
        qEvent.teacherLng,
        qEvent.isGpsCheckEnabled !== false,
        qEvent.qrRefreshIntervalSeconds,
        true
      );
    }
  });
}, 2000);

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
    universityCode,
    universityName,
    facultyCode,
    facultyName,
    departmentCode,
    departmentName,
    branchName,
    programCode,
    programName,
    affiliatedPrograms,
  } = req.body || {};

  const cleanEmail = (email || '').toString().trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลที่ถูกต้อง (เช่น example@gmail.com)' });
  }

  // Maintenance mode check for non-admin registration
  const isMaintenance = systemSettings.maintenanceMode || systemSettings.systemMaintenanceMode;
  if (isMaintenance && cleanEmail !== SUPER_ADMIN_EMAIL) {
    const msg = systemSettings.maintenanceMessage || systemSettings.announcementMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก';
    return res.status(503).json({
      error: `[โหมดปิดปรับปรุงระบบ] ${msg}`,
    });
  }

  // Check if system allows self/auto registration
  if (!systemSettings.allowGoogleAutoRegister && cleanEmail !== SUPER_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'ระบบปิดการลงทะเบียนผู้ใช้งานใหม่ชั่วคราว (ทั้ง Google และ Email/Password) กรุณาติดต่อผู้ดูแลระบบเพื่อขออนุมัติบัญชี',
    });
  }

  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return res.status(400).json({ error: 'อีเมลผู้ดูแลระบบหลักต้องลงทะเบียนและเข้าสู่ระบบด้วย Google Account เท่านั้น' });
  }

  // Domain permission check
  const domainCheck = checkRegistrationDomain(cleanEmail);
  if (!domainCheck.allowed) {
    return res.status(403).json({ error: domainCheck.reason });
  }

  const userRole = domainCheck.forcedRole || role || UserRole.STUDENT;

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
    universityCode: (universityCode || 'MU').toString().trim(),
    universityName: (universityName || 'มหาวิทยาลัยมหิดล').toString().trim(),
    facultyCode: (facultyCode || 'MT').toString().trim(),
    facultyName: (facultyName || 'คณะเทคนิคการแพทย์').toString().trim(),
    departmentCode: (departmentCode || '').toString().trim(),
    departmentName: (departmentName || '').toString().trim(),
    branchName: (branchName || '').toString().trim(),
    programCode: (programCode || '').toString().trim(),
    programName: (programName || '').toString().trim(),
    affiliatedPrograms: Array.isArray(affiliatedPrograms) ? affiliatedPrograms : [],
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
  const user = findUserByIdentity(cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานในระบบ กรุณาตรวจสอบอีเมลหรือลงทะเบียนใหม่' });
  }

  // Maintenance mode check for non-admin users
  const isMaintenance = systemSettings.maintenanceMode || systemSettings.systemMaintenanceMode;
  const isUserAdmin = user.role === UserRole.ADMIN || user.id === 'usr_admin_1' || cleanEmail === SUPER_ADMIN_EMAIL;
  if (isMaintenance && !isUserAdmin) {
    const msg = systemSettings.maintenanceMessage || systemSettings.announcementMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก';
    return res.status(503).json({
      error: `[โหมดปิดปรับปรุงระบบ] ${msg}`,
    });
  }

  if (user.isSuspended) {
    return res.status(403).json({
      error: `บัญชีของคุณถูกระงับการใช้งานโดยผู้ดูแลระบบ ${user.suspendedReason ? `(สาเหตุ: ${user.suspendedReason})` : ''}`,
    });
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
    universityCode,
    universityName,
    facultyCode,
    facultyName,
    departmentCode,
    departmentName,
    branchName,
    programCode,
    programName,
    affiliatedPrograms,
  } = req.body || {};

  // Password update validation
  if (newPassword && newPassword.toString().trim() !== '') {
    const isGoogleAccount = user.authProvider === 'google';
    const isDefaultOrEmptyPassword = !user.password || user.password === '123456';
    const bypassCurrentPasswordCheck = isGoogleAccount || isDefaultOrEmptyPassword || req.body.isGoogleOrFirstPasswordSet;

    if (!bypassCurrentPasswordCheck) {
      if (!currentPassword || currentPassword.toString() !== user.password) {
        return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      }
    }

    if (newPassword.toString().length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }
    user.password = newPassword.toString().trim();
  }

  if (title) user.title = title.toString().trim();
  if (firstNameTh) user.firstNameTh = firstNameTh.toString().trim();
  if (lastNameTh) user.lastNameTh = lastNameTh.toString().trim();
  if (firstNameEn) user.firstNameEn = firstNameEn.toString().trim();
  if (lastNameEn) user.lastNameEn = lastNameEn.toString().trim();
  if (universityId !== undefined) user.universityId = universityId.toString().trim();
  if (universityCode !== undefined) user.universityCode = universityCode.toString().trim();
  if (universityName !== undefined) user.universityName = universityName.toString().trim();
  if (facultyCode !== undefined) user.facultyCode = facultyCode.toString().trim();
  if (facultyName !== undefined) user.facultyName = facultyName.toString().trim();
  if (departmentCode !== undefined) user.departmentCode = departmentCode.toString().trim();
  if (departmentName !== undefined) user.departmentName = departmentName.toString().trim();
  if (branchName !== undefined) user.branchName = branchName.toString().trim();
  if (programCode !== undefined) user.programCode = programCode.toString().trim();
  if (programName !== undefined) user.programName = programName.toString().trim();
  if (affiliatedPrograms !== undefined && Array.isArray(affiliatedPrograms)) user.affiliatedPrograms = affiliatedPrograms;

  saveToFirestore(COLLECTIONS.USERS, user);
  res.json({ message: 'บันทึกการตั้งค่าโปรไฟล์เรียบร้อยแล้ว', user });
});

app.post('/api/auth/google', (req, res) => {
  try {
    const { email, name, picture, role, title, universityId, firstNameTh, lastNameTh, firstNameEn, lastNameEn, password } = req.body || {};
    const rawEmail = (email || `user_${Math.floor(1000 + Math.random() * 9000)}@university.ac.th`).toString().trim().toLowerCase();

    // Multi-factor Identity Resolution: match exact email, alias, domain transition (.edu <-> .ac.th), or student ID
    let user = findUserByIdentity(rawEmail, universityId, role as UserRole);

    // Maintenance mode check for non-admin users
    const isMaintenance = systemSettings.maintenanceMode || systemSettings.systemMaintenanceMode;
    const isUserAdmin = (user && (user.role === UserRole.ADMIN || user.id === 'usr_admin_1')) || rawEmail === SUPER_ADMIN_EMAIL;
    if (isMaintenance && !isUserAdmin) {
      const msg = systemSettings.maintenanceMessage || systemSettings.announcementMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก';
      return res.status(503).json({
        error: `[โหมดปิดปรับปรุงระบบ] ${msg}`,
      });
    }

    if (!user) {
      // Check if system allows auto registration via Google
      if (!systemSettings.allowGoogleAutoRegister && rawEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
          error: 'ระบบปิดการสมัครสมาชิกใหม่ชั่วคราว กรุณาติดต่อผู้ดูแลระบบเพื่อขออนุมัติหรือสร้างบัญชี',
        });
      }

      // Domain permission check
      const domainCheck = checkRegistrationDomain(rawEmail);
      if (!domainCheck.allowed) {
        return res.status(403).json({ error: domainCheck.reason });
      }

      const forcedRole = domainCheck.forcedRole;

      // If user does not exist in system yet and no role is explicitly passed
      if (!role) {
        const sDomain = systemSettings.studentDomain || 'student.mahidol.ac.th';
        const tDomain = systemSettings.teacherDomain || 'mahidol.ac.th';

        return res.json({
          requiresOnboarding: true,
          forcedRole: forcedRole,
          email: rawEmail,
          name: name || rawEmail.split('@')[0],
          picture: picture || 'https://lh3.googleusercontent.com/a/default-user',
          message: forcedRole === UserRole.STUDENT
            ? `พบอีเมลนักศึกษา (@${sDomain}) กรุณากรอกข้อมูลสำหรับนักศึกษาเพื่อเริ่มต้นใช้งาน`
            : forcedRole === UserRole.TEACHER
            ? `พบอีเมลอาจารย์ (@${tDomain}) กรุณากรอกข้อมูลสำหรับอาจารย์เพื่อเริ่มต้นใช้งาน`
            : forcedRole === UserRole.ADMIN
            ? 'พบอีเมลผู้ดูแลระบบ กรุณากรอกข้อมูลผู้ดูแลระบบเพื่อเริ่มต้นใช้งาน'
            : 'ผู้ใช้งานใหม่ กรุณาตั้งค่าประเภทบัญชี กำหนดรหัสผ่าน และระบุข้อมูลประจำตัวเพื่อเริ่มต้นใช้งาน',
        });
      }

      // Determine effective user role: forcedRole takes precedence over requested role
      const effectiveRole = forcedRole || (role === UserRole.TEACHER ? UserRole.TEACHER : role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.STUDENT);

      // Validate Student ID if registering as Student
      if (effectiveRole === UserRole.STUDENT && (!universityId || !(universityId + '').trim())) {
        return res.status(400).json({ error: 'กรุณาระบุรหัสประจำตัวนักศึกษาที่ถูกต้อง' });
      }

      const parts = (name || 'Google User').toString().trim().split(' ');
      const fTh = firstNameTh && firstNameTh.toString().trim() ? firstNameTh.toString().trim() : (parts[0] || 'ผู้ใช้งาน');
      const lTh = lastNameTh && lastNameTh.toString().trim() ? lastNameTh.toString().trim() : (parts.slice(1).join(' ') || 'กูเกิล');
      const fEn = firstNameEn && firstNameEn.toString().trim() ? firstNameEn.toString().trim() : (parts[0] || 'Google');
      const lEn = lastNameEn && lastNameEn.toString().trim() ? lastNameEn.toString().trim() : (parts.slice(1).join(' ') || 'User');

      const canonicalEmail = getCanonicalUniversityEmail(rawEmail);
      const emailAliasesList = new Set<string>();
      if (canonicalEmail !== rawEmail) {
        emailAliasesList.add(rawEmail);
      }
      getEmailDomainVariants(rawEmail).forEach((v) => emailAliasesList.add(v));

      user = {
        id: `usr_g_${Date.now()}`,
        role: effectiveRole,
        title: title ? title.toString().trim() : (effectiveRole === UserRole.TEACHER ? 'อ.ดร.' : effectiveRole === UserRole.ADMIN ? 'แอดมิน' : 'นาย'),
        firstNameTh: fTh,
        lastNameTh: lTh,
        firstNameEn: fEn,
        lastNameEn: lEn,
        universityId: effectiveRole === UserRole.STUDENT ? (universityId || '').toString().trim() : '',
        email: canonicalEmail,
        emailAliases: Array.from(emailAliasesList),
        password: password && password.toString().trim() ? password.toString().trim() : '123456',
        avatarUrl: picture || 'https://lh3.googleusercontent.com/a/default-user',
        authProvider: 'google',
        deviceId: `dev_g_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      saveToFirestore(COLLECTIONS.USERS, user);
    } else {
      if (user.isSuspended) {
        return res.status(403).json({
          error: `บัญชีของคุณถูกระงับการใช้งานโดยผู้ดูแลระบบ ${user.suspendedReason ? `(สาเหตุ: ${user.suspendedReason})` : ''}`,
        });
      }

      // Existing user signing in with Google - Auto Upgrade to canonical .ac.th and preserve aliases
      if (!Array.isArray(user.emailAliases)) {
        user.emailAliases = [];
      }
      if (!user.emailAliases.includes(user.email)) {
        user.emailAliases.push(user.email);
      }
      if (!user.emailAliases.includes(rawEmail)) {
        user.emailAliases.push(rawEmail);
      }

      // If user logs in with .ac.th while currently having .edu, upgrade primary email
      const canonical = getCanonicalUniversityEmail(rawEmail);
      if (rawEmail.endsWith('.ac.th') && user.email.endsWith('.edu')) {
        if (!user.emailAliases.includes(user.email)) {
          user.emailAliases.push(user.email);
        }
        user.email = canonical;
      }

      // Link account & update avatar / password if provided
      if (picture) user.avatarUrl = picture;
      if (!user.authProvider) user.authProvider = 'google';
      if (password && password.toString().trim()) {
        user.password = password.toString().trim();
      }
      if (rawEmail === SUPER_ADMIN_EMAIL) {
        user.role = UserRole.ADMIN;
      }
      saveToFirestore(COLLECTIONS.USERS, user);
    }

    res.json({ message: 'เข้าสู่ระบบด้วย Google สำเร็จ (Google Auth successful)', user });
  } catch (err: any) {
    console.error('Error in /api/auth/google:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการประมวลผลระบบลงทะเบียน/เข้าสู่ระบบด้วย Google กรุณาลองใหม่อีกครั้ง' });
  }
});

app.get('/api/users/me', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = resolveActiveUser(userId) || users.get(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  res.json(user);
});

// 2. Course Management
app.get('/api/courses', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = resolveActiveUser(userId) || users.get(userId);

  if (!user) {
    return res.json([]);
  }

  const effectiveUserId = user.id;
  let result: Course[] = [];

  if (user.role === UserRole.STUDENT) {
    const enrolledCourseIds = courseMembers
      .filter((m) => (m.userId === effectiveUserId || m.userId === userId) && m.role === CourseMemberRole.STUDENT)
      .map((m) => m.courseId);
    result = Array.from(courses.values()).filter((c) => enrolledCourseIds.includes(c.id));
  } else if (user.role === UserRole.ADMIN) {
    result = Array.from(courses.values());
  } else if (user.role === UserRole.TEACHER) {
    const memberCourseIds = courseMembers
      .filter((m) => (m.userId === effectiveUserId || m.userId === userId))
      .map((m) => m.courseId);
    result = Array.from(courses.values()).filter((c) => {
      if (c.ownerId === effectiveUserId || c.ownerId === userId || memberCourseIds.includes(c.id)) return true;
      if (user.firstNameTh && (c.coordinatorName?.includes(user.firstNameTh) || c.ownerName?.includes(user.firstNameTh))) return true;
      return false;
    });
    // Fallback: If teacher has no specific courses bound yet, return all courses so new teacher accounts see available courses
    if (result.length === 0) {
      result = Array.from(courses.values());
    }
  } else {
    result = [];
  }

  result.forEach((c) => {
    if (c.weeks && Array.isArray(c.weeks)) {
      c.weeks.sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
    }
  });

  res.json(result);
});

app.post('/api/courses', async (req, res) => {
  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks, ownerId, defaultLat, defaultLng, allowedGpsRadius, curriculums, facultyCode, departmentCode, majorCode, degreeLevel } = req.body;

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
  const radius = parseFloat(allowedGpsRadius) || 200;

  const initialWeeks = Array.isArray(weeks) ? weeks : [];
  initialWeeks.sort((a: any, b: any) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));

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
    allowedGpsRadius: radius,
    weeks: initialWeeks,
    curriculums: Array.isArray(curriculums) ? curriculums : (curriculums ? [curriculums] : []),
    facultyCode: facultyCode || 'MT',
    departmentCode: departmentCode || 'ID',
    majorCode: majorCode || 'MTMT',
    degreeLevel: degreeLevel || 'ปริญญาตรี',
    createdAt: new Date().toISOString(),
  };

  courses.set(newCourse.id, newCourse);
  deletedCourseIds.delete(newCourse.id);
  await saveToFirestore(COLLECTIONS.COURSES, newCourse);

  // Add owner as course member
  const ownerMember: CourseMember = {
    id: `cm_${Date.now()}`,
    courseId: newCourse.id,
    userId: owner.id,
    role: CourseMemberRole.CO_TEACHER,
    joinedAt: new Date().toISOString(),
  };
  courseMembers.push(ownerMember);
  deletedMemberIds.delete(ownerMember.id);
  await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, ownerMember);

  // Automatically create session entries for each week and batch-persist to Firestore
  const newSessionsToSave: Session[] = [];
  newCourse.weeks.forEach((w) => {
    const wNum = Number(w.weekNumber) || 1;
    const sesId = `ses_${newCourse.id}_w${wNum}`;
    const newSession: Session = {
      id: sesId,
      courseId: newCourse.id,
      weekNumber: wNum,
      topic: w.topic || `สัปดาห์ที่ ${wNum}`,
      teacherLat: lat,
      teacherLng: lng,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    sessions.set(sesId, newSession);
    deletedSessionIds.delete(sesId);
    newSessionsToSave.push(newSession);
  });

  if (newSessionsToSave.length > 0) {
    await batchSaveToFirestore(COLLECTIONS.SESSIONS, newSessionsToSave);
  }

  saveLocalCache();
  res.json({ message: 'Course created successfully', course: newCourse });
});

// Clone / Duplicate Course Structure
app.post('/api/courses/:id/clone', async (req, res) => {
  const sourceCourseId = req.params.id;
  const { teacherId, academicYear, semester, newCourseCode, newCourseName, startDate, includeCoTeachers } = req.body;
  const reqUserId = (req.headers['x-user-id'] as string) || teacherId;

  const sourceCourse = courses.get(sourceCourseId);
  if (!sourceCourse || deletedCourseIds.has(sourceCourseId)) {
    return res.status(404).json({ error: 'ไม่พบรายวิชาต้นแบบที่ต้องการคัดลอก' });
  }

  const actingUser = reqUserId ? users.get(reqUserId) : null;
  const isAdmin = actingUser?.role === UserRole.ADMIN;
  const isOwner = sourceCourse.ownerId === reqUserId;
  const memberObj = courseMembers.find((m) => m.courseId === sourceCourseId && m.userId === reqUserId);
  const isTeacherOrCoordinator = memberObj && (
    memberObj.role === CourseMemberRole.COORDINATOR ||
    memberObj.role === CourseMemberRole.CO_COORDINATOR ||
    memberObj.role === CourseMemberRole.CO_TEACHER ||
    (memberObj.role as string) === 'TEACHER' ||
    (memberObj.role as string) === 'INSTRUCTOR'
  );

  if (!isAdmin && !isOwner && !isTeacherOrCoordinator) {
    return res.status(403).json({
      error: 'เฉพาะผู้สร้างรายวิชา ผู้รับผิดชอบรายวิชา หรืออาจารย์ผู้สอนเท่านั้นที่มีสิทธิ์คัดลอกโครงสร้างรายวิชา',
    });
  }

  const effectiveAcademicYear = parseInt(academicYear, 10) || (sourceCourse.academicYear ? sourceCourse.academicYear + 1 : 2570);
  const effectiveSemester = semester || sourceCourse.semester || Semester.FIRST;
  const finalCourseCode = (newCourseCode || sourceCourse.courseCode || '').trim().toUpperCase();
  const finalCourseName = (newCourseName || sourceCourse.courseName || '').trim();

  // Create clean new Course ID
  const newCourseId = `crs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Clone weeks with optional shifted dates
  const clonedWeeks: TeachingWeek[] = (sourceCourse.weeks || []).map((w, idx) => {
    const wNum = Number(w.weekNumber) || idx + 1;
    let computedDate = w.date;
    if (startDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (wNum - 1) * 7);
      computedDate = d.toISOString().split('T')[0];
    }
    return {
      weekNumber: wNum,
      topic: w.topic || `สัปดาห์ที่ ${wNum}`,
      date: computedDate || '',
    };
  });
  clonedWeeks.sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));

  const newCourseOwnerId = actingUser?.id || sourceCourse.ownerId;
  const newCourseOwnerName = actingUser
    ? `${actingUser.title || ''} ${actingUser.firstNameTh || ''} ${actingUser.lastNameTh || ''}`.trim() || actingUser.email
    : sourceCourse.ownerName;

  const newCourse: Course = {
    id: newCourseId,
    courseCode: finalCourseCode,
    courseName: finalCourseName,
    academicYear: effectiveAcademicYear,
    semester: effectiveSemester,
    coordinatorName: sourceCourse.coordinatorName || newCourseOwnerName,
    ownerId: newCourseOwnerId,
    ownerName: newCourseOwnerName,
    defaultLat: sourceCourse.defaultLat || 13.7988363,
    defaultLng: sourceCourse.defaultLng || 100.322944,
    allowedGpsRadius: sourceCourse.allowedGpsRadius || 200,
    weeks: clonedWeeks,
    curriculums: Array.isArray(sourceCourse.curriculums) ? [...sourceCourse.curriculums] : [],
    facultyCode: sourceCourse.facultyCode || 'MT',
    departmentCode: sourceCourse.departmentCode || 'ID',
    majorCode: sourceCourse.majorCode || 'MTMT',
    degreeLevel: sourceCourse.degreeLevel || 'ปริญญาตรี',
    createdAt: new Date().toISOString(),
  };

  courses.set(newCourse.id, newCourse);
  deletedCourseIds.delete(newCourse.id);
  await saveToFirestore(COLLECTIONS.COURSES, newCourse);

  // 1. Add owner/creator member
  const membersToSave: CourseMember[] = [];
  const ownerMember: CourseMember = {
    id: `cm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    courseId: newCourse.id,
    userId: newCourseOwnerId,
    role: CourseMemberRole.CO_TEACHER,
    joinedAt: new Date().toISOString(),
  };
  courseMembers.push(ownerMember);
  deletedMemberIds.delete(ownerMember.id);
  membersToSave.push(ownerMember);

  // 2. Optionally clone Co-teachers and Instructors (cleanly excluding students)
  if (includeCoTeachers !== false) {
    const existingSourceTeachers = courseMembers.filter(
      (m) =>
        m.courseId === sourceCourseId &&
        m.userId !== newCourseOwnerId &&
        m.role !== CourseMemberRole.STUDENT &&
        (m.role as string) !== 'STUDENT'
    );

    for (const st of existingSourceTeachers) {
      const coMember: CourseMember = {
        id: `cm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        courseId: newCourse.id,
        userId: st.userId,
        role: st.role,
        joinedAt: new Date().toISOString(),
      };
      courseMembers.push(coMember);
      deletedMemberIds.delete(coMember.id);
      membersToSave.push(coMember);
    }
  }

  if (membersToSave.length > 0) {
    await batchSaveToFirestore(COLLECTIONS.COURSE_MEMBERS, membersToSave);
  }

  // 3. Create fresh Sessions for each week
  const newSessionsToSave: Session[] = [];
  clonedWeeks.forEach((w) => {
    const wNum = Number(w.weekNumber) || 1;
    const sesId = `ses_${newCourse.id}_w${wNum}`;
    const newSession: Session = {
      id: sesId,
      courseId: newCourse.id,
      weekNumber: wNum,
      topic: w.topic || `สัปดาห์ที่ ${wNum}`,
      teacherLat: newCourse.defaultLat,
      teacherLng: newCourse.defaultLng,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    sessions.set(sesId, newSession);
    deletedSessionIds.delete(sesId);
    newSessionsToSave.push(newSession);
  });

  if (newSessionsToSave.length > 0) {
    await batchSaveToFirestore(COLLECTIONS.SESSIONS, newSessionsToSave);
  }

  // 4. Generate clean static invite tokens for Students & Teachers
  const studentInviteCode = generateStatic4CharToken(newCourse.id, CourseMemberRole.STUDENT);
  const studentInvite: InviteLink = {
    id: `inv_${newCourse.id}_${CourseMemberRole.STUDENT}`,
    courseId: newCourse.id,
    role: CourseMemberRole.STUDENT,
    code: studentInviteCode,
    expiresAt: '2099-12-31T23:59:59.000Z',
  };
  inviteLinks.set(studentInviteCode, studentInvite);

  const teacherInviteCode = generateStatic4CharToken(newCourse.id, CourseMemberRole.INSTRUCTOR);
  const teacherInvite: InviteLink = {
    id: `inv_${newCourse.id}_${CourseMemberRole.INSTRUCTOR}`,
    courseId: newCourse.id,
    role: CourseMemberRole.INSTRUCTOR,
    code: teacherInviteCode,
    expiresAt: '2099-12-31T23:59:59.000Z',
  };
  inviteLinks.set(teacherInviteCode, teacherInvite);

  saveLocalCache();

  res.json({
    message: `คัดลอกโครงสร้างรายวิชา ${finalCourseCode} เรียบร้อยแล้ว (สร้างคาบเรียน ${clonedWeeks.length} สัปดาห์ พร้อมใช้งาน)`,
    course: newCourse,
    clonedSessionsCount: clonedWeeks.length,
    clonedTeachersCount: membersToSave.length,
    studentInviteCode,
  });
});

// Helper function to guarantee Session entries exist for every week in course.weeks
function ensureCourseSessions(course: Course): Session[] {
  if (!course) return [];

  const courseLat = course.defaultLat || 13.7988363;
  const courseLng = course.defaultLng || 100.322944;

  if (Array.isArray(course.weeks) && course.weeks.length > 0) {
    const existingSessions = Array.from(sessions.values()).filter((s) => s.courseId === course.id);
    const existingWeekMap = new Map<number, Session>();
    existingSessions.forEach((s) => {
      existingWeekMap.set(Number(s.weekNumber), s);
    });

    const sessionsToPersist: Session[] = [];

    course.weeks.forEach((w) => {
      const wNum = Number(w.weekNumber) || 1;
      const existing = existingWeekMap.get(wNum);
      if (!existing) {
        const sesId = `ses_${course.id}_w${wNum}`;
        const newSession: Session = {
          id: sesId,
          courseId: course.id,
          weekNumber: wNum,
          topic: w.topic || `สัปดาห์ที่ ${wNum}`,
          teacherLat: courseLat,
          teacherLng: courseLng,
          isActive: false,
          createdAt: new Date().toISOString(),
        };
        sessions.set(sesId, newSession);
        deletedSessionIds.delete(sesId);
        sessionsToPersist.push(newSession);
      } else if (w.topic && existing.topic !== w.topic) {
        existing.topic = w.topic;
        sessions.set(existing.id, existing);
        sessionsToPersist.push(existing);
      }
    });

    if (sessionsToPersist.length > 0) {
      batchSaveToFirestore(COLLECTIONS.SESSIONS, sessionsToPersist).catch(() => {});
    }
  }

  return Array.from(sessions.values())
    .filter((s) => s.courseId === course.id)
    .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
}

app.get('/api/courses/:id', (req, res) => {
  const course = courses.get(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  if (course.weeks && Array.isArray(course.weeks)) {
    course.weeks.sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
  }

  const rawMembers = courseMembers.filter((cm) => cm.courseId === course.id);
  const uniqueMemberMap = new Map<string, CourseMember>();
  const rolePriority: Record<string, number> = {
    [CourseMemberRole.COORDINATOR]: 4,
    [CourseMemberRole.CO_TEACHER]: 3,
    [CourseMemberRole.CO_COORDINATOR]: 3,
    [CourseMemberRole.INSTRUCTOR]: 2,
    [CourseMemberRole.STUDENT]: 1,
  };

  for (const cm of rawMembers) {
    if (!cm || !cm.userId) continue;
    if (!uniqueMemberMap.has(cm.userId)) {
      uniqueMemberMap.set(cm.userId, cm);
    } else {
      const existing = uniqueMemberMap.get(cm.userId)!;
      if ((rolePriority[cm.role] || 0) > (rolePriority[existing.role] || 0)) {
        uniqueMemberMap.set(cm.userId, cm);
      }
    }
  }

  const members = Array.from(uniqueMemberMap.values()).map((cm) => ({
    ...cm,
    user: users.get(cm.userId),
  }));

  const courseSessions = ensureCourseSessions(course);

  res.json({
    course,
    members,
    sessions: courseSessions,
  });
});

app.put('/api/courses/:id', async (req, res) => {
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

  const { courseCode, courseName, academicYear, semester, coordinatorName, weeks, defaultLat, defaultLng, allowedGpsRadius, curriculums, facultyCode, departmentCode, majorCode, degreeLevel } = req.body;

  if (courseCode) course.courseCode = courseCode;
  if (courseName) course.courseName = courseName;
  if (academicYear) course.academicYear = parseInt(academicYear, 10);
  if (semester) course.semester = semester;
  if (coordinatorName) course.coordinatorName = coordinatorName;
  if (defaultLat !== undefined) course.defaultLat = parseFloat(defaultLat);
  if (defaultLng !== undefined) course.defaultLng = parseFloat(defaultLng);
  if (allowedGpsRadius !== undefined) course.allowedGpsRadius = parseFloat(allowedGpsRadius);
  if (curriculums !== undefined) course.curriculums = Array.isArray(curriculums) ? curriculums : [curriculums];
  if (facultyCode) course.facultyCode = facultyCode;
  if (departmentCode) course.departmentCode = departmentCode;
  if (majorCode) course.majorCode = majorCode;
  if (degreeLevel) course.degreeLevel = degreeLevel;

  const courseLat = course.defaultLat || 13.7988363;
  const courseLng = course.defaultLng || 100.322944;

  const sessionsToSave: Session[] = [];
  const sessionsToDelete: string[] = [];

  // Synchronize all existing sessions with course default location
  Array.from(sessions.values()).forEach((s) => {
    if (s.courseId === courseId) {
      s.teacherLat = courseLat;
      s.teacherLng = courseLng;
      sessions.set(s.id, s);
      sessionsToSave.push(s);
    }
  });

  if (Array.isArray(weeks)) {
    weeks.sort((a: any, b: any) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
    course.weeks = weeks;

    // Synchronize sessions Map with updated weeks list
    const existingSessions = Array.from(sessions.values()).filter((s) => s.courseId === courseId);
    const currentWeekNumbers = new Set(weeks.map((w: any) => Number(w.weekNumber)));

    // Delete sessions for weeks that were removed
    existingSessions.forEach((s) => {
      if (!currentWeekNumbers.has(Number(s.weekNumber))) {
        sessions.delete(s.id);
        deletedSessionIds.add(s.id);
        sessionsToDelete.push(s.id);
      }
    });

    // Create or update sessions for current weeks
    weeks.forEach((w: any) => {
      const wNum = Number(w.weekNumber) || 1;
      const existingSession = existingSessions.find((s) => Number(s.weekNumber) === wNum);
      if (existingSession) {
        existingSession.weekNumber = wNum;
        existingSession.topic = w.topic;
        existingSession.teacherLat = courseLat;
        existingSession.teacherLng = courseLng;
        sessions.set(existingSession.id, existingSession);
        deletedSessionIds.delete(existingSession.id);
        if (!sessionsToSave.some((s) => s.id === existingSession.id)) {
          sessionsToSave.push(existingSession);
        }
      } else {
        const newSesId = `ses_${courseId}_w${wNum}`;
        const newSession: Session = {
          id: newSesId,
          courseId,
          weekNumber: wNum,
          topic: w.topic || `สัปดาห์ที่ ${wNum}`,
          teacherLat: courseLat,
          teacherLng: courseLng,
          isActive: false,
          createdAt: new Date().toISOString(),
        };
        sessions.set(newSesId, newSession);
        deletedSessionIds.delete(newSesId);
        sessionsToSave.push(newSession);
      }
    });
  }

  courses.set(courseId, course);
  deletedCourseIds.delete(courseId);

  // Real-time Cloud Firestore Persistence
  await saveToFirestore(COLLECTIONS.COURSES, course);

  if (sessionsToSave.length > 0) {
    await batchSaveToFirestore(COLLECTIONS.SESSIONS, sessionsToSave);
  }

  for (const delSesId of sessionsToDelete) {
    await deleteFromFirestore(COLLECTIONS.SESSIONS, delSesId);
  }

  if (sessionsToDelete.length > 0) {
    await saveTombstonesToFirestore();
  }

  saveLocalCache();

  const updatedSessions = Array.from(sessions.values())
    .filter((s) => s.courseId === courseId)
    .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));

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

  // Auto-backup before course deletion
  await createSnapshotBackup(`Pre-Course Deletion (${course.courseCode || courseId})`, user.email || user.id);

  // Delete course from memory and Firestore
  courses.delete(courseId);
  deletedCourseIds.add(courseId);
  deleteFromFirestore(COLLECTIONS.COURSES, courseId).catch(() => {});

  // Delete course members
  for (let i = courseMembers.length - 1; i >= 0; i--) {
    if (courseMembers[i].courseId === courseId) {
      const member = courseMembers[i];
      deletedMemberIds.add(member.id);
      courseMembers.splice(i, 1);
      deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, member.id).catch(() => {});
    }
  }

  // Delete sessions associated with courseId
  const deletedSesIds = new Set<string>();
  for (const [sesId, ses] of Array.from(sessions.entries())) {
    if (ses.courseId === courseId) {
      sessions.delete(sesId);
      deletedSessionIds.add(sesId);
      deletedSesIds.add(sesId);
      deleteFromFirestore(COLLECTIONS.SESSIONS, sesId).catch(() => {});
    }
  }

  // NOTE: DATA PROTECTION POLICY
  // Attendance/Checkin records are NEVER cascade-deleted when a course is removed.
  // They remain in the database as historical audit records for students and administrators.
  for (const att of attendanceRecords) {
    if (deletedSesIds.has(att.sessionId)) {
      (att as any).detachedCourse = true;
      (att as any).originalCourseCode = course.courseCode;
      (att as any).originalCourseName = course.courseName;
    }
  }

  // Delete quick events strictly associated with this course or teacher
  for (const [qId, qEvent] of Array.from(quickEvents.entries())) {
    if ((qEvent as any).courseId === courseId || qEvent.teacherId === user.id) {
      quickEvents.delete(qId);
      deletedQuickEventIds.add(qId);
      deleteFromFirestore(COLLECTIONS.QUICK_EVENTS, qId).catch(() => {});
    }
  }

  // Cascade delete leave requests strictly associated with this courseId
  for (let i = leaveRequests.length - 1; i >= 0; i--) {
    if (leaveRequests[i].courseId === courseId) {
      const leaveId = leaveRequests[i].id;
      deletedLeaveIds.add(leaveId);
      leaveRequests.splice(i, 1);
      deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, leaveId).catch(() => {});
    }
  }

  saveLocalCache();
  await saveTombstonesToFirestore();

  res.json({ message: 'ลบรายวิชาสำเร็จ โดยประวัติการเช็กชื่อของนักศึกษาจะถูกเก็บรักษาไว้อย่างปลอดภัย', courseId });
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

app.post('/api/courses/:id/members/invite-student', async (req, res) => {
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
    deletedMemberIds.delete(existingMember.id);
    await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, existingMember);
    saveLocalCache();
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
  deletedMemberIds.delete(newMember.id);
  await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);
  saveLocalCache();

  res.json({
    message: `เพิ่มนักศึกษา ${targetStudent.firstNameTh} ${targetStudent.lastNameTh} (${targetStudent.universityId || '-'}) เข้าร่วมรายวิชาสำเร็จ`,
    member: { ...newMember, user: targetStudent },
  });
});

app.post('/api/courses/:id/members/invite-students-batch', async (req, res) => {
  const courseId = req.params.id;
  const { studentUserIds } = req.body;

  if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อนักศึกษาอย่างน้อย 1 คน' });
  }

  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชาที่ระบุ' });
  }

  let addedCount = 0;
  let updatedCount = 0;
  const newMembersToSave: CourseMember[] = [];

  for (const uid of studentUserIds) {
    const targetStudent = users.get(uid);
    if (!targetStudent) continue;

    const existingMember = courseMembers.find((m) => m.courseId === courseId && m.userId === uid);
    if (existingMember) {
      existingMember.role = CourseMemberRole.STUDENT;
      deletedMemberIds.delete(existingMember.id);
      newMembersToSave.push(existingMember);
      updatedCount++;
    } else {
      const newMember: CourseMember = {
        id: `cm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        courseId,
        userId: uid,
        role: CourseMemberRole.STUDENT,
        joinedAt: new Date().toISOString(),
      };
      courseMembers.push(newMember);
      deletedMemberIds.delete(newMember.id);
      newMembersToSave.push(newMember);
      addedCount++;
    }
  }

  if (newMembersToSave.length > 0) {
    await batchSaveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMembersToSave);
  }

  saveLocalCache();

  res.json({
    message: `เพิ่มนักศึกษาเข้าร่วมรายวิชาสำเร็จจำนวน ${addedCount} คน${updatedCount > 0 ? ` (มีอยู่แล้ว ${updatedCount} คน)` : ''}`,
    addedCount,
    updatedCount,
    total: studentUserIds.length,
  });
});

app.post('/api/courses/:id/members/invite-teacher', async (req, res) => {
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
    deletedMemberIds.delete(existingMember.id);
    await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, existingMember);
    saveLocalCache();
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
  deletedMemberIds.delete(newMember.id);
  await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);
  saveLocalCache();

  res.json({
    message: `เพิ่ม/เชิญ ${targetTeacher.title} ${targetTeacher.firstNameTh} ${targetTeacher.lastNameTh} เข้าร่วมรายวิชาสำเร็จ`,
    member: { ...newMember, user: targetTeacher },
  });
});

app.put('/api/courses/:id/members/:memberId/role', async (req, res) => {
  const { id: courseId, memberId } = req.params;
  const { role } = req.body;

  const member = courseMembers.find((m) => m.id === memberId || (m.courseId === courseId && m.userId === memberId));
  if (!member) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ในรายวิชานี้' });
  }

  member.role = role;
  deletedMemberIds.delete(member.id);
  await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, member);
  saveLocalCache();

  res.json({ message: 'อัปเดตสิทธิ์ของอาจารย์เรียบร้อยแล้ว', member });
});

app.delete('/api/courses/:id/members/:memberId', async (req, res) => {
  const { id: courseId, memberId } = req.params;
  const { teacherId, password } = req.body || {};
  const reqUserId = (req.headers['x-user-id'] as string) || teacherId;

  // 1. Verify User permissions
  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในระบบ' });
  }

  const reqUser = reqUserId ? users.get(reqUserId) : null;
  const isAdmin = reqUser?.role === UserRole.ADMIN;
  const isOwner = course.ownerId === reqUserId;
  const memberObj = courseMembers.find((m) => m.courseId === courseId && m.userId === reqUserId);
  const isTeacherOrCoordinator = memberObj && (
    memberObj.role === CourseMemberRole.COORDINATOR ||
    memberObj.role === CourseMemberRole.CO_TEACHER ||
    (memberObj.role as string) === 'TEACHER' ||
    (memberObj.role as string) === 'INSTRUCTOR'
  );

  if (!isAdmin && !isOwner && !isTeacherOrCoordinator) {
    return res.status(403).json({
      error: 'เฉพาะแอดมิน (Admin), ผู้สร้างรายวิชา, และอาจารย์ผู้รับผิดชอบรายวิชาเท่านั้นที่มีสิทธิ์ลบนักศึกษา',
    });
  }

  // 2. Verify Password of the acting user
  if (!reqUser) {
    return res.status(400).json({ error: 'ไม่พบข้อมูลอาจารย์ผู้ดำเนินการลบ' });
  }

  if (!password || password.toString().trim() === '') {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านของอาจารย์เพื่อยืนยันการลบนักศึกษา' });
  }

  const expectedPassword = reqUser.password || '123456';
  if (password.toString().trim() !== expectedPassword) {
    return res.status(400).json({ error: 'รหัสผ่านอาจารย์ไม่ถูกต้อง ไม่สามารถลบนักศึกษาได้' });
  }

  const index = courseMembers.findIndex((m) => m.id === memberId || (m.courseId === courseId && m.userId === memberId));
  if (index === -1) {
    return res.status(404).json({ error: 'ไม่พบสมาชิกในรายวิชานี้' });
  }

  const removed = courseMembers.splice(index, 1)[0];
  await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, removed.id);
  saveLocalCache();

  res.json({ message: 'ลบสมาชิกออกจากรายวิชาเรียบร้อยแล้ว', memberId: removed.id });
});

app.post('/api/courses/:id/members/batch-delete', async (req, res) => {
  const { id: courseId } = req.params;
  const { memberIds, teacherId, password } = req.body as { memberIds: string[]; teacherId?: string; password?: string };
  const reqUserId = (req.headers['x-user-id'] as string) || teacherId;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อสมาชิกที่ต้องการลบ' });
  }

  // 1. Verify User permissions
  const course = courses.get(courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในระบบ' });
  }

  const reqUser = reqUserId ? users.get(reqUserId) : null;
  const isAdmin = reqUser?.role === UserRole.ADMIN;
  const isOwner = course.ownerId === reqUserId;
  const memberObj = courseMembers.find((m) => m.courseId === courseId && m.userId === reqUserId);
  const isTeacherOrCoordinator = memberObj && (
    memberObj.role === CourseMemberRole.COORDINATOR ||
    memberObj.role === CourseMemberRole.CO_TEACHER ||
    (memberObj.role as string) === 'TEACHER' ||
    (memberObj.role as string) === 'INSTRUCTOR'
  );

  if (!isAdmin && !isOwner && !isTeacherOrCoordinator) {
    return res.status(403).json({
      error: 'เฉพาะแอดมิน (Admin), ผู้สร้างรายวิชา, และอาจารย์ผู้รับผิดชอบรายวิชาเท่านั้นที่มีสิทธิ์ลบนักศึกษา',
    });
  }

  // 2. Verify Password of the acting user
  if (!reqUser) {
    return res.status(400).json({ error: 'ไม่พบข้อมูลอาจารย์ผู้ดำเนินการลบ' });
  }

  if (!password || password.toString().trim() === '') {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านของอาจารย์เพื่อยืนยันการลบนักศึกษา' });
  }

  const expectedPassword = reqUser.password || '123456';
  if (password.toString().trim() !== expectedPassword) {
    return res.status(400).json({ error: 'รหัสผ่านอาจารย์ไม่ถูกต้อง ไม่สามารถลบนักศึกษาได้' });
  }

  const idsToDeleteSet = new Set(memberIds);
  const removedMembers: CourseMember[] = [];

  for (let i = courseMembers.length - 1; i >= 0; i--) {
    const m = courseMembers[i];
    if (m.courseId === courseId && (idsToDeleteSet.has(m.id) || idsToDeleteSet.has(m.userId))) {
      const removed = courseMembers.splice(i, 1)[0];
      removedMembers.push(removed);
      await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, removed.id);
    }
  }
  saveLocalCache();

  res.json({
    message: `ลบสมาชิกออกจากรายวิชาเรียบร้อยแล้ว ${removedMembers.length} คน`,
    count: removedMembers.length,
    removedIds: removedMembers.map((m) => m.id),
  });
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

app.post('/api/invites/join', async (req, res) => {
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
  deletedMemberIds.delete(newMember.id);
  await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, newMember);
  saveLocalCache();

  res.json({ message: 'เข้าร่วมรายวิชาสำเร็จเรียบร้อยแล้ว!', courseId: targetCourseId });
});

// 3. Active Session & Dynamic QR Management
app.post('/api/sessions/:id/activate', async (req, res) => {
  const { teacherLat, teacherLng, isGpsCheckEnabled = true, sessionDurationMinutes, lateThresholdMinutes, isStaticQr, qrRefreshIntervalSeconds } = req.body;
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const course = courses.get(session.courseId);

  const intervalSec = Math.max(5, Math.min(600, Number(qrRefreshIntervalSeconds) || session.qrRefreshIntervalSeconds || systemSettings.dynamicQrIntervalSeconds || 30));

  session.isActive = true;
  session.activatedAt = new Date().toISOString();
  session.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  session.sessionDurationMinutes = sessionDurationMinutes ? Number(sessionDurationMinutes) : (session.sessionDurationMinutes || 30);
  session.lateThresholdMinutes = lateThresholdMinutes ? Number(lateThresholdMinutes) : (session.lateThresholdMinutes || 15);
  session.isStaticQr = isStaticQr === true;
  session.qrRefreshIntervalSeconds = intervalSec;

  let inputLat = teacherLat !== undefined ? parseFloat(teacherLat) : NaN;
  let inputLng = teacherLng !== undefined ? parseFloat(teacherLng) : NaN;

  // If teacher Lat/Lng passed is missing, generic default, or uncalibrated, prefer course classroom location
  if (isNaN(inputLat) || isNaN(inputLng) || (Math.abs(inputLat - 13.7563) < 0.05 && Math.abs(inputLng - 100.5018) < 0.05)) {
    if (course && course.defaultLat && course.defaultLng) {
      inputLat = course.defaultLat;
      inputLng = course.defaultLng;
    }
  }

  if (!isNaN(inputLat) && !isNaN(inputLng)) {
    session.teacherLat = inputLat;
    session.teacherLng = inputLng;
  } else if (course && course.defaultLat && course.defaultLng) {
    session.teacherLat = course.defaultLat;
    session.teacherLng = course.defaultLng;
  }

  // Generate immediate active QR token (6 characters) - fresh for each session
  const token = generate6CharToken();
  const isStatic = isStaticQr === true;
  const now = Date.now();
  const expiresAt = isStatic ? now + 86400000 : now + (intervalSec * 1000) + 5000;
  const nextRefreshAt = now + (intervalSec * 1000);

  const qrData: ActiveQR = {
    token,
    expiresAt,
    refreshIntervalSeconds: intervalSec,
    nextRefreshAt,
    lat: session.teacherLat,
    lng: session.teacherLng,
    isGpsCheckEnabled: session.isGpsCheckEnabled,
    isStatic,
  };
  activeQRCodes.set(session.id, qrData);

  deletedSessionIds.delete(session.id);
  await saveToFirestore(COLLECTIONS.SESSIONS, session);
  saveLocalCache();

  res.json({ message: 'Session QR code activated', session, qrToken: token, expiresAt, isStatic, refreshIntervalSeconds: intervalSec });
});

app.post('/api/sessions/:id/gps-toggle', async (req, res) => {
  const { isGpsCheckEnabled } = req.body;
  const targetId = req.params.id;
  const session = sessions.get(targetId);
  if (session) {
    session.isGpsCheckEnabled = isGpsCheckEnabled !== false;
    deletedSessionIds.delete(session.id);
    await saveToFirestore(COLLECTIONS.SESSIONS, session);
  }
  const qEvt = quickEvents.get(targetId);
  if (qEvt) {
    qEvt.isGpsCheckEnabled = isGpsCheckEnabled !== false;
    deletedQuickEventIds.delete(qEvt.id);
    await saveToFirestore(COLLECTIONS.QUICK_EVENTS, qEvt);
  }
  const activeQR = activeQRCodes.get(targetId);
  if (activeQR) {
    activeQR.isGpsCheckEnabled = isGpsCheckEnabled !== false;
  }
  saveLocalCache();
  res.json({ message: 'GPS check status updated', isGpsCheckEnabled: isGpsCheckEnabled !== false });
});

app.post('/api/sessions/:id/qr-mode', async (req, res) => {
  const { isStatic } = req.body;
  const targetId = req.params.id;
  const isStaticBool = isStatic === true;

  const session = sessions.get(targetId);
  if (session) {
    session.isStaticQr = isStaticBool;
    deletedSessionIds.delete(session.id);
    await saveToFirestore(COLLECTIONS.SESSIONS, session);
  }
  const qEvt = quickEvents.get(targetId);
  if (qEvt) {
    qEvt.isStaticQr = isStaticBool;
    deletedQuickEventIds.delete(qEvt.id);
    await saveToFirestore(COLLECTIONS.QUICK_EVENTS, qEvt);
  }

  const activeQR = activeQRCodes.get(targetId);
  if (activeQR) {
    const now = Date.now();
    const intervalSec = activeQR.refreshIntervalSeconds || systemSettings.dynamicQrIntervalSeconds || 30;
    activeQR.isStatic = isStaticBool;
    activeQR.expiresAt = isStaticBool ? now + 86400000 : now + (intervalSec * 1000) + 5000;
    activeQR.nextRefreshAt = now + (intervalSec * 1000);

    // Broadcast updated QR data immediately via WebSocket
    activeWsClients.forEach((client) => {
      if ((client.sessionId === targetId || client.eventId === targetId) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'QR_REFRESH', data: activeQR }));
      }
    });
  }

  saveLocalCache();
  res.json({ message: 'QR Mode updated successfully', isStatic: isStaticBool, activeQR });
});

app.post('/api/sessions/:id/qr-interval', async (req, res) => {
  const { qrRefreshIntervalSeconds } = req.body;
  const targetId = req.params.id;
  const intervalSec = Math.max(5, Math.min(600, Number(qrRefreshIntervalSeconds) || 30));

  const session = sessions.get(targetId);
  if (session) {
    session.qrRefreshIntervalSeconds = intervalSec;
    deletedSessionIds.delete(session.id);
    await saveToFirestore(COLLECTIONS.SESSIONS, session);
  }
  const qEvt = quickEvents.get(targetId);
  if (qEvt) {
    qEvt.qrRefreshIntervalSeconds = intervalSec;
    deletedQuickEventIds.delete(qEvt.id);
    await saveToFirestore(COLLECTIONS.QUICK_EVENTS, qEvt);
  }

  const activeQR = activeQRCodes.get(targetId);
  const now = Date.now();
  if (activeQR) {
    activeQR.refreshIntervalSeconds = intervalSec;
    if (!activeQR.isStatic) {
      // Immediately issue a fresh token with new refresh cycle
      const newToken = generate6CharToken();
      activeQR.token = newToken;
      activeQR.expiresAt = now + (intervalSec * 1000) + 5000;
      activeQR.nextRefreshAt = now + (intervalSec * 1000);
    }

    // Broadcast updated QR data immediately via WebSocket
    activeWsClients.forEach((client) => {
      if ((client.sessionId === targetId || client.eventId === targetId) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'QR_REFRESH', data: activeQR }));
      }
    });
  }

  saveLocalCache();
  res.json({ message: 'QR Refresh Interval updated', qrRefreshIntervalSeconds: intervalSec, activeQR });
});

app.post('/api/sessions/:id/deactivate', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (session) {
    session.isActive = false;
    activeQRCodes.delete(session.id);
    deletedSessionIds.delete(session.id);
    await saveToFirestore(COLLECTIONS.SESSIONS, session);
    saveLocalCache();
  }
  res.json({ message: 'Session closed', session });
});

app.get('/api/sessions/:id/records', (req, res) => {
  const records = attendanceRecords.filter((r) => r.sessionId === req.params.id);
  res.json(records);
});

app.get('/api/sessions/active', (req, res) => {
  const activeSessionsList: Array<{ session: Session; course?: Course; activeQR?: ActiveQR }> = [];
  const now = Date.now();
  sessions.forEach((s) => {
    if (s.isActive) {
      const maxDuration = s.sessionDurationMinutes || 30;
      if (s.activatedAt) {
        const elapsedMin = (now - new Date(s.activatedAt).getTime()) / (1000 * 60);
        if (elapsedMin > maxDuration) {
          s.isActive = false;
          activeQRCodes.delete(s.id);
          return;
        }
      }
      const course = courses.get(s.courseId);
      const qrData = activeQRCodes.get(s.id);
      activeSessionsList.push({ session: s, course, activeQR: qrData });
    }
  });
  activeSessionsList.sort((a, b) => (Number(a.session.weekNumber) || 0) - (Number(b.session.weekNumber) || 0));
  res.json(activeSessionsList);
});

// 4. ANTI-PROXY CHECK-IN ENDPOINT
app.post('/api/checkin', async (req, res) => {
  const { sessionId, qrToken, studentId, scannedLat, scannedLng, scannedAccuracy, deviceId, checkinMode = 'HYBRID' } = req.body;

  if (!sessionId || !studentId) {
    return res.status(400).json({ error: 'Missing check-in parameters.' });
  }

  const student = resolveActiveUser(studentId) || users.get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const session = sessions.get(sessionId);
  if (!session || !session.isActive) {
    return res.status(400).json({ error: 'Check-in session is not active or has been closed by teacher.' });
  }

  let activeQR = activeQRCodes.get(sessionId);
  if (!activeQR && session && session.isActive) {
    // Auto-rehydrate activeQR for active session if server memory was reset/restarted
    const intervalSec = session.qrRefreshIntervalSeconds || 30;
    const bufferMs = getGraceBufferMs(intervalSec);
    const token = generate6CharToken();
    activeQR = {
      token,
      expiresAt: Date.now() + (intervalSec * 1000) + bufferMs,
      refreshIntervalSeconds: intervalSec,
      nextRefreshAt: Date.now() + (intervalSec * 1000),
      lat: session.teacherLat,
      lng: session.teacherLng,
      isGpsCheckEnabled: session.isGpsCheckEnabled,
      isStatic: false,
      previousTokens: [],
    };
    activeQRCodes.set(sessionId, activeQR);
  }

  // Mode validation: QR_ONLY, HYBRID, or TOKEN requires valid active token
  if (checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID' || checkinMode === 'TOKEN') {
    if (!qrToken) {
      return res.status(400).json({ error: 'กรุณากรอกรหัส Token 6 หลักจากหน้าจออาจารย์' });
    }
    if (!activeQR || !isValidActiveToken(activeQR, qrToken)) {
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
    await saveToFirestore(COLLECTIONS.USERS, student);
  }

  // Geofence Distance Calculation
  const course = courses.get(session.courseId);
  const isGenericDefault = (lat?: number, lng?: number) =>
    lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) ||
    (Math.abs(lat - 13.7563) < 0.05 && Math.abs(lng - 100.5018) < 0.05);

  let lat1: number | undefined;
  let lon1: number | undefined;

  if (activeQR && activeQR.lat !== undefined && !isNaN(activeQR.lat) && activeQR.lng !== undefined && !isNaN(activeQR.lng)) {
    lat1 = activeQR.lat;
    lon1 = activeQR.lng;
  }
  if ((lat1 === undefined || isGenericDefault(lat1, lon1)) && session.teacherLat !== undefined && !isNaN(session.teacherLat)) {
    lat1 = session.teacherLat;
    lon1 = session.teacherLng;
  }
  if ((lat1 === undefined || isGenericDefault(lat1, lon1)) && course && course.defaultLat && course.defaultLng) {
    lat1 = course.defaultLat;
    lon1 = course.defaultLng;
  }
  if (lat1 === undefined || isNaN(lat1) || lon1 === undefined || isNaN(lon1)) {
    lat1 = 13.7563;
    lon1 = 100.5018;
  }

  // Determine if GPS Geofence Check is required
  const sessionGpsEnabled = session.isGpsCheckEnabled !== false;
  const qrGpsEnabled = activeQR ? activeQR.isGpsCheckEnabled !== false : true;
  const isGpsCheckRequired = sessionGpsEnabled && qrGpsEnabled;

  // If student tries GPS_ONLY mode while teacher has disabled GPS
  if (checkinMode === 'GPS_ONLY' && !isGpsCheckRequired) {
    return res.status(400).json({
      error: 'ไม่สามารถเช็คชื่อด้วย GPS ได้ เนื่องจากอาจารย์ปิดระบบตรวจสอบ GPS สำหรับคาบนี้ กรุณาสแกน QR Code หรือใช้รหัสเข้าชั้นเรียน',
    });
  }

  const hasStudentCoords = scannedLat !== undefined && scannedLat !== null && scannedLat !== '' && !isNaN(Number(scannedLat)) &&
                           scannedLng !== undefined && scannedLng !== null && scannedLng !== '' && !isNaN(Number(scannedLng));

  const lat2 = hasStudentCoords ? parseFloat(scannedLat) : NaN;
  const lon2 = hasStudentCoords ? parseFloat(scannedLng) : NaN;

  let distanceMeters = 0;

  if (isGpsCheckRequired) {
    if (isNaN(lat2) || isNaN(lon2)) {
      return res.status(400).json({
        error: 'ไม่พบตำแหน่ง GPS จากอุปกรณ์ของคุณ กรุณาเปิดอนุญาตสิทธิ์ตำแหน่งที่ตั้ง (Location Service) ในเบราว์เซอร์แล้วลองใหม่อีกครั้ง',
      });
    }

    if (lat1 === undefined || lon1 === undefined || isNaN(lat1) || isNaN(lon1)) {
      return res.status(400).json({
        error: 'ยังไม่ได้ระบุพิกัดสถานที่เรียนสำหรับวิชานี้ กรุณาให้อาจารย์ผู้สอนตั้งค่าพิกัดห้องเรียน หรือสลับเป็นโหมด QR อย่างเดียว',
      });
    }

    distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);
    const ALLOWED_RADIUS = (course && typeof course.allowedGpsRadius === 'number' && course.allowedGpsRadius > 0)
      ? course.allowedGpsRadius
      : 200;

    // Smart tolerance: allow minor hardware/indoor triangulation jitter based on accuracy (max 40m buffer)
    const accuracyBuffer = typeof scannedAccuracy === 'number' && scannedAccuracy > 0
      ? Math.min(40, Math.round(scannedAccuracy * 0.4))
      : 0;
    const effectiveRadius = ALLOWED_RADIUS + accuracyBuffer;

    if (distanceMeters > effectiveRadius) {
      return res.status(400).json({
        error: `[GPS Geofence Violation] คุณอยู่ห่างจากสถานที่เรียน ${distanceMeters} เมตร (อนุญาตไม่เกิน ${ALLOWED_RADIUS} เมตร) หากอยู่ในห้องเรียนแล้วแต่พิกัดคลาดเคลื่อน กรุณาแจ้งอาจารย์ผู้สอน`,
        distanceMeters,
        allowedRadius: ALLOWED_RADIUS,
      });
    }
  } else if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
    distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);
  }

  // Duplicate check (checks both requested studentId and resolved student.id)
  const alreadyChecked = attendanceRecords.find(
    (r) => r.sessionId === sessionId && (r.studentId === studentId || r.studentId === student.id || (student.universityId && r.studentUniversityId === student.universityId))
  );

  if (alreadyChecked) {
    return res.status(400).json({
      error: 'คุณได้เช็คชื่อในคาบนี้ไปแล้ว!',
      record: alreadyChecked,
      resolvedUser: student.id !== studentId ? student : undefined,
    });
  }

  // Time-window check: 0 to lateThreshold -> PRESENT, lateThreshold to maxDuration -> LATE, > maxDuration -> Expired/ABSENT
  let calculatedStatus = AttendanceStatus.PRESENT;
  let statusMessage = 'เช็คชื่อเข้าเรียนสำเร็จ (ตรงเวลา)';

  if (session.activatedAt) {
    const startTime = new Date(session.activatedAt).getTime();
    const nowTime = Date.now();
    const diffMinutes = (nowTime - startTime) / (1000 * 60);
    const maxDuration = session.sessionDurationMinutes || 30;
    const lateThreshold = session.lateThresholdMinutes || 15;

    if (diffMinutes > maxDuration) {
      return res.status(400).json({
        error: `[หมดเวลาเช็คอิน] คาบเรียนนี้เปิดเช็คชื่อมาแล้ว ${Math.floor(diffMinutes)} นาที (เกินกำหนด ${maxDuration} นาที ถือว่าขาดเรียน) หากมีเหตุจำเป็นกรุณาแจ้งอาจารย์ผู้สอน`,
      });
    } else if (diffMinutes > lateThreshold) {
      calculatedStatus = AttendanceStatus.LATE;
      statusMessage = `เช็คชื่อสำเร็จ (เข้าเรียนสาย: สายไป ${Math.floor(diffMinutes)} นาที / เกิน ${lateThreshold} นาทีแรก)`;
    }
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
    status: calculatedStatus,
    scannedLat: lat2,
    scannedLng: lon2,
    distanceMeters,
    deviceId: deviceId || student.deviceId || 'unknown',
    checkinMethod: checkinMode,
  };

  attendanceRecords.push(newRecord);
  deletedAttendanceIds.delete(newRecord.id);
  await saveToFirestore(COLLECTIONS.ATTENDANCE, newRecord);
  saveLocalCache();
  broadcastCheckinEvent(sessionId, newRecord);

  res.json({
    message: statusMessage,
    record: newRecord,
    distanceMeters,
    checkinMethod: checkinMode,
    resolvedUser: student.id !== studentId ? student : undefined,
  });
});

// 4.5 TEACHER CHECK-IN ENDPOINT (SEPARATE DATASET)
app.post('/api/teacher/checkin', async (req, res) => {
  const { teacherId, courseId, sessionId, lat, lng, deviceId, deviceName, deviceType, browser, os, checkinMethod = 'HYBRID', qrToken, buildingRoom, notes } = req.body;

  const teacher = users.get(teacherId);
  if (!teacher || teacher.role !== UserRole.TEACHER) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้ของอาจารย์' });
  }

  // Anti-Proxy / Device Protection
  if (deviceId) {
    const bindResult = bindUserDevice(teacher, deviceId, deviceName, deviceType, browser, os);
    if (!bindResult.success) {
      return res.status(403).json({
        error: bindResult.error || `[Device Protection] Device Mismatch or Limit Reached!`,
      });
    }
    users.set(teacher.id, teacher);
    await saveToFirestore(COLLECTIONS.USERS, teacher);
  }

  // Token Validation if provided or in TOKEN/HYBRID mode
  if (checkinMethod === 'TOKEN' || checkinMethod === 'HYBRID' || checkinMethod === 'QR_ONLY') {
    if (qrToken && sessionId) {
      const activeQR = activeQRCodes.get(sessionId);
      if (activeQR && !isValidActiveToken(activeQR, qrToken)) {
        return res.status(400).json({ error: 'รหัส Token / QR Code หมดอายุหรือไม่อยู่ในระบบ! กรุณาสแกนหรือกรอกรหัส 6 หลักล่าสุด' });
      }
    }
  }

  // GPS Location & Distance Calculation
  const scannedLat = lat !== undefined && lat !== null && lat !== '' && !isNaN(Number(lat)) ? parseFloat(lat) : NaN;
  const scannedLng = lng !== undefined && lng !== null && lng !== '' && !isNaN(Number(lng)) ? parseFloat(lng) : NaN;

  if ((checkinMethod === 'GPS_ONLY' || checkinMethod === 'HYBRID') && (isNaN(scannedLat) || isNaN(scannedLng))) {
    return res.status(400).json({
      error: 'ไม่พบตำแหน่ง GPS จากอุปกรณ์ของคุณ กรุณาเปิดอนุญาตสิทธิ์ตำแหน่งที่ตั้ง (Location Service) ในเบราว์เซอร์แล้วลองใหม่อีกครั้ง',
    });
  }

  let distanceMeters = 0;
  let courseCode: string | undefined;
  let courseName: string | undefined;
  let sessionTopic: string | undefined;

  if (courseId && courses.has(courseId)) {
    const c = courses.get(courseId);
    courseCode = c?.courseCode;
    courseName = c?.courseName;
    if (c && c.defaultLat && c.defaultLng && !isNaN(scannedLat) && !isNaN(scannedLng)) {
      distanceMeters = getHaversineDistance(c.defaultLat, c.defaultLng, scannedLat, scannedLng);
    }
  }

  if (sessionId && sessions.has(sessionId)) {
    const s = sessions.get(sessionId);
    sessionTopic = s?.topic;
    if (s && s.teacherLat !== undefined && s.teacherLng !== undefined && !isNaN(scannedLat) && !isNaN(scannedLng) && distanceMeters === 0) {
      distanceMeters = getHaversineDistance(s.teacherLat, s.teacherLng, scannedLat, scannedLng);
    }
  }

  // Duplicate check-in prevention for same session
  if (sessionId) {
    const alreadyChecked = teacherAttendanceRecords.find(
      (r) => r.sessionId === sessionId && r.teacherId === teacherId
    );
    if (alreadyChecked) {
      return res.status(400).json({
        error: 'คุณได้บันทึกการเช็คชื่อเข้าสอนสำหรับคาบนี้เรียบร้อยแล้ว!',
        record: alreadyChecked,
      });
    }
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
    lat: !isNaN(scannedLat) ? scannedLat : 13.7563,
    lng: !isNaN(scannedLng) ? scannedLng : 100.5018,
    checkinMethod,
    deviceId: deviceId || teacher.deviceId || 'unknown',
    buildingRoom,
    notes,
    distanceMeters,
    qrToken,
  };

  teacherAttendanceRecords.push(record);
  await saveToFirestore(COLLECTIONS.TEACHER_ATTENDANCE, record);
  saveLocalCache();

  res.json({
    message: 'อาจารย์เช็คชื่อเข้าสอนสำเร็จเรียบร้อยแล้ว!',
    record,
    distanceMeters,
    checkinMethod,
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
app.post('/api/quick-events', async (req, res) => {
  const { title, teacherId, teacherLat, teacherLng, isGpsCheckEnabled = true } = req.body;
  const reqUserId = req.headers['x-user-id'] as string;
  const newEvent: QuickEvent = {
    id: `evt_${Date.now()}`,
    title: title || 'Ad-hoc Quick Attendance Event',
    teacherId: teacherId || reqUserId || '',
    teacherLat: parseFloat(teacherLat) || 13.7988363,
    teacherLng: parseFloat(teacherLng) || 100.322944,
    isActive: true,
    createdAt: new Date().toISOString(),
    isGpsCheckEnabled: isGpsCheckEnabled !== false,
  };

  quickEvents.set(newEvent.id, newEvent);
  deletedQuickEventIds.delete(newEvent.id);
  await saveToFirestore(COLLECTIONS.QUICK_EVENTS, newEvent);
  saveLocalCache();

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

app.post('/api/checkin/quick', async (req, res) => {
  const { eventId, qrToken, studentId, scannedLat, scannedLng, scannedAccuracy, deviceId } = req.body;

  const qEvent = quickEvents.get(eventId);
  if (!qEvent || !qEvent.isActive) {
    return res.status(400).json({ error: 'Quick Check-in event is inactive.' });
  }

  const student = resolveActiveUser(studentId) || users.get(studentId);
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
    await saveToFirestore(COLLECTIONS.USERS, student);
  }

  const checkinMode = req.body.checkinMode || 'HYBRID';
  const activeQR = activeQRCodes.get(eventId);

  if (checkinMode === 'QR_ONLY' || checkinMode === 'HYBRID' || checkinMode === 'TOKEN') {
    if (!activeQR || !isValidActiveToken(activeQR, qrToken || '')) {
      return res.status(400).json({ error: 'Invalid or expired event QR code.' });
    }
  }

  let lat1 = activeQR?.lat ?? qEvent.teacherLat ?? 13.7563;
  let lon1 = activeQR?.lng ?? qEvent.teacherLng ?? 100.5018;

  const eventGpsEnabled = qEvent.isGpsCheckEnabled !== false;
  const qrGpsEnabled = activeQR ? activeQR.isGpsCheckEnabled !== false : true;
  const isGpsCheckRequired = eventGpsEnabled && qrGpsEnabled;

  if (req.body.checkinMode === 'GPS_ONLY' && !isGpsCheckRequired) {
    return res.status(400).json({
      error: 'ไม่สามารถเช็คชื่อด้วย GPS ได้ เนื่องจากอาจารย์ปิดระบบตรวจสอบ GPS สำหรับกิจกรรมนี้ กรุณาสแกน QR Code หรือใช้รหัสเข้าชั้นเรียน',
    });
  }

  const hasStudentCoords = scannedLat !== undefined && scannedLat !== null && scannedLat !== '' && !isNaN(Number(scannedLat)) &&
                           scannedLng !== undefined && scannedLng !== null && scannedLng !== '' && !isNaN(Number(scannedLng));

  const lat2 = hasStudentCoords ? parseFloat(scannedLat) : NaN;
  const lon2 = hasStudentCoords ? parseFloat(scannedLng) : NaN;

  let distanceMeters = 0;

  if (isGpsCheckRequired) {
    if (isNaN(lat2) || isNaN(lon2)) {
      return res.status(400).json({
        error: 'ไม่พบตำแหน่ง GPS จากอุปกรณ์ของคุณ กรุณาเปิดอนุญาตสิทธิ์ตำแหน่งที่ตั้ง (Location Service) ในเบราว์เซอร์แล้วลองใหม่อีกครั้ง',
      });
    }

    if (lat1 === undefined || lon1 === undefined || isNaN(lat1) || isNaN(lon1)) {
      return res.status(400).json({
        error: 'ยังไม่ได้ระบุพิกัดสถานที่เช็คชื่อกิจกรรมนี้',
      });
    }

    distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);
    const ALLOWED_RADIUS = 200;
    const accuracyBuffer = typeof scannedAccuracy === 'number' && scannedAccuracy > 0
      ? Math.min(40, Math.round(scannedAccuracy * 0.4))
      : 0;
    const effectiveRadius = ALLOWED_RADIUS + accuracyBuffer;

    if (distanceMeters > effectiveRadius) {
      return res.status(400).json({
        error: `[GPS Geofence Violation] คุณอยู่ห่างจากสถานที่กิจกรรม ${distanceMeters} เมตร (อนุญาตไม่เกิน ${ALLOWED_RADIUS} เมตร) หากอยู่ในสถานที่แล้วแต่พิกัดคลาดเคลื่อน กรุณาแจ้งผู้จัด`,
        distanceMeters,
        allowedRadius: ALLOWED_RADIUS,
      });
    }
  } else if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
    distanceMeters = getHaversineDistance(lat1, lon1, lat2, lon2);
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
  deletedAttendanceIds.delete(newRecord.id);
  await saveToFirestore(COLLECTIONS.ATTENDANCE, newRecord);
  saveLocalCache();
  broadcastCheckinEvent(eventId, newRecord);

  res.json({
    message: 'Quick Check-in recorded!',
    record: newRecord,
    resolvedUser: student.id !== studentId ? student : undefined,
  });
});

// 6. CSV Export Endpoint
app.get('/api/export-csv/:courseId', (req, res) => {
  let course = courses.get(req.params.courseId);
  if (!course) {
    course = Array.from(courses.values()).find(
      (c) => c.id === req.params.courseId || c.courseCode === req.params.courseId
    );
  }
  if (!course) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="error_course_not_found.csv"');
    return res.status(404).send('\uFEFF' + 'ข้อผิดพลาด,ไม่พบข้อมูลรายวิชาดังกล่าว (Course not found)\n');
  }

  const courseSessions = Array.from(sessions.values())
    .filter((s) => s.courseId === course.id)
    .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
  const members = courseMembers
    .filter((cm) => cm.courseId === course.id && cm.role === CourseMemberRole.STUDENT)
    .map((cm) => users.get(cm.userId))
    .filter(Boolean) as User[];

  // Header row: Student ID, Title, Name TH, Name EN, Email, สัปดาห์ที่ 1, ..., Overall %
  let csv = 'รหัสนักศึกษา,คำนำหน้า,ชื่อ-นามสกุล (TH),Full Name (EN),อีเมล';
  courseSessions.forEach((s) => {
    const topicStr = s.topic ? ` (${s.topic.replace(/,/g, ' ')})` : '';
    csv += `,"สัปดาห์ที่ ${s.weekNumber}${topicStr}"`;
  });
  csv += ',จำนวนคาบที่เข้าเรียน,คาบทั้งหมด,เปอร์เซ็นต์เข้าเรียน (%)\n';

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
        weekCols += `,"ลาเรียน (${leaveTypeLabel})"`;
      } else {
        const rec = findStudentAttendanceRecord(st.id, course.id, s);
        if (rec) {
          attendedCount++;
          const checkinTimeBkk = formatBangkokTime(rec.timestamp);
          const isLate = rec.status === AttendanceStatus.LATE || Boolean(rec.isLate);
          const statusText = isLate ? `มาสาย (${checkinTimeBkk})` : `มาเรียน (${checkinTimeBkk})`;
          weekCols += `,"${statusText}"`;
        } else {
          weekCols += `,"ขาดเรียน"`;
        }
      }
    });

    const total = courseSessions.length || 1;
    const rate = Math.round((attendedCount / total) * 100);

    csv += `"${st.universityId || '-'}","${st.title || ''}","${st.firstNameTh || ''} ${st.lastNameTh || ''}","${st.firstNameEn || ''} ${st.lastNameEn || ''}","${st.email}"${weekCols},${attendedCount},${total},${rate}%\n`;
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
    const timeStr = formatBangkokDateTime(r.timestamp);
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
    academicYear: course.academicYear || 2569,
    semester: course.semester || Semester.FIRST,
    ...(weekNumber ? { weekNumber: Number(weekNumber) } : {}),
    leaveType: leaveType as LeaveType,
    leaveDate,
    ...(isMultiDay && endDate ? { endDate } : {}),
    isMultiDay: Boolean(isMultiDay),
    reason,
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(attachmentName ? { attachmentName } : {}),
    status: LeaveStatus.PENDING,
    createdAt: new Date().toISOString(),
  };

  leaveRequests.unshift(newLeave);
  saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, newLeave);

  // Send Notification to responsible teachers & course coordinators
  try {
    const teacherIds = new Set<string>();
    if (course.ownerId) teacherIds.add(course.ownerId);
    courseMembers.forEach((cm) => {
      if (cm.courseId === course.id && (cm.role === CourseMemberRole.CO_TEACHER || cm.role === CourseMemberRole.COORDINATOR || (cm.role as string) === 'TEACHER')) {
        teacherIds.add(cm.userId);
      }
    });
    if (teacherIds.size === 0) {
      Array.from(users.values()).forEach((u) => {
        if (u.role === 'TEACHER' || u.role === 'ADMIN') teacherIds.add(u.id);
      });
    }

    const leaveTypeTh = leaveType === LeaveType.SICK ? 'ลาป่วย' : leaveType === LeaveType.PERSONAL ? 'ลากิจ' : 'ลาอื่นๆ';
    teacherIds.forEach((tId) => {
      const notif: NotificationItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${tId.substring(0, 4)}`,
        recipientUserId: tId,
        title: `คำขอลางานใหม่: ${course.courseCode}`,
        message: `${newLeave.studentNameTh} (${student.universityId || ''}) ยื่นคำขอ${leaveTypeTh} สัปดาห์ที่ ${newLeave.weekNumber || 1} [${newLeave.leaveDate}]`,
        type: 'LEAVE_REQUEST',
        relatedId: newLeave.id,
        courseId: course.id,
        courseCode: course.courseCode,
        senderName: newLeave.studentNameTh,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      notifications.set(notif.id, notif);
      saveToFirestore(COLLECTIONS.NOTIFICATIONS, notif);
    });
    saveLocalCache();
  } catch (err) {
    console.error('Error creating leave request notifications:', err);
  }

  res.json({
    message: 'ส่งใบลาเรียนเรียบร้อยแล้ว รออาจารย์ผู้สอนพิจารณาอนุมัติ',
    leaveRequest: newLeave,
  });
});

// Get student's leave requests (ประวัติการแจ้งลาของนักศึกษา)
app.get('/api/leave-requests/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const list = leaveRequests.filter(
    (l) =>
      l &&
      l.studentId === studentId &&
      !deletedLeaveIds.has(l.id) &&
      (!l.courseId || !deletedCourseIds.has(l.courseId))
  );
  res.json(list);
});

// Get teacher's leave requests for courses taught by teacher (รายการแจ้งลาสำหรับอาจารย์)
app.get('/api/leave-requests/teacher/:teacherId', (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!teacherId) return res.json([]);

    const user = users.get(teacherId);

    // If Admin, can view all active leaves across system
    if (user && user.role === UserRole.ADMIN) {
      const adminList = leaveRequests.filter(
        (l) => l && l.id && !deletedLeaveIds.has(l.id) && (!l.courseId || !deletedCourseIds.has(l.courseId))
      );
      return res.json(adminList);
    }

    // Find courses where teacher is owner or member with instructor/coordinator/co-teacher role
    const teacherCourseIds = new Set<string>();
    Array.from(courses.values()).forEach((c) => {
      if (c && c.ownerId === teacherId && !deletedCourseIds.has(c.id)) {
        teacherCourseIds.add(c.id);
      }
    });

    courseMembers.forEach((cm) => {
      if (
        cm &&
        cm.userId === teacherId &&
        cm.role !== CourseMemberRole.STUDENT &&
        (cm.role as string) !== 'STUDENT' &&
        !deletedCourseIds.has(cm.courseId)
      ) {
        teacherCourseIds.add(cm.courseId);
      }
    });

    // Strict Instance Isolation: Only match exact courseId that teacher is responsible for
    const list = leaveRequests.filter(
      (l) =>
        l &&
        l.id &&
        !deletedLeaveIds.has(l.id) &&
        l.courseId &&
        teacherCourseIds.has(l.courseId) &&
        !deletedCourseIds.has(l.courseId)
    );

    res.json(list || []);
  } catch (err) {
    console.error('Error fetching teacher leave requests:', err);
    res.json([]);
  }
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

  // Send Notification to student
  try {
    const statusLabel = status === LeaveStatus.APPROVED ? 'อนุมัติเรียบร้อย' : status === LeaveStatus.REJECTED ? 'ถูกปฏิเสธ' : 'ปรับสถานะ';
    const notif: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientUserId: updated.studentId,
      title: `ผลการพิจารณาใบลา: ${updated.courseCode || 'รายวิชา'}`,
      message: `คำขอลาของคุณวันที่ ${updated.leaveDate} ได้รับการ${statusLabel} ${teacherComment ? `(หมายเหตุ: ${teacherComment})` : ''}`,
      type: 'LEAVE_STATUS_UPDATE',
      relatedId: updated.id,
      courseId: updated.courseId,
      courseCode: updated.courseCode,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    notifications.set(notif.id, notif);
    saveToFirestore(COLLECTIONS.NOTIFICATIONS, notif);
    saveLocalCache();
  } catch (err) {
    console.error('Error sending leave status notification to student:', err);
  }

  res.json({
    message: status === LeaveStatus.APPROVED ? 'อนุมัติการลาเรียนเรียบร้อยแล้ว' : 'ปฏิเสธใบลาเรียนเรียบร้อยแล้ว',
    leaveRequest: updated,
  });
});

// 8. NOTIFICATION ENDPOINTS
// Get notifications for user
app.get('/api/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  const userNotifs = Array.from(notifications.values())
    .filter((n) => n.recipientUserId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(userNotifs);
});

// Mark single notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notif = notifications.get(id);
  if (notif) {
    notif.isRead = true;
    saveToFirestore(COLLECTIONS.NOTIFICATIONS, notif);
    saveLocalCache();
    return res.json({ success: true, notification: notif });
  }
  res.status(404).json({ error: 'Notification not found' });
});

// Mark all notifications as read for user
app.put('/api/notifications/mark-all-read/:userId', (req, res) => {
  const { userId } = req.params;
  let count = 0;
  notifications.forEach((n) => {
    if (n.recipientUserId === userId && !n.isRead) {
      n.isRead = true;
      saveToFirestore(COLLECTIONS.NOTIFICATIONS, n);
      count++;
    }
  });
  saveLocalCache();
  res.json({ success: true, updatedCount: count });
});

// Cancel or Delete leave request (นักศึกษายกเลิก หรืออาจารย์/แอดมินลบคำขอลา)
app.delete('/api/leave-requests/:id', (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true' || req.body?.force === true;
  const itemIndex = leaveRequests.findIndex((l) => l.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลใบลาที่ต้องการลบ/ยกเลิก' });
  }

  if (!force && leaveRequests[itemIndex].status !== LeaveStatus.PENDING) {
    return res.status(400).json({ error: 'ไม่สามารถยกเลิกใบลาที่ได้รับการพิจารณาไปแล้วได้' });
  }

  const [removed] = leaveRequests.splice(itemIndex, 1);
  deletedLeaveIds.add(id);
  deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, id).catch(() => {});
  saveLocalCache();
  saveTombstonesToFirestore().catch(() => {});

  res.json({
    message: 'ลบข้อมูลคำขอลาเรียนเรียบร้อยแล้ว',
    id: removed.id,
  });
});

// Helper to find a student's attendance record for a specific course session
function findStudentAttendanceRecord(studentId: string, courseId: string, session: Session): AttendanceRecord | undefined {
  const stdUser = users.get(studentId);
  const uniId = stdUser?.universityId;
  return attendanceRecords.find((r) => {
    // 1. Check student identity match
    const isStudentMatch =
      r.studentId === studentId ||
      (stdUser && r.studentId === stdUser.id) ||
      (uniId && (
        r.studentUniversityId === uniId ||
        r.studentId === uniId ||
        r.studentId === `usr_std_${uniId}`
      ));
    if (!isStudentMatch) return false;

    // 2. Check session / course / week match
    if (session.id && r.sessionId === session.id) return true;
    if (r.courseId && r.courseId === courseId && Number(r.weekNumber) === Number(session.weekNumber)) return true;

    if (r.sessionId) {
      const recSession = sessions.get(r.sessionId);
      if (recSession && recSession.courseId === courseId && Number(recSession.weekNumber) === Number(session.weekNumber)) {
        return true;
      }
    }

    return false;
  });
}

// Helper to check if a student has an APPROVED leave request for a given session
function getApprovedLeaveForSession(studentId: string, courseId: string, session: Session, course?: Course): LeaveRequest | undefined {
  const stdUser = users.get(studentId);
  const uniId = stdUser?.universityId;
  const targetCourse = course || courses.get(courseId);
  const weekItem = targetCourse?.weeks?.find((w: any) => Number(w.weekNumber) === Number(session.weekNumber));
  const sessionDate = (session as any).date || weekItem?.date || (session.activatedAt ? session.activatedAt.split('T')[0] : null);

  return leaveRequests.find((lr) => {
    const isStudentMatch =
      lr.studentId === studentId ||
      (stdUser && lr.studentId === stdUser.id) ||
      (uniId && (
        lr.studentUniversityId === uniId ||
        lr.studentId === uniId ||
        lr.studentId === `usr_std_${uniId}`
      ));
    if (!isStudentMatch || lr.courseId !== courseId || (lr.status !== LeaveStatus.APPROVED && (lr.status as string) !== 'APPROVED')) {
      return false;
    }

    // 1. Direct week number match
    if (lr.weekNumber && session.weekNumber && Number(lr.weekNumber) === Number(session.weekNumber)) {
      return true;
    }

    // 2. Date match against the real planned/actual session date
    if (sessionDate && lr.leaveDate) {
      if (!lr.isMultiDay && lr.leaveDate === sessionDate) return true;
      if (lr.isMultiDay && lr.endDate && sessionDate >= lr.leaveDate && sessionDate <= lr.endDate) return true;
    }

    return false;
  });
}

// Helper to check if a session has been conducted/opened for attendance
function isSessionConducted(session: Session, course?: Course): boolean {
  if (!session) return false;
  if (session.isActive) return true;
  if (session.activatedAt) return true;

  // Check if any student attendance record exists for this session or week
  const hasAttendance = attendanceRecords.some((r) =>
    r.sessionId === session.id ||
    (r.courseId === session.courseId && Number(r.weekNumber) === Number(session.weekNumber))
  );
  if (hasAttendance) return true;

  // Check if any teacher check-in record exists for this session or week
  const hasTeacherLog = teacherAttendanceRecords.some((tr: any) =>
    tr.sessionId === session.id ||
    (tr.courseId === session.courseId && Number(tr.weekNumber) === Number(session.weekNumber))
  );
  if (hasTeacherLog) return true;

  // Check if session has a scheduled date that has already passed or is today in Bangkok timezone
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

// Student Dashboard Stats endpoint
app.get('/api/student/:studentId/stats', (req, res) => {
  const reqStudentId = req.params.studentId;
  const resolvedStudent = resolveActiveUser(reqStudentId) || users.get(reqStudentId);
  const studentId = resolvedStudent ? resolvedStudent.id : reqStudentId;

  const enrolledCourseIds = courseMembers
    .filter((cm) => (cm.userId === studentId || cm.userId === reqStudentId) && cm.role === CourseMemberRole.STUDENT)
    .map((cm) => cm.courseId);

  const studentCourses = enrolledCourseIds.map((id) => courses.get(id)).filter(Boolean) as Course[];

  const courseStats = studentCourses.map((c) => {
    const cSessions = ensureCourseSessions(c);

    const totalSessions = cSessions.length || (c.weeks ? c.weeks.length : 15);
    const conductedSessionsList = cSessions.filter((s) => isSessionConducted(s, c));
    const conductedSessions = conductedSessionsList.length;

    let attendedCount = 0;
    let approvedLeaveCount = 0;
    let lateCount = 0;

    conductedSessionsList.forEach((s) => {
      const approvedLeave = getApprovedLeaveForSession(studentId, c.id, s);
      if (approvedLeave) {
        approvedLeaveCount++;
      } else {
        const rec = findStudentAttendanceRecord(studentId, c.id, s);
        if (rec) {
          attendedCount++;
          if (rec.status === AttendanceStatus.LATE || Boolean(rec.isLate)) {
            lateCount++;
          }
        }
      }
    });

    const absentSessions = Math.max(0, conductedSessions - attendedCount - approvedLeaveCount);
    const maxAllowedAbsences = Math.floor(totalSessions * 0.20);
    const remainingAbsenceQuota = Math.max(0, maxAllowedAbsences - absentSessions);
    const isExceededAbsenceQuota = absentSessions > maxAllowedAbsences;

    // Calculate percentage based on conducted sessions to avoid premature "risk of failing" warning
    const percentage = conductedSessions === 0 ? 100 : Math.round((attendedCount / conductedSessions) * 100);

    let statusColor: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    let statusText = 'มีสิทธิ์สอบปกติ';

    if (isExceededAbsenceQuota || (conductedSessions > 0 && percentage < 80)) {
      statusColor = 'RED';
      statusText = 'เสี่ยงหมดสิทธิ์สอบ';
    } else if ((conductedSessions > 0 && percentage >= 80 && percentage <= 84) || (absentSessions > 0 && remainingAbsenceQuota === 0)) {
      statusColor = 'YELLOW';
      statusText = 'เฝ้าระวัง';
    }

    const pastCheckins = attendanceRecords.filter((r) =>
      cSessions.some((s) => findStudentAttendanceRecord(studentId, c.id, s)?.id === r.id)
    );

    return {
      course: c,
      stats: {
        totalSessions,
        conductedSessions,
        attendedSessions: attendedCount,
        approvedLeaveSessions: approvedLeaveCount,
        lateSessions: lateCount,
        absentSessions,
        percentage,
        statusColor,
        maxAllowedAbsences,
        remainingAbsenceQuota,
        statusText,
        examEligibilityStatus: statusColor === 'RED' ? 'INELIGIBLE' : statusColor === 'YELLOW' ? 'WARNING' : 'ELIGIBLE',
      },
      pastCheckins,
    };
  });

  res.json(courseStats);
});

// Teacher Course Overview Dashboard API
app.get('/api/teacher/courses-overview', (req, res) => {
  const reqTeacherId = (req.query.teacherId as string) || (req.headers['x-user-id'] as string);
  const teacher = resolveActiveUser(reqTeacherId) || users.get(reqTeacherId);
  const teacherId = teacher ? teacher.id : reqTeacherId;

  if (!teacher) {
    return res.status(401).json({ error: 'ไม่พบข้อมูลอาจารย์ผู้ใช้งาน' });
  }

  const memberCourseIds = courseMembers
    .filter((m) => m.userId === teacherId || m.userId === reqTeacherId)
    .map((m) => m.courseId);

  let teacherCourses = Array.from(courses.values()).filter((c) => {
    if (teacher.role === UserRole.ADMIN) return true;
    if (c.ownerId === teacherId || c.ownerId === reqTeacherId || memberCourseIds.includes(c.id)) return true;
    if (teacher.firstNameTh && (c.coordinatorName?.includes(teacher.firstNameTh) || c.ownerName?.includes(teacher.firstNameTh))) return true;
    return false;
  });

  // Fallback: If no courses found for new teacher account/login on fresh deployment, show all courses
  if (teacherCourses.length === 0) {
    teacherCourses = Array.from(courses.values());
  }

  const overviewList = teacherCourses.map((course) => {
    const membersInCourse = courseMembers.filter((m) => m.courseId === course.id);
    const studentMembers = membersInCourse.filter((m) => m.role === CourseMemberRole.STUDENT);
    const coTeacherMembers = membersInCourse.filter((m) => m.role === CourseMemberRole.CO_TEACHER);

    const cSessions = ensureCourseSessions(course);
    const conductedSessionsList = cSessions.filter((s) => isSessionConducted(s, course));
    const conductedSessionsCount = conductedSessionsList.length;
    const totalSessionsCount = cSessions.length || 1;
    const maxAllowedAbsences = Math.floor(totalSessionsCount * 0.20);

    const studentList = studentMembers.map((m) => {
      const studentUser = users.get(m.userId);
      const studentName = studentUser
        ? `${studentUser.title || ''} ${studentUser.firstNameTh || ''} ${studentUser.lastNameTh || ''}`.trim() || studentUser.email
        : 'นักศึกษา';
      const studentIdNum = studentUser?.universityId || '-';

      let attendedCount = 0;
      let approvedLeaveCount = 0;
      let lateCount = 0;
      let lastCheckinTime: string | null = null;
      let lastCheckinMethod: string | null = null;
      const validCheckinTimes: Date[] = [];

      const sessionStatuses = cSessions.map((s) => {
        const isConducted = isSessionConducted(s, course);
        const approvedLeave = getApprovedLeaveForSession(m.userId, course.id, s);
        if (approvedLeave) {
          if (isConducted) approvedLeaveCount++;
          const leaveTypeLabel =
            approvedLeave.leaveType === LeaveType.SICK
              ? 'ลาป่วย'
              : approvedLeave.leaveType === LeaveType.PERSONAL
              ? 'ลากิจ'
              : 'ลาอื่นๆ';
          return {
            sessionId: s.id,
            weekNumber: s.weekNumber,
            topic: s.topic,
            status: 'LEAVE',
            statusText: `ลาเรียน (${leaveTypeLabel})`,
            shortStatus: leaveTypeLabel,
            checkinTime: null,
            checkinTimeBangkok: null,
          };
        } else {
          const rec = findStudentAttendanceRecord(m.userId, course.id, s);
          if (rec) {
            const timeBkk = formatBangkokTime(rec.timestamp);
            const recStatus = rec.status as string;
            if (recStatus === 'LEAVE' || recStatus === AttendanceStatus.LEAVE) {
              if (isConducted) approvedLeaveCount++;
              return {
                sessionId: s.id,
                weekNumber: s.weekNumber,
                topic: s.topic,
                status: 'LEAVE',
                statusText: 'ลาเรียน (บันทึกโดยอาจารย์)',
                shortStatus: 'ลาเรียน',
                checkinTime: rec.timestamp,
                checkinTimeBangkok: timeBkk,
              };
            } else if (recStatus === 'ABSENT' || recStatus === AttendanceStatus.ABSENT) {
              return {
                sessionId: s.id,
                weekNumber: s.weekNumber,
                topic: s.topic,
                status: 'ABSENT',
                statusText: 'ขาดเรียน (บันทึกโดยอาจารย์)',
                shortStatus: 'ขาดเรียน',
                checkinTime: null,
                checkinTimeBangkok: null,
              };
            } else {
              attendedCount++;
              const recDt = new Date(rec.timestamp);
              validCheckinTimes.push(recDt);
              if (!lastCheckinTime || new Date(rec.timestamp).getTime() > new Date(lastCheckinTime).getTime()) {
                lastCheckinTime = rec.timestamp;
                lastCheckinMethod = rec.checkinMethod;
              }
              const isLate = rec.status === AttendanceStatus.LATE || Boolean(rec.isLate);
              if (isLate) lateCount++;
              const statusLabel = isLate ? `มาสาย (${timeBkk})` : `มาเรียน (${timeBkk})`;
              return {
                sessionId: s.id,
                weekNumber: s.weekNumber,
                topic: s.topic,
                status: isLate ? 'LATE' : 'PRESENT',
                statusText: statusLabel,
                shortStatus: isLate ? 'มาสาย' : 'มาเรียน',
                checkinTime: rec.timestamp,
                checkinTimeBangkok: timeBkk,
              };
            }
          } else {
            if (isConducted) {
              return {
                sessionId: s.id,
                weekNumber: s.weekNumber,
                topic: s.topic,
                status: 'ABSENT',
                statusText: 'ขาดเรียน',
                shortStatus: 'ขาดเรียน',
                checkinTime: null,
                checkinTimeBangkok: null,
              };
            } else {
              return {
                sessionId: s.id,
                weekNumber: s.weekNumber,
                topic: s.topic,
                status: 'UPCOMING',
                statusText: 'ยังไม่เริ่มสอน',
                shortStatus: 'ยังไม่สอน',
                checkinTime: null,
                checkinTimeBangkok: null,
              };
            }
          }
        }
      });

      const absentCount = Math.max(0, conductedSessionsCount - attendedCount - approvedLeaveCount);
      const remainingAbsenceQuota = Math.max(0, maxAllowedAbsences - absentCount);
      const isExceededAbsenceQuota = absentCount > maxAllowedAbsences;

      // Calculate attendance percent based on conducted sessions
      const attendancePercent = conductedSessionsCount === 0 ? 100 : Math.round((attendedCount / conductedSessionsCount) * 100);

      let examEligibilityStatus: 'ELIGIBLE' | 'WARNING' | 'INELIGIBLE' = 'ELIGIBLE';
      let examEligibilityLabel = 'มีสิทธิ์สอบ (ปกติ)';

      if (isExceededAbsenceQuota || (conductedSessionsCount > 0 && attendancePercent < 80)) {
        examEligibilityStatus = 'INELIGIBLE';
        examEligibilityLabel = 'เสี่ยงหมดสิทธิ์สอบ (<80%)';
      } else if ((conductedSessionsCount > 0 && attendancePercent >= 80 && attendancePercent <= 84) || (absentCount > 0 && remainingAbsenceQuota === 0)) {
        examEligibilityStatus = 'WARNING';
        examEligibilityLabel = 'เฝ้าระวัง (80-84%)';
      }

      let avgTimeStr = '-';
      if (validCheckinTimes.length > 0) {
        const totalMinutes = validCheckinTimes.reduce((acc, dt) => {
          const bkkHour = parseInt(dt.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }), 10) || 0;
          const bkkMin = parseInt(dt.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', minute: '2-digit' }), 10) || 0;
          return acc + (bkkHour * 60 + bkkMin);
        }, 0);
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
        lateCount,
        absentCount,
        conductedSessionsCount,
        totalSessionsCount,
        maxAllowedAbsences,
        remainingAbsenceQuota,
        attendancePercent,
        examEligibilityStatus,
        examEligibilityLabel,
        avgTimeStr,
        lastCheckinTime,
        lastCheckinMethod,
        sessionStatuses,
      };
    });

    const courseSessionsList = Array.from(sessions.values())
      .filter((s) => s.courseId === course.id)
      .sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
    const sessionDetailsList = courseSessionsList.map((s) => {
      const recordsForSession = attendanceRecords.filter((r) => r.sessionId === s.id);

      let firstCheckinTimeStr = '-';
      let lastCheckinTimeStr = '-';

      if (recordsForSession.length > 0) {
        const sorted = [...recordsForSession].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        firstCheckinTimeStr = formatBangkokTime(sorted[0].timestamp);
        lastCheckinTimeStr = formatBangkokTime(sorted[sorted.length - 1].timestamp);
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
          const rec = findStudentAttendanceRecord(m.userId, course.id, s);
          if (rec) {
            attendedStudents.push({
              userId: m.userId,
              studentName,
              studentIdNum,
              email: studentUser?.email || '',
              avatarUrl: studentUser?.avatarUrl || '',
              checkinTime: formatBangkokTime(rec.timestamp),
              checkinMethod: rec.checkinMethod || 'สแกน QR',
            });
          } else {
            const isConducted = isSessionConducted(s, course);
            absentStudents.push({
              userId: m.userId,
              studentName,
              studentIdNum,
              email: studentUser?.email || '',
              avatarUrl: studentUser?.avatarUrl || '',
              isOnLeave: false,
              statusText: isConducted ? 'ขาดเรียน' : 'ยังไม่เริ่มสอน',
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
        isConducted: isSessionConducted(s, course),
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

    const totalPossibleConductedCheckins = totalRegisteredCount * (conductedSessionsCount || 1);
    let totalActualCheckins = 0;

    conductedSessionsList.forEach((s) => {
      studentMembers.forEach((m) => {
        const approvedLeave = getApprovedLeaveForSession(m.userId, course.id, s);
        if (!approvedLeave) {
          const rec = findStudentAttendanceRecord(m.userId, course.id, s);
          if (rec) totalActualCheckins++;
        }
      });
    });

    const courseAvgAttendanceRate = conductedSessionsCount === 0
      ? 100
      : (totalPossibleConductedCheckins > 0 ? Math.round((totalActualCheckins / totalPossibleConductedCheckins) * 100) : 100);

    return {
      course,
      totalRegisteredCount,
      totalCoTeachersCount,
      totalSessions,
      conductedSessionsCount,
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
    if (fsUsers && fsUsers.length > 0) {
      for (const u of fsUsers) {
        if (u && u.id && !DEMO_USER_IDS.has(u.id)) {
          await deleteFromFirestore(COLLECTIONS.USERS, u.id);
          deletedCount++;
        }
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

// --- SYSTEM BACKUP & DATA INTEGRITY ENDPOINTS ---

// Fetch list of available system backups
app.get('/api/admin/backups', async (req, res) => {
  try {
    const memoryList = systemBackups.map(({ data, ...meta }) => ({
      ...meta,
      type: getBackupType(meta),
    }));

    let fsList: any[] = [];
    try {
      const fsBackups = await getAllFromFirestore<any>('SYSTEM_BACKUPS');
      if (fsBackups && fsBackups.length > 0) {
        fsList = fsBackups.map(({ data, ...meta }) => ({
          ...meta,
          type: getBackupType(meta),
        }));
      }
    } catch (e) {
      // ignore
    }

    const map = new Map<string, any>();
    fsList.forEach((b) => map.set(b.id, b));
    memoryList.forEach((b) => map.set(b.id, b));

    const combined = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({ backups: combined });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching system backups' });
  }
});

// Create a new snapshot backup manually
app.post('/api/admin/backups/create', async (req, res) => {
  try {
    const { label } = req.body || {};
    const backup = await createSnapshotBackup(label || 'Manual Admin Backup Point', 'Admin User', 'manual');
    const { data, ...meta } = backup;
    res.json({ message: 'สร้างจุดสำรองข้อมูล (Manual Backup Snapshot) สำเร็จเรียบร้อยแล้ว', backup: meta });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error creating manual system backup' });
  }
});

// Delete a snapshot backup manually
app.delete('/api/admin/backups/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    await deleteFromFirestore('SYSTEM_BACKUPS', backupId);
    const idx = systemBackups.findIndex((b) => b.id === backupId);
    if (idx >= 0) {
      systemBackups.splice(idx, 1);
    }
    res.json({ message: 'ลบจุดสำรองข้อมูล (Backup Snapshot) สำเร็จเรียบร้อยแล้ว' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting system backup' });
  }
});

// Restore from a snapshot backup
app.post('/api/admin/backups/restore/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await restoreSnapshotBackup(backupId);
    res.json({
      message: 'กู้คืนข้อมูลทั้งระบบจากจุดสำรอง (Backup Snapshot) สำเร็จเรียบร้อยแล้ว',
      ...result,
      currentAttendanceCount: attendanceRecords.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error restoring system backup' });
  }
});

// Auto-heal database integrity
app.post('/api/admin/database/auto-heal', async (req, res) => {
  try {
    // 1. Force sync from Firestore first to pick up any direct changes/deletions from Firebase Console
    await syncFromFirestore();

    if (attendanceRecords.length < 87) {
      await importRealCsvAttendanceRecords();
    }
    const backup = await createSnapshotBackup('Integrity Auto-Heal Check', 'System Auto-Heal');
    res.json({
      message: 'ซิงค์และตรวจสอบกู้คืนความสมบูรณ์ของฐานข้อมูลจาก Firestore สำเร็จเรียบร้อยแล้ว',
      attendanceCount: attendanceRecords.length,
      usersCount: users.size,
      coursesCount: courses.size,
      sessionsCount: sessions.size,
      latestBackupId: backup.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error executing auto-heal' });
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
      case 'teacherAttendanceRecords': {
        const idx = teacherAttendanceRecords.findIndex((a) => a.id === docData.id);
        if (idx >= 0) teacherAttendanceRecords[idx] = docData;
        else teacherAttendanceRecords.push(docData);
        await saveToFirestore('teacherAttendanceRecords', docData);
        break;
      }
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
        deletedUserIds.add(docId);
        await deleteFromFirestore(COLLECTIONS.USERS, docId);
        break;
      case 'courses': {
        courses.delete(docId);
        deletedCourseIds.add(docId);
        await deleteFromFirestore(COLLECTIONS.COURSES, docId);

        // Cascade delete course members
        for (let i = courseMembers.length - 1; i >= 0; i--) {
          if (courseMembers[i].courseId === docId) {
            const member = courseMembers[i];
            deletedMemberIds.add(member.id);
            courseMembers.splice(i, 1);
            await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, member.id);
          }
        }

        // Cascade delete sessions associated with this course
        const cascadeSesIds = new Set<string>();
        for (const [sesId, ses] of Array.from(sessions.entries())) {
          if (ses.courseId === docId) {
            sessions.delete(sesId);
            deletedSessionIds.add(sesId);
            cascadeSesIds.add(sesId);
            await deleteFromFirestore(COLLECTIONS.SESSIONS, sesId);
          }
        }

        // NOTE: DATA PROTECTION POLICY
        // Attendance records are NEVER cascade-deleted when deleting a course.
        for (const att of attendanceRecords) {
          if (cascadeSesIds.has(att.sessionId)) {
            (att as any).detachedCourse = true;
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
        deletedMemberIds.add(docId);
        await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, docId);
        break;
      }
      case 'sessions':
        sessions.delete(docId);
        deletedSessionIds.add(docId);
        await deleteFromFirestore(COLLECTIONS.SESSIONS, docId);
        break;
      case 'attendanceRecords': {
        const idx = attendanceRecords.findIndex((a) => a.id === docId);
        if (idx >= 0) attendanceRecords.splice(idx, 1);
        await deleteFromFirestore(COLLECTIONS.ATTENDANCE, docId);
        saveLocalCache();
        break;
      }
      case 'leaveRequests': {
        const idx = leaveRequests.findIndex((l) => l.id === docId);
        if (idx >= 0) leaveRequests.splice(idx, 1);
        deletedLeaveIds.add(docId);
        await deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, docId);
        saveLocalCache();
        saveTombstonesToFirestore().catch(() => {});
        break;
      }
      case 'quickEvents':
        quickEvents.delete(docId);
        await deleteFromFirestore(COLLECTIONS.QUICK_EVENTS, docId);
        break;
      case 'teacherAttendanceRecords': {
        const idx = teacherAttendanceRecords.findIndex((a) => a.id === docId);
        if (idx >= 0) teacherAttendanceRecords.splice(idx, 1);
        await deleteFromFirestore('teacherAttendanceRecords', docId);
        break;
      }
      default:
        return res.status(400).json({ error: 'Collection ไม่รองรับการลบโดยตรง' });
    }

    saveLocalCache();
    await saveTombstonesToFirestore();

    res.json({ message: `ลบเอกสาร ${docId} จาก ${collectionName} เรียบร้อยแล้ว`, docId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการลบเอกสาร' });
  }
});

// --- SYSTEM SETTINGS & MASTER DATA ENDPOINTS ---

// Get public/global system settings
app.get('/api/system/settings', (req, res) => {
  try {
    res.json(systemSettings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching system settings' });
  }
});

// Update global system settings (Admin)
app.put('/api/admin/settings', async (req, res) => {
  try {
    const body = req.body || {};

    // Normalize Maintenance Mode & Messages
    const isMaintenance = body.maintenanceMode ?? body.systemMaintenanceMode ?? systemSettings.maintenanceMode ?? false;
    const msgAnnouncement = body.announcementMessage ?? body.systemAnnouncement ?? systemSettings.announcementMessage ?? '';
    const msgMaintenance = body.maintenanceMessage || msgAnnouncement || 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก';

    // Normalize Domain Settings
    let tDomains: string[] = body.teacherDomains;
    if (!Array.isArray(tDomains) && body.teacherDomain) {
      tDomains = body.teacherDomain.split(/[,;\s]+/).filter(Boolean);
    }
    if (!Array.isArray(tDomains)) {
      tDomains = systemSettings.teacherDomains || ['mahidol.ac.th', 'mahidol.edu'];
    }

    let sDomains: string[] = body.studentDomains;
    if (!Array.isArray(sDomains) && body.studentDomain) {
      sDomains = body.studentDomain.split(/[,;\s]+/).filter(Boolean);
    }
    if (!Array.isArray(sDomains)) {
      sDomains = systemSettings.studentDomains || ['student.mahidol.ac.th', 'student.mahidol.edu'];
    }

    const allowOther = body.allowOtherDomainsSelfRegister ?? body.allowOtherDomains ?? systemSettings.allowOtherDomainsSelfRegister ?? false;

    const updated: SystemSettings = {
      ...systemSettings,
      ...body,
      id: 'global_config',
      maintenanceMode: Boolean(isMaintenance),
      systemMaintenanceMode: Boolean(isMaintenance),
      maintenanceMessage: msgMaintenance,
      announcementMessage: msgAnnouncement,
      systemAnnouncement: msgAnnouncement,
      allowTeacherSelfRegister: body.allowTeacherSelfRegister ?? systemSettings.allowTeacherSelfRegister ?? true,
      allowStudentSelfRegister: body.allowStudentSelfRegister ?? systemSettings.allowStudentSelfRegister ?? true,
      allowOtherDomainsSelfRegister: Boolean(allowOther),
      allowOtherDomains: Boolean(allowOther),
      teacherDomains: tDomains,
      teacherDomain: tDomains.join(', '),
      studentDomains: sDomains,
      studentDomain: sDomains.join(', '),
      updatedAt: new Date().toISOString(),
    };

    systemSettings = updated;
    await saveToFirestore(COLLECTIONS.SYSTEM_SETTINGS, updated);
    res.json({ message: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', settings: systemSettings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error updating system settings' });
  }
});

// Get Master Universities
app.get('/api/admin/master/universities', (req, res) => {
  try {
    seedDefaultMasterData();
    const univs = Array.from(masterUniversities.values());
    res.json(univs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching master universities' });
  }
});

// Save Master University
app.post('/api/admin/master/universities', async (req, res) => {
  try {
    const { id, code, nameTh, nameEn } = req.body;
    if (!code || !nameTh) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสมหาวิทยาลัยและชื่อมหาวิทยาลัย' });
    }
    const uId = id || `univ_${Date.now()}`;
    const newUniv: MasterUniversity = {
      id: uId,
      code: code.trim().toUpperCase(),
      nameTh: nameTh.trim(),
      nameEn: (nameEn || '').trim(),
    };
    masterUniversities.set(uId, newUniv);
    await saveToFirestore(COLLECTIONS.MASTER_UNIVERSITIES, newUniv);
    saveLocalCache();
    res.json({ message: 'บันทึกข้อมูลมหาวิทยาลัยเรียบร้อยแล้ว', university: newUniv });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving university' });
  }
});

// Delete Master University
app.delete('/api/admin/master/universities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    masterUniversities.delete(id);
    await deleteFromFirestore(COLLECTIONS.MASTER_UNIVERSITIES, id);
    saveLocalCache();
    res.json({ message: 'ลบข้อมูลมหาวิทยาลัยเรียบร้อยแล้ว', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting university' });
  }
});

// Get Master Faculties
app.get('/api/admin/master/faculties', (req, res) => {
  try {
    seedDefaultMasterData();
    const facs = Array.from(masterFaculties.values());
    res.json(facs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching master faculties' });
  }
});

// Save Master Faculty
app.post('/api/admin/master/faculties', async (req, res) => {
  try {
    const { id, universityId, code, nameTh, nameEn } = req.body;
    if (!code || !nameTh) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสคณะและชื่อคณะ' });
    }
    const fId = id || `fac_${Date.now()}`;
    const newFac: MasterFaculty = {
      id: fId,
      universityId: universityId || 'univ_mu',
      code: code.trim().toUpperCase(),
      nameTh: nameTh.trim(),
      nameEn: (nameEn || '').trim(),
    };
    masterFaculties.set(fId, newFac);
    await saveToFirestore(COLLECTIONS.MASTER_FACULTIES, newFac);
    saveLocalCache();
    res.json({ message: 'บันทึกข้อมูลคณะเรียบร้อยแล้ว', faculty: newFac });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving faculty' });
  }
});

// Delete Master Faculty
app.delete('/api/admin/master/faculties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    masterFaculties.delete(id);
    await deleteFromFirestore(COLLECTIONS.MASTER_FACULTIES, id);
    saveLocalCache();
    res.json({ message: 'ลบข้อมูลคณะเรียบร้อยแล้ว', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting faculty' });
  }
});

// Seed/Reset Default Master Data
app.post('/api/admin/master/seed-defaults', async (req, res) => {
  try {
    seedDefaultMasterData();
    saveLocalCache();
    res.json({
      message: 'รีเซ็ต/สร้างข้อมูลหลักเริ่มต้น (มหาวิทยาลัย คณะ ภาควิชา หลักสูตร) เรียบร้อยแล้ว',
      universities: Array.from(masterUniversities.values()),
      faculties: Array.from(masterFaculties.values()),
      departments: Array.from(masterDepartments.values()),
      curriculums: Array.from(masterCurriculums.values()),
      prefixes: Array.from(masterPrefixes.values()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error seeding default master data' });
  }
});

// Get Master Departments
app.get('/api/admin/master/departments', (req, res) => {
  try {
    const deps = Array.from(masterDepartments.values());
    res.json(deps);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching master departments' });
  }
});

// Save (Create/Update) Master Department
app.post('/api/admin/master/departments', async (req, res) => {
  try {
    const { id, code, nameTh, nameEn, facultyTh, facultyCode, universityTh, universityCode, majorCode, majorNameTh } = req.body;
    if (!code || !nameTh) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสภาควิชาและชื่อภาควิชา (ภาษาไทย)' });
    }
    const depId = id || `dep_${Date.now()}`;
    const newDep: MasterDepartment = {
      id: depId,
      code: code.trim().toUpperCase(),
      nameTh: nameTh.trim(),
      nameEn: (nameEn || '').trim(),
      universityTh: (universityTh || 'มหาวิทยาลัยมหิดล').trim(),
      universityCode: (universityCode || 'MU').trim(),
      facultyTh: (facultyTh || 'คณะเทคนิคการแพทย์').trim(),
      facultyCode: (facultyCode || 'MT').trim(),
      majorCode: (majorCode || 'MTMT').trim(),
      majorNameTh: (majorNameTh || 'สาขาวิชาเทคนิคการแพทย์').trim(),
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    masterDepartments.set(depId, newDep);
    await saveToFirestore(COLLECTIONS.MASTER_DEPARTMENTS, newDep);
    res.json({ message: 'บันทึกภาควิชาเรียบร้อยแล้ว', department: newDep });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving department' });
  }
});

// Delete Master Department
app.delete('/api/admin/master/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    masterDepartments.delete(id);
    await deleteFromFirestore(COLLECTIONS.MASTER_DEPARTMENTS, id);
    res.json({ message: 'ลบภาควิชาเรียบร้อยแล้ว', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting department' });
  }
});

// Get Master Curriculums
app.get('/api/admin/master/curriculums', (req, res) => {
  try {
    const currs = Array.from(masterCurriculums.values());
    res.json(currs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching master curriculums' });
  }
});

// Save (Create/Update) Master Curriculum
app.post('/api/admin/master/curriculums', async (req, res) => {
  try {
    const { id, code, nameTh, titleTh, nameEn, universityCode, universityTh, facultyCode, facultyTh, majorCode, degreeLevel } = req.body;
    const currTitle = (nameTh || titleTh || '').trim();
    if (!currTitle) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อหลักสูตร (ภาษาไทย)' });
    }
    const currId = id || `curr_${Date.now()}`;
    const newCurr: MasterCurriculum = {
      id: currId,
      code: (code || `CURR_${Date.now()}`).trim().toUpperCase(),
      nameTh: currTitle,
      titleTh: currTitle,
      nameEn: (nameEn || '').trim(),
      universityCode: (universityCode || 'MU').trim(),
      universityTh: (universityTh || 'มหาวิทยาลัยมหิดล').trim(),
      facultyCode: (facultyCode || 'MT').trim(),
      facultyTh: (facultyTh || 'คณะเทคนิคการแพทย์').trim(),
      majorCode: (majorCode || 'MTMT').trim(),
      degreeLevel: (degreeLevel || 'ปริญญาตรี').trim(),
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    masterCurriculums.set(currId, newCurr);
    await saveToFirestore(COLLECTIONS.MASTER_CURRICULUMS, newCurr);
    res.json({ message: 'บันทึกหลักสูตรเรียบร้อยแล้ว', curriculum: newCurr });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving curriculum' });
  }
});

// Delete Master Curriculum
app.delete('/api/admin/master/curriculums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    masterCurriculums.delete(id);
    await deleteFromFirestore(COLLECTIONS.MASTER_CURRICULUMS, id);
    res.json({ message: 'ลบหลักสูตรเรียบร้อยแล้ว', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting curriculum' });
  }
});

// Get Master Prefixes
app.get('/api/admin/master/prefixes', (req, res) => {
  try {
    const prefixes = Array.from(masterPrefixes.values());
    res.json(prefixes);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching master prefixes' });
  }
});

// Save Master Prefix
app.post('/api/admin/master/prefixes', async (req, res) => {
  try {
    const { id, titleTh, titleEn, category } = req.body;
    if (!titleTh) {
      return res.status(400).json({ error: 'กรุณากรอกคำนำหน้านาม (ภาษาไทย)' });
    }
    const prefixId = id || `prefix_${Date.now()}`;
    const newPrefix: MasterPrefix = {
      id: prefixId,
      titleTh: titleTh.trim(),
      titleEn: (titleEn || '').trim(),
      category: category || 'BOTH',
    };
    masterPrefixes.set(prefixId, newPrefix);
    await saveToFirestore(COLLECTIONS.MASTER_PREFIXES, newPrefix);
    res.json({ message: 'บันทึกคำนำหน้านามเรียบร้อยแล้ว', prefix: newPrefix });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving prefix' });
  }
});

// Delete Master Prefix
app.delete('/api/admin/master/prefixes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    masterPrefixes.delete(id);
    await deleteFromFirestore(COLLECTIONS.MASTER_PREFIXES, id);
    res.json({ message: 'ลบคำนำหน้านามเรียบร้อยแล้ว', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error deleting prefix' });
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

  // 1b. Deduplicate courseMembers
  await deduplicateCourseMembers();

  // 2. Clean sessions
  for (const [sesId, ses] of Array.from(sessions.entries())) {
    const courseExists = ses.courseId && courses.has(ses.courseId);
    if (!courseExists) {
      deletedSummary.sessions.push(`ID: ${sesId} [ไม่พบวิชา (${ses.courseId})]`);
      sessions.delete(sesId);
      await deleteFromFirestore(COLLECTIONS.SESSIONS, sesId);
    }
  }

  // 3. Attendance records are PROTECTED and NEVER DELETED during database cleanup
  // Historical check-in records are preserved intact for student audit compliance.

  // 4. Clean leaveRequests
  for (let i = leaveRequests.length - 1; i >= 0; i--) {
    const lr = leaveRequests[i];
    const courseExists = lr.courseId && courses.has(lr.courseId);
    const studentExists = lr.studentId && (users.has(lr.studentId) || Array.from(users.values()).some((u) => u.universityId === lr.studentId));

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

// Admin Reset Password for a user
app.put('/api/admin/users/:userId/reset-password', async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body || {};

  if (!newPassword || newPassword.toString().trim() === '') {
    return res.status(400).json({ error: 'กรุณากำหนดรหัสผ่านใหม่' });
  }

  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  targetUser.password = newPassword.toString().trim();
  users.set(userId, targetUser);
  await saveToFirestore(COLLECTIONS.USERS, targetUser);

  res.json({ message: `รีเซ็ตรหัสผ่านของผู้ใช้ (${targetUser.firstNameTh}) สำเร็จแล้ว`, user: targetUser });
});

// Admin Update User Profile Details
app.put('/api/admin/users/:userId/details', async (req, res) => {
  const { userId } = req.params;
  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  const {
    title,
    firstNameTh,
    lastNameTh,
    firstNameEn,
    lastNameEn,
    universityId,
    email,
    role,
    department,
    isSuspended,
    suspendedReason,
    universityCode,
    universityName,
    facultyCode,
    facultyName,
    departmentCode,
    departmentName,
    branchName,
    programCode,
    programName,
    affiliatedPrograms,
  } = req.body || {};

  if (role && [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].includes(role)) {
    targetUser.role = role;
  }
  if (title !== undefined) targetUser.title = title;
  if (firstNameTh !== undefined) targetUser.firstNameTh = firstNameTh;
  if (lastNameTh !== undefined) targetUser.lastNameTh = lastNameTh;
  if (firstNameEn !== undefined) targetUser.firstNameEn = firstNameEn;
  if (lastNameEn !== undefined) targetUser.lastNameEn = lastNameEn;
  if (universityId !== undefined) targetUser.universityId = universityId;
  if (email !== undefined) targetUser.email = email;
  if (department !== undefined) targetUser.department = department;
  if (universityCode !== undefined) targetUser.universityCode = universityCode;
  if (universityName !== undefined) targetUser.universityName = universityName;
  if (facultyCode !== undefined) targetUser.facultyCode = facultyCode;
  if (facultyName !== undefined) targetUser.facultyName = facultyName;
  if (departmentCode !== undefined) targetUser.departmentCode = departmentCode;
  if (departmentName !== undefined) targetUser.departmentName = departmentName;
  if (branchName !== undefined) targetUser.branchName = branchName;
  if (programCode !== undefined) targetUser.programCode = programCode;
  if (programName !== undefined) targetUser.programName = programName;
  if (affiliatedPrograms !== undefined && Array.isArray(affiliatedPrograms)) targetUser.affiliatedPrograms = affiliatedPrograms;
  if (isSuspended !== undefined) targetUser.isSuspended = isSuspended;
  if (suspendedReason !== undefined) targetUser.suspendedReason = suspendedReason;

  users.set(userId, targetUser);
  await saveToFirestore(COLLECTIONS.USERS, targetUser);

  res.json({ message: `อัปเดตข้อมูลผู้ใช้งาน (${targetUser.firstNameTh}) เรียบร้อยแล้ว`, user: targetUser });
});

// Admin Toggle User Status (Suspend / Activate)
app.put('/api/admin/users/:userId/status', async (req, res) => {
  const { userId } = req.params;
  const { isSuspended, suspendedReason } = req.body || {};

  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  targetUser.isSuspended = !!isSuspended;
  targetUser.suspendedReason = suspendedReason || '';
  users.set(userId, targetUser);
  await saveToFirestore(COLLECTIONS.USERS, targetUser);

  res.json({
    message: isSuspended
      ? `ระงับการใช้งานบัญชี (${targetUser.firstNameTh}) เรียบร้อยแล้ว`
      : `ปลดการระงับบัญชี (${targetUser.firstNameTh}) เรียบร้อยแล้ว`,
    user: targetUser,
  });
});

// Admin Delete Single User
app.delete('/api/admin/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const targetUser = users.get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  if (targetUser.email && targetUser.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
    return res.status(400).json({ error: 'ไม่สามารถลบบัญชี Super Admin ได้' });
  }

  users.delete(userId);
  await deleteFromFirestore(COLLECTIONS.USERS, userId);

  res.json({ message: `ลบบัญชีผู้ใช้งาน (${targetUser.firstNameTh}) ออกจากระบบสำเร็จ` });
});

// Admin Bulk Role Change
app.post('/api/admin/users/bulk-role', async (req, res) => {
  const { userIds, role } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อผู้ใช้ที่ต้องการเปลี่ยนสิทธิ์' });
  }
  if (![UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].includes(role)) {
    return res.status(400).json({ error: 'สิทธิ์ไม่ถูกต้อง' });
  }

  let updatedCount = 0;
  for (const id of userIds) {
    const u = users.get(id);
    if (u && u.email && u.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      u.role = role;
      users.set(id, u);
      await saveToFirestore(COLLECTIONS.USERS, u);
      updatedCount++;
    }
  }

  res.json({ message: `เปลี่ยนบทบาทผู้ใช้จำนวน ${updatedCount} รายการเป็น ${role} สำเร็จ` });
});

// Admin Bulk Status Change (Suspend / Activate)
app.post('/api/admin/users/bulk-status', async (req, res) => {
  const { userIds, isSuspended, suspendedReason } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อผู้ใช้ที่ต้องการเปลี่ยนสถานะ' });
  }

  let updatedCount = 0;
  for (const id of userIds) {
    const u = users.get(id);
    if (u && u.email && u.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      u.isSuspended = !!isSuspended;
      u.suspendedReason = suspendedReason || '';
      users.set(id, u);
      await saveToFirestore(COLLECTIONS.USERS, u);
      updatedCount++;
    }
  }

  res.json({
    message: isSuspended
      ? `ระงับการใช้งานผู้ใช้จำนวน ${updatedCount} รายการเรียบร้อยแล้ว`
      : `ยกเลิกการระงับผู้ใช้จำนวน ${updatedCount} รายการเรียบร้อยแล้ว`,
  });
});

// Admin Bulk Delete Users
app.post('/api/admin/users/bulk-delete', async (req, res) => {
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อผู้ใช้ที่ต้องการลบ' });
  }

  let deletedCount = 0;
  for (const id of userIds) {
    const u = users.get(id);
    if (u && u.email && u.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      users.delete(id);
      await deleteFromFirestore(COLLECTIONS.USERS, id);
      deletedCount++;
    }
  }

  res.json({ message: `ลบบัญชีผู้ใช้จำนวน ${deletedCount} รายการสำเร็จ` });
});

// Admin Bulk Unbind Devices
app.post('/api/admin/users/bulk-reset-devices', async (req, res) => {
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'กรุณาระบุรายชื่อผู้ใช้ที่ต้องการปลดล็อกอุปกรณ์' });
  }

  let resetCount = 0;
  for (const id of userIds) {
    const u = users.get(id);
    if (u) {
      u.deviceId = undefined;
      u.devices = [];
      users.set(id, u);
      await saveToFirestore(COLLECTIONS.USERS, u);
      resetCount++;
    }
  }

  res.json({ message: `ปลดล็อกอุปกรณ์ของผู้ใช้จำนวน ${resetCount} รายการเรียบร้อยแล้ว` });
});

// -------------------- DOMAIN TRANSITION & ACCOUNT MERGE API --------------------

/**
 * Scans the database to identify duplicate accounts based on domain aliases (.edu vs .ac.th),
 * identical Student ID, or exact name matches.
 */
app.get('/api/admin/users/duplicate-scan', (req, res) => {
  try {
    const allUsers = Array.from(users.values()).filter(Boolean);
    const groups: Map<string, { primaryUser: User; secondaryUsers: User[]; reason: 'DOMAIN_TRANSITION' | 'UNIVERSITY_ID_MATCH' | 'NAME_MATCH' }> = new Map();
    const processedUserIds = new Set<string>();

    for (let i = 0; i < allUsers.length; i++) {
      const u1 = allUsers[i];
      if (processedUserIds.has(u1.id)) continue;

      const duplicates: User[] = [];
      let matchReason: 'DOMAIN_TRANSITION' | 'UNIVERSITY_ID_MATCH' | 'NAME_MATCH' = 'DOMAIN_TRANSITION';

      const email1 = (u1.email || '').trim().toLowerCase();
      const uId1 = (u1.universityId || '').trim();
      const variants1 = getEmailDomainVariants(email1);

      for (let j = i + 1; j < allUsers.length; j++) {
        const u2 = allUsers[j];
        if (processedUserIds.has(u2.id)) continue;

        const email2 = (u2.email || '').trim().toLowerCase();
        const uId2 = (u2.universityId || '').trim();

        let isMatch = false;

        // Check 1: Domain transition match (.edu vs .ac.th)
        if (email1 && email2 && variants1.includes(email2)) {
          isMatch = true;
          matchReason = 'DOMAIN_TRANSITION';
        }
        // Check 2: Same University ID (Student ID) and same role
        else if (uId1 && uId2 && uId1 === uId2 && u1.role === u2.role) {
          isMatch = true;
          matchReason = 'UNIVERSITY_ID_MATCH';
        }
        // Check 3: Identical Thai name & same role (when student ID missing or same)
        else if (
          u1.firstNameTh &&
          u2.firstNameTh &&
          u1.lastNameTh &&
          u2.lastNameTh &&
          u1.firstNameTh.trim() === u2.firstNameTh.trim() &&
          u1.lastNameTh.trim() === u2.lastNameTh.trim() &&
          u1.role === u2.role
        ) {
          isMatch = true;
          matchReason = 'NAME_MATCH';
        }

        if (isMatch) {
          duplicates.push(u2);
          processedUserIds.add(u2.id);
        }
      }

      if (duplicates.length > 0) {
        processedUserIds.add(u1.id);
        const groupKey = `group_${u1.id}`;

        // Determine which user is the primary user:
        // Prefer .ac.th over .edu, or the account with most data / newer Google login
        const allInGroup = [u1, ...duplicates];
        allInGroup.sort((a, b) => {
          const aIsAcTh = (a.email || '').endsWith('.ac.th') ? 1 : 0;
          const bIsAcTh = (b.email || '').endsWith('.ac.th') ? 1 : 0;
          if (aIsAcTh !== bIsAcTh) return bIsAcTh - aIsAcTh;

          const aIsGoogle = a.authProvider === 'google' ? 1 : 0;
          const bIsGoogle = b.authProvider === 'google' ? 1 : 0;
          if (aIsGoogle !== bIsGoogle) return bIsGoogle - aIsGoogle;

          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          return aDate - bDate; // Older established account if same
        });

        const primary = allInGroup[0];
        const secondaries = allInGroup.slice(1);

        groups.set(groupKey, {
          primaryUser: primary,
          secondaryUsers: secondaries,
          reason: matchReason,
        });
      }
    }

    const candidates = Array.from(groups.entries()).map(([groupId, group]) => {
      const allGroupUserIds = [group.primaryUser.id, ...group.secondaryUsers.map((u) => u.id)];
      const allGroupEmails = Array.from(new Set([group.primaryUser.email, ...group.secondaryUsers.map((u) => u.email)].filter(Boolean)));
      const allGroupUIds = Array.from(new Set([group.primaryUser.universityId, ...group.secondaryUsers.map((u) => u.universityId)].filter(Boolean)));

      const attendanceCount = attendanceRecords.filter((ar) => allGroupUserIds.includes(ar.studentId)).length;
      const coursesCount = courseMembers.filter((cm) => allGroupUserIds.includes(cm.userId)).length;
      const leavesCount = leaveRequests.filter((lr) => allGroupUserIds.includes(lr.studentId)).length;

      return {
        id: groupId,
        primaryUser: group.primaryUser,
        secondaryUsers: group.secondaryUsers,
        matchReason: group.reason,
        details: {
          emails: allGroupEmails,
          universityIds: allGroupUIds,
          totalAttendanceRecords: attendanceCount,
          totalCoursesCount: coursesCount,
          totalLeavesCount: leavesCount,
        },
      };
    });

    const totalRedundant = candidates.reduce((acc, c) => acc + c.secondaryUsers.length, 0);

    res.json({
      timestamp: new Date().toISOString(),
      totalUsersChecked: allUsers.length,
      duplicateGroupCount: candidates.length,
      totalRedundantAccounts: totalRedundant,
      candidates,
    });
  } catch (err: any) {
    console.error('Error during duplicate scan:', err);
    res.status(500).json({ error: `เกิดข้อผิดพลาดในการตรวจสอบบัญชีซ้ำซ้อน: ${err.message}` });
  }
});

/**
 * Universal Smart Account Merge Core Function:
 * Merges secondary user accounts into the primary user account with zero data loss.
 */
async function executeUserAccountMerge(primaryUserId: string, secondaryUserIds: string[]): Promise<{
  success: boolean;
  primaryUser: User;
  removedUserIds: string[];
  reassignedAttendanceCount: number;
  reassignedCoursesCount: number;
  reassignedLeavesCount: number;
}> {
  const primaryUser = users.get(primaryUserId);
  if (!primaryUser) {
    throw new Error('ไม่พบบัญชีผู้ใช้หลัก (Primary User)');
  }

  const validSecondaryIds = secondaryUserIds.filter((id) => id !== primaryUserId && users.has(id));
  if (validSecondaryIds.length === 0) {
    throw new Error('ไม่พบบัญชีผู้ใช้ซ้ำซ้อนที่ต้องการรวม');
  }

  // Ensure aliases list
  if (!Array.isArray(primaryUser.emailAliases)) {
    primaryUser.emailAliases = [];
  }
  if (primaryUser.email && !primaryUser.emailAliases.includes(primaryUser.email)) {
    primaryUser.emailAliases.push(primaryUser.email);
  }

  // Ensure devices list
  if (!Array.isArray(primaryUser.devices)) {
    primaryUser.devices = [];
    if (primaryUser.deviceId) {
      primaryUser.devices.push({
        id: `dev_primary_${primaryUser.id}`,
        deviceId: primaryUser.deviceId,
        deviceName: 'อุปกรณ์หลัก (Primary Phone)',
        deviceType: 'MOBILE',
        boundAt: primaryUser.createdAt || new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        isPrimary: true,
      });
    }
  }

  let reassignedAttendanceCount = 0;
  let reassignedCoursesCount = 0;
  let reassignedLeavesCount = 0;

  for (const secId of validSecondaryIds) {
    const secUser = users.get(secId);
    if (!secUser) continue;

    // 1. Inherit email and aliases
    if (secUser.email) {
      if (!primaryUser.emailAliases.includes(secUser.email)) {
        primaryUser.emailAliases.push(secUser.email);
      }
    }
    if (Array.isArray(secUser.emailAliases)) {
      secUser.emailAliases.forEach((alias) => {
        if (alias && !primaryUser.emailAliases!.includes(alias)) {
          primaryUser.emailAliases!.push(alias);
        }
      });
    }

    // 2. Inherit missing student profile fields
    if (!primaryUser.universityId && secUser.universityId) {
      primaryUser.universityId = secUser.universityId;
    }
    if (!primaryUser.title && secUser.title) {
      primaryUser.title = secUser.title;
    }
    if (!primaryUser.firstNameTh && secUser.firstNameTh) {
      primaryUser.firstNameTh = secUser.firstNameTh;
    }
    if (!primaryUser.lastNameTh && secUser.lastNameTh) {
      primaryUser.lastNameTh = secUser.lastNameTh;
    }
    if (!primaryUser.department && secUser.department) {
      primaryUser.department = secUser.department;
    }
    if (!primaryUser.facultyCode && secUser.facultyCode) {
      primaryUser.facultyCode = secUser.facultyCode;
      primaryUser.facultyName = secUser.facultyName;
    }
    if (!primaryUser.departmentCode && secUser.departmentCode) {
      primaryUser.departmentCode = secUser.departmentCode;
      primaryUser.departmentName = secUser.departmentName;
    }
    if (!primaryUser.programCode && secUser.programCode) {
      primaryUser.programCode = secUser.programCode;
      primaryUser.programName = secUser.programName;
    }
    if (secUser.avatarUrl && (!primaryUser.avatarUrl || primaryUser.avatarUrl.includes('default-user'))) {
      primaryUser.avatarUrl = secUser.avatarUrl;
    }

    // 3. Consolidate devices
    if (Array.isArray(secUser.devices) && secUser.devices.length > 0) {
      secUser.devices.forEach((d) => {
        const alreadyHas = primaryUser.devices!.some((pd) => pd.deviceId === d.deviceId);
        if (!alreadyHas) {
          primaryUser.devices!.push({
            ...d,
            id: `dev_merged_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            isPrimary: false,
          });
        }
      });
    } else if (secUser.deviceId) {
      const alreadyHas = primaryUser.devices!.some((pd) => pd.deviceId === secUser.deviceId);
      if (!alreadyHas) {
        primaryUser.devices!.push({
          id: `dev_merged_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          deviceId: secUser.deviceId,
          deviceName: 'อุปกรณ์เพิ่มเติม (Merged Device)',
          deviceType: 'MOBILE',
          boundAt: secUser.createdAt || new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          isPrimary: false,
        });
      }
    }

    // 4. Reassign Attendance Records
    for (const ar of attendanceRecords) {
      if (ar && ar.studentId === secId) {
        ar.studentId = primaryUserId;
        ar.studentNameTh = primaryUser.firstNameTh ? `${primaryUser.title || ''} ${primaryUser.firstNameTh} ${primaryUser.lastNameTh || ''}`.trim() : ar.studentNameTh;
        if (primaryUser.universityId) {
          ar.studentUniversityId = primaryUser.universityId;
        }
        await saveToFirestore(COLLECTIONS.ATTENDANCE, ar);
        reassignedAttendanceCount++;
      }
    }

    // 5. Reassign Course Memberships
    // Filter course memberships for secondary user
    const secMembers = courseMembers.filter((cm) => cm.userId === secId);
    for (const sm of secMembers) {
      // Check if primary is already a member of this course
      const primaryInCourse = courseMembers.find((cm) => cm.courseId === sm.courseId && cm.userId === primaryUserId);
      if (!primaryInCourse) {
        sm.userId = primaryUserId;
        await saveToFirestore(COLLECTIONS.COURSE_MEMBERS, sm);
        reassignedCoursesCount++;
      } else {
        // Remove redundant membership
        const idx = courseMembers.findIndex((cm) => cm.id === sm.id);
        if (idx >= 0) courseMembers.splice(idx, 1);
        await deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, sm.id);
      }
    }

    // 6. Reassign Courses ownership (if teacher)
    for (const c of Array.from(courses.values())) {
      let courseUpdated = false;
      if (c.ownerId === secId) {
        c.ownerId = primaryUserId;
        c.ownerName = `${primaryUser.title || ''} ${primaryUser.firstNameTh} ${primaryUser.lastNameTh || ''}`.trim();
        courseUpdated = true;
      }
      if (courseUpdated) {
        courses.set(c.id, c);
        await saveToFirestore(COLLECTIONS.COURSES, c);
      }
    }

    // 7. Reassign Leave Requests
    for (const lr of leaveRequests) {
      if (lr && lr.studentId === secId) {
        lr.studentId = primaryUserId;
        lr.studentNameTh = `${primaryUser.title || ''} ${primaryUser.firstNameTh} ${primaryUser.lastNameTh || ''}`.trim();
        if (primaryUser.universityId) {
          lr.studentUniversityId = primaryUser.universityId;
        }
        await saveToFirestore(COLLECTIONS.LEAVE_REQUESTS, lr);
        reassignedLeavesCount++;
      }
    }

    // 8. Reassign Notifications
    for (const [nId, notif] of Array.from(notifications.entries())) {
      if (notif.recipientUserId === secId) {
        notif.recipientUserId = primaryUserId;
        notifications.set(nId, notif);
        await saveToFirestore(COLLECTIONS.NOTIFICATIONS, notif);
      }
    }

    // 9. Save Pointer Mapping for seamless redirect & healing
    mergedUserPointers.set(secId, primaryUserId);
    await saveToFirestore(COLLECTIONS.USER_POINTERS, {
      id: secId,
      targetUserId: primaryUserId,
      mergedAt: new Date().toISOString(),
    });

    // 10. Delete secondary user record from active users
    users.delete(secId);
    await deleteFromFirestore(COLLECTIONS.USERS, secId);
  }

  // Ensure primary email is canonical .ac.th if possible
  const canonicalEmail = getCanonicalUniversityEmail(primaryUser.email);
  if (canonicalEmail !== primaryUser.email) {
    if (!primaryUser.emailAliases.includes(primaryUser.email)) {
      primaryUser.emailAliases.push(primaryUser.email);
    }
    primaryUser.email = canonicalEmail;
  }

  users.set(primaryUserId, primaryUser);
  await saveToFirestore(COLLECTIONS.USERS, primaryUser);

  return {
    success: true,
    primaryUser,
    removedUserIds: validSecondaryIds,
    reassignedAttendanceCount,
    reassignedCoursesCount,
    reassignedLeavesCount,
  };
}

/**
 * Admin Merge Single Pair / Group of Users
 */
app.post('/api/admin/users/merge', async (req, res) => {
  try {
    const { primaryUserId, secondaryUserIds } = req.body || {};
    if (!primaryUserId || !Array.isArray(secondaryUserIds) || secondaryUserIds.length === 0) {
      return res.status(400).json({ error: 'กรุณาระบุ primaryUserId และ secondaryUserIds สำหรับการรวมบัญชี' });
    }

    // Create automatic safety backup before performing merge
    let backupId = '';
    try {
      const backupResult = await createSnapshotBackup(`Auto Backup ก่อนรวมบัญชี (${primaryUserId})`, 'Account Deduplication Merge', 'auto');
      backupId = backupResult?.id || '';
    } catch (bErr) {
      console.warn('Auto backup warning:', bErr);
    }

    const mergeResult = await executeUserAccountMerge(primaryUserId, secondaryUserIds);

    res.json({
      success: true,
      message: `รวมบัญชีสำเร็จเรียบร้อยแล้ว (${mergeResult.removedUserIds.length} บัญชีถูกรวมเข้ากับ ${mergeResult.primaryUser.firstNameTh || mergeResult.primaryUser.email})`,
      mergedCount: mergeResult.removedUserIds.length,
      primaryUserId: mergeResult.primaryUser.id,
      primaryUser: mergeResult.primaryUser,
      removedUserIds: mergeResult.removedUserIds,
      reassignedAttendanceCount: mergeResult.reassignedAttendanceCount,
      reassignedCoursesCount: mergeResult.reassignedCoursesCount,
      reassignedLeavesCount: mergeResult.reassignedLeavesCount,
      backupId,
    });
  } catch (err: any) {
    console.error('Error merging accounts:', err);
    res.status(500).json({ error: `เกิดข้อผิดพลาดในการรวมบัญชี: ${err.message}` });
  }
});

/**
 * Admin Auto-Merge All Detected Duplicates
 */
app.post('/api/admin/users/merge-all-duplicates', async (req, res) => {
  try {
    // 1. Create safety backup first
    let backupId = '';
    try {
      const backupResult = await createSnapshotBackup('Auto Backup ก่อนรวมบัญชีซ้ำซ้อนทั้งหมด (Domain Transition Full Merge)', 'Account Deduplication Batch Merge', 'auto');
      backupId = backupResult?.id || '';
    } catch (bErr) {
      console.warn('Auto backup warning:', bErr);
    }

    // 2. Scan duplicates
    const allUsers = Array.from(users.values()).filter(Boolean);
    const groups: Array<{ primaryUserId: string; secondaryUserIds: string[] }> = [];
    const processedUserIds = new Set<string>();

    for (let i = 0; i < allUsers.length; i++) {
      const u1 = allUsers[i];
      if (processedUserIds.has(u1.id)) continue;

      const duplicates: User[] = [];
      const email1 = (u1.email || '').trim().toLowerCase();
      const uId1 = (u1.universityId || '').trim();
      const variants1 = getEmailDomainVariants(email1);

      for (let j = i + 1; j < allUsers.length; j++) {
        const u2 = allUsers[j];
        if (processedUserIds.has(u2.id)) continue;

        const email2 = (u2.email || '').trim().toLowerCase();
        const uId2 = (u2.universityId || '').trim();

        let isMatch = false;
        if (email1 && email2 && variants1.includes(email2)) {
          isMatch = true;
        } else if (uId1 && uId2 && uId1 === uId2 && u1.role === u2.role) {
          isMatch = true;
        }

        if (isMatch) {
          duplicates.push(u2);
          processedUserIds.add(u2.id);
        }
      }

      if (duplicates.length > 0) {
        processedUserIds.add(u1.id);
        const allInGroup = [u1, ...duplicates];
        allInGroup.sort((a, b) => {
          const aIsAcTh = (a.email || '').endsWith('.ac.th') ? 1 : 0;
          const bIsAcTh = (b.email || '').endsWith('.ac.th') ? 1 : 0;
          if (aIsAcTh !== bIsAcTh) return bIsAcTh - aIsAcTh;

          const aIsGoogle = a.authProvider === 'google' ? 1 : 0;
          const bIsGoogle = b.authProvider === 'google' ? 1 : 0;
          if (aIsGoogle !== bIsGoogle) return bIsGoogle - aIsGoogle;

          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          return aDate - bDate;
        });

        groups.push({
          primaryUserId: allInGroup[0].id,
          secondaryUserIds: allInGroup.slice(1).map((u) => u.id),
        });
      }
    }

    let totalMergedUsers = 0;
    let totalAttendanceReassigned = 0;
    let totalCoursesReassigned = 0;
    let totalLeavesReassigned = 0;

    for (const group of groups) {
      try {
        const resMerge = await executeUserAccountMerge(group.primaryUserId, group.secondaryUserIds);
        totalMergedUsers += resMerge.removedUserIds.length;
        totalAttendanceReassigned += resMerge.reassignedAttendanceCount;
        totalCoursesReassigned += resMerge.reassignedCoursesCount;
        totalLeavesReassigned += resMerge.reassignedLeavesCount;
      } catch (grpErr) {
        console.error(`Error merging group ${group.primaryUserId}:`, grpErr);
      }
    }

    res.json({
      success: true,
      message: `ดำเนินการรวมบัญชีซ้ำซ้อนทั้งหมดเสร็จสิ้น รวมบัญชีทั้งสิ้น ${totalMergedUsers} บัญชี (โอนประวัติเช็กชื่อ ${totalAttendanceReassigned} รายการ, วิชา ${totalCoursesReassigned} รายการ, ใบลา ${totalLeavesReassigned} รายการ)`,
      totalGroupsProcessed: groups.length,
      totalMergedUsers,
      totalAttendanceReassigned,
      totalCoursesReassigned,
      totalLeavesReassigned,
      backupId,
    });
  } catch (err: any) {
    console.error('Error auto-merging all duplicates:', err);
    res.status(500).json({ error: `เกิดข้อผิดพลาดในการรวมบัญชีทั้งหมด: ${err.message}` });
  }
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
  const isLockEnabled = systemSettings.singleDeviceLockEnabled ?? true;
  const maxAllowedDevices = systemSettings.maxDevicesPerUser || 1;

  res.json({
    devices: user.devices,
    maxDevices: isStudent && isLockEnabled ? maxAllowedDevices : null,
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

// Helper function to safely remove a user device
function removeUserDevice(user: User, targetDevId: string): { success: boolean; error?: string; initialCount: number; remainingCount: number } {
  if (!user) return { success: false, error: 'ไม่พบผู้ใช้งานนี้ในระบบ', initialCount: 0, remainingCount: 0 };

  // Ensure user.devices array exists and primary device is populated
  if (!user.devices) {
    user.devices = [];
  }
  if (user.devices.length === 0 && user.deviceId) {
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

  // Ensure all device items have an 'id' property
  user.devices.forEach((d, idx) => {
    if (!d.id) {
      d.id = `dev_${idx}_${d.deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
    }
  });

  if (user.devices.length === 0) {
    return { success: false, error: 'ไม่มีอุปกรณ์ที่ผูกไว้ในระบบ', initialCount: 0, remainingCount: 0 };
  }

  const decodedDevId = decodeURIComponent(targetDevId || '');
  const initialCount = user.devices.length;

  user.devices = user.devices.filter((d) => {
    // 1. Direct match with d.id or d.deviceId
    if (d.id && (d.id === targetDevId || d.id === decodedDevId)) return false;
    if (d.deviceId && (d.deviceId === targetDevId || d.deviceId === decodedDevId)) return false;

    // 2. Hardware fingerprint match (e.g., fp_123456)
    if (targetDevId && targetDevId.includes('fp_') && d.deviceId && d.deviceId.includes(targetDevId)) return false;
    if (decodedDevId && decodedDevId.includes('fp_') && d.deviceId && d.deviceId.includes(decodedDevId)) return false;

    // 3. Extracted fingerprint regex match
    const targetFp = (targetDevId || '').match(/fp_[a-f0-9]+/)?.[0];
    if (targetFp && d.deviceId && d.deviceId.includes(targetFp)) return false;

    return true;
  });

  // If match was not found, but only 1 device exists or user sent 'primary', fallback remove
  if (user.devices.length === initialCount && (targetDevId === 'primary' || targetDevId === 'first')) {
    user.devices.shift();
  }

  const remainingCount = user.devices.length;
  if (remainingCount === initialCount) {
    return { success: false, error: 'ไม่พบอุปกรณ์ที่ระบุในรายการผูกเครื่อง', initialCount, remainingCount };
  }

  if (user.devices.length > 0) {
    user.deviceId = user.devices[0].deviceId;
  } else {
    user.deviceId = undefined;
  }

  return { success: true, initialCount, remainingCount };
}

// Remove a specific bound device (DELETE endpoint)
app.delete('/api/users/:userId/devices/:devId', async (req, res) => {
  const { userId, devId } = req.params;
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  const result = removeUserDevice(user, devId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  users.set(user.id, user);
  await saveToFirestore(COLLECTIONS.USERS, user);

  res.json({
    message: 'ยกเลิกการผูกอุปกรณ์เรียบร้อยแล้ว',
    devices: user.devices,
    user,
  });
});

// Remove a specific bound device (POST endpoint for sandboxed/cross-origin safety)
app.post('/api/users/:userId/devices/delete', async (req, res) => {
  const { userId } = req.params;
  const { devId, targetId, deviceId } = req.body || {};
  const target = devId || targetId || deviceId || (req.query.devId as string) || '';

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  const result = removeUserDevice(user, String(target));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
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
  const { studentId, sessionId: rawSessionId, weekNumber, eventId, courseId, status, checkinMethod } = req.body;

  let targetUser = users.get(studentId);
  if (!targetUser) {
    targetUser = Array.from(users.values()).find(
      (u) => u.id === studentId || u.universityId === studentId
    );
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้ในระบบ (กรุณาเลือกผู้ใช้ที่มีอยู่จริง)' });
  }

  // Auto-resolve session ID canonically using courseId and weekNumber
  let sessionId = rawSessionId;
  if (courseId && weekNumber) {
    const courseObj = courses.get(courseId);
    if (courseObj) {
      ensureCourseSessions(courseObj);
      const matchedSession = Array.from(sessions.values()).find(
        (s) => s.courseId === courseId && Number(s.weekNumber) === Number(weekNumber)
      );
      if (matchedSession) {
        sessionId = matchedSession.id;
      }
    }
  }

  if (!sessionId && courseId && weekNumber) {
    let matchedSession = Array.from(sessions.values()).find(
      (s) => s.courseId === courseId && Number(s.weekNumber) === Number(weekNumber)
    );
    if (!matchedSession) {
      const newSessionId = `ses_${courseId}_wk${weekNumber}_${Date.now()}`;
      matchedSession = {
        id: newSessionId,
        courseId,
        weekNumber: Number(weekNumber),
        topic: `การสอน สัปดาห์ที่ ${weekNumber}`,
        createdAt: new Date().toISOString(),
        teacherLat: 0,
        teacherLng: 0,
        isActive: false,
      };
      sessions.set(newSessionId, matchedSession);
      await saveToFirestore(COLLECTIONS.SESSIONS, matchedSession);
    }
    sessionId = matchedSession.id;
  }

  // Prevent teachers from overriding approved student leaves
  if (targetUser.role === UserRole.STUDENT && courseId && sessionId && (req as any).user?.role === UserRole.TEACHER) {
    const matchedSes = sessions.get(sessionId);
    if (matchedSes) {
      const approvedLeave = getApprovedLeaveForSession(targetUser.id, courseId, matchedSes);
      if (approvedLeave) {
        return res.status(400).json({
          error: `ไม่สามารถแก้ไขสถานะได้ เนื่องจากนักศึกษามีใบลาที่ได้รับการอนุมัติแล้ว (${approvedLeave.leaveType === LeaveType.SICK ? 'ลาป่วย' : 'ลากิจ'})`,
        });
      }
    }
  }

  if (targetUser.role === UserRole.TEACHER) {
    let teacherRecord = teacherAttendanceRecords.find(
      (tr) =>
        tr.teacherId === targetUser!.id &&
        ((sessionId && tr.sessionId === sessionId) || (courseId && tr.courseId === courseId))
    );
    const crs = courseId ? courses.get(courseId) : undefined;
    const ses = sessionId ? sessions.get(sessionId) : undefined;

    if (teacherRecord) {
      teacherRecord.timestamp = new Date().toISOString();
      teacherRecord.notes = `Admin override status: ${status}`;
    } else {
      teacherRecord = {
        id: `tatt_admin_override_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        teacherId: targetUser.id,
        teacherName: `${targetUser.title || ''}${targetUser.firstNameTh || ''} ${targetUser.lastNameTh || ''}`.trim(),
        courseId: courseId || ses?.courseId,
        courseCode: crs?.courseCode,
        courseName: crs?.courseName,
        sessionId,
        sessionTopic: ses?.topic,
        timestamp: new Date().toISOString(),
        lat: 0,
        lng: 0,
        checkinMethod: (checkinMethod as any) || 'HYBRID',
        deviceId: targetUser.deviceId || 'admin_override',
        notes: `Admin override status: ${status}`,
      };
      teacherAttendanceRecords.push(teacherRecord);
    }
    await saveToFirestore('teacherAttendanceRecords', teacherRecord);
    return res.json({ message: 'ปรับแก้ไขข้อมูลการเช็กชื่อของอาจารย์สำเร็จเรียบร้อยแล้ว', record: teacherRecord });
  }

  // Handle Student Attendance Override
  const sesObj = sessionId ? sessions.get(sessionId) : undefined;
  let record = findStudentAttendanceRecord(targetUser.id, courseId || sesObj?.courseId || '', sesObj || { id: sessionId, courseId: courseId || '', weekNumber: Number(weekNumber) || 1 } as Session);
  if (!record && (sessionId || eventId)) {
    record = attendanceRecords.find(
      (ar) =>
        (ar.studentId === targetUser!.id || (targetUser!.universityId && ar.studentUniversityId === targetUser!.universityId)) &&
        ((sessionId && ar.sessionId === sessionId) || (eventId && ar.eventId === eventId))
    );
  }

  if (record) {
    record.status = status as AttendanceStatus;
    record.timestamp = new Date().toISOString();
    if (sessionId) record.sessionId = sessionId;
    if (courseId) record.courseId = courseId;
    if (weekNumber) record.weekNumber = Number(weekNumber);
    if (checkinMethod) record.checkinMethod = checkinMethod as any;
  } else {
    record = {
      id: `att_admin_override_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      eventId,
      courseId,
      weekNumber: weekNumber ? Number(weekNumber) : undefined,
      studentId: targetUser.id,
      studentNameTh: `${targetUser.title || ''}${targetUser.firstNameTh} ${targetUser.lastNameTh}`.trim(),
      studentNameEn: `${targetUser.firstNameEn || ''} ${targetUser.lastNameEn || ''}`.trim(),
      studentUniversityId: targetUser.universityId,
      timestamp: new Date().toISOString(),
      status: status as AttendanceStatus,
      scannedLat: 0,
      scannedLng: 0,
      distanceMeters: 0,
      deviceId: targetUser.deviceId || 'admin_override',
      checkinMethod: (checkinMethod as any) || 'HYBRID',
    };
    attendanceRecords.push(record);
  }

  await saveToFirestore(COLLECTIONS.ATTENDANCE, record);
  if (record.sessionId) {
    broadcastCheckinEvent(record.sessionId, record);
  } else if (record.eventId) {
    broadcastCheckinEvent(record.eventId, record);
  }

  res.json({ message: 'ปรับแก้ไขข้อมูลการเช็กชื่อของนักศึกษาสำเร็จเรียบร้อยแล้ว', record });
});

// Clear all student check-in attendance records completely
app.post('/api/admin/clear-all-attendance', async (req, res) => {
  try {
    const fsAttendance = await getAllFromFirestore<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
    const count = Math.max(attendanceRecords.length, fsAttendance?.length || 0);

    if (fsAttendance && fsAttendance.length > 0) {
      for (const ar of fsAttendance) {
        if (ar && ar.id) {
          await deleteFromFirestore(COLLECTIONS.ATTENDANCE, ar.id);
        }
      }
    }
    for (const ar of attendanceRecords) {
      if (ar && ar.id) {
        await deleteFromFirestore(COLLECTIONS.ATTENDANCE, ar.id);
      }
    }
    attendanceRecords.length = 0;

    res.json({
      message: 'ลบข้อมูลการเช็กชื่อเข้าเรียนทั้งหมดเรียบร้อยแล้ว',
      deletedCount: count,
      remainingCount: 0,
    });
  } catch (err: any) {
    console.error('Error clearing attendance records:', err);
    res.status(500).json({ error: `เกิดข้อผิดพลาดในการลบข้อมูลการเช็กชื่อ: ${err.message}` });
  }
});

app.delete('/api/admin/attendance', async (req, res) => {
  try {
    const fsAttendance = await getAllFromFirestore<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
    const count = Math.max(attendanceRecords.length, fsAttendance?.length || 0);

    if (fsAttendance && fsAttendance.length > 0) {
      for (const ar of fsAttendance) {
        if (ar && ar.id) {
          await deleteFromFirestore(COLLECTIONS.ATTENDANCE, ar.id);
        }
      }
    }
    for (const ar of attendanceRecords) {
      if (ar && ar.id) {
        await deleteFromFirestore(COLLECTIONS.ATTENDANCE, ar.id);
      }
    }
    attendanceRecords.length = 0;

    res.json({
      message: 'ลบข้อมูลการเช็กชื่อเข้าเรียนทั้งหมดเรียบร้อยแล้ว',
      deletedCount: count,
      remainingCount: 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real CSV Exported Records (87 rows)
const CSV_RAW_RECORDS = [
  { no: '1', type: 'นักศึกษา', studentId: '6806043', name: 'นางสาว รุจาภา สันติวสุธา', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:46:32' },
  { no: '2', type: 'นักศึกษา', studentId: '6806063', name: 'นางสาว ณัฐนันท์ พระธาตุ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:53' },
  { no: '3', type: 'นักศึกษา', studentId: '6806045', name: 'นางสาว วีร์สุดา เหลืองพูนสิน', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:38' },
  { no: '4', type: 'นักศึกษา', studentId: '6806073', name: 'นางสาว บุณยวีร์ ตันสิทธิพันธุ์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:37' },
  { no: '5', type: 'นักศึกษา', studentId: '6806058', name: 'นางสาว คุ้มขวัญ เดชไพบูลย์มงคล', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:37' },
  { no: '6', type: 'นักศึกษา', studentId: '6806069', name: 'นาย THANACHOT CHANSONG', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:36' },
  { no: '7', type: 'นักศึกษา', studentId: '6806027', name: 'นางสาว ชนนิกานต์ แสนประเสริฐ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:34' },
  { no: '8', type: 'นักศึกษา', studentId: '6806039', name: 'นางสาว พาขวัญ สุวรรณธาดา', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:34' },
  { no: '9', type: 'นักศึกษา', studentId: '6806065', name: 'นางสาว ณิชกานต์ ชัยพฤกษ์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:33' },
  { no: '10', type: 'นักศึกษา', studentId: '6806056', name: 'นางสาว KANLAYAKORN SUWANMANASIN', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:32' },
  { no: '11', type: 'นักศึกษา', studentId: '6806081', name: 'นางสาว ภคมน มหารงค์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:45:21' },
  { no: '12', type: 'นักศึกษา', studentId: '6806047', name: 'นางสาว สิตางศุ์ ฟักทอง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:42:09' },
  { no: '13', type: 'นักศึกษา', studentId: '6806089', name: 'นางสาว WARANGRAT PAPHAWADIDIT', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:41:35' },
  { no: '14', type: 'นักศึกษา', studentId: '6806005', name: 'นางสาว ณัณท์ณภัส แก้วสว่าง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:41:04' },
  { no: '15', type: 'นักศึกษา', studentId: '6806055', name: 'นางสาว กัญญารัตน์ แป้นเอียด', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:40:42' },
  { no: '16', type: 'นักศึกษา', studentId: '6806093', name: 'นางสาว สายน้ำ ทัพพวิบูล', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '3/8/2569 13:40:40' },
  { no: '17', type: 'นักศึกษา', studentId: '6806057', name: 'นางสาว เกตน์นิภา วงษ์อาจ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '3/8/2569 13:40:39' },
  { no: '18', type: 'นักศึกษา', studentId: '6806033', name: 'นาย THIANPHALIT LEELAMANEE', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'GPS_ONLY', note: '-', time: '3/8/2569 13:40:29' },
  { no: '19', type: 'นักศึกษา', studentId: '6806085', name: 'นาย รัฐกิตติ์ สุรีย์นิธิคุณ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:40:20' },
  { no: '20', type: 'นักศึกษา', studentId: '6806079', name: 'นาย PHANTHITA CHOTIRAT', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:40:08' },
  { no: '21', type: 'นักศึกษา', studentId: '6806066', name: 'นาย NICHAKAN PINIT', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '3/8/2569 13:39:50' },
  { no: '22', type: 'นักศึกษา', studentId: '6806064', name: 'นาย ณัฐภัทร ชวนานุกูล', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '3/8/2569 13:39:45' },
  { no: '23', type: 'นักศึกษา', studentId: '6806052', name: 'นางสาว อวัสดา วรรธนะกุลโรจน์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '3/8/2569 13:39:45' },
  { no: '24', type: 'นักศึกษา', studentId: '6806016', name: 'นางสาว PAWITPORN POTO', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:39' },
  { no: '25', type: 'นักศึกษา', studentId: '6806049', name: 'นางสาว สุทธิกานต์ เอกสมัย', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:36' },
  { no: '26', type: 'นักศึกษา', studentId: '6806086', name: 'นางสาว รัตนากร น้อยวัน', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:33' },
  { no: '27', type: 'นักศึกษา', studentId: '6806068', name: 'นาย ติณณภพ อารีวัฒนะ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:30' },
  { no: '28', type: 'นักศึกษา', studentId: '6806020', name: 'นางสาว กณิศา สร้อยสังวาลย์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:20' },
  { no: '29', type: 'นักศึกษา', studentId: '6806054', name: 'นางสาว กฤษณา บุญศรี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:12' },
  { no: '30', type: 'นักศึกษา', studentId: '6806078', name: 'นางสาว พัณณ์ชิตา สงวนเกียรติชัย', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:12' },
  { no: '31', type: 'นักศึกษา', studentId: '6806070', name: 'นางสาว ธนพร เจริญวิทยวรกุล', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'GPS_ONLY', note: '-', time: '3/8/2569 13:39:12' },
  { no: '32', type: 'นักศึกษา', studentId: '6806083', name: 'นาย ภาณุวัฒน์ คำศรีสุข', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:08' },
  { no: '33', type: 'นักศึกษา', studentId: '6806075', name: 'นางสาว ปุณิกา เบญจกาญจน์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:39:07' },
  { no: '34', type: 'นักศึกษา', studentId: '6806076', name: 'นางสาว พัชรพร ขาวนาค', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:55' },
  { no: '35', type: 'นักศึกษา', studentId: '6806077', name: 'นางสาว พัชริญา ฉัตรเทียนชัย', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:54' },
  { no: '36', type: 'นักศึกษา', studentId: '6806010', name: 'นาย PRAKASIT KAEWTRAKULCHAI', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:52' },
  { no: '37', type: 'นักศึกษา', studentId: '6806037', name: 'นางสาว พรรณพนัช จงกลกลาง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:52' },
  { no: '38', type: 'นักศึกษา', studentId: '6806028', name: 'นางสาว ณภัทร หวังศรีโรจน์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:51' },
  { no: '39', type: 'นักศึกษา', studentId: '6806096', name: 'นางสาว SUCHADA KLINTOMYA', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:50' },
  { no: '40', type: 'นักศึกษา', studentId: '6806050', name: 'นางสาว สุพิธชยา ทองสุข', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:50' },
  { no: '41', type: 'นักศึกษา', studentId: '6806084', name: 'นางสาว PURITA KANOKKAWINCHOT', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:48' },
  { no: '42', type: 'นักศึกษา', studentId: '6806046', name: 'นาย ศิภูริน บางโพ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:48' },
  { no: '43', type: 'นักศึกษา', studentId: '6806090', name: 'นางสาว ศรัณย์พร แซ่เตีย', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:47' },
  { no: '44', type: 'นักศึกษา', studentId: '6706017', name: 'นางสาว ภัทรวดี คำมา', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:46' },
  { no: '45', type: 'นักศึกษา', studentId: '6806061', name: 'นางสาว ณัฏฐกมล อรุณนันทพานิช', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:45' },
  { no: '46', type: 'นักศึกษา', studentId: '6806072', name: 'นาย NOPPADON SONGSARN', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:45' },
  { no: '47', type: 'นักศึกษา', studentId: '6806006', name: 'นางสาว ธนภรณ์ สร้อยทอง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:45' },
  { no: '48', type: 'นักศึกษา', studentId: '6806091', name: 'นางสาว ศิริรัตน์ ทองสง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:44' },
  { no: '49', type: 'นักศึกษา', studentId: '6806032', name: 'นาย ธนาชัย น้อยจีน', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:44' },
  { no: '50', type: 'นักศึกษา', studentId: '6806053', name: 'นาย กรภัทร สุขสบาย', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:44' },
  { no: '51', type: 'นักศึกษา', studentId: '6806048', name: 'นางสาว สิริฉัตร แซ่ลี้', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:43' },
  { no: '52', type: 'นักศึกษา', studentId: '6806042', name: 'นางสาว รินนภา โฮ้หนู', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:41' },
  { no: '53', type: 'นักศึกษา', studentId: '6806097', name: 'นางสาว สุนิสา เหมือนแจ่ม', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:41' },
  { no: '54', type: 'นักศึกษา', studentId: '6806034', name: 'นางสาว นันทพัชร์ เธียรสุวรรณแสง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:41' },
  { no: '55', type: 'นักศึกษา', studentId: '6806087', name: 'นางสาว ลดาดล อินถาเครือ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:41' },
  { no: '56', type: 'นักศึกษา', studentId: '6806013', name: 'นางสาว พวงมณี พรหมชนะ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:40' },
  { no: '57', type: 'นักศึกษา', studentId: '6806074', name: 'นางสาว PALITA SIRILEARNMAN', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:39' },
  { no: '58', type: 'นักศึกษา', studentId: '6806031', name: 'นางสาว THANANCHANOK YIMJANG', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:39' },
  { no: '59', type: 'นักศึกษา', studentId: '6806025', name: 'นางสาว ฉันท์ชนิต ธรรมสูตร', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:38' },
  { no: '60', type: 'นักศึกษา', studentId: '6806038', name: 'นางสาว PHATCHARIN SRIKHAMSAENG', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:37' },
  { no: '61', type: 'นักศึกษา', studentId: '6806003', name: 'นางสาว จิดาภา แซ่ลี่', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:37' },
  { no: '62', type: 'นักศึกษา', studentId: '6806088', name: 'นางสาว วรนิษฐา ดวงดี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:37' },
  { no: '63', type: 'นักศึกษา', studentId: '6806030', name: 'นางสาว ณิชมน พฤกษ์รังษี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:34' },
  { no: '64', type: 'นักศึกษา', studentId: '6806004', name: 'นาย ญาณกร พูลทรัพย์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:33' },
  { no: '65', type: 'นักศึกษา', studentId: '6806001', name: 'นางสาว กุศลิน หนูในน้ำ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:33' },
  { no: '66', type: 'นักศึกษา', studentId: '6806022', name: 'นางสาว เขมจิรา รอชัยกุล', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'GPS_ONLY', note: '-', time: '3/8/2569 13:38:31' },
  { no: '67', type: 'นักศึกษา', studentId: '6806023', name: 'นางสาว จิดาภา ยอดชาญ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:31' },
  { no: '68', type: 'นักศึกษา', studentId: '6806041', name: 'นางสาว ภูษชา คนไว', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:30' },
  { no: '69', type: 'นักศึกษา', studentId: '6806017', name: 'นางสาว วศินี บุญณมี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:29' },
  { no: '70', type: 'นักศึกษา', studentId: '6806002', name: 'นางสาว แก้วตา อินทวงค์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:29' },
  { no: '71', type: 'นักศึกษา', studentId: '6806011', name: 'นางสาว ปวีณ์ลดา เพ็ชรมณี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:28' },
  { no: '72', type: 'นักศึกษา', studentId: '6806026', name: 'นางสาว ชญาดา เพ็ชรปิ่นแก้ว', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:27' },
  { no: '73', type: 'นักศึกษา', studentId: '6806029', name: 'นาย ณัฐนนท์ อินทร์กลิ่น', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:26' },
  { no: '74', type: 'นักศึกษา', studentId: '6806067', name: 'นางสาว ดวงกมล จงพิริยะไพบูลย์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:25' },
  { no: '75', type: 'นักศึกษา', studentId: '6806092', name: 'นาย ศุภวิชญ์ อิงคศรี', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:25' },
  { no: '76', type: 'นักศึกษา', studentId: '6806062', name: 'นางสาว ณัฐนรี ทองสงค์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:24' },
  { no: '77', type: 'นักศึกษา', studentId: '6806007', name: 'นาย TEERAPAT JAROENSUK', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:24' },
  { no: '78', type: 'นักศึกษา', studentId: '6806095', name: 'นาย SINGHA KETKAN', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:23' },
  { no: '79', type: 'นักศึกษา', studentId: '6806044', name: 'นางสาว วริศา ณัทกลทีป์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:19' },
  { no: '80', type: 'นักศึกษา', studentId: '6806036', name: 'นางสาว ปาริชาติ ตระกูลเกษมสิริ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:19' },
  { no: '81', type: 'นักศึกษา', studentId: '6806012', name: 'นางสาว เปรมมิกา บัณฑิตสินทรัพย์', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:18' },
  { no: '82', type: 'นักศึกษา', studentId: '6806009', name: 'นาย ปฐมกาล สุทธิ์เสงี่ยม', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:17' },
  { no: '83', type: 'นักศึกษา', studentId: '6806008', name: 'นางสาว NARA HUSSAWARIN', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:15' },
  { no: '84', type: 'นักศึกษา', studentId: '6806082', name: 'นางสาว ภัทรนันท์ แซ่ปึง', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:11' },
  { no: '85', type: 'นักศึกษา', studentId: '6806094', name: 'นางสาว สาริศา แดงประภา', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '3/8/2569 13:38:04' },
  { no: '86', type: 'นักศึกษา', studentId: '66010012', name: 'นาย กิตติพงษ์ สุขเสริฐ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 2', status: 'มาเรียน (PRESENT)', method: 'HYBRID', note: '-', time: '31/7/2569 13:55:17' },
  { no: '87', type: 'นักศึกษา', studentId: '66010012', name: 'นาย กิตติพงษ์ สุขเสริฐ', code: 'MTID 204', course: 'Basic Data Management with Computer', week: 'สัปดาห์ที่ 1', status: 'มาเรียน (PRESENT)', method: 'TOKEN', note: '-', time: '31/7/2569 13:52:05' },
];

function parseThaiDateTime(timeStr: string): string {
  try {
    const [datePart, timePart] = timeStr.trim().split(' ');
    const [dStr, mStr, yBEStr] = datePart.split('/');
    const d = parseInt(dStr, 10);
    const m = parseInt(mStr, 10);
    const yBE = parseInt(yBEStr, 10);
    const yCE = yBE - 543;
    const [hhStr, mmStr, ssStr] = timePart.split(':');
    const hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    const ss = parseInt(ssStr, 10);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${yCE}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+07:00`;
  } catch (err) {
    return new Date().toISOString();
  }
}

function splitThaiName(fullNameStr: string) {
  let title = '';
  let rest = fullNameStr.trim();
  if (rest.startsWith('นางสาว ')) {
    title = 'นางสาว';
    rest = rest.substring(7).trim();
  } else if (rest.startsWith('นาย ')) {
    title = 'นาย';
    rest = rest.substring(4).trim();
  }

  const parts = rest.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  const isEnglish = /^[A-Za-z\s]+$/.test(rest);

  return {
    title,
    firstNameTh: isEnglish ? '' : firstName,
    lastNameTh: isEnglish ? '' : lastName,
    firstNameEn: isEnglish ? firstName : '',
    lastNameEn: isEnglish ? lastName : '',
  };
}

async function importRealCsvAttendanceRecords() {
  console.log('[CSV Import] Starting import of 87 real exported attendance records...');

  // 1. Ensure courses exist if not deleted
  if (!deletedCourseIds.has('crs_mtid204')) {
    const mtid204: Course = {
      id: 'crs_mtid204',
      courseCode: 'MTID204',
      courseName: 'Basic Data Management with Computer',
      academicYear: 2569,
      semester: Semester.FIRST,
      coordinatorName: 'ผศ.ดร. วนิดา เรียนดี',
      ownerId: 'usr_t2',
      ownerName: 'ผศ.ดร. วนิดา เรียนดี',
      facultyCode: 'MT',
      departmentCode: 'ID',
      majorCode: 'MTMT',
      degreeLevel: 'ปริญญาตรี',
      curriculums: ['วิทยาศาสตร์บัณฑิต (เทคนิคการแพทย์)'],
      defaultLat: 13.7988363,
      defaultLng: 100.322944,
      allowedGpsRadius: 200,
      weeks: [
        { weekNumber: 1, topic: 'Basic Data Management with Computer - Lecture 1', date: '2026-08-03' },
        { weekNumber: 2, topic: 'Basic Data Management with Computer - Lecture 2', date: '2026-07-31' },
      ],
      createdAt: new Date().toISOString(),
    };
    courses.set(mtid204.id, mtid204);
    await saveToFirestore(COLLECTIONS.COURSES, mtid204);
  }

  if (!deletedCourseIds.has('crs_test101')) {
    const test101 = courses.get('crs_test101');
    if (test101) {
      test101.courseName = 'Basic Data Management with Computer';
      await saveToFirestore(COLLECTIONS.COURSES, test101);
    }
  }

  // 2. Ensure Sessions exist if not deleted
  if (!deletedCourseIds.has('crs_mtid204')) {
    const sesMtid204W1: Session = {
      id: 'ses_mtid204_w1',
      courseId: 'crs_mtid204',
      weekNumber: 1,
      topic: 'Basic Data Management with Computer - Lecture 1',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    const sesMtid204W2: Session = {
      id: 'ses_mtid204_w2',
      courseId: 'crs_mtid204',
      weekNumber: 2,
      topic: 'Basic Data Management with Computer - Lecture 2',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    if (!deletedSessionIds.has('ses_mtid204_w1')) {
      sessions.set(sesMtid204W1.id, sesMtid204W1);
      await saveToFirestore(COLLECTIONS.SESSIONS, sesMtid204W1);
    }
    if (!deletedSessionIds.has('ses_mtid204_w2')) {
      sessions.set(sesMtid204W2.id, sesMtid204W2);
      await saveToFirestore(COLLECTIONS.SESSIONS, sesMtid204W2);
    }
  }

  if (!deletedCourseIds.has('crs_test101')) {
    const sesTest101W1: Session = {
      id: 'ses_1',
      courseId: 'crs_test101',
      weekNumber: 1,
      topic: 'Basic Data Management with Computer - Lecture 1',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    const sesTest101W2: Session = {
      id: 'ses_2',
      courseId: 'crs_test101',
      weekNumber: 2,
      topic: 'Basic Data Management with Computer - Lecture 2',
      teacherLat: 13.7988363,
      teacherLng: 100.322944,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    if (!deletedSessionIds.has('ses_1')) {
      sessions.set(sesTest101W1.id, sesTest101W1);
      await saveToFirestore(COLLECTIONS.SESSIONS, sesTest101W1);
    }
    if (!deletedSessionIds.has('ses_2')) {
      sessions.set(sesTest101W2.id, sesTest101W2);
      await saveToFirestore(COLLECTIONS.SESSIONS, sesTest101W2);
    }
  }

  // 3. Import Students, Members & Attendance Records
  const usersToSave: User[] = [];
  const membersToSave: CourseMember[] = [];
  const recordsToSave: AttendanceRecord[] = [];

  for (const item of CSV_RAW_RECORDS) {
    const stdId = item.studentId.trim();
    const userId = `usr_std_${stdId}`;
    const nameInfo = splitThaiName(item.name);

    // Create/update User
    const existingUser = users.get(userId);
    const studentUser: User = existingUser || {
      id: userId,
      role: UserRole.STUDENT,
      title: nameInfo.title,
      firstNameTh: nameInfo.firstNameTh,
      lastNameTh: nameInfo.lastNameTh,
      firstNameEn: nameInfo.firstNameEn,
      lastNameEn: nameInfo.lastNameEn,
      universityId: stdId,
      email: `${stdId}@student.mahidol.ac.th`,
      password: 'password123',
      department: 'ID',
      createdAt: new Date().toISOString(),
    };
    if (!users.has(userId)) {
      users.set(userId, studentUser);
      usersToSave.push(studentUser);
    }

    // Enroll in MTID204 & TEST101
    const cmMtid204Id = `cm_mtid204_${stdId}`;
    if (!courseMembers.some((m) => m.id === cmMtid204Id)) {
      const cm: CourseMember = {
        id: cmMtid204Id,
        courseId: 'crs_mtid204',
        userId,
        role: CourseMemberRole.STUDENT,
        joinedAt: new Date().toISOString(),
      };
      courseMembers.push(cm);
      membersToSave.push(cm);
    }

    const cmTest101Id = `cm_test101_${stdId}`;
    if (!courseMembers.some((m) => m.id === cmTest101Id)) {
      const cm: CourseMember = {
        id: cmTest101Id,
        courseId: 'crs_test101',
        userId,
        role: CourseMemberRole.STUDENT,
        joinedAt: new Date().toISOString(),
      };
      courseMembers.push(cm);
      membersToSave.push(cm);
    }

    // Parse attendance record
    const weekNum = item.week.includes('2') ? 2 : 1;
    const isoTimestamp = parseThaiDateTime(item.time);
    const methodClean = (item.method.trim() || 'HYBRID') as any;

    // MTID204 Record
    const recId = `rec_csv_${item.no}`;
    const recordMtid204: AttendanceRecord = {
      id: recId,
      sessionId: weekNum === 1 ? 'ses_mtid204_w1' : 'ses_mtid204_w2',
      studentId: userId,
      studentNameTh: item.name,
      studentNameEn: nameInfo.firstNameEn ? `${nameInfo.firstNameEn} ${nameInfo.lastNameEn}` : item.name,
      studentUniversityId: stdId,
      timestamp: isoTimestamp,
      status: AttendanceStatus.PRESENT,
      scannedLat: 13.7988363,
      scannedLng: 100.322944,
      distanceMeters: 3,
      deviceId: `dev_${stdId}`,
      checkinMethod: methodClean,
    };

    const existingIdx = attendanceRecords.findIndex((r) => r.id === recId);
    if (existingIdx >= 0) {
      attendanceRecords[existingIdx] = recordMtid204;
    } else {
      attendanceRecords.push(recordMtid204);
    }
    recordsToSave.push(recordMtid204);

    // TEST101 Record
    const recTest101Id = `rec_csv_test101_${item.no}`;
    const recordTest101: AttendanceRecord = {
      id: recTest101Id,
      sessionId: weekNum === 1 ? 'ses_1' : 'ses_2',
      studentId: userId,
      studentNameTh: item.name,
      studentNameEn: nameInfo.firstNameEn ? `${nameInfo.firstNameEn} ${nameInfo.lastNameEn}` : item.name,
      studentUniversityId: stdId,
      timestamp: isoTimestamp,
      status: AttendanceStatus.PRESENT,
      scannedLat: 13.7988363,
      scannedLng: 100.322944,
      distanceMeters: 3,
      deviceId: `dev_${stdId}`,
      checkinMethod: methodClean,
    };

    const existingTest101Idx = attendanceRecords.findIndex((r) => r.id === recTest101Id);
    if (existingTest101Idx >= 0) {
      attendanceRecords[existingTest101Idx] = recordTest101;
    } else {
      attendanceRecords.push(recordTest101);
    }
    recordsToSave.push(recordTest101);
  }

  // Execute batch writes in parallel
  await Promise.all([
    batchSaveToFirestore(COLLECTIONS.USERS, usersToSave),
    batchSaveToFirestore(COLLECTIONS.COURSE_MEMBERS, membersToSave),
    batchSaveToFirestore(COLLECTIONS.ATTENDANCE, recordsToSave),
  ]);

  console.log(`[CSV Import] Successfully imported all 87 real attendance records! Current total attendance records: ${attendanceRecords.length}`);
}

app.post('/api/admin/import-csv', async (req, res) => {
  try {
    await importRealCsvAttendanceRecords();
    res.json({
      message: 'นำเข้าข้อมูลการเช็กชื่อจริงจากไฟล์ CSV จำนวน 87 รายการสำเร็จเรียบร้อยแล้ว',
      totalRecords: attendanceRecords.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Firestore Database Sync Handler
async function syncFromFirestore() {
  try {
    const fsSettings = await getAllFromFirestore<SystemSettings>(COLLECTIONS.SYSTEM_SETTINGS);
    const hasInitializedConfig = Boolean(fsSettings && fsSettings.length > 0);

    if (fsSettings && fsSettings.length > 0) {
      const tombstoneDoc = fsSettings.find((s: any) => s.id === 'tombstones') as any;
      if (tombstoneDoc) {
        if (Array.isArray(tombstoneDoc.deletedCourseIds)) {
          tombstoneDoc.deletedCourseIds.forEach((id: string) => deletedCourseIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedMemberIds)) {
          tombstoneDoc.deletedMemberIds.forEach((id: string) => deletedMemberIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedSessionIds)) {
          tombstoneDoc.deletedSessionIds.forEach((id: string) => deletedSessionIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedUserIds)) {
          tombstoneDoc.deletedUserIds.forEach((id: string) => deletedUserIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedLeaveIds)) {
          tombstoneDoc.deletedLeaveIds.forEach((id: string) => deletedLeaveIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedAttendanceIds)) {
          tombstoneDoc.deletedAttendanceIds.forEach((id: string) => deletedAttendanceIds.add(id));
        }
        if (Array.isArray(tombstoneDoc.deletedQuickEventIds)) {
          tombstoneDoc.deletedQuickEventIds.forEach((id: string) => deletedQuickEventIds.add(id));
        }
      }

      const config = fsSettings.find((s) => s.id === 'global_config') || fsSettings[0];
      if (config && config.id === 'global_config') {
        systemSettings = { ...systemSettings, ...config };
      }
    } else if (fsSettings !== null && !hasInitializedConfig) {
      await saveToFirestore(COLLECTIONS.SYSTEM_SETTINGS, { id: 'global_config', ...systemSettings });
    }

    // 1. Sync Users
    const fsUsers = await getAllFromFirestore<User>(COLLECTIONS.USERS);
    if (fsUsers !== null && fsUsers.length > 0) {
      for (const u of fsUsers) {
        if (!u || !u.id) continue;
        if (deletedUserIds.has(u.id)) {
          deleteFromFirestore(COLLECTIONS.USERS, u.id).catch(() => {});
        } else {
          if (DEMO_USER_IDS.has(u.id)) {
            u.isDemo = true;
          }
          users.set(u.id, u);
        }
      }
    }
    for (const [id] of Array.from(users.entries())) {
      if (deletedUserIds.has(id)) {
        users.delete(id);
      }
    }

    // 2. Sync Courses
    const fsCourses = await getAllFromFirestore<Course>(COLLECTIONS.COURSES);
    if (fsCourses !== null && fsCourses.length > 0) {
      for (const c of fsCourses) {
        if (!c || !c.id) continue;
        if (deletedCourseIds.has(c.id)) {
          deleteFromFirestore(COLLECTIONS.COURSES, c.id).catch(() => {});
        } else {
          courses.set(c.id, c);
        }
      }
    }
    for (const [id] of Array.from(courses.entries())) {
      if (deletedCourseIds.has(id)) {
        courses.delete(id);
      }
    }

    // 3. Sync Course Members
    const fsMembers = await getAllFromFirestore<CourseMember>(COLLECTIONS.COURSE_MEMBERS);
    if (fsMembers !== null && fsMembers.length > 0) {
      const memberMap = new Map<string, CourseMember>();
      courseMembers.forEach((m) => {
        if (m && m.id && !deletedMemberIds.has(m.id)) memberMap.set(m.id, m);
      });
      for (const cm of fsMembers) {
        if (!cm || !cm.id) continue;
        if (deletedMemberIds.has(cm.id)) {
          deleteFromFirestore(COLLECTIONS.COURSE_MEMBERS, cm.id).catch(() => {});
        } else {
          memberMap.set(cm.id, cm);
        }
      }
      courseMembers.length = 0;
      courseMembers.push(...memberMap.values());
      await deduplicateCourseMembers();
    }

    // 4. Sync Sessions
    const fsSessions = await getAllFromFirestore<Session>(COLLECTIONS.SESSIONS);
    if (fsSessions !== null && fsSessions.length > 0) {
      for (const s of fsSessions) {
        if (!s || !s.id) continue;
        if (deletedSessionIds.has(s.id)) {
          deleteFromFirestore(COLLECTIONS.SESSIONS, s.id).catch(() => {});
        } else {
          sessions.set(s.id, s);
        }
      }
    }
    for (const [id] of Array.from(sessions.entries())) {
      if (deletedSessionIds.has(id)) {
        sessions.delete(id);
      }
    }

    // 5. Sync Attendance Records
    const fsAttendance = await getAllFromFirestore<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
    if (fsAttendance !== null && fsAttendance.length > 0) {
      const existingIds = new Set(attendanceRecords.map((r) => r.id));
      for (const ar of fsAttendance) {
        if (!ar || !ar.id) continue;
        if (ar.id.startsWith('rec_crs_') || ar.id === 'rec_1' || ar.id === 'rec_2' || ar.id === 'rec_3') {
          deleteFromFirestore(COLLECTIONS.ATTENDANCE, ar.id).catch(() => {});
        } else if (!existingIds.has(ar.id)) {
          attendanceRecords.push(ar);
          existingIds.add(ar.id);
        }
      }
    }

    // 6. Sync Leave Requests & Purge Demo/Orphaned Requests
    deletedLeaveIds.add('leave_demo_1');
    deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, 'leave_demo_1').catch(() => {});

    // Remove leave_demo_1 from memory if loaded from cache
    for (let i = leaveRequests.length - 1; i >= 0; i--) {
      if (leaveRequests[i].id === 'leave_demo_1' || deletedLeaveIds.has(leaveRequests[i].id)) {
        leaveRequests.splice(i, 1);
      }
    }

    const fsLeaves = await getAllFromFirestore<LeaveRequest>(COLLECTIONS.LEAVE_REQUESTS);
    if (fsLeaves !== null && fsLeaves.length > 0) {
      const existingLeaveIds = new Set(leaveRequests.map((l) => l.id));
      for (const l of fsLeaves) {
        if (
          l &&
          l.id &&
          l.id !== 'leave_demo_1' &&
          !deletedLeaveIds.has(l.id) &&
          !existingLeaveIds.has(l.id) &&
          l.courseId &&
          courses.has(l.courseId) &&
          !deletedCourseIds.has(l.courseId)
        ) {
          leaveRequests.push(l);
          existingLeaveIds.add(l.id);
        }
      }
    }

    // Clean any orphaned leave requests whose course was deleted
    for (let i = leaveRequests.length - 1; i >= 0; i--) {
      const lr = leaveRequests[i];
      if (!lr.courseId || !courses.has(lr.courseId) || deletedCourseIds.has(lr.courseId)) {
        deletedLeaveIds.add(lr.id);
        leaveRequests.splice(i, 1);
        deleteFromFirestore(COLLECTIONS.LEAVE_REQUESTS, lr.id).catch(() => {});
      }
    }

    // 7. Sync Teacher Attendance Records
    const fsTeacherAttendance = await getAllFromFirestore<TeacherAttendanceRecord>(COLLECTIONS.TEACHER_ATTENDANCE);
    if (fsTeacherAttendance !== null && fsTeacherAttendance.length > 0) {
      const existingTeacherRecIds = new Set(teacherAttendanceRecords.map((t) => t.id));
      for (const t of fsTeacherAttendance) {
        if (t && t.id && !existingTeacherRecIds.has(t.id)) {
          teacherAttendanceRecords.push(t);
          existingTeacherRecIds.add(t.id);
        }
      }
    }

    // Sync Master Universities
    const fsUnivs = await getAllFromFirestore<MasterUniversity>(COLLECTIONS.MASTER_UNIVERSITIES);
    if (fsUnivs !== null && fsUnivs.length > 0) {
      for (const u of fsUnivs) {
        if (u && u.id) masterUniversities.set(u.id, u);
      }
    }

    // Sync Master Faculties
    const fsFacs = await getAllFromFirestore<MasterFaculty>(COLLECTIONS.MASTER_FACULTIES);
    if (fsFacs !== null && fsFacs.length > 0) {
      for (const f of fsFacs) {
        if (f && f.id) masterFaculties.set(f.id, f);
      }
    }

    // Sync Master Departments
    const fsDeps = await getAllFromFirestore<MasterDepartment>(COLLECTIONS.MASTER_DEPARTMENTS);
    if (fsDeps !== null && fsDeps.length > 0) {
      for (const d of fsDeps) {
        if (d && d.id) masterDepartments.set(d.id, d);
      }
    }

    // Sync Master Curriculums
    const fsCurrs = await getAllFromFirestore<MasterCurriculum>(COLLECTIONS.MASTER_CURRICULUMS);
    if (fsCurrs !== null && fsCurrs.length > 0) {
      for (const c of fsCurrs) {
        if (c && c.id) masterCurriculums.set(c.id, c);
      }
    }

    // Sync Master Prefixes
    const fsPrefixes = await getAllFromFirestore<MasterPrefix>(COLLECTIONS.MASTER_PREFIXES);
    if (fsPrefixes !== null && fsPrefixes.length > 0) {
      for (const p of fsPrefixes) {
        if (p && p.id) masterPrefixes.set(p.id, p);
      }
    }

    // Sync Notifications
    const fsNotifs = await getAllFromFirestore<NotificationItem>(COLLECTIONS.NOTIFICATIONS);
    if (fsNotifs !== null && fsNotifs.length > 0) {
      for (const n of fsNotifs) {
        if (n && n.id) notifications.set(n.id, n);
      }
    }

    // Sync Merged User Pointers
    const fsPointers = await getAllFromFirestore<{ id: string; targetUserId: string }>(COLLECTIONS.USER_POINTERS);
    if (fsPointers !== null && fsPointers.length > 0) {
      for (const ptr of fsPointers) {
        if (ptr && ptr.id && ptr.targetUserId) {
          mergedUserPointers.set(ptr.id, ptr.targetUserId);
        }
      }
    }

    // Ensure base CSV exported attendance records are present if database is empty or missing records
    if (attendanceRecords.length < 87 && !deletedCourseIds.has('crs_mtid204') && !deletedCourseIds.has('crs_test101')) {
      await importRealCsvAttendanceRecords();
    }

    // Save updated state to local cache
    saveLocalCache();

    console.log(`[Firestore Sync] Database synchronized successfully. Courses: ${courses.size}, Attendance Records Total: ${attendanceRecords.length}`);
  } catch (err) {
    console.error('[Firestore Sync Warning] Falling back to local cache data:', err);
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
