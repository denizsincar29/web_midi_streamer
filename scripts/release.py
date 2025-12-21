#!/usr/bin/env python3
# /// script
# dependencies = []
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
    - Type 'END' on a new line to finish multiline input
    - Markdown will be converted to HTML automatically
    - Timestamps are added automatically
"""

import json
import re
from datetime import datetime
from pathlib import Path


def get_multiline_input(prompt):
    """Get multiline input from user, ending with 'END' on its own line"""
    print(prompt)
    print("(Type 'END' on a new line when finished)")
    lines = []
    while True:
        line = input()
        if line.strip() == 'END':
            break
        lines.append(line)
    return '\n'.join(lines)


def markdown_to_html(markdown_text):
    """Convert simple markdown to HTML"""
    html = markdown_text
    
    # Headers
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    
    # Bold
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    
    # Lists - multiline processing
    lines = html.split('\n')
    in_list = False
    result_lines = []
    
    for line in lines:
        if line.strip().startswith('- '):
            if not in_list:
                result_lines.append('<ul>')
                in_list = True
            content = line.strip()[2:]  # Remove "- "
            result_lines.append(f'<li>{content}</li>')
        else:
            if in_list:
                result_lines.append('</ul>')
                in_list = False
            if line.strip():  # Non-empty lines become paragraphs if not already HTML
                if not line.strip().startswith('<'):
                    result_lines.append(f'<p>{line}</p>')
                else:
                    result_lines.append(line)
            else:
                result_lines.append('')
    
    if in_list:
        result_lines.append('</ul>')
    
    html = '\n'.join(result_lines)
    
    # Clean up extra paragraph tags around headers
    html = re.sub(r'<p>(<h[23]>)', r'\1', html)
    html = re.sub(r'(</h[23]>)</p>', r'\1', html)
    
    return html


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
