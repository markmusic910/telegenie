/**
 * Format a number in compact human-readable form (e.g. 1.2K, 45K, 1.2M).
 */
export function formatCompactNumber(count?: number | null): string {
  if (count == null || count <= 0) return '0';
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return (val >= 10 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')) + 'M';
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return (val >= 10 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')) + 'K';
  }
  return count.toLocaleString();
}

/**
 * Format byte counts to human-readable strings (e.g. 1.2 MB, 850 KB, 14 B).
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size < 10 && i > 0 ? size.toFixed(1) : Math.round(size)} ${units[i]}`;
}

/**
 * Format seconds duration into mm:ss or hh:mm:ss.
 */
export function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Extract extension from filename (lowercase, without leading dot).
 */
export function getFileExtension(filename?: string | null): string {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()?.toLowerCase() ?? '';
}

