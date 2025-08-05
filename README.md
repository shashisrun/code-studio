# Studio - Modern Code Editor

A modern, cross-platform code editor built with Tauri, React, and CodeMirror 6. Features a clean interface, powerful editing capabilities, and extensible architecture.

## Features

- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- 🌙 **Dark/Light Themes**: Toggle between light and dark modes
- 📁 **File Management**: Browse directories and manage files
- 🔍 **Syntax Highlighting**: Support for JavaScript, TypeScript, Python, JSON, CSS, HTML, Markdown, and more
- 🔧 **Code Intelligence**: Autocompletion, bracket matching, and search functionality
- ⚡ **Fast Performance**: Native performance with Tauri's Rust backend
- 🖥️ **Cross-Platform**: Works on macOS, Windows, and Linux
- 📦 **Modular Architecture**: Easy to extend with new features and languages

## Tech Stack

### Frontend
- **React 19** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast development and building
- **CodeMirror 6** - Powerful code editor component
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS v4** - Utility-first CSS framework
- **Lucide React** - Beautiful icons

### Backend
- **Tauri 2.0** - Rust-based desktop application framework
- **Rust** - Systems programming language for native performance

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Bun](https://bun.sh/) package manager
- [Rust](https://rustup.rs/) (latest stable)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd studio
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start development server**
   ```bash
   bun run tauri dev
   ```

   This will start both the React development server and the Tauri application.

### Building for Production

#### Desktop Applications

Build for your current platform:
```bash
bun run tauri build
```

Build for specific platforms:
```bash
# macOS
bun run tauri build --target universal-apple-darwin

# Windows
bun run tauri build --target x86_64-pc-windows-msvc

# Linux
bun run tauri build --target x86_64-unknown-linux-gnu
```

#### Web Version
```bash
bun run build
```

## Project Structure

```
studio/
├── src/                    # React frontend source
│   ├── components/         # React components
│   │   ├── CodeEditor.tsx  # Main code editor component
│   │   ├── FileExplorer.tsx # File browser sidebar
│   │   └── ui/            # shadcn/ui components
│   ├── lib/               # Utility functions
│   │   ├── tauri.ts       # Tauri API wrapper
│   │   └── utils.ts       # General utilities
│   ├── types.ts           # TypeScript type definitions
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── lib.rs         # Main Tauri application
│   │   └── main.rs        # Entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
└── package.json           # Node.js dependencies
```

## Available Scripts

- `bun run tauri dev` - Start development server
- `bun run tauri build` - Build for production
- `bun run build` - Build web version
- `bun run preview` - Preview production build

## API Reference

### Tauri Commands

The application exposes several Rust commands that can be called from the frontend:

#### File Operations
- `read_file_content(filePath: string)` - Read file contents
- `write_file_content(filePath: string, content: string)` - Write file contents
- `get_file_info(filePath: string)` - Get file metadata
- `list_directory(dirPath: string)` - List directory contents

### Frontend Components

#### CodeEditor
```tsx
<CodeEditor
  value={content}
  onChange={handleChange}
  language="typescript"
  theme="dark"
  onSave={handleSave}
/>
```

#### FileExplorer
```tsx
<FileExplorer
  onFileSelect={handleFileSelect}
  currentDirectory="/path/to/directory"
/>
```

## Supported Languages

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py)
- JSON (.json)
- CSS (.css)
- HTML (.html, .htm)
- Markdown (.md, .markdown)
- And more...

## Configuration

### Adding New Language Support

1. Install the CodeMirror language package:
   ```bash
   bun add @codemirror/lang-[language]
   ```

2. Update the language detection in `src/types.ts`:
   ```typescript
   case 'ext':
     return 'language-name';
   ```

3. Add the language extension in `src/components/CodeEditor.tsx`:
   ```typescript
   import { language } from '@codemirror/lang-language';
   
   case 'language-name':
     return language();
   ```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Plugin system for extensions
- [ ] AI-powered code completion
- [ ] Git integration
- [ ] Terminal integration
- [ ] Advanced search and replace
- [ ] Multiple cursor support
- [ ] Vim key bindings
- [ ] Language servers integration (LSP)
- [ ] Debugger integration
- [ ] Project templates

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Tauri](https://tauri.app/) for the amazing desktop framework
- [CodeMirror](https://codemirror.net/) for the powerful editor component
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
