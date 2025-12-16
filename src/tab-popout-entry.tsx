import React from 'react';
import ReactDOM from 'react-dom/client';
import TabPopoutWindowApp from './components/TabPopoutWindowApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('tab-popout-root')!).render(
  <React.StrictMode>
    <TabPopoutWindowApp />
  </React.StrictMode>
);
