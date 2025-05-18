/**
 * Utility functions for path handling
 */

// Username placeholder used for path normalization
const USER_PLACEHOLDER = '{USER}';

/**
 * Converts a normalized path with {USER} placeholder back to a real path
 * @param path Path with {USER} placeholder
 * @returns Path with actual username
 */
export function denormalizePath(path: string): string {
  if (!path) return path;
  
  // Skip if there's no placeholder
  if (!path.includes(USER_PLACEHOLDER)) {
    return path;
  }
  
  const homeDir = window.navigator?.userAgent?.includes('Mac') 
    ? `/Users/${getCurrentUsername()}` 
    : `C:\\Users\\${getCurrentUsername()}`;
    
  return path.replace(`/Users/${USER_PLACEHOLDER}/`, `${homeDir}/`);
}

/**
 * Resolves a workspace-relative path
 * This handles paths that include the workspace path with USER_PLACEHOLDER
 */
export function resolveWorkspacePath(path: string): string {
  if (!path) return '';
  
  // If path already starts with file:// protocol, return as is
  if (path.startsWith('file://')) {
    return path;
  }
  
  // If path is already absolute, denormalize and return
  if (path.startsWith('/') || path.match(/^[A-Za-z]:\\/)) {
    return denormalizePath(path);
  }
  
  // For relative paths, combine with workspace path
  let workspacePath = '';
  
  // Try to get workspace path from localStorage
  try {
    workspacePath = localStorage.getItem('workspacePath') || '';
  } catch (e) {
    console.warn('无法从localStorage获取工作目录');
  }
  
  // If we have a workspace path, combine with the relative path
  if (workspacePath) {
    const fullPath = `${workspacePath}/${path}`;
    return denormalizePath(fullPath);
  }
  
  // If we can't determine the workspace path, return the relative path as is
  console.warn('无法解析相对路径，工作目录未知:', path);
  return path;
}

/**
 * Converts a local file path to a proper file:// URL
 * @param path Local file path
 * @returns URL that can be used in src attributes
 */
export function filePathToUrl(path: string): string {
  if (!path) return '';
  
  // First resolve the path considering workspace and user placeholders
  const resolvedPath = resolveWorkspacePath(path);
  
  // Remove any existing file:// prefix to avoid duplication
  let cleanPath = resolvedPath.replace(/^file:\/\/+/, '');
  
  // Ensure the path starts with a slash if not on Windows
  if (!cleanPath.startsWith('/') && !cleanPath.match(/^[A-Za-z]:\\/)) {
    cleanPath = '/' + cleanPath;
  }
  
  // Ensure Windows paths use forward slashes
  cleanPath = cleanPath.replace(/\\/g, '/');
  
  // For Windows paths that have drive letters, ensure proper format like /C:/path
  if (cleanPath.match(/^\/[A-Za-z]:/)) {
    // Already in the right format
  } else if (cleanPath.match(/^[A-Za-z]:/)) {
    cleanPath = '/' + cleanPath;
  }
  
  // Encode the path components (but keep slashes intact)
  const encodedPath = cleanPath.split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
  
  return `file://${encodedPath}`;
}

/**
 * Get current username from the system
 * Simplified version for renderer process
 */
function getCurrentUsername(): string {
  // Try to extract from path if possible
  const pathParts = window.location.pathname.split('/');
  for (const part of pathParts) {
    if (part && part !== 'Users' && part !== 'home') {
      // Skip common system directories
      if (['Applications', 'Library', 'System', 'bin', 'etc', 'opt', 'var', 'tmp'].includes(part)) {
        continue;
      }
      return part;
    }
  }
  
  // Fallback
  return 'current-user';
} 