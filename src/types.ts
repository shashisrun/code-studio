// Types for Tauri backend communication

export interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

export interface EditorFile {
  path: string;
  name: string;
  content: string;
  language: string;
  modified: boolean;
}

export interface EditorState {
  openFiles: EditorFile[];
  activeFileIndex: number;
  currentDirectory?: string;
}

// Language detection based on file extension
export const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'rs':
      return 'rust';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'text';
  }
};

// Theme type
export type Theme = 'light' | 'dark';

export interface EditorSettings {
  theme: Theme;
  fontSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  minimap: boolean;
}
