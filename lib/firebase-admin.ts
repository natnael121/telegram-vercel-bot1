import * as admin from 'firebase-admin';

let _db: admin.firestore.Firestore | null = null;
let _storage: admin.storage.Storage | null = null;
let _auth: admin.auth.Auth | null = null;

function initAdmin() {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Skip initialization if any crucial credential is missing or has template values during build
  if (
    !projectId ||
    !clientEmail ||
    !privateKey ||
    projectId.includes('your_') ||
    clientEmail.includes('xxxxx')
  ) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Firebase Admin] Missing or placeholder credentials — skipping initialization');
    }
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
        privateKey,
        clientEmail,
        clientId: process.env.FIREBASE_CLIENT_ID,
      } as admin.ServiceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } catch (error: any) {
    console.error('[Firebase Admin] Initialization error caught:', error.message);
  }
}

export function getDb(): admin.firestore.Firestore {
  initAdmin();
  if (!_db) {
    // If not initialized, return a mock or dummy firestore proxy to prevent build crash
    try {
      _db = admin.firestore();
    } catch (_) {
      // Fallback dummy db object for build time
      return {
        collection: () => ({
          doc: () => ({
            get: () => Promise.resolve({ exists: false, data: () => null }),
            set: () => Promise.resolve(),
            update: () => Promise.resolve(),
            delete: () => Promise.resolve(),
          }),
          where: () => ({
            limit: () => ({
              get: () => Promise.resolve({ empty: true, docs: [] }),
            }),
            orderBy: () => ({
              get: () => Promise.resolve({ empty: true, docs: [] }),
            }),
          }),
          orderBy: () => ({
            limit: () => ({
              get: () => Promise.resolve({ empty: true, docs: [] }),
            }),
          }),
        }),
      } as any;
    }
  }
  return _db!;
}

export function getStorage(): admin.storage.Storage {
  initAdmin();
  if (!_storage) {
    try {
      _storage = admin.storage();
    } catch (_) {
      return {} as any;
    }
  }
  return _storage!;
}

export function getAuth(): admin.auth.Auth {
  initAdmin();
  if (!_auth) {
    try {
      _auth = admin.auth();
    } catch (_) {
      return {} as any;
    }
  }
  return _auth!;
}

// Convenience lazy getters
export const db = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const database = getDb();
    const val = (database as any)[prop];
    return typeof val === 'function' ? val.bind(database) : val;
  },
});

export const storage = new Proxy({} as admin.storage.Storage, {
  get(_target, prop) {
    const store = getStorage();
    const val = (store as any)[prop];
    return typeof val === 'function' ? val.bind(store) : val;
  },
});

export const auth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    const authentication = getAuth();
    const val = (authentication as any)[prop];
    return typeof val === 'function' ? val.bind(authentication) : val;
  },
});

export default admin;
