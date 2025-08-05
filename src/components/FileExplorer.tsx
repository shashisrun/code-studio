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
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (dirPath: string, level: number = 0): Promise<FileTreeNode[]> => {
    try {
      const files = await tauriApi.listDirectory(dirPath);
      return files.map(file => ({
        ...file,
        level,
        expanded: false,
        children: file.is_directory ? [] : undefined,
      }));
    } catch (err) {
      console.error('Failed to load directory:', err);
      return [];
    }
  };

  const toggleDirectory = async (node: FileTreeNode) => {
    if (!node.is_directory) return;

    const newTree = [...fileTree];
    const targetNode = findNodeByPath(newTree, node.path);
    
    if (!targetNode) return;

    if (targetNode.expanded) {
      targetNode.expanded = false;
      targetNode.children = [];
    } else {
      targetNode.expanded = true;
      setLoading(true);
      try {
        targetNode.children = await loadDirectory(node.path, node.level + 1);
      } catch (err) {
        setError(`Failed to load directory: ${err}`);
      } finally {
        setLoading(false);
      }
    }

    setFileTree(newTree);
  };

  const findNodeByPath = (nodes: FileTreeNode[], path: string): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const renderFileTree = (nodes: FileTreeNode[]): React.ReactNode => {
    return nodes.map((node) => {
      const Icon = getFileIcon(node.name, node.is_directory);
      const isExpanded = node.is_directory && node.expanded;
      
      return (
        <div key={node.path}>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                if (node.is_directory) {
                  toggleDirectory(node);
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
          {isExpanded && node.children && (
            <div>{renderFileTree(node.children)}</div>
          )}
        </div>
      );
    });
  };

  useEffect(() => {
    if (currentDirectory) {
      setLoading(true);
      setError(null);
      loadDirectory(currentDirectory)
        .then(setFileTree)
        .catch(err => setError(`Failed to load directory: ${err}`))
        .finally(() => setLoading(false));
    }
  }, [currentDirectory]);

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
              
              {!loading && !error && fileTree.length === 0 && currentDirectory && (
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
              
              {renderFileTree(fileTree)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
