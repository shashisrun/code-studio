<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Modern Code Editor - Copilot Instructions

This is a modern, cross-platform code editor built with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Code Editor**: CodeMirror 6
- **Styling**: Tailwind CSS v4

## Architecture Overview

### Frontend Structure
- `/src/components/` - React components (CodeEditor, FileExplorer, etc.)
- `/src/lib/` - Utility functions and API wrappers
- `/src/types.ts` - TypeScript type definitions
- `/src/App.tsx` - Main application layout and state management

### Backend Structure
- `/src-tauri/src/lib.rs` - Rust backend with Tauri commands
- File operations: read_file_content, write_file_content, list_directory, get_file_info

### Key Features
1. **File Management**: Open/save files, directory browsing
2. **Code Editing**: Syntax highlighting, multiple language support
3. **UI/UX**: Modern interface with dark/light themes
4. **Cross-platform**: Works on macOS, Windows, and Linux

## Development Guidelines

When making changes:
1. **File Operations**: Use Tauri commands for all file system operations
2. **UI Components**: Prefer shadcn/ui components over custom implementations
3. **Styling**: Use Tailwind CSS classes and the design system
4. **State Management**: Keep editor state in React components
5. **TypeScript**: Maintain strict typing throughout

## Code Style
- Use functional components with hooks
- Implement proper error handling for file operations
- Follow React best practices for performance
- Use TypeScript interfaces for all data structures

## Extension Points
The editor is designed to be modular and extensible:
- Language support via CodeMirror extensions
- Themes via CodeMirror and Tailwind
- Plugins through React component composition
- AI features can be added as separate components
