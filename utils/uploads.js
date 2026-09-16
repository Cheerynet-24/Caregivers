const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getStorageBuckets } = require('./firebase');

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

async function uploadToCloudinary(file, folder) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(`${params}${apiSecret}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([file.buffer || fs.readFileSync(file.path)], { type: file.mimetype || 'application/octet-stream' }), file.originalname || `${uuidv4()}${getExtension(file)}`);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || `Cloudinary upload failed (${response.status})`);
  return result.secure_url;
}

/** Persist an uploaded file using Cloudinary, Firebase, or local development storage. */
async function persistUpload(file, folder = 'media') {
  if (!file) return null;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    return uploadToCloudinary(file, folder);
  }
  const filename = `${uuidv4()}${getExtension(file)}`;
  const objectName = `${folder}/${filename}`;
  const buckets = getStorageBuckets();

  if (buckets.length) {
    let lastError = null;
    for (const bucket of buckets) try {
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
    } catch (error) { lastError = error; console.error(`Firebase upload failed for ${bucket.name}:`, error.message); }
    const isEphemeralDeployment = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER;
    if (isEphemeralDeployment) throw new Error(`Firebase Storage upload failed: ${lastError?.message || 'check bucket and service-account permissions'}`);
  }

  const isEphemeralDeployment = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER;
  if (isEphemeralDeployment) {
    throw new Error('Persistent media storage is not configured. Set the CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET variables in production.');
  }

  ensureLocalUploadDir();
  const localName = `${uuidv4()}${getExtension(file)}`;
  const localPath = path.join(localUploadDir, localName);
  if (file.buffer) fs.writeFileSync(localPath, file.buffer);
  else fs.copyFileSync(file.path, localPath);
  return `/uploads/${localName}`;
}

module.exports = { persistUpload, localUploadDir, ensureLocalUploadDir };
