import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { listen } from '@tauri-apps/api/event';
import BrainApp from './components/brain/BrainApp';
import './App.css';

function BrainRoot() {
  const params = new URLSearchParams(window.location.search);
  const initialPath = params.get('project') || undefined;
  const [projectPath, setProjectPath] = useState(initialPath);

  // Listen for project updates from main window
  useEffect(() => {
    const unlistenPromise = listen<{ projectPath: string }>('brain-project-update', (event) => {
      if (event.payload?.projectPath) {
        setProjectPath(event.payload.projectPath);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, []);

  return <BrainApp projectPath={projectPath} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrainRoot />
  </React.StrictMode>
);
