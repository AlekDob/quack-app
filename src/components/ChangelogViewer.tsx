import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { fetchAllReleases, type GitHubRelease } from '../services/githubReleases';
import { getCurrentVersion, getBaseVersion } from '../utils/version';

interface ChangelogViewerProps {
  maxReleases?: number; // Maximum number of releases to show (default: 10)
}

export default function ChangelogViewer({ maxReleases = 10 }: ChangelogViewerProps) {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [loading, setLoading] = useState(true);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const currentVersionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadReleases = async () => {
      setLoading(true);
      try {
        const current = await getCurrentVersion();
        setCurrentVersion(current);

        const allReleases = await fetchAllReleases(maxReleases);
        if (allReleases) {
          setReleases(allReleases);

          // Auto-expand current version
          const currentRelease = allReleases.find(
            (r) => getBaseVersion(r.tag_name) === `v${current}`
          );
          if (currentRelease) {
            setExpandedReleases(new Set([currentRelease.tag_name]));
          }
        }
      } catch (error) {
        console.error('Error loading changelog:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReleases();
  }, [maxReleases]);

  // Scroll to current version on mount
  useEffect(() => {
    if (!loading && currentVersionRef.current) {
      setTimeout(() => {
        currentVersionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading]);

  const toggleExpand = (tagName: string) => {
    setExpandedReleases((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
        <svg
          style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <div>Loading changelog...</div>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
        <div style={{ fontSize: '14px' }}>No releases found</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {releases.map((release) => {
        const isExpanded = expandedReleases.has(release.tag_name);
        const isCurrent = getBaseVersion(release.tag_name) === `v${currentVersion}`;

        return (
          <div
            key={release.tag_name}
            ref={isCurrent ? currentVersionRef : null}
            style={{
              background: isCurrent
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)'
                : 'rgba(255, 255, 255, 0.03)',
              border: isCurrent ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            {/* Header */}
            <button
              onClick={() => toggleExpand(release.tag_name)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'white',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: isCurrent ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  {release.name || release.tag_name}
                </div>
                {isCurrent && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                      fontWeight: 600,
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    CURRENT
                  </span>
                )}
                {release.prerelease && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(251, 191, 36, 0.2)',
                      color: '#fbbf24',
                      fontWeight: 600,
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                    }}
                  >
                    PRE-RELEASE
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  {formatDate(release.published_at)}
                </span>
                <svg
                  style={{
                    width: '16px',
                    height: '16px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {/* Body - Release Notes */}
            {isExpanded && (
              <div
                style={{
                  padding: '0 16px 16px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  animation: 'slideDown 0.2s ease-out',
                }}
              >
                {release.body ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      marginTop: '12px',
                    }}
                  >
                    {release.body}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontStyle: 'italic',
                      marginTop: '12px',
                    }}
                  >
                    No release notes available
                  </div>
                )}

                {/* Download Links */}
                {release.assets.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginBottom: '8px',
                      }}
                    >
                      Downloads:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {release.assets.map((asset) => (
                        <button
                          key={asset.name}
                          onClick={() => open(asset.browser_download_url)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          <span>{asset.name}</span>
                          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            {(asset.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View on GitHub Link */}
                <button
                  onClick={() => open(release.html_url)}
                  style={{
                    marginTop: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <svg
                    style={{ width: '14px', height: '14px' }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  View on GitHub
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
