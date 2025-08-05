import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { FileInfo } from '../types';

// Tauri command wrappers
export const tauriApi = {
  // File operations
  async readFileContent(filePath: string): Promise<string> {
    return await invoke('read_file_content', { filePath });
  },

  async writeFileContent(filePath: string, content: string): Promise<void> {
    return await invoke('write_file_content', { filePath, content });
  },

  async getFileInfo(filePath: string): Promise<FileInfo> {
    return await invoke('get_file_info', { filePath });
  },

  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    return await invoke('list_directory', { dirPath });
  },

  // File dialogs using Tauri's native dialog plugin
  async openFileDialog(): Promise<string | null> {
    const result = await open({
      multiple: false,
      filters: [
        {
          name: 'All Files',
          extensions: ['*']
        },
        {
          name: 'Text Files',
          extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'css', 'html', 'xml', 'yaml', 'yml']
        }
      ]
    });
    
    return result as string | null;
  },

  async openFolderDialog(): Promise<string | null> {
    const result = await open({
      directory: true,
      multiple: false
    });
    
    return result as string | null;
  },

  async saveFileDialog(defaultPath?: string): Promise<string | null> {
    const result = await save({
      defaultPath,
      filters: [
        {
          name: 'All Files',
          extensions: ['*']
        },
        {
          name: 'Text Files',
          extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'css', 'html', 'xml', 'yaml', 'yml']
        }
      ]
    });
    
    return result as string | null;
  },

  // Utility function to get file extension
  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  },

  // Check if file exists (by trying to get its info)
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.getFileInfo(filePath);
      return true;
    } catch {
      return false;
    }
  }
};
