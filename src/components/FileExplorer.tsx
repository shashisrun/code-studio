import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Folder, 
  ChevronRight, 
  ChevronDown,
  Image,
  Code,
  FileJson,
  FileCode,
  FolderOpen
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { FileInfo } from '../types';
import { tauriApi } from '../lib/tauri';

interface FileExplorerProps {
  onFileSelect: (filePath: string) => void;
  currentDirectory?: string;
  activeFilePath?: string;
  className?: string;
}

interface FileTreeNode extends FileInfo {
  children?: FileTreeNode[];
  expanded?: boolean;
  level: number;
}

const getFileIcon = (fileName: string, isDirectory: boolean) => {
  if (isDirectory) return Folder;
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return Code;
    case 'json':
      return FileJson;
    case 'py':
      return Code;
    case 'html':
    case 'css':
    case 'scss':
      return FileCode;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return Image;
    default:
      return FileText;
  }
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  onFileSelect,
  currentDirectory,
  activeFilePath,
  className,
}) => {
  const [flatFileList, setFlatFileList] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (dirPath: string, level: number = 0): Promise<FileTreeNode[]> => {
    try {
      const files = await tauriApi.listDirectory(dirPath);
      return files.map(file => ({
        ...file,
        level,
        expanded: expandedFolders.has(file.path),
        children: undefined,
      }));
    } catch (err) {
      console.error('Failed to load directory:', err);
      return [];
    }
  };

  const buildFlatList = async (rootPath: string): Promise<FileTreeNode[]> => {
    const result: FileTreeNode[] = [];
    
    const processDirectory = async (dirPath: string, level: number = 0) => {
      const files = await loadDirectory(dirPath, level);
      
      for (const file of files) {
        result.push(file);
        
        // If this directory is expanded, load its children
        if (file.is_directory && expandedFolders.has(file.path)) {
          await processDirectory(file.path, level + 1);
        }
      }
    };
    
    await processDirectory(rootPath);
    return result;
  };

  const toggleDirectory = async (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Rebuild the flat list whenever expanded folders change
  const refreshFileList = async () => {
    if (!currentDirectory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const newList = await buildFlatList(currentDirectory);
      setFlatFileList(newList);
    } catch (err) {
      setError(`Failed to load directory: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const renderFileList = (): React.ReactNode => {
    return flatFileList.map((node) => {
      const Icon = getFileIcon(node.name, node.is_directory);
      const isExpanded = node.is_directory && expandedFolders.has(node.path);
      
      return (
        <SidebarMenuItem key={node.path}>
          <SidebarMenuButton
            onClick={() => {
              if (node.is_directory) {
                toggleDirectory(node.path);
              } else {
                onFileSelect(node.path);
              }
            }}
            isActive={!node.is_directory && node.path === activeFilePath}
            className={cn(
              'w-full text-left',
              !node.is_directory && 'text-muted-foreground'
            )}
            style={{ paddingLeft: `${(node.level * 12) + 8}px` }}
          >
            <div className="flex items-center gap-2 w-full">
              {node.is_directory && (
                <span className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              )}
              <Icon className={cn(
                'flex-shrink-0',
                node.is_directory ? 'h-4 w-4' : 'h-3.5 w-3.5'
              )} />
              <span className="truncate text-sm">{node.name}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };

  useEffect(() => {
    if (currentDirectory) {
      refreshFileList();
    } else {
      setFlatFileList([]);
    }
  }, [currentDirectory]);

  // Refresh when expanded folders change
  useEffect(() => {
    if (currentDirectory) {
      refreshFileList();
    }
  }, [expandedFolders, currentDirectory]);

  return (
    <Sidebar className={cn('h-full', className)} variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Folder className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">File Explorer</span>
                <span className="truncate text-xs">
                  {currentDirectory ? currentDirectory.split('/').pop() || 'Root' : 'No folder'}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Explorer
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 flex items-center text-xs">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                    Loading...
                  </div>
                </SidebarMenuItem>
              )}
              
              {error && (
                <SidebarMenuItem>
                  <div className="mx-3 my-1 px-2 py-1 text-xs text-destructive bg-destructive/5 border-l-2 border-destructive/20 rounded-sm">
                    {error}
                  </div>
                </SidebarMenuItem>
              )}
              
              {!loading && !error && flatFileList.length === 0 && currentDirectory && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-sidebar-foreground/60 text-center">
                    Empty folder
                  </div>
                </SidebarMenuItem>
              )}
              
              {!currentDirectory && (
                <SidebarMenuItem>
                  <div className="px-3 py-6 text-center">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30 text-sidebar-foreground/50" />
                    <p className="text-xs text-sidebar-foreground/70">No folder opened</p>
                    <p className="mt-1 opacity-60 text-xs text-sidebar-foreground/50">Use File → Open Folder</p>
                  </div>
                </SidebarMenuItem>
              )}
              
              {renderFileList()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
