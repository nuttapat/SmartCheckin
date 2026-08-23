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
  USER_POINTERS: 'mergedUserPointers',
};

// Retry queue for failed Firestore operations
interface RetryItem {
  type: 'SAVE' | 'DELETE';
  collectionName: string;
  item?: any;
  docId?: string;
  retryCount: number;
  lastAttempt: number;
}

const retryQueue: RetryItem[] = [];
let isProcessingRetry = false;

function enqueueRetry(item: Omit<RetryItem, 'retryCount' | 'lastAttempt'>) {
  // Deduplicate in queue
  const existingIdx = retryQueue.findIndex(
    (r) =>
      r.collectionName === item.collectionName &&
      ((item.docId && r.docId === item.docId) || (item.item && r.item?.id === item.item?.id))
  );
  if (existingIdx >= 0) {
    retryQueue[existingIdx] = {
      ...item,
      retryCount: retryQueue[existingIdx].retryCount,
      lastAttempt: Date.now(),
    };
  } else {
    retryQueue.push({
      ...item,
      retryCount: 0,
      lastAttempt: Date.now(),
    });
  }
  scheduleRetryProcessing();
}

let retryTimeout: any = null;
function scheduleRetryProcessing() {
  if (retryTimeout || isProcessingRetry || retryQueue.length === 0) return;
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    processRetryQueue();
  }, 5000);
}

async function processRetryQueue() {
  if (isProcessingRetry || retryQueue.length === 0) return;
  isProcessingRetry = true;
  const now = Date.now();

  try {
    for (let i = retryQueue.length - 1; i >= 0; i--) {
      const task = retryQueue[i];
      // Exponential backoff wait: 5s, 15s, 45s, max 3 retries
      const delay = Math.min(60000, 5000 * Math.pow(3, task.retryCount));
      if (now - task.lastAttempt < delay) continue;

      if (task.retryCount >= 4) {
        // Exceeded max retries, remove to prevent leak
        retryQueue.splice(i, 1);
        continue;
      }

      task.lastAttempt = now;
      task.retryCount++;

      try {
        if (task.type === 'SAVE' && task.item) {
          const docRef = doc(db, task.collectionName, task.item.id);
          const cleanedItem = removeUndefinedFields(task.item);
          await setDoc(docRef, cleanedItem, { merge: true });
          retryQueue.splice(i, 1);
        } else if (task.type === 'DELETE' && task.docId) {
          const docRef = doc(db, task.collectionName, task.docId);
          await deleteDoc(docRef);
          retryQueue.splice(i, 1);
        }
      } catch (err: any) {
        // Leave in queue for next cycle
      }
    }
  } finally {
    isProcessingRetry = false;
    if (retryQueue.length > 0) {
      scheduleRetryProcessing();
    }
  }
}

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
 * Generic helper to save or update an entity in Firestore with 15s timeout and retry queue
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
      console.warn(`[Firestore Save Notice] Collection: ${collectionName}, ID: ${item.id}: ${msg}. Queued for retry.`);
      enqueueRetry({ type: 'SAVE', collectionName, item });
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
 * Generic helper to delete a document from Firestore with fallback retry
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
      console.warn(`[Firestore Delete Notice] Collection: ${collectionName}, ID: ${docId}: ${msg}. Queued for retry.`);
      enqueueRetry({ type: 'DELETE', collectionName, docId });
    }
  }
}
