#!/usr/bin/env python3
"""
Generate Strudel samples manifest JSON from a samples directory.
Usage: python3 scripts/generate-samples-manifest.py [samples_dir]
Default: website/public/samples/
"""

import json
import os
import sys
from pathlib import Path

AUDIO_EXTS = {'.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aif', '.aiff'}
WEBSITE_PUBLIC = Path(__file__).parent.parent / 'website' / 'public'
DEFAULT_SAMPLES_DIR = WEBSITE_PUBLIC / 'samples'

def crawl_samples(samples_dir):
    """Crawl samples directory and return manifest structure."""
    manifest = {}

    if not samples_dir.exists():
        print(f"Samples directory not found: {samples_dir}")
        return manifest

    # Iterate through subdirectories
    for subdir in sorted(samples_dir.iterdir()):
        if not subdir.is_dir():
            continue

        bank_name = subdir.name
        samples = []

        # Find all audio files in this subdirectory
        for file in sorted(subdir.glob('*')):
            if file.is_file() and file.suffix.lower() in AUDIO_EXTS:
                sample_name = file.stem  # filename without extension
                relative_path = f"samples/{bank_name}/{file.name}"
                samples.append({
                    "name": sample_name,
                    "url": relative_path
                })

        if samples:
            manifest[bank_name] = samples
            print(f"  {bank_name}: {len(samples)} samples")

    return manifest

def write_manifest(manifest, output_file):
    """Write manifest JSON to file."""
    with open(output_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote manifest to: {output_file}")
    print(f"Total banks: {len(manifest)}")

if __name__ == '__main__':
    samples_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SAMPLES_DIR
    samples_dir = samples_dir.resolve()

    print(f"Scanning: {samples_dir}")
    manifest = crawl_samples(samples_dir)

    if manifest:
        output = WEBSITE_PUBLIC / 'samples-manifest.json'
        write_manifest(manifest, output)
        print("\nExample usage in pattern:")
        first_bank = next(iter(manifest.keys()))
        first_sample = manifest[first_bank][0]['name']
        print(f"  samples('samples-manifest.json')")
        print(f"  s('{first_bank}:{first_sample}')")
    else:
        print("No audio files found in subdirectories.")
        print(f"Create subdirectories in {samples_dir} with .wav/.mp3/etc files.")
