/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format transfer speed in B/s, KB/s, or MB/s
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '0 KB/s';
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
}

/**
 * Format seconds to readable mm:ss or hh:mm:ss
 */
export function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.ceil(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${remSecs}s`;
  }
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

/**
 * Detect file category
 */
export type FileCategory = 'image' | 'pdf' | 'document' | 'archive' | 'audio' | 'video' | 'code' | 'other';

export function getFileCategory(fileName: string, mimeType = ''): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext) || mimeType.startsWith('image/')) {
    return 'image';
  }
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || mimeType.includes('zip') || mimeType.includes('tar')) {
    return 'archive';
  }
  if (['doc', 'docx', 'rtf', 'odt', 'txt', 'pages'].includes(ext) || mimeType.includes('word') || mimeType.includes('document')) {
    return 'document';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext) || mimeType.startsWith('video/')) {
    return 'video';
  }
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sh', 'sql', 'md'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

/**
 * Detect client device name & type
 */
export function detectDevice(): { name: string; type: 'mobile' | 'desktop' | 'tablet' } {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua);

  let type: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (isMobile) type = 'mobile';
  else if (isTablet) type = 'tablet';

  let os = 'Device';
  if (/macintosh|mac os x/i.test(ua)) os = 'Mac';
  else if (/windows/i.test(ua)) os = 'Windows PC';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iPhone';
  else if (/linux/i.test(ua)) os = 'Linux';

  return {
    name: `${os} (${type === 'mobile' ? 'Mobile' : type === 'tablet' ? 'Tablet' : 'Desktop'})`,
    type,
  };
}
