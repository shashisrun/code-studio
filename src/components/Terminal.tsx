import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button } from '@/components/ui/button';
import {
  Terminal as TerminalIcon,
  X,
  RotateCcw,
  Plus,
  GripHorizontal,
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
  working_directory: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  workingDirectory,
  className,
  theme = 'dark',
}) => {
  // Detect user's home directory using Tauri API
  const [homeDir, setHomeDir] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Use Tauri's path API to get home directory
        const { homeDir } = await import('@tauri-apps/api/path');
        const dir = await homeDir();
        console.log('Home directory:', dir);
        setHomeDir(dir);
      } catch (e) {
        setHomeDir('/');
      }
    })();
  }, []);

  const effectiveWorkingDirectory = workingDirectory || homeDir || '/';

  const [tabs, setTabs] = useState<TerminalSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const terminalsRef = useRef<{ [id: string]: { xterm: XTerm; fitAddon: FitAddon } }>({});
  const containerRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  const resizeRef = useRef<HTMLDivElement>(null);

  const activeSession = activeTabId ? terminalsRef.current[activeTabId] : undefined;

  useEffect(() => {
    const cleanup = async () => {
      Object.values(terminalsRef.current).forEach(({ xterm }) => xterm.dispose());
      await invoke('cleanup_all_terminals');
    };
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeRef.current) {
        const parentRect = resizeRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          // Calculate new height from mouse position relative to top of parent
          const newHeight = Math.max(200, Math.min(600, parentRect.bottom - e.clientY));
          setTerminalHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, terminalHeight]);

  useEffect(() => {
    if (activeTabId && terminalsRef.current[activeTabId]) {
      const { fitAddon } = terminalsRef.current[activeTabId];
      const container = containerRefs.current[activeTabId];
      if (container) {
        const resizeObserver = new ResizeObserver(() => {
          setTimeout(() => fitAddon.fit(), 0);
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
      }
    }
  }, [activeTabId]);

  // Example: get font size from CSS variable or app context
  const fontSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size')) || 13;

  const createSession = useCallback(async () => {
    const session: TerminalSession = await invoke('create_terminal_session', {
      workingDirectory: effectiveWorkingDirectory,
    });

    const tabId = session.id;
    const xterm = new XTerm({
      theme: {
        background: theme === 'dark' ? '#000000' : '#ffffff',
        foreground: theme === 'dark' ? '#ffffff' : '#000000',
        cursor: theme === 'dark' ? '#ffffff' : '#000000',
      },
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize,
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.onData((data) => {
      invoke('write_to_pty', {
        sessionId: tabId,
        input: data,
      });
    });

    terminalsRef.current[tabId] = { xterm, fitAddon };

    setTabs((prev) => [...prev, session]);
    setActiveTabId(tabId);
  }, [effectiveWorkingDirectory, theme]);

  useEffect(() => {
    const unlisten = listen('terminal-data', (event) => {
      const payload = event.payload as { id: string; data: string };
      const term = terminalsRef.current[payload.id];
      if (term) {
        term.xterm.write(payload.data);
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const closeSession = useCallback(async (tabId: string) => {
    await invoke('close_terminal_session', { sessionId: tabId });
    const term = terminalsRef.current[tabId];
    if (term) {
      term.xterm.dispose();
      delete terminalsRef.current[tabId];
    }
    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId && updated.length > 0) {
        setActiveTabId(updated[updated.length - 1].id);
      } else if (updated.length === 0) {
        setActiveTabId(null);
      }
      return updated;
    });
  }, [activeTabId]);

  useEffect(() => {
    tabs.forEach((tab) => {
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
          fitAddon.fit();
          xterm.scrollToBottom();
          xterm.resize(xterm.cols, xterm.rows);
        }, 0);
      }
    }
  }, [tabs, terminalHeight, activeTabId]);

  useEffect(() => {
    if (tabs.length === 0) {
      createSession();
    }
  }, [tabs.length, createSession]);

  return (
    <div
      ref={resizeRef}
      className={cn(
        'flex flex-col bg-background border rounded-lg overflow-hidden min-h-[200px] max-h-[600px]',
        className,
      )}
      style={{ height: `${terminalHeight}px` }}
    >
      {/* Resize Handle (move to top) */}
      <div
        className="h-2 bg-muted/20 hover:bg-muted/40 cursor-row-resize flex items-center justify-center border-b"
        style={{ position: 'relative', zIndex: 10 }}
        onMouseDown={() => setIsResizing(true)}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Terminal Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={createSession} className="h-8 w-8 p-0" title="New Terminal">
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
                tab.id === activeTabId ? 'bg-background border' : 'hover:bg-muted/10',
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="truncate max-w-[100px]">{tab.name}</span>
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

      {/* Terminal Container (stick to bottom, fill remaining space above status bar) */}
      <div className="flex-1 overflow-hidden relative" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => { containerRefs.current[tab.id] = el; }}
            style={{
              width: '100%',
              height: "100%",
              position: 'absolute',
              bottom: 0,
              left: 0,
              zIndex: tab.id === activeTabId ? 2 : 1,
              opacity: tab.id === activeTabId ? 1 : 0,
              pointerEvents: tab.id === activeTabId ? 'auto' : 'none',
              transition: 'opacity 0.2s',
            }}
          />
        ))}
      </div>
      {/* Status bar would go here, below terminal container */}
    </div>
  );
};
