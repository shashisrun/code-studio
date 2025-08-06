import { useState, useCallback, useEffect } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./components/CodeEditor";
import { FileExplorer } from "./components/FileExplorer";
import { Terminal } from "./components/Terminal";
import { AppMenu } from "./components/AppMenu";
import { StatusBar } from "./components/StatusBar";
import { EditorFile, getLanguageFromExtension } from "./types";
import { tauriApi } from "./lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { ChatWindow } from "./components/ChatWindow";

function App() {
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [currentDirectory, setCurrentDirectory] = useState<string>();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [showTerminal, setShowTerminal] = useState(false);

  const activeFile = openFiles[activeFileIndex];

  const onToggleTerminal = useCallback(() => {
    setShowTerminal((prev) => !prev);
  }, []);

  // Global cleanup on app close
  useEffect(() => {
    const handleAppClose = async () => {
      try {
        await invoke("cleanup_all_terminals");
        await invoke("cleanup_dev_ports");
      } catch (error) {
        console.error("App cleanup error:", error);
      }
    };

    // Listen for app close events
    window.addEventListener("beforeunload", handleAppClose);

    return () => {
      window.removeEventListener("beforeunload", handleAppClose);
    };
  }, []);

  const openFile = useCallback(
    async (filePath: string) => {
      try {
        // Check if file is already open
        const existingIndex = openFiles.findIndex(
          (file) => file.path === filePath
        );
        if (existingIndex !== -1) {
          setActiveFileIndex(existingIndex);
          return;
        }

        const content = await tauriApi.readFileContent(filePath);
        const fileName = filePath.split(/[/\\]/).pop() || "Untitled";
        const language = getLanguageFromExtension(fileName);

        const newFile: EditorFile = {
          path: filePath,
          name: fileName,
          content,
          language,
          modified: false,
        };

        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileIndex(openFiles.length);
      } catch (error) {
        console.error("Failed to open file:", error);
        alert("Failed to open file: " + error);
      }
    },
    [openFiles]
  );

  const saveFile = useCallback(
    async (fileIndex?: number) => {
      const targetIndex = fileIndex ?? activeFileIndex;
      const file = openFiles[targetIndex];

      if (!file) return;

      try {
        await tauriApi.writeFileContent(file.path, file.content);

        setOpenFiles((prev) =>
          prev.map((f, i) =>
            i === targetIndex ? { ...f, modified: false } : f
          )
        );
      } catch (error) {
        console.error("Failed to save file:", error);
        alert("Failed to save file: " + error);
      }
    },
    [openFiles, activeFileIndex]
  );

  const closeFile = useCallback(
    (fileIndex: number) => {
      const file = openFiles[fileIndex];

      // TODO: Add confirmation dialog for modified files
      if (file.modified) {
        const confirmed = confirm(
          `${file.name} has unsaved changes. Close anyway?`
        );
        if (!confirmed) return;
      }

      setOpenFiles((prev) => prev.filter((_, i) => i !== fileIndex));

      if (fileIndex === activeFileIndex) {
        setActiveFileIndex(Math.max(0, fileIndex - 1));
      } else if (fileIndex < activeFileIndex) {
        setActiveFileIndex(activeFileIndex - 1);
      }
    },
    [openFiles, activeFileIndex]
  );

  const updateFileContent = useCallback(
    (content: string) => {
      if (!activeFile) return;

      setOpenFiles((prev) =>
        prev.map((file, index) =>
          index === activeFileIndex
            ? { ...file, content, modified: file.content !== content }
            : file
        )
      );
    },
    [activeFile, activeFileIndex]
  );

  const openFolder = useCallback(async () => {
    try {
      const folderPath = await tauriApi.openFolderDialog();
      if (folderPath) {
        setCurrentDirectory(folderPath);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }, []);

  const openFileFromDialog = useCallback(async () => {
    try {
      const filePath = await tauriApi.openFileDialog();
      if (filePath) {
        await openFile(filePath);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }, [openFile]);

  const newFile = useCallback(() => {
    const newFile: EditorFile = {
      path: `untitled-${Date.now()}.txt`,
      name: "Untitled",
      content: "",
      language: "plaintext",
      modified: true,
    };

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileIndex(openFiles.length);
  }, [openFiles]);

  const saveAsFile = useCallback(async () => {
    if (!activeFile) return;

    try {
      const filePath = await tauriApi.saveFileDialog(activeFile.name);
      if (filePath) {
        await tauriApi.writeFileContent(filePath, activeFile.content);

        // Update the file in the open files list
        setOpenFiles((prev) =>
          prev.map((f, i) =>
            i === activeFileIndex
              ? {
                  ...f,
                  path: filePath,
                  name: filePath.split(/[/\\]/).pop() || "Untitled",
                  modified: false,
                }
              : f
          )
        );
      }
    } catch (error) {
      console.error("Failed to save file as:", error);
      alert("Failed to save file as: " + error);
    }
  }, [activeFile, activeFileIndex]);

  const closeActiveFile = useCallback(() => {
    if (activeFile) {
      closeFile(activeFileIndex);
    }
  }, [activeFile, activeFileIndex, closeFile]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <div
        className={cn(
          "h-screen w-screen flex bg-background text-foreground overflow-hidden",
          theme
        )}
      >
        <AppMenu
          openFiles={openFiles}
          activeFile={activeFile}
          onOpenFile={openFileFromDialog}
          onOpenFolder={openFolder}
          onSaveFile={() => saveFile()}
          onSaveAsFile={saveAsFile}
          onCloseFile={closeActiveFile}
          onNewFile={newFile}
          onToggleTheme={toggleTheme}
          theme={theme}
          showTerminal={showTerminal}
          onToggleTerminal={onToggleTerminal}
        />

        {/* Sidebar */}
        <FileExplorer
          onFileSelect={openFile}
          currentDirectory={currentDirectory}
          activeFilePath={activeFile?.path}
        />

        {/* Main Content */}
        <SidebarInset className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-row h-full">
            <div className="flex-1 flex flex-col h-full">
              <div className="h-full flex flex-col">
                {/* Header with Sidebar Trigger */}
                <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                  <SidebarTrigger className="-ml-1" />
                  <div className="flex-1" />
                </header>

                {/* Tab Bar */}
                {openFiles.length > 0 && (
                  <div className="bg-muted/10 border-b border-border/30">
                    <Tabs
                      value={activeFileIndex.toString()}
                      onValueChange={(value) =>
                        setActiveFileIndex(parseInt(value))
                      }
                    >
                      <TabsList className="h-[2.25rem] p-0 bg-transparent border-none rounded-none w-full justify-start">
                        {openFiles.map((file, index) => (
                          <TabsTrigger
                            key={file.path}
                            value={index.toString()}
                            className="group relative h-[2.25rem] px-[1rem] py-0 text-[0.875rem] font-normal rounded-none border-r border-border/20 bg-transparent hover:bg-muted/40 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:border-r-border/20 transition-all duration-200 min-w-0 max-w-[12rem]"
                          >
                            <div className="flex items-center gap-[0.5rem] min-w-0">
                              <span className="truncate text-foreground/80 data-[state=active]:text-foreground group-data-[state=active]:text-foreground">
                                {file.name}
                              </span>
                              {file.modified && (
                                <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-orange-500 flex-shrink-0 modified-indicator" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-[1.25rem] w-[1.25rem] p-0 ml-auto flex-shrink-0 hover:bg-destructive/15 hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition-all duration-150"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeFile(index);
                                }}
                              >
                                <X className="h-[0.75rem] w-[0.75rem]" />
                              </Button>
                            </div>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                )}

                {/* Editor and Terminal */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Editor */}
                  <div
                    className={cn(
                      "flex-1 overflow-auto",
                      showTerminal && "flex-[3]"
                    )}
                  >
                    {activeFile ? (
                      <CodeEditor
                        value={activeFile.content}
                        onChange={updateFileContent}
                        language={activeFile.language}
                        theme={theme}
                        onSave={() => saveFile()}
                        height="100%"
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center max-w-md">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                          <h3 className="text-lg font-medium mb-2 text-foreground/80">
                            No files open
                          </h3>
                          <p className="text-sm mb-4 text-muted-foreground">
                            Open a file or folder to get started
                          </p>
                          <div className="text-xs text-muted-foreground/70 space-y-1">
                            <p>
                              File → Open File (
                              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
                                ⌘O
                              </kbd>
                              )
                            </p>
                            <p>
                              File → Open Folder (
                              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
                                ⌘⇧O
                              </kbd>
                              )
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terminal Panel */}
                  {showTerminal && (
                    <div className="flex-1 border-t">
                      <Terminal
                        workingDirectory={currentDirectory}
                        theme={theme}
                        className="h-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Chat Window */}
            <ChatWindow className="border-t" />
          </div>
          {/* Status Bar */}
          <StatusBar activeFile={activeFile} theme={theme} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default App;
