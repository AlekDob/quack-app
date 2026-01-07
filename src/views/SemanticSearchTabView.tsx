import { useState, useCallback, useEffect } from 'react';
import type { Tab } from '../components/TabBar';
import { invoke } from '@tauri-apps/api/core';
import './SemanticSearchTabView.css';

interface SemanticSearchTabViewProps {
  tab: Tab;
  isActive: boolean;
}

interface SearchResult {
  type: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
  matchType: 'hybrid' | 'fts';
  language: string;
}

interface SearchResponse {
  success: boolean;
  query?: string;
  searchMode?: string;
  results?: SearchResult[];
  stats?: {
    totalResults: number;
    returnedResults: number;
    searchTimeMs: number;
    indexStatus?: {
      fileCount: number;
      chunkCount: number;
      embeddingCount: number;
      lastIndexed: string;
    };
  };
  error?: string;
  message?: string;
}

/**
 * Semantic code search tab view
 */
export default function SemanticSearchTabView({ tab, isActive }: SemanticSearchTabViewProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState<SearchResponse['stats'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string>('');
  const [isIndexed, setIsIndexed] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // Get current project path from tab or detect it
  useEffect(() => {
    const detectProjectPath = async () => {
      try {
        // Try to get from tab first
        if (tab.docsPath) {
          setProjectPath(tab.docsPath);
          return;
        }

        // Otherwise detect from CWD
        const cwd = await invoke<string>('get_home_directory');
        setProjectPath(cwd);
      } catch (err) {
        console.error('Failed to detect project path:', err);
      }
    };

    if (isActive) {
      detectProjectPath();
    }
  }, [isActive, tab.docsPath]);

  // Check if project is indexed
  useEffect(() => {
    const checkIndexStatus = async () => {
      if (!projectPath) return;

      try {
        const response = await invoke<string>('semantic_search_get_status', {
          projectPath,
        });

        const result = JSON.parse(response);
        if (result.success && result.indexed) {
          setIsIndexed(true);
        } else {
          setIsIndexed(false);
        }
      } catch (err) {
        console.error('Failed to check index status:', err);
        setIsIndexed(false);
      }
    };

    if (projectPath) {
      checkIndexStatus();
    }
  }, [projectPath]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !projectPath) return;

    setIsSearching(true);
    setError(null);

    try {
      // Call Tauri command for semantic search
      const response = await invoke<string>('semantic_search_code', {
        query: query.trim(),
        projectPath,
        level: null, // Optional, defaults to 'all'
        limit: null, // Optional, defaults to 10
      });

      const result: SearchResponse = JSON.parse(response);

      if (result.success && result.results) {
        setSearchResults(result.results);
        setSearchStats(result.stats || null);
      } else {
        setError(result.message || 'Search failed');
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to execute search');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, projectPath]);

  const handleIndexProject = useCallback(async () => {
    if (!projectPath) return;

    // Validate project path - avoid indexing home directory
    const homeDir = await invoke<string>('get_home_directory');
    if (projectPath === homeDir) {
      setError('Cannot index home directory. Please select a specific project folder.');
      return;
    }

    // Validate path exists and is a directory
    if (!projectPath.includes('/') && !projectPath.includes('\\')) {
      setError('Please enter a valid project path (e.g., /Users/username/projects/my-app)');
      return;
    }

    setIsIndexing(true);
    setError(null);

    try {
      // Call Tauri command to index project
      const response = await invoke<string>('semantic_search_index_project', {
        projectPath,
        patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      });

      const result = JSON.parse(response);

      if (result.success) {
        setIsIndexed(true);
        alert(`Indexed ${result.stats?.filesIndexed || 0} files successfully!`);
      } else {
        setError(result.error || result.message || 'Indexing failed');
      }
    } catch (err: any) {
      console.error('Indexing error:', err);
      setError(err.message || 'Failed to index project');
    } finally {
      setIsIndexing(false);
    }
  }, [projectPath]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleOpenFile = useCallback(async (filePath: string, line: number) => {
    try {
      await invoke('open_file_in_editor', {
        filePath,
        line,
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, []);

  if (!isActive || tab.type !== 'semantic-search') {
    return null;
  }

  return (
    <div className="semantic-search-tab-view">
      <div className="semantic-search-header">
        <div className="search-bar-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search code by meaning... (e.g., 'authentication logic')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSearching}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="project-info">
          <input
            type="text"
            className="project-path-input"
            placeholder="Enter project path..."
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            disabled={isIndexing}
          />
          {!isIndexed && (
            <button
              className="index-button"
              onClick={handleIndexProject}
              disabled={isIndexing || !projectPath}
            >
              {isIndexing ? 'Indexing...' : 'Index Project'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="search-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {searchStats && (
        <div className="search-stats">
          <span>
            {searchStats.returnedResults} results in {searchStats.searchTimeMs}ms
          </span>
          {searchStats.indexStatus && (
            <span className="index-stats">
              • {searchStats.indexStatus.fileCount} files •{' '}
              {searchStats.indexStatus.chunkCount} chunks •{' '}
              {searchStats.indexStatus.embeddingCount} embeddings
            </span>
          )}
        </div>
      )}

      <div className="search-results">
        {searchResults.length === 0 && !isSearching && !error && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>Semantic Code Search</h3>
            <p>Search your codebase by meaning, not just keywords</p>
            <ul className="features-list">
              <li>Natural language queries</li>
              <li>Understands code context</li>
              <li>Hybrid search (semantic + keyword)</li>
              <li>Fast local embeddings</li>
            </ul>
            {!isIndexed && (
              <p className="index-prompt">
                Index your project first to enable search
              </p>
            )}
          </div>
        )}

        {searchResults.map((result, index) => (
          <div
            key={index}
            className="search-result-item"
            onClick={() => handleOpenFile(result.file, result.startLine)}
          >
            <div className="result-header">
              <span className="result-type">{result.type}</span>
              <span className="result-name">{result.name}</span>
              <span className="result-score">
                {Math.round(result.score * 100)}% match
              </span>
            </div>
            <div className="result-file">
              {result.file}:{result.startLine}-{result.endLine}
            </div>
            <div className="result-content">
              <code>{result.content.substring(0, 200)}...</code>
            </div>
            <div className="result-meta">
              <span className="result-language">{result.language}</span>
              <span className="result-match-type">{result.matchType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
