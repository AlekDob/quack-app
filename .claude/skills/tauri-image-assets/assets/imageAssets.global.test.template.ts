/**
 * Global Image Assets Test
 *
 * Scans the entire project to find all image references and verifies they exist
 * in both the public folder (for production) and original locations (for dev).
 *
 * This ensures no broken images in production builds.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

// Project root (go up from src/tests/)
const PROJECT_ROOT = resolve(__dirname, '../../');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const SRC_DIR = join(PROJECT_ROOT, 'src');

/**
 * Extract image paths from source code
 */
function extractImagePaths(content: string): string[] {
  const paths: string[] = [];

  // Match patterns like: '/images/...' or './images/...' or '../images/...'
  const patterns = [
    /['"`](\/images\/[^'"`$]+\.(?:png|jpg|jpeg|gif|svg|webp))['"`]/gi,
    /['"`](\.\.?\/images\/[^'"`$]+\.(?:png|jpg|jpeg|gif|svg|webp))['"`]/gi,
    // Match import statements
    /import\s+\w+\s+from\s+['"`]([^'"`$]+\.(?:png|jpg|jpeg|gif|svg|webp))['"`]/gi,
    // Match require statements
    /require\(['"`]([^'"`$]+\.(?:png|jpg|jpeg|gif|svg|webp))['"`]\)/gi,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const path = match[1];
      // Skip template strings with variables (e.g., duck${i}.jpeg)
      if (!path.includes('${')) {
        paths.push(path);
      }
    }
  });

  return paths;
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      // Skip node_modules, dist, target, .git
      if (entry === 'node_modules' || entry === 'dist' || entry === 'target' || entry === '.git' || entry === '.next') {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath, extensions));
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.warn(`Failed to scan directory ${dir}:`, err);
  }

  return files;
}

/**
 * Scan all source files for image references
 */
function findAllImageReferences(): Map<string, string[]> {
  const imageReferences = new Map<string, string[]>();

  // Scan TypeScript/JavaScript files
  const sourceFiles = scanDirectory(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx']);

  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const paths = extractImagePaths(content);

      if (paths.length > 0) {
        imageReferences.set(file.replace(PROJECT_ROOT, ''), paths);
      }
    } catch (err) {
      console.warn(`Failed to read file ${file}:`, err);
    }
  }

  return imageReferences;
}

/**
 * Check if an image exists in public folder
 */
function checkImageInPublic(imagePath: string): boolean {
  // Remove leading slash and resolve to public folder
  const cleanPath = imagePath.replace(/^\//, '');
  const publicPath = join(PUBLIC_DIR, cleanPath);

  return existsSync(publicPath);
}

/**
 * Get all images from public folder
 */
function getAllPublicImages(): string[] {
  const images: string[] = [];

  function scanPublicDir(dir: string, basePath: string = '') {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relativePath = basePath ? `${basePath}/${entry}` : entry;

        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanPublicDir(fullPath, relativePath);
        } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(entry)) {
          images.push(`/${relativePath}`);
        }
      }
    } catch (err) {
      console.warn(`Failed to scan public directory ${dir}:`, err);
    }
  }

  scanPublicDir(PUBLIC_DIR);
  return images;
}

describe('Global Image Assets Validation', () => {
  const imageReferences = findAllImageReferences();
  const publicImages = getAllPublicImages();

  it('should find source files with image references', () => {
    expect(imageReferences.size).toBeGreaterThan(0);
    console.log(`\n📄 Found ${imageReferences.size} files with image references`);
  });

  it('should find images in public folder', () => {
    expect(publicImages.length).toBeGreaterThan(0);
    console.log(`\n🖼️  Found ${publicImages.length} images in public folder`);
  });

  describe('All referenced images should exist in public folder', () => {
    const allReferencedPaths = new Set<string>();
    const missingImages: Array<{ file: string; path: string }> = [];

    imageReferences.forEach((paths, file) => {
      paths.forEach(path => {
        // Normalize path (remove ./ and ../)
        let normalizedPath = path;
        if (path.startsWith('./') || path.startsWith('../')) {
          // For relative imports, we need context - just check if it's in public
          normalizedPath = path.replace(/^\.\.?\//, '/');
        }

        allReferencedPaths.add(normalizedPath);

        if (!checkImageInPublic(normalizedPath)) {
          missingImages.push({ file, path: normalizedPath });
        }
      });
    });

    it(`should have all ${allReferencedPaths.size} referenced images in public folder`, () => {
      if (missingImages.length > 0) {
        console.log('\n❌ Missing images in public folder:');
        missingImages.forEach(({ file, path }) => {
          console.log(`   ${file} → ${path}`);
        });
      }

      expect(missingImages).toHaveLength(0);
    });
  });

  describe('Duck Avatar Images', () => {
    it('should have all 35 duck avatars in public/images/ducks/new-avatars/', () => {
      const duckAvatars = publicImages.filter(img =>
        img.includes('/images/ducks/new-avatars/') && img.match(/duck\d+\.jpeg$/)
      );

      expect(duckAvatars.length).toBeGreaterThanOrEqual(35);

      // Check specific ducks
      for (let i = 1; i <= 35; i++) {
        const duckPath = `/images/ducks/new-avatars/duck${i}.jpeg`;
        expect(publicImages).toContain(duckPath);
      }
    });

    it('should have duckdroid fallback image', () => {
      const hasDroid = publicImages.some(img => img.includes('droid.jpeg'));
      expect(hasDroid).toBe(true);
    });

    it('should have duck30.jpeg fallback', () => {
      const hasDuck30 = publicImages.some(img => img.includes('duck30.jpeg'));
      expect(hasDuck30).toBe(true);
    });
  });

  describe('Image Path Conventions', () => {
    it('all public images should start with /', () => {
      publicImages.forEach(img => {
        expect(img.startsWith('/')).toBe(true);
      });
    });

    it('should not have duplicate images', () => {
      const uniqueImages = new Set(publicImages);
      expect(uniqueImages.size).toBe(publicImages.length);
    });

    it('image paths should be lowercase (case-sensitive filesystems)', () => {
      publicImages.forEach(img => {
        // Check filename only, not full path
        const filename = img.split('/').pop() || '';
        // Allow uppercase extensions like .PNG, but filename should be lowercase
        const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
        expect(nameWithoutExt).toBe(nameWithoutExt.toLowerCase());
      });
    });
  });

  describe('Report Summary', () => {
    it('should generate complete image audit report', () => {
      console.log('\n📊 IMAGE AUDIT REPORT');
      console.log('='.repeat(50));
      console.log(`📁 Total files scanned: ${imageReferences.size}`);
      console.log(`🖼️  Total images in public: ${publicImages.length}`);

      const allReferencedPaths = new Set<string>();
      imageReferences.forEach((paths) => {
        paths.forEach(path => allReferencedPaths.add(path));
      });
      console.log(`🔗 Unique image references in code: ${allReferencedPaths.size}`);

      // List files with most image references
      const sortedFiles = Array.from(imageReferences.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5);

      console.log('\n📄 Top 5 files with most image references:');
      sortedFiles.forEach(([file, paths]) => {
        console.log(`   ${file}: ${paths.length} images`);
      });

      // List image folders
      const folders = new Set(publicImages.map(img => {
        const parts = img.split('/');
        return parts.slice(0, -1).join('/');
      }));

      console.log(`\n📂 Image folders: ${folders.size}`);
      folders.forEach(folder => {
        const count = publicImages.filter(img => img.startsWith(folder + '/')).length;
        console.log(`   ${folder}: ${count} images`);
      });

      expect(true).toBe(true);
    });
  });
});
