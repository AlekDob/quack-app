#!/usr/bin/env python3
"""
Copy Images to Public Folder

This script copies all images from a source directory to the public folder,
maintaining the directory structure. Useful for Tauri + Vite projects where
images must be in public/ to work in production builds.

Usage:
    python copy_images_to_public.py <source_dir> <dest_dir>
    python copy_images_to_public.py images/ public/images/
"""

import sys
import os
import shutil
from pathlib import Path
from typing import List, Tuple

# Supported image extensions
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'}


def find_images(source_dir: Path) -> List[Path]:
    """Find all image files in source directory recursively."""
    images = []
    for file in source_dir.rglob('*'):
        if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(file)
    return images


def copy_images(source_dir: Path, dest_dir: Path, dry_run: bool = False) -> Tuple[int, int]:
    """
    Copy images from source to destination, maintaining directory structure.

    Returns:
        Tuple of (copied_count, skipped_count)
    """
    images = find_images(source_dir)

    if not images:
        print(f"⚠️  No images found in {source_dir}")
        return 0, 0

    print(f"📸 Found {len(images)} images in {source_dir}")

    copied = 0
    skipped = 0

    for img in images:
        # Calculate relative path
        rel_path = img.relative_to(source_dir)
        dest_file = dest_dir / rel_path

        # Check if file already exists and is identical
        if dest_file.exists():
            if dest_file.stat().st_size == img.stat().st_size:
                print(f"⏭️  Skip (exists): {rel_path}")
                skipped += 1
                continue

        if dry_run:
            print(f"🔍 Would copy: {rel_path}")
            copied += 1
        else:
            # Create destination directory if needed
            dest_file.parent.mkdir(parents=True, exist_ok=True)

            # Copy file
            shutil.copy2(img, dest_file)
            print(f"✅ Copied: {rel_path}")
            copied += 1

    return copied, skipped


def main():
    if len(sys.argv) < 3:
        print("Usage: python copy_images_to_public.py <source_dir> <dest_dir> [--dry-run]")
        print("\nExample:")
        print("  python copy_images_to_public.py images/ public/images/")
        print("  python copy_images_to_public.py images/ public/images/ --dry-run")
        sys.exit(1)

    source_dir = Path(sys.argv[1])
    dest_dir = Path(sys.argv[2])
    dry_run = '--dry-run' in sys.argv

    if not source_dir.exists():
        print(f"❌ Source directory not found: {source_dir}")
        sys.exit(1)

    if not source_dir.is_dir():
        print(f"❌ Source is not a directory: {source_dir}")
        sys.exit(1)

    print("🚀 Image Copy Tool")
    print("=" * 50)
    print(f"📂 Source: {source_dir.absolute()}")
    print(f"📁 Destination: {dest_dir.absolute()}")
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be copied")
    print("=" * 50)
    print()

    copied, skipped = copy_images(source_dir, dest_dir, dry_run)

    print()
    print("=" * 50)
    print(f"✅ Copied: {copied}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"📊 Total: {copied + skipped}")

    if dry_run:
        print()
        print("🔍 This was a dry run. Run without --dry-run to actually copy files.")


if __name__ == '__main__':
    main()
