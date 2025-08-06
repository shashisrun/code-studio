import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { spawn } from 'tauri-pty';
import type { IPty } from 'tauri-pty';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button } from '@/components/ui/button';
import { 
  Terminal as TerminalIcon, 
  X, 
  RotateCcw,
  Plus,
  GripHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  workingDirectory?: string;
  className?: string;
  theme?: 'light' | 'dark';
}

interface TerminalSession {
  id: string;
  name: string;
  isActive: boolean;
  workingDirectory: string;
  pty: IPty;
  xterm: XTerm;
  fitAddon: FitAddon;
}

export const Terminal: React.FC<TerminalProps> = ({
  workingDirectory = '/',
  className,
  theme = 'dark'
}) => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Cleanup terminals on component unmount
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        // Cleanup all xterm instances
        sessions.forEach(session => {
          if (session.pty) {
            session.pty.kill();
          }
          if (session.xterm) {
            session.xterm.dispose();
          }
        });
        await invoke('cleanup_all_terminals');
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [sessions]);

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeRef.current) {
        const rect = resizeRef.current.getBoundingClientRect();
        const newHeight = Math.max(200, Math.min(600, e.clientY - rect.top + terminalHeight));
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, terminalHeight]);

  // Fit terminal when container size changes
  useEffect(() => {
    if (activeSession?.fitAddon && terminalContainerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          activeSession.fitAddon?.fit();
        }, 0);
      });
      
      resizeObserver.observe(terminalContainerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [activeSession]);

  // Create a new terminal session

  const createSession = useCallback(async () => {
    try {
      console.log('Creating new terminal session...');
      const sessionId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Detect default shell from backend
      let shell = '/bin/bash';
      try {
        shell = await invoke<string>('detect_default_shell');
      } catch (err) {
        console.warn('Failed to detect shell, falling back to /bin/bash or cmd.exe:', err);
      }
      // Create XTerm instance
      const xterm = new XTerm({
        theme: {
          background: theme === 'dark' ? '#000000' : '#ffffff',
          foreground: theme === 'dark' ? '#ffffff' : '#000000',
          cursor: theme === 'dark' ? '#ffffff' : '#000000',
        },
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        fontSize: 13,
        cursorBlink: true,
        cols: 80,
        rows: 24,
      });
      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      const webLinksAddon = new WebLinksAddon();
      xterm.loadAddon(webLinksAddon);
      // Use detected shell for PTY
      const pty = spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workingDirectory,
        env: {},
      });
      // Connect PTY to XTerm
      pty.onData((data: string) => {
        xterm.write(data);
      });
      pty.onExit(({ exitCode }) => {
        xterm.write(`\r\n\r\nProcess exited with code ${exitCode}\r\n`);
      });
      // Connect XTerm input to PTY
      xterm.onData((data) => {
        pty.write(data);
      });
      // Handle terminal resize
      xterm.onResize(({ cols, rows }) => {
        pty.resize(cols, rows);
      });
      const newSession: TerminalSession = {
        id: sessionId,
        name: `Terminal ${sessions.length + 1}`,
        isActive: true,
        workingDirectory: workingDirectory,
        xterm,
        fitAddon,
        pty,
      };
      setSessions(prev => [
        ...prev.map(s => ({ ...s, isActive: false })),
        newSession
      ]);
      setActiveSessionId(newSession.id);
    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  }, [sessions.length, workingDirectory, theme]);


  // Close a terminal session
  const closeSession = useCallback(async (sessionId: string) => {
    try {
      const sessionToClose = sessions.find(s => s.id === sessionId);
      
      if (sessionToClose) {
        // Cleanup PTY
        if (sessionToClose.pty) {
          sessionToClose.pty.kill();
        }
        
        // Cleanup XTerm
        if (sessionToClose.xterm) {
          sessionToClose.xterm.dispose();
        }
        
      }
    } catch (error) {
      console.error('Failed to close terminal session:', error);
    }

    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (filtered.length === 0) {
        return [];
      }
      
      if (sessionId === activeSessionId) {
        const newActive = filtered[filtered.length - 1];
        newActive.isActive = true;
        setActiveSessionId(newActive.id);
      }
      
      return filtered;
    });

    if (sessions.length === 1) {
      setActiveSessionId(null);
    }
  }, [sessions, activeSessionId]);

  // Mount XTerm to DOM when active session changes
  useEffect(() => {
    if (activeSession?.xterm && terminalContainerRef.current) {
      // Clear the container
      terminalContainerRef.current.innerHTML = '';
      
      // Mount the terminal
      activeSession.xterm.open(terminalContainerRef.current);
      
      // Fit the terminal
      setTimeout(() => {
        activeSession.fitAddon?.fit();
      }, 0);
    }
  }, [activeSession]);

  // Initialize with first session
  useEffect(() => {
    console.log('Terminal useEffect triggered, sessions.length:', sessions.length);
    if (sessions.length === 0) {
      console.log('Creating initial terminal session');
      createSession();
    }
  }, []);

  // Debug effect to log sessions changes
  useEffect(() => {
    console.log('Sessions changed:', sessions);
  }, [sessions]);

  return (
    <div 
      ref={resizeRef}
      className={cn('flex flex-col bg-background border rounded-lg overflow-hidden min-h-[200px] max-h-[600px]', className)}
      style={{ height: `${terminalHeight}px` }}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
        
        <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={createSession}
        className="h-8 w-8 p-0"
        title="New Terminal"
      >
        <Plus className="h-3 w-3" />
      </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activeSession?.xterm?.clear()}
            disabled={!activeSessionId}
            className="h-8 w-8 p-0"
            title="Clear Terminal"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Tabs */}
      {sessions.length > 1 && (
        <div className="flex items-center gap-1 p-1 border-b bg-muted/5 flex-shrink-0">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1 rounded text-xs cursor-pointer',
                session.id === activeSessionId 
                  ? 'bg-background border' 
                  : 'hover:bg-muted/10',
              )}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span className="flex items-center gap-1">
                <span className="truncate max-w-[100px]">{session.name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="h-4 w-4 p-0 hover:bg-destructive/20"
              >
                <X className="h-2 w-2" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={terminalContainerRef}
          className="w-full h-full"
          style={{ 
            height: `${terminalHeight - 100}px` // Account for header and resize handle
          }}
        />
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Initializing terminal...
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div 
        className="h-2 bg-muted/20 hover:bg-muted/40 cursor-row-resize flex items-center justify-center border-t"
        onMouseDown={() => setIsResizing(true)}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
};
