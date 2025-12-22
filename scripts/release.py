#!/usr/bin/env python3
# /// script
# dependencies = [
#   "markdown",
#   "beautifulsoup4",
# ]
# ///
"""
Release script for Web MIDI Streamer
Updates version numbers and adds changelog entries to help files

Usage:
    uv run scripts/release.py
    
This interactive script will:
1. Prompt for new version number (e.g., 1.1.0)
2. Prompt for English changelog entry (multiline markdown)
3. Prompt for Russian changelog entry (multiline markdown)
4. Update version in manifest.json
5. Update cache version in service-worker.js
6. Add changelog HTML to help-en.html
7. Add changelog HTML to help-ru.html

Note:
    - Press Enter twice within 1 second to finish multiline input
    - Markdown will be converted to HTML automatically using markdown library
    - Timestamps are added automatically
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path
import markdown
from bs4 import BeautifulSoup


def get_multiline_input(prompt):
    """Get multiline input from user, ending with double Enter press within 1 second"""
    print(prompt)
    print("(Press Enter twice within 1 second to finish)")
    lines = []
    last_empty_time = None
    
    while True:
        line = input()
        
        if line.strip() == '':
            # Empty line detected
            if last_empty_time is not None:
                # Check if less than 1 second since last empty line
                if time.time() - last_empty_time < 1.0:
                    # Double Enter detected within 1 second - end input
                    break
            last_empty_time = time.time()
            lines.append(line)
        else:
            # Non-empty line - reset timer
            last_empty_time = None
            lines.append(line)
    
    # Remove trailing empty lines
    while lines and lines[-1].strip() == '':
        lines.pop()
    
    return '\n'.join(lines)


def markdown_to_html(markdown_text):
    """Convert markdown to HTML using markdown library"""
    # Convert markdown to HTML
    html = markdown.markdown(
        markdown_text,
        extensions=['extra', 'nl2br']
    )
    
    # Use BeautifulSoup to clean up and format the HTML
    soup = BeautifulSoup(html, 'html.parser')
    
    # Return formatted HTML (prettified but on single line per tag for compactness)
    return str(soup)


def update_manifest_version(manifest_path, new_version):
    """Update version in manifest.json"""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    old_version = manifest.get('version', 'unknown')
    manifest['version'] = new_version
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')  # Add final newline
    
    return old_version


def update_service_worker_cache(sw_path, new_version):
    """Update cache version in service-worker.js"""
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and update cache name
    pattern = r"const CACHE_NAME = 'midi-streamer-v[\d\.]+';"
    replacement = f"const CACHE_NAME = 'midi-streamer-v{new_version}';"
    
    new_content = re.sub(pattern, replacement, content)
    
    with open(sw_path, 'w', encoding='utf-8') as f:
        f.write(new_content)


def update_help_file(help_path, new_version, changelog_html, lang):
    """Update help file with new changelog entry"""
    with open(help_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create timestamp
    timestamp = datetime.now().strftime('%B %Y')
    
    # Create changelog entry HTML
    changelog_entry = f'''                    <h3>Version {new_version} - {timestamp}</h3>
{changelog_html}
                    
                    '''
    
    # Find the "What's New" section and insert after version info
    # Look for the pattern with version information
    if lang == 'en':
        version_pattern = r'(<section class="help-step">\s*<h2>Version Information</h2>\s*<p><strong>Version [\d\.]+</strong>[^<]*</p>\s*<p>[^<]*</p>\s*)'
        new_section_start = '''<section class="help-step">
                    <h2>Version Information</h2>
                    <p><strong>Version ''' + new_version + '''</strong> - ''' + timestamp + '''</p>
                    <p>Latest release with new features and improvements!</p>
                    
                    '''
    else:  # Russian
        version_pattern = r'(<section class="help-step">\s*<h2>Информация о версии</h2>\s*<p><strong>Версия [\d\.]+</strong>[^<]*</p>\s*<p>[^<]*</p>\s*)'
        new_section_start = '''<section class="help-step">
                    <h2>Информация о версии</h2>
                    <p><strong>Версия ''' + new_version + '''</strong> - ''' + timestamp + '''</p>
                    <p>Последний релиз с новыми функциями и улучшениями!</p>
                    
                    '''
    
    # Replace version information and inject changelog
    content = re.sub(
        version_pattern,
        new_section_start + changelog_entry,
        content,
        count=1
    )
    
    with open(help_path, 'w', encoding='utf-8') as f:
        f.write(content)


def main():
    # Get base path (parent of scripts directory)
    base_path = Path(__file__).parent.parent
    
    print("=" * 60)
    print("Web MIDI Streamer Release Script")
    print("=" * 60)
    print()
    
    # Get version number
    new_version = input("Enter new version number (e.g., 1.1.0): ").strip()
    if not re.match(r'^\d+\.\d+\.\d+$', new_version):
        print("Error: Invalid version format. Use X.Y.Z format.")
        return 1
    
    print()
    
    # Get English changelog
    print("Enter English changelog (markdown format):")
    en_changelog = get_multiline_input("")
    print()
    
    # Get Russian changelog
    print("Enter Russian changelog (markdown format):")
    ru_changelog = get_multiline_input("")
    print()
    
    # Convert markdown to HTML
    en_html = markdown_to_html(en_changelog)
    ru_html = markdown_to_html(ru_changelog)
    
    # Update files
    print("Updating files...")
    print()
    
    manifest_path = base_path / 'manifest.json'
    sw_path = base_path / 'service-worker.js'
    help_en_path = base_path / 'help-en.html'
    help_ru_path = base_path / 'help-ru.html'
    
    # Update manifest.json
    old_version = update_manifest_version(manifest_path, new_version)
    print(f"✓ Updated manifest.json: {old_version} → {new_version}")
    
    # Update service-worker.js
    update_service_worker_cache(sw_path, new_version)
    print(f"✓ Updated service-worker.js cache version to v{new_version}")
    
    # Update help files
    update_help_file(help_en_path, new_version, en_html, 'en')
    print("✓ Updated help-en.html with changelog")
    
    update_help_file(help_ru_path, new_version, ru_html, 'ru')
    print("✓ Updated help-ru.html with changelog")
    
    print()
    print("=" * 60)
    print("Release preparation complete!")
    print("=" * 60)
    print()
    print("Modified files:")
    print(f"  - {manifest_path.relative_to(base_path)}")
    print(f"  - {sw_path.relative_to(base_path)}")
    print(f"  - {help_en_path.relative_to(base_path)}")
    print(f"  - {help_ru_path.relative_to(base_path)}")
    print()
    print("Next steps:")
    print("  1. Review the changes")
    print("  2. Commit with message: f'Release v{new_version}'")
    print("  3. Tag the release: git tag v{new_version}")
    print("  4. Push: git push && git push --tags")
    
    return 0


if __name__ == '__main__':
    exit(main())
