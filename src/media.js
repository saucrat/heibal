import { apiUrl } from './api.js';

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#f6f1ea';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('photo'));
      }, 'image/jpeg', 0.86);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo'));
    };
    image.src = url;
  });
}

export async function uploadPhoto(file) {
  const blob = await shrinkImage(file);
  const response = await fetch(apiUrl('/api/media'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.url) throw new Error('photo');
  return data.url;
}
