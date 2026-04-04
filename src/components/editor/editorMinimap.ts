/**
 * editorMinimap
 *
 * CodeMirror 6 minimap sidebar via @replit/codemirror-minimap.
 *
 * @module editorMinimap
 */

import { showMinimap } from '@replit/codemirror-minimap';
import type { Extension } from '@codemirror/state';

/** Minimap extension showing code overview on the right */
export function buildMinimapExtension(): Extension {
  return showMinimap.compute(['doc'], () => ({
    create: () => {
      const dom = document.createElement('div');
      return { dom };
    },
    displayText: 'blocks',
    showOverlay: 'always',
  }));
}
