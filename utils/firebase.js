const admin = require('firebase-admin');

let messaging = null;
let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  if (!admin.apps.length) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`
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

module.exports = { sendPush, getStorageBucket };
