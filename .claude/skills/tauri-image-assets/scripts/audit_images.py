#!/usr/bin/env python3
"""
Image Assets Audit Tool

Scans a project's source code to find all image references and checks if they
exist in the public folder. Useful for diagnosing broken images in production builds.

Usage:
    python audit_images.py <project_root>
    python audit_images.py /path/to/project
"""

import sys
import re
from pathlib import Path
from typing import Set, Dict, List
from collections import defaultdict

# Image extensions to look for
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'}

# Source file extensions to scan
SOURCE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.vue', '.html'}


def extract_image_paths(content: str) -> Set[str]:
    """Extract image paths from source code."""
    paths = set()

    # Match patterns like: '/images/...' or './images/...' or '../images/...'
    patterns = [
        r'[\'"`](/images/[^\'"` $]+\.(?:png|jpg|jpeg|gif|svg|webp|ico))[\'"`]',
        r'[\'"`](\.\.?/images/[^\'"` $]+\.(?:png|jpg|jpeg|gif|svg|webp|ico))[\'"`]',
        # Match import statements
        r'import\s+\w+\s+from\s+[\'"`]([^\'"` $]+\.(?:png|jpg|jpeg|gif|svg|webp|ico))[\'"`]',
        # Match require statements
        r'require\([\'"`]([^\'"` $]+\.(?:png|jpg|jpeg|gif|svg|webp|ico))[\'"`]\)',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            # Skip template strings with variables
            if '${' not in match:
                paths.add(match)

    return paths


def scan_source_files(src_dir: Path) -> Dict[str, Set[str]]:
    """Scan source files for image references."""
    image_refs = defaultdict(set)

    # Skip common directories
    skip_dirs = {'node_modules', 'dist', 'build', 'target', '.git', '.next', '__pycache__'}

    for file in src_dir.rglob('*'):
        # Skip directories we don't want to scan
        if any(skip in file.parts for skip in skip_dirs):
            continue

        if file.is_file() and file.suffix in SOURCE_EXTENSIONS:
            try:
                content = file.read_text(encoding='utf-8')
                paths = extract_image_paths(content)
                if paths:
                    rel_path = str(file.relative_to(src_dir))
                    image_refs[rel_path] = paths
            except Exception as e:
                print(f"⚠️  Could not read {file}: {e}")

    return image_refs


def check_image_in_public(public_dir: Path, image_path: str) -> bool:
    """Check if an image exists in the public folder."""
    # Remove leading slash and resolve to public folder
    clean_path = image_path.lstrip('/')
    public_path = public_dir / clean_path
    return public_path.exists()


def get_all_public_images(public_dir: Path) -> Set[str]:
    """Get all images from public folder."""
    images = set()

    if not public_dir.exists():
        return images

    for file in public_dir.rglob('*'):
        if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS:
            rel_path = '/' + str(file.relative_to(public_dir))
            images.add(rel_path)

    return images


def main():
    if len(sys.argv) < 2:
        print("Usage: python audit_images.py <project_root>")
        print("\nExample:")
        print("  python audit_images.py /path/to/project")
        print("  python audit_images.py .")
        sys.exit(1)

    project_root = Path(sys.argv[1]).resolve()

    if not project_root.exists():
        print(f"❌ Project root not found: {project_root}")
        sys.exit(1)

    src_dir = project_root / 'src'
    public_dir = project_root / 'public'

    if not src_dir.exists():
        print(f"❌ Source directory not found: {src_dir}")
        sys.exit(1)

    print("🔍 IMAGE ASSETS AUDIT")
    print("=" * 70)
    print(f"📂 Project: {project_root}")
    print(f"📁 Source: {src_dir}")
    print(f"📁 Public: {public_dir}")
    print("=" * 70)
    print()

    # Scan source files
    print("🔎 Scanning source files...")
    image_refs = scan_source_files(src_dir)

    if not image_refs:
        print("✅ No image references found in source code")
        return

    # Get all referenced paths
    all_paths = set()
    for paths in image_refs.values():
        all_paths.update(paths)

    # Get all public images
    public_images = get_all_public_images(public_dir)

    # Check which images are missing
    missing_images = []
    for path in all_paths:
        # Normalize path
        normalized_path = path
        if path.startswith('./') or path.startswith('../'):
            normalized_path = '/' + path.lstrip('./')

        if not check_image_in_public(public_dir, normalized_path):
            # Find which files reference this image
            refs = [file for file, paths in image_refs.items() if path in paths]
            missing_images.append((normalized_path, refs))

    # Print results
    print(f"\n📊 SUMMARY")
    print("=" * 70)
    print(f"📄 Files scanned: {len(image_refs)}")
    print(f"🖼️  Images in public/: {len(public_images)}")
    print(f"🔗 Unique image references: {len(all_paths)}")
    print(f"❌ Missing images: {len(missing_images)}")
    print()

    if missing_images:
        print("❌ MISSING IMAGES IN PUBLIC FOLDER:")
        print("-" * 70)
        for img_path, refs in missing_images:
            print(f"\n📸 {img_path}")
            print(f"   Referenced in:")
            for ref in refs:
                print(f"   - {ref}")
        print()
        print("⚠️  These images will NOT work in production build!")
        print("💡 Run: python scripts/copy_images_to_public.py <source> public/")
        sys.exit(1)
    else:
        print("✅ ALL IMAGES FOUND IN PUBLIC FOLDER!")
        print("🎉 Production build should work correctly")

    # List top files with most image references
    if image_refs:
        print(f"\n📄 TOP FILES WITH IMAGE REFERENCES:")
        print("-" * 70)
        sorted_files = sorted(image_refs.items(), key=lambda x: len(x[1]), reverse=True)[:5]
        for file, paths in sorted_files:
            print(f"   {file}: {len(paths)} images")


if __name__ == '__main__':
    main()
