const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getStorageBucket } = require('./firebase');

const localUploadDir = path.join(__dirname, '../uploads');

const ensureLocalUploadDir = () => {
  if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir, { recursive: true });
};

const getExtension = file => {
  const original = path.extname(file?.originalname || '').toLowerCase();
  if (original && /^[.a-z0-9]+$/i.test(original)) return original;
  const subtype = String(file?.mimetype || '').split('/')[1]?.split(';')[0] || 'bin';
  return `.${subtype.replace(/[^a-z0-9]/gi, '') || 'bin'}`;
};

/**
 * Persist an uploaded multer file. Firebase Storage is used when configured;
 * local disk remains available for development and self-hosted deployments.
 */
async function persistUpload(file, folder = 'media') {
  if (!file) return null;
  const filename = `${uuidv4()}${getExtension(file)}`;
  const objectName = `${folder}/${filename}`;
  const bucket = getStorageBucket();

  if (bucket) {
    try {
      const token = uuidv4();
      const remoteFile = bucket.file(objectName);
      const buffer = file.buffer || fs.readFileSync(file.path);
      await remoteFile.save(buffer, {
        resumable: false,
        metadata: {
          contentType: file.mimetype || 'application/octet-stream',
          metadata: { firebaseStorageDownloadTokens: token }
        }
      });
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectName)}?alt=media&token=${token}`;
    } catch (error) {
      // A misconfigured bucket must not prevent a user from sending a message.
      // The local fallback keeps development/self-hosted deployments usable.
      console.error('Firebase upload failed; using local fallback:', error.message);
    }
  }

  const isEphemeralDeployment = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER;
  if (isEphemeralDeployment) {
    throw new Error('Persistent media storage is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET before enabling uploads in production.');
  }

  ensureLocalUploadDir();
  const localName = `${uuidv4()}${getExtension(file)}`;
  const localPath = path.join(localUploadDir, localName);
  if (file.buffer) fs.writeFileSync(localPath, file.buffer);
  else fs.copyFileSync(file.path, localPath);
  return `/uploads/${localName}`;
}

module.exports = { persistUpload, localUploadDir, ensureLocalUploadDir };
