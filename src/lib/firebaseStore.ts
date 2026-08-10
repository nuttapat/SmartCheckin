import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';

// Read configuration from firebase-applet-config.json
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGooglePopup() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.warn('[Firebase Auth] signInWithPopup encountered issue, popup block or mobile storage partitioning:', err);
    return null;
  }
}

// Firestore Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  COURSES: 'courses',
  SESSIONS: 'sessions',
  ATTENDANCE: 'attendanceRecords',
  TEACHER_ATTENDANCE: 'teacherAttendanceRecords',
  QUICK_EVENTS: 'quickEvents',
  COURSE_MEMBERS: 'courseMembers',
  LEAVE_REQUESTS: 'leaveRequests',
  SYSTEM_SETTINGS: 'systemSettings',
  MASTER_UNIVERSITIES: 'masterUniversities',
  MASTER_FACULTIES: 'masterFaculties',
  MASTER_DEPARTMENTS: 'masterDepartments',
  MASTER_PREFIXES: 'masterPrefixes',
  MASTER_CURRICULUMS: 'masterCurriculums',
  NOTIFICATIONS: 'notifications',
};

/**
 * Recursively remove undefined fields from an object for Firestore compatibility
 */
function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedFields(value);
    }
  }
  return cleaned as T;
}

/**
 * Generic helper to save or update an entity in Firestore with 15s timeout
 */
export async function saveToFirestore<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, item.id);
    const cleanedItem = removeUndefinedFields(item);
    const savePromise = setDoc(docRef, cleanedItem, { merge: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore save timeout (25s)')), 25000)
    );
    await Promise.race([savePromise, timeoutPromise]);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Quota limit exceeded')) {
      console.warn(`[Firestore Quota Exceeded] Save skipped for '${collectionName}/${item.id}'. Saved locally.`);
    } else {
      console.warn(`[Firestore Save Notice] Collection: ${collectionName}, ID: ${item.id}: ${msg}`);
    }
  }
}

/**
 * Batch save helper to write multiple items in atomic chunks (up to 400 docs per batch)
 */
export async function batchSaveToFirestore<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;

  const CHUNK_SIZE = 400; // Firestore limit is 500 writes per batch
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, collectionName, item.id);
        const cleanedItem = removeUndefinedFields(item);
        batch.set(docRef, cleanedItem, { merge: true });
      }
      const commitPromise = batch.commit();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore batch commit timeout (20s)')), 20000)
      );
      await Promise.race([commitPromise, timeoutPromise]);
    } catch (err) {
      console.warn(`[Firestore Batch Save Warning] Chunk starting at index ${i} failed, falling back to individual saves:`, err);
      // Fallback to individual saveToFirestore with concurrency control
      for (const item of chunk) {
        await saveToFirestore(collectionName, item);
      }
    }
  }
}

/**
 * Generic helper to fetch all documents in a collection from Firestore
 * Returns null if fetch fails (e.g. quota limit, timeout, network error), or T[] if succeeded.
 */
export async function getAllFromFirestore<T>(collectionName: string): Promise<T[] | null> {
  try {
    const colRef = collection(db, collectionName);
    const fetchPromise = getDocs(colRef).then((snapshot) =>
      snapshot.docs.map((docSnap) => docSnap.data() as T)
    );
    const timeoutPromise = new Promise<T[]>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore fetch timeout (15s)')), 15000)
    );
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Quota limit exceeded')) {
      console.warn(`[Firestore Quota Exceeded] Collection '${collectionName}' reached free tier quota. Operating safely on local persistent cache.`);
    } else {
      console.warn(`[Firestore Fetch Notice] Collection '${collectionName}': ${msg}`);
    }
    return null;
  }
}

/**
 * Generic helper to delete a document from Firestore
 */
export async function deleteFromFirestore(
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Quota limit exceeded')) {
      console.warn(`[Firestore Quota Exceeded] Delete skipped for '${collectionName}/${docId}'. Handled locally via tombstone.`);
    } else {
      console.warn(`[Firestore Delete Notice] Collection: ${collectionName}, ID: ${docId}: ${msg}`);
    }
  }
}
