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
  // Only store tab metadata and active tab in state
  const [tabs, setTabs] = useState<{ id: string; name: string; workingDirectory: string }[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  // Store XTerm/PTY instances in refs
  const terminalsRef = useRef<{ [id: string]: { xterm: XTerm; fitAddon: FitAddon; pty: IPty } }>({});
  const containerRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  const resizeRef = useRef<HTMLDivElement>(null);

  const activeSession = activeTabId ? terminalsRef.current[activeTabId] : undefined;

  // Cleanup terminals on component unmount
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        Object.values(terminalsRef.current).forEach(({ pty, xterm }) => {
          pty?.kill();
          xterm?.dispose();
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
  }, []);

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
  if (activeTabId && terminalsRef.current[activeTabId]) {
    const { fitAddon } = terminalsRef.current[activeTabId];
    const container = containerRefs.current[activeTabId];
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          fitAddon?.fit();
        }, 0);
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
  }
}, [activeTabId]);

  // Create a new terminal session
  const createSession = useCallback(async () => {
    try {
      const tabId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let shell = '/bin/bash';
      try {
        shell = await invoke<string>('detect_default_shell');
      } catch (err) {
        console.warn('Failed to detect shell, falling back to /bin/bash or cmd.exe:', err);
      }
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
      const pty = spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workingDirectory,
        env: {},
      });
      pty.onData((data: string) => {
        xterm.write(data);
      });
      pty.onExit(({ exitCode }) => {
        xterm.write(`\r\n\r\nProcess exited with code ${exitCode}\r\n`);
      });
      xterm.onData((data) => {
        pty.write(data);
      });
      xterm.onResize(({ cols, rows }) => {
        pty.resize(cols, rows);
      });
      terminalsRef.current[tabId] = { xterm, fitAddon, pty };
      setTabs(prev => [...prev, { id: tabId, name: `Terminal ${prev.length + 1}`, workingDirectory }]);
      setActiveTabId(tabId);
    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  }, [workingDirectory, theme]);


  // Close a terminal session
  const closeSession = useCallback(async (tabId: string) => {
    try {
      const term = terminalsRef.current[tabId];
      if (term) {
        term.pty?.kill();
        term.xterm?.dispose();
        delete terminalsRef.current[tabId];
      }
    } catch (error) {
      console.error('Failed to close terminal session:', error);
    }
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) return [];
      if (tabId === activeTabId) {
        setActiveTabId(filtered[filtered.length - 1]?.id ?? null);
      }
      return filtered;
    });
    if (tabs.length === 1) {
      setActiveTabId(null);
    }
  }, [activeTabId, tabs.length]);

  // Mount XTerm to DOM when active session changes

  // Attach XTerm to its container only if not already attached
useEffect(() => {
  tabs.forEach(tab => {
    const container = containerRefs.current[tab.id];
    const term = terminalsRef.current[tab.id];
    if (term && container && container.childNodes.length === 0) {
      term.xterm.open(container);
    }
  });
  if (activeTabId && terminalsRef.current[activeTabId]) {
    const { xterm, fitAddon } = terminalsRef.current[activeTabId];
    const container = containerRefs.current[activeTabId];
    if (container) {
      setTimeout(() => {
        xterm.refresh(0, xterm.rows - 1);
        fitAddon?.fit();
        xterm.scrollToBottom();
        xterm.resize(xterm.cols, xterm.rows);
      }, 0);
    }
  }
}, [tabs, terminalHeight, activeTabId]);

  // Initialize with first session
  useEffect(() => {
    if (tabs.length === 0) {
      createSession();
    }
  }, [tabs.length, createSession]);

  // Debug effect to log sessions changes
  useEffect(() => {
    console.log('Tabs changed:', tabs);
  }, [tabs]);

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
            disabled={!activeSession}
            className="h-8 w-8 p-0"
            title="Clear Terminal"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Tabs */}
      {tabs.length > 1 && (
        <div className="flex items-center gap-1 p-1 border-b bg-muted/5 flex-shrink-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1 rounded text-xs cursor-pointer',
                tab.id === activeTabId 
                  ? 'bg-background border' 
                  : 'hover:bg-muted/10',
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="flex items-center gap-1">
                <span className="truncate max-w-[100px]">{tab.name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(tab.id);
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
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            ref={el => { containerRefs.current[tab.id] = el; }}
            style={{
              width: '100%',
              height: `${terminalHeight - 100}px`,
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: tab.id === activeTabId ? 2 : 1,
              opacity: tab.id === activeTabId ? 1 : 0,
              pointerEvents: tab.id === activeTabId ? 'auto' : 'none',
              transition: 'opacity 0.2s',
            }}
            className="w-full h-full"
          />
        ))}
        {tabs.length === 0 && (
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
