/**
 * IPC Helper Utilities
 * 
 * This file provides helper functions for IPC communication between renderer and main processes.
 */

/**
 * Invoke an IPC method in the main process
 * @param channel The IPC channel to invoke
 * @param data Optional data to send with the request
 * @returns A promise that resolves with the result from the main process
 */
export async function invokeIPC<T = any>(channel: string, data: any = null): Promise<T> {
  if (!window.electron?.ipcRenderer) {
    throw new Error('IPC renderer not available');
  }
  
  return window.electron.ipcRenderer.invoke(channel, data);
}

/**
 * Get the workspace path from the main process
 */
export async function getWorkspacePath(): Promise<string> {
  return invokeIPC<string>('get-workspace');
}

/**
 * Open the workspace selection dialog
 */
export async function selectWorkspace(): Promise<{ success: boolean; path?: string; error?: string }> {
  return invokeIPC('select-workspace');
}

/**
 * Get all applied icon records
 */
export async function getAppliedIcons(): Promise<{ success: boolean; records: any[]; error?: string }> {
  return invokeIPC('get-applied-icons');
}

/**
 * Reset a folder icon to its default
 * @param folderPath The path to the folder
 */
export async function resetFolderIcon(folderPath: string): Promise<void> {
  return invokeIPC('reset-icon', folderPath);
}

/**
 * Restore all icons to their applied states
 */
export async function restoreAllIcons(): Promise<{ 
  success: boolean; 
  results?: { 
    total: number; 
    success: number; 
    failed: number; 
    errors: string[] 
  }; 
  error?: string 
}> {
  return invokeIPC('restore-all-icons');
}

/**
 * Copy example icons to the custom icons directory
 */
export async function copyExampleIcons(): Promise<{ success: boolean; count?: number; error?: string }> {
  return invokeIPC('copy-example-icons');
}

/**
 * Open the custom icons directory
 */
export async function openCustomIconsDirectory(): Promise<{ success: boolean; error?: string }> {
  return invokeIPC('open-custom-icons-directory');
}

/**
 * Download an icon from a URL
 * @param url The URL to download from
 */
export async function downloadIconFromUrl(url: string): Promise<{ 
  success: boolean; 
  filePath?: string; 
  fileName?: string; 
  error?: string 
}> {
  return invokeIPC('download-icon-from-url', url);
}

/**
 * Read a file and get its contents as a data URL
 * @param filePath The path to the file
 */
export async function readFileAsDataUrl(filePath: string): Promise<{ 
  success: boolean; 
  data?: string; 
  error?: string 
}> {
  return invokeIPC('read-file', filePath);
} 