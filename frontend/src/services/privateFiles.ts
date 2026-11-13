import apiClient from './apiClient';
import { trustedPrivateFilePath } from './projectScope';

export async function fetchPrivateFile(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiClient.get<Blob>(trustedPrivateFilePath(url), { responseType: 'blob', signal });
  if (response.data.type.includes('text/html')) throw new Error('Không tìm thấy nội dung tệp.');
  return response.data;
}

export async function downloadPrivateFile(url: string, filename: string) {
  const blob = await fetchPrivateFile(url);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a'); link.href = objectUrl; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
}
