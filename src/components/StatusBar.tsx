import React from 'react';
import { EditorFile } from '../types';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  activeFile?: EditorFile;
  theme: 'light' | 'dark';
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  activeFile, 
  theme,
  className 
}) => {
  const getFileStats = () => {
    if (!activeFile) return null;
    
    const lines = activeFile.content.split('\n').length;
    const chars = activeFile.content.length;
    const words = activeFile.content.trim() ? activeFile.content.trim().split(/\s+/).length : 0;
    
    return { lines, chars, words };
  };

  const stats = getFileStats();

  return (
    <div className={cn(
      'h-6 bg-muted/40 border-t border-border/50 flex items-center justify-between px-3 text-xs text-muted-foreground',
      className
    )}>
      <div className="flex items-center space-x-4">
        {activeFile && (
          <>
            <span className="flex items-center">
              <span className={cn(
                'w-2 h-2 rounded-full mr-1.5',
                activeFile.modified ? 'bg-orange-500' : 'bg-green-500'
              )} />
              {activeFile.modified ? 'Modified' : 'Saved'}
            </span>
            <span className="opacity-60">•</span>
            <span>{activeFile.language}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {stats && (
          <>
            <span>{stats.lines} lines</span>
            <span className="opacity-60">•</span>
            <span>{stats.words} words</span>
            <span className="opacity-60">•</span>
            <span>{stats.chars} characters</span>
            <span className="opacity-60">•</span>
          </>
        )}
        <span className="capitalize">{theme} theme</span>
      </div>
    </div>
  );
};
