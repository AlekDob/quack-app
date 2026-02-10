import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

const CRISP_WEBSITE_ID = '9bb89dd4-fe14-41f7-a60b-1ca54968e267';

export default function SupportChatWidget() {
  useEffect(() => {
    if (window.$crisp) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;

    document.head.appendChild(script);

    return () => {
      script.remove();
      delete window.$crisp;
      delete window.CRISP_WEBSITE_ID;
    };
  }, []);

  return null;
}
