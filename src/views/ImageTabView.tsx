import { memo, useState, useRef, useCallback, useEffect } from 'react';
import type { Tab } from '../components/TabBar';
import './ImageTabView.css';

interface ImageTabViewProps {
  tab: Tab;
  isActive: boolean;
}

function ImageTabView({ tab, isActive }: ImageTabViewProps) {
  if (!isActive || tab.type !== 'image') return null;

  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const imageSrc = tab.imageData
    ? `data:${tab.mediaType || 'image/png'};base64,${tab.imageData}`
    : tab.filePath || '';

  const fileName = tab.filePath ? tab.filePath.split('/').pop() || 'Image' : tab.label;

  // Load image dimensions
  useEffect(() => {
    if (imageSrc && imageRef.current) {
      const img = imageRef.current;
      const handleLoad = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
      };
      if (img.complete) {
        handleLoad();
      } else {
        img.addEventListener('load', handleLoad);
        return () => img.removeEventListener('load', handleLoad);
      }
    }
  }, [imageSrc]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 400));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25));
  }, []);

  const handleZoomFit = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomActual = useCallback(() => {
    if (containerRef.current && imageLoaded) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const actualZoom = Math.min(
        (containerWidth / imageDimensions.width) * 100,
        (containerHeight / imageDimensions.height) * 100,
        100
      );
      setZoom(actualZoom);
      setPan({ x: 0, y: 0 });
    }
  }, [imageDimensions, imageLoaded]);

  // Pan controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 100) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomFit();
      } else if (e.key === '1') {
        e.preventDefault();
        handleZoomActual();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleZoomIn, handleZoomOut, handleZoomFit, handleZoomActual]);

  // Download handler
  const handleDownload = useCallback(() => {
    if (imageSrc) {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = fileName;
      link.click();
    }
  }, [imageSrc, fileName]);

  // Format file size
  const formatFileSize = (base64: string): string => {
    const bytes = Math.ceil((base64.length * 3) / 4);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="image-tab-view">
      {/* Toolbar */}
      <div className="image-toolbar">
        <div className="image-info">
          <span className="image-filename">{fileName}</span>
          {imageLoaded && (
            <>
              <span className="image-meta">{imageDimensions.width} × {imageDimensions.height}</span>
              {tab.imageData && <span className="image-meta">{formatFileSize(tab.imageData)}</span>}
            </>
          )}
        </div>
        <div className="image-controls">
          <button onClick={handleZoomOut} disabled={zoom <= 25} title="Zoom out (-)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 8a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5A.5.5 0 015 8z"/>
              <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l2.315 2.315a1 1 0 01-1.415 1.414l-2.315-2.315A6 6 0 012 8z"/>
            </svg>
          </button>
          <span className="zoom-level">{zoom}%</span>
          <button onClick={handleZoomIn} disabled={zoom >= 400} title="Zoom in (+)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.5a.5.5 0 01.5.5v2.5H11a.5.5 0 010 1H8.5V11a.5.5 0 01-1 0V8.5H5a.5.5 0 010-1h2.5V5a.5.5 0 01.5-.5z"/>
              <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l2.315 2.315a1 1 0 01-1.415 1.414l-2.315-2.315A6 6 0 012 8z"/>
            </svg>
          </button>
          <button onClick={handleZoomFit} title="Fit to view (0)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1a.5.5 0 00-.5.5v4a.5.5 0 01-1 0v-4A1.5 1.5 0 011.5 0h4a.5.5 0 010 1h-4zM10 .5a.5.5 0 01.5-.5h4A1.5 1.5 0 0116 1.5v4a.5.5 0 01-1 0v-4a.5.5 0 00-.5-.5h-4a.5.5 0 01-.5-.5zM.5 10a.5.5 0 01.5.5v4a.5.5 0 00.5.5h4a.5.5 0 010 1h-4A1.5 1.5 0 010 14.5v-4a.5.5 0 01.5-.5zm15 0a.5.5 0 01.5.5v4a1.5 1.5 0 01-1.5 1.5h-4a.5.5 0 010-1h4a.5.5 0 00.5-.5v-4a.5.5 0 01.5-.5z"/>
            </svg>
          </button>
          <button onClick={handleZoomActual} title="Actual size (1)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.255 5.786a.237.237 0 00.241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 00.25.246h.811a.25.25 0 00.25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button onClick={handleDownload} title="Download image">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="image-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="image-wrapper"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt={fileName}
            style={{
              width: `${zoom}%`,
              maxWidth: 'none',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ImageTabView);
