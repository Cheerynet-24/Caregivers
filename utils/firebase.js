const admin = require('firebase-admin');

let messaging = null;

function getMessaging() {
  if (messaging) return messaging;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }
  messaging = admin.messaging();
  return messaging;
}

async function sendPush(token, { title, body, type = 'message', data = {} }) {
  const service = getMessaging();
  if (!service || !token) return false;
  try {
    await service.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries({ type, title, body, ...data }).map(([key, value]) => [key, String(value ?? '')])),
      android: {
        priority: 'high',
        notification: {
          channelId: 'caregivers_calls_messages_v2',
          sound: type === 'call' ? 'default' : 'default'
        }
      }
    });
    return true;
  } catch (error) {
    console.error('FCM push failed:', error.code || error.message);
    return false;
  }
}

module.exports = { sendPush };
