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
  MASTER_DEPARTMENTS: 'masterDepartments',
  MASTER_PREFIXES: 'masterPrefixes',
  MASTER_CURRICULUMS: 'masterCurriculums',
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
 * Generic helper to save or update an entity in Firestore
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
      setTimeout(() => reject(new Error('Firestore save timeout')), 4000)
    );
    await Promise.race([savePromise, timeoutPromise]);
  } catch (err) {
    console.error(`[Firestore Save Warning] Collection: ${collectionName}, ID: ${item.id}`, err);
  }
}

/**
 * Generic helper to fetch all documents in a collection from Firestore
 */
export async function getAllFromFirestore<T>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const fetchPromise = getDocs(colRef).then((snapshot) =>
      snapshot.docs.map((docSnap) => docSnap.data() as T)
    );
    const timeoutPromise = new Promise<T[]>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore fetch timeout')), 3000)
    );
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.error(`[Firestore Fetch Warning] Collection: ${collectionName}`, err);
    return [];
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
  } catch (err) {
    console.error(`[Firestore Delete Error] Collection: ${collectionName}, ID: ${docId}`, err);
  }
}
