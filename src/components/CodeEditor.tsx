import { useRef, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'

interface CodeEditorProps {
  content: string
  filename: string | null
  language?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onSave?: (value: string) => void
}

const getLanguageFromFilename = (filename: string | null): string => {
  if (!filename) return 'plaintext'

  const extension = filename.split('.').pop()?.toLowerCase() || ''

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',

    // Data
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'toml': 'toml',

    // Documents
    'md': 'markdown',
    'mdx': 'markdown',
    'markdown': 'markdown',

    // Programming Languages
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'php': 'php',
    'rb': 'ruby',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'ps1': 'powershell',

    // Config files
    'dockerfile': 'dockerfile',
    'gitignore': 'ignore',
    'env': 'plaintext',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'plaintext',

    // Others
    'sql': 'sql',
    'graphql': 'graphql',
    'vue': 'vue',
    'svelte': 'svelte',
  }

  return languageMap[extension] || 'plaintext'
}

export default function CodeEditor({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
}: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const detectedLanguage = useMemo(() => {
    return language || getLanguageFromFilename(filename)
  }, [language, filename])

  const handleEditorDidMount = useCallback((
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor')
  ) => {
    editorRef.current = editor

    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, Fira Code, Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly,
      minimap: { enabled: true },
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      glyphMargin: false,
      renderWhitespace: 'selection',
      renderControlCharacters: false,
      automaticLayout: true,
    })

    // Add save shortcut (Cmd/Ctrl + S)
    if (!readOnly && onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const value = editor.getValue()
        onSave(value)
      })
    }

    // Add format shortcut (Shift + Alt + F)
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run()
      }
    )
  }, [readOnly, onSave])

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined && onChange) {
      onChange(value)
    }
  }, [onChange])

  return (
    <Editor
      height="100%"
      language={detectedLanguage}
      value={content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        contextmenu: true,
        selectOnLineNumbers: true,
        automaticLayout: true,
      }}
    />
  )
}