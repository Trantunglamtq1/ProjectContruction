export const PROJECT_ACCESS_DENIED = 'project-access-denied';
export const PROJECT_ACCESS_CHANGED = 'project-access-changed';

let selectedProjectId: string | null = null;
export const getSelectedProjectId = () => selectedProjectId;
export const setSelectedProjectId = (id: string | null) => { selectedProjectId = id; };
export const requireProjectId = () => {
  if (!selectedProjectId) throw new Error('Vui lòng chọn dự án.');
  return selectedProjectId;
};

export function resolveProjectSelection(projects: { id: string }[], requested: string | null, saved: string | null) {
  const id = requested ?? saved;
  return id && projects.some(project => project.id === id) ? id : null;
}

export function withProjectScope(path: string, projectId: string) {
  const base = 'http://project.local';
  const url = new URL(path, base);
  if (url.origin !== base) throw new Error('Đường dẫn dự án không hợp lệ.');
  url.searchParams.set('projectId', projectId);
  return url.pathname + url.search + url.hash;
}

export function trustedPrivateFilePath(url: string) {
  if (!/^\/api\/(drawings\/files|inspections\/attachments\/files)\/[^/?#]+$/.test(url)) throw new Error('Đường dẫn tệp không hợp lệ.');
  const filename = decodeURIComponent(url.substring(url.lastIndexOf('/') + 1));
  if (!filename || filename === '.' || filename === '..' || /[\\/\x00-\x1f]/.test(filename)) throw new Error('Tên tệp không hợp lệ.');
  return url.substring(4);
}
