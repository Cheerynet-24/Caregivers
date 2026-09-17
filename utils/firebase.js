const admin = require('firebase-admin');

let messaging = null;
let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const emailProjectId = clientEmail?.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1];
  const projectId = emailProjectId || process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  if (!admin.apps.length) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket: (process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`).replace(/^gs:\/\//, '').replace(/\/$/, '')
    });
  } else {
    firebaseApp = admin.app();
  }
  return firebaseApp;
}

function getMessaging() {
  if (messaging) return messaging;
  const app = getFirebaseApp();
  if (!app) return null;
  messaging = admin.messaging(app);
  return messaging;
}

function getStorageBucket() {
  const app = getFirebaseApp();
  if (!app) return null;
  try { return admin.storage(app).bucket(); } catch (error) {
    console.error('Firebase Storage unavailable:', error.message);
    return null;
  }
}

function getStorageBuckets() {
  const app = getFirebaseApp();
  if (!app) return [];
  const configured = process.env.FIREBASE_STORAGE_BUCKET?.replace(/^gs:\/\//, '').replace(/\/$/, '');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const emailProjectId = clientEmail?.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1];
  const projectId = emailProjectId || process.env.FIREBASE_PROJECT_ID;
  const configuredProjectId = process.env.FIREBASE_PROJECT_ID;
  const names = [...new Set([
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
    configuredProjectId && `${configuredProjectId}.firebasestorage.app`,
    configuredProjectId && `${configuredProjectId}.appspot.com`,
    configured
  ].filter(Boolean))];
  return names.map(name => { try { return admin.storage(app).bucket(name); } catch { return null; } }).filter(Boolean);
}

async function sendPush(token, { title, body, type = 'message', data = {} }) {
  const service = getMessaging();
  if (!service || !token) return false;
  try {
    await service.send({
      token,
      data: Object.fromEntries(Object.entries({ type, title, body, ...data }).map(([key, value]) => [key, String(value ?? '')])),
      android: {
        priority: 'high',
        ttl: 3600 * 1000
      }
    });
    return true;
  } catch (error) {
    console.error('FCM push failed:', error.code || error.message);
    if (type === 'call' && data.offer) {
      try {
        const fallbackData = { ...data };
        delete fallbackData.offer;
        await service.send({
          token,
          data: Object.fromEntries(Object.entries({ type, title, body, ...fallbackData }).map(([key, value]) => [key, String(value ?? '')])),
          android: { priority: 'high', ttl: 3600 * 1000 }
        });
        return true;
      } catch (fallbackError) {
        console.error('FCM fallback push failed:', fallbackError.code || fallbackError.message);
      }
    }
    return false;
  }
}

function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && (process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL));
}

module.exports = { sendPush, isFirebaseConfigured, getStorageBucket, getStorageBuckets };
