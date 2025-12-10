/**
 * ANSI Code Parser
 *
 * Converts ANSI escape codes to styled HTML for terminal output display.
 * Supports colors, bold, italic, underline, and reset codes.
 */

// ANSI color codes mapping
const ANSI_COLORS: Record<number, string> = {
  // Standard colors (foreground)
  30: '#1e1e1e', // Black
  31: '#e74c3c', // Red
  32: '#2ecc71', // Green
  33: '#f1c40f', // Yellow
  34: '#3498db', // Blue
  35: '#9b59b6', // Magenta
  36: '#1abc9c', // Cyan
  37: '#ecf0f1', // White
  // Bright colors (foreground)
  90: '#7f8c8d', // Bright Black (Gray)
  91: '#ff6b6b', // Bright Red
  92: '#5dff7a', // Bright Green
  93: '#ffd93d', // Bright Yellow
  94: '#74b9ff', // Bright Blue
  95: '#d4a5ff', // Bright Magenta
  96: '#81ecec', // Bright Cyan
  97: '#ffffff', // Bright White
  // Background colors
  40: '#1e1e1e',
  41: '#e74c3c',
  42: '#2ecc71',
  43: '#f1c40f',
  44: '#3498db',
  45: '#9b59b6',
  46: '#1abc9c',
  47: '#ecf0f1',
  // Bright background
  100: '#7f8c8d',
  101: '#ff6b6b',
  102: '#5dff7a',
  103: '#ffd93d',
  104: '#74b9ff',
  105: '#d4a5ff',
  106: '#81ecec',
  107: '#ffffff',
};

// 256-color palette (simplified - common terminal colors)
function get256Color(code: number): string {
  // Standard colors (0-7)
  if (code < 8) {
    return ANSI_COLORS[30 + code] || '#ffffff';
  }
  // Bright colors (8-15)
  if (code < 16) {
    return ANSI_COLORS[90 + (code - 8)] || '#ffffff';
  }
  // 216 color cube (16-231)
  if (code < 232) {
    const n = code - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    return `rgb(${r * 51}, ${g * 51}, ${b * 51})`;
  }
  // Grayscale (232-255)
  const gray = (code - 232) * 10 + 8;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

interface ParsedSegment {
  text: string;
  styles: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
}

/**
 * Parse ANSI escape codes and return styled segments
 */
export function parseAnsi(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Current style state
  let currentStyles: ParsedSegment['styles'] = {};

  // ANSI escape sequence regex
  // Matches: \x1b[ followed by numbers separated by ; and ending with m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let lastIndex = 0;
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textSegment = text.slice(lastIndex, match.index);
      if (textSegment) {
        segments.push({
          text: textSegment,
          styles: { ...currentStyles },
        });
      }
    }

    // Parse the escape codes
    const codes = match[1].split(';').map(c => parseInt(c, 10) || 0);

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];

      switch (code) {
        // Reset
        case 0:
          currentStyles = {};
          break;

        // Bold
        case 1:
          currentStyles.fontWeight = 'bold';
          break;

        // Dim (faint)
        case 2:
          currentStyles.color = currentStyles.color || 'rgba(255,255,255,0.6)';
          break;

        // Italic
        case 3:
          currentStyles.fontStyle = 'italic';
          break;

        // Underline
        case 4:
          currentStyles.textDecoration = 'underline';
          break;

        // Normal intensity
        case 22:
          delete currentStyles.fontWeight;
          break;

        // Not italic
        case 23:
          delete currentStyles.fontStyle;
          break;

        // Not underlined
        case 24:
          delete currentStyles.textDecoration;
          break;

        // Foreground colors (30-37, 90-97)
        case 30: case 31: case 32: case 33:
        case 34: case 35: case 36: case 37:
        case 90: case 91: case 92: case 93:
        case 94: case 95: case 96: case 97:
          currentStyles.color = ANSI_COLORS[code];
          break;

        // Default foreground
        case 39:
          delete currentStyles.color;
          break;

        // Background colors (40-47, 100-107)
        case 40: case 41: case 42: case 43:
        case 44: case 45: case 46: case 47:
        case 100: case 101: case 102: case 103:
        case 104: case 105: case 106: case 107:
          currentStyles.backgroundColor = ANSI_COLORS[code];
          break;

        // Default background
        case 49:
          delete currentStyles.backgroundColor;
          break;

        // 256-color foreground: 38;5;n
        case 38:
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            currentStyles.color = get256Color(codes[i + 2]);
            i += 2;
          } else if (codes[i + 1] === 2 && codes.length >= i + 5) {
            // True color: 38;2;r;g;b
            currentStyles.color = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
            i += 4;
          }
          break;

        // 256-color background: 48;5;n
        case 48:
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            currentStyles.backgroundColor = get256Color(codes[i + 2]);
            i += 2;
          } else if (codes[i + 1] === 2 && codes.length >= i + 5) {
            // True color: 48;2;r;g;b
            currentStyles.backgroundColor = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
            i += 4;
          }
          break;

        default:
          // Unknown code, ignore
          break;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      segments.push({
        text: remaining,
        styles: { ...currentStyles },
      });
    }
  }

  return segments;
}

/**
 * Strip all ANSI codes from text
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Convert ANSI text to HTML string with inline styles
 */
export function ansiToHtml(text: string): string {
  const segments = parseAnsi(text);

  return segments.map(segment => {
    const styleArr: string[] = [];

    if (segment.styles.color) {
      styleArr.push(`color: ${segment.styles.color}`);
    }
    if (segment.styles.backgroundColor) {
      styleArr.push(`background-color: ${segment.styles.backgroundColor}`);
    }
    if (segment.styles.fontWeight) {
      styleArr.push(`font-weight: ${segment.styles.fontWeight}`);
    }
    if (segment.styles.fontStyle) {
      styleArr.push(`font-style: ${segment.styles.fontStyle}`);
    }
    if (segment.styles.textDecoration) {
      styleArr.push(`text-decoration: ${segment.styles.textDecoration}`);
    }

    // Escape HTML
    const escapedText = segment.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (styleArr.length > 0) {
      return `<span style="${styleArr.join('; ')}">${escapedText}</span>`;
    }

    return escapedText;
  }).join('');
}
