import React from 'react';
import ReactDOM from 'react-dom/client';
import BrainApp from './components/brain/BrainApp';
import './App.css';

function BrainRoot() {
  const params = new URLSearchParams(window.location.search);
  const projectPath = params.get('project') || undefined;

  return <BrainApp projectPath={projectPath} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrainRoot />
  </React.StrictMode>
);
