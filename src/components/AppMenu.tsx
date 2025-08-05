import { useEffect } from 'react';
import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface AppMenuProps {
  openFiles: any[];
  activeFile: any;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onCloseFile: () => void;
  onNewFile: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

export function AppMenu({
  openFiles,
  activeFile,
  onOpenFile,
  onOpenFolder,
  onSaveFile,
  onSaveAsFile,
  onCloseFile,
  onNewFile,
  onToggleTheme,
  theme
}: AppMenuProps) {
  useEffect(() => {
    const createMenu = async () => {
      try {
        // Create menu items
        const newFileItem = await MenuItem.new({
          id: 'new_file',
          text: 'New File',
          accelerator: 'CmdOrCtrl+N',
          action: onNewFile,
        });

        const openFileItem = await MenuItem.new({
          id: 'open_file',
          text: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          action: onOpenFile,
        });

        const openFolderItem = await MenuItem.new({
          id: 'open_folder',
          text: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          action: onOpenFolder,
        });

        const saveItem = await MenuItem.new({
          id: 'save',
          text: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: activeFile?.modified || false,
          action: onSaveFile,
        });

        const saveAsItem = await MenuItem.new({
          id: 'save_as',
          text: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: !!activeFile,
          action: onSaveAsFile,
        });

        const closeFileItem = await MenuItem.new({
          id: 'close_file',
          text: 'Close File',
          accelerator: 'CmdOrCtrl+W',
          enabled: !!activeFile,
          action: onCloseFile,
        });

        const closeWindowItem = await MenuItem.new({
          id: 'close_window',
          text: 'Close Window',
          accelerator: 'CmdOrCtrl+Shift+W',
          action: async () => {
            const window = getCurrentWindow();
            await window.close();
          },
        });

        // Create separators
        const separator1 = await PredefinedMenuItem.new({ item: 'Separator' });
        const separator2 = await PredefinedMenuItem.new({ item: 'Separator' });
        const separator3 = await PredefinedMenuItem.new({ item: 'Separator' });

        // Create File submenu
        const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
            newFileItem,
            separator1,
            openFileItem,
            openFolderItem,
            separator2,
            saveItem,
            saveAsItem,
            separator3,
            closeFileItem,
            closeWindowItem,
          ],
        });

        // Create View menu items
        const toggleThemeItem = await MenuItem.new({
          id: 'toggle_theme',
          text: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
          accelerator: 'CmdOrCtrl+Shift+T',
          action: onToggleTheme,
        });

        const viewSeparator = await PredefinedMenuItem.new({ item: 'Separator' });

        const viewSubmenu = await Submenu.new({
          text: 'View',
          items: [
            toggleThemeItem,
            viewSeparator,
          ],
        });

        // Create Edit menu items
        const findItem = await MenuItem.new({
          id: 'find',
          text: 'Find',
          accelerator: 'CmdOrCtrl+F',
          enabled: !!activeFile,
        });

        const replaceItem = await MenuItem.new({
          id: 'replace',
          text: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          enabled: !!activeFile,
        });

        const editSeparator1 = await PredefinedMenuItem.new({ item: 'Separator' });
        const editSeparator2 = await PredefinedMenuItem.new({ item: 'Separator' });

        const editSubmenu = await Submenu.new({
          text: 'Edit',
          items: [
            await PredefinedMenuItem.new({ item: 'Undo' }),
            await PredefinedMenuItem.new({ item: 'Redo' }),
            editSeparator1,
            await PredefinedMenuItem.new({ item: 'Cut' }),
            await PredefinedMenuItem.new({ item: 'Copy' }),
            await PredefinedMenuItem.new({ item: 'Paste' }),
            editSeparator2,
            await PredefinedMenuItem.new({ item: 'SelectAll' }),
            findItem,
            replaceItem,
          ],
        });

        // Create Window menu items
        const minimizeItem = await MenuItem.new({
          id: 'minimize',
          text: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          action: async () => {
            const window = getCurrentWindow();
            await window.minimize();
          },
        });

        const maximizeItem = await MenuItem.new({
          id: 'maximize',
          text: 'Maximize',
          action: async () => {
            const window = getCurrentWindow();
            await window.toggleMaximize();
          },
        });

        const fullscreenItem = await MenuItem.new({
          id: 'fullscreen',
          text: 'Enter Full Screen',
          accelerator: 'F11',
          action: async () => {
            const window = getCurrentWindow();
            const isFullscreen = await window.isFullscreen();
            await window.setFullscreen(!isFullscreen);
          },
        });

        const windowSeparator = await PredefinedMenuItem.new({ item: 'Separator' });

        const windowSubmenu = await Submenu.new({
          text: 'Window',
          items: [
            minimizeItem,
            maximizeItem,
            windowSeparator,
            fullscreenItem,
          ],
        });

        // Create Help menu items
        const aboutItem = await MenuItem.new({
          id: 'about',
          text: 'About',
          action: () => {
            alert('Code Editor\nBuilt with Tauri + React + CodeMirror');
          },
        });

        const keyboardShortcutsItem = await MenuItem.new({
          id: 'keyboard_shortcuts',
          text: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          action: () => {
            alert(`Keyboard Shortcuts:

File:
• New File: Ctrl/Cmd+N
• Open File: Ctrl/Cmd+O
• Open Folder: Ctrl/Cmd+Shift+O
• Save: Ctrl/Cmd+S
• Save As: Ctrl/Cmd+Shift+S
• Close File: Ctrl/Cmd+W

View:
• Toggle Sidebar: Ctrl/Cmd+B
• Toggle Theme: Ctrl/Cmd+Shift+T

Edit:
• Find: Ctrl/Cmd+F
• Replace: Ctrl/Cmd+H

Window:
• Minimize: Ctrl/Cmd+M
• Full Screen: F11`);
          },
        });

        const helpSeparator = await PredefinedMenuItem.new({ item: 'Separator' });

        const helpSubmenu = await Submenu.new({
          text: 'Help',
          items: [
            aboutItem,
            keyboardShortcutsItem,
            helpSeparator,
          ],
        });

        // Create main menu
        const menu = await Menu.new({
          items: [
            fileSubmenu,
            editSubmenu,
            viewSubmenu,
            windowSubmenu,
            helpSubmenu,
          ],
        });

        // Set as app menu
        await menu.setAsAppMenu();
        console.log('Native menu created successfully');

      } catch (error) {
        console.error('Failed to create menu:', error);
      }
    };

    createMenu();
  }, [
    openFiles,
    activeFile,
    theme,
    onOpenFile,
    onOpenFolder,
    onSaveFile,
    onSaveAsFile,
    onCloseFile,
    onNewFile,
    onToggleTheme,
  ]);

  // This component doesn't render anything visible
  return null;
}
