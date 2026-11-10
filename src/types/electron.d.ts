export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  uptime: number;
  totalMemory: number;
  freeMemory: number;
  cpus: number;
}

export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface ElectronAPI {
  getSystemInfo: () => Promise<SystemInfo>;
  openFileDialog: () => Promise<FileDialogResult>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
