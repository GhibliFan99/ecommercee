import dotenv from 'dotenv';

dotenv.config();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile({ buffer, mimeType, size }) {
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error('Invalid file type. Allowed formats: JPG, PNG, WEBP.');
  }

  const effectiveSize = size || (buffer ? buffer.length : 0);
  if (effectiveSize > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds the 5 MB limit.');
  }

  return true;
}

/**
 * Upload an image to configured Cloud Storage (Supabase Storage / Cloudinary / Vercel Blob).
 * Fallback to base64 data URI when cloud credentials are not yet configured during local testing.
 */
export async function uploadImage({ buffer, base64, mimeType, fileName, folder = 'uploads', isPrivate = false }) {
  let fileBuffer = buffer;
  let detectedMime = mimeType || 'image/jpeg';

  if (!fileBuffer && base64) {
    const match = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1];
      fileBuffer = Buffer.from(match[2], 'base64');
    } else {
      fileBuffer = Buffer.from(base64, 'base64');
    }
  }

  if (!fileBuffer) {
    throw new Error('No image file data provided for upload.');
  }

  validateImageFile({ buffer: fileBuffer, mimeType: detectedMime, size: fileBuffer.length });

  const safeFileName = `${folder}/${Date.now()}-${(fileName || 'image').replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  // 1. Supabase Storage Provider
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const bucket = isPrivate ? 'payment-proofs' : 'product-images';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${safeFileName}`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': detectedMime,
        },
        body: fileBuffer,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Supabase upload failed: ${errorText}`);
      }

      if (isPrivate) {
        // Return signed path identifier
        return {
          url: `${process.env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${safeFileName}`,
          path: safeFileName,
          isPrivate: true,
        };
      }

      return {
        url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${safeFileName}`,
        path: safeFileName,
        isPrivate: false,
      };
    } catch (err) {
      console.warn('Supabase upload error, falling back:', err.message);
    }
  }

  // 2. Cloudinary Provider
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      const [apiKey, apiSecret] = url.username && url.password ? [url.username, url.password] : url.auth.split(':');
      const cloudName = url.host;

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: detectedMime });
      formData.append('file', blob);
      formData.append('folder', folder);
      formData.append('api_key', apiKey);

      const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const res = await fetch(uploadEndpoint, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return { url: data.secure_url, isPrivate: false };
      }
    } catch (err) {
      console.warn('Cloudinary upload error, falling back:', err.message);
    }
  }

  // 3. Graceful fallback for local development & demonstration: Data URI
  const dataUrl = `data:${detectedMime};base64,${fileBuffer.toString('base64')}`;
  return {
    url: dataUrl,
    path: safeFileName,
    isPrivate,
  };
}
