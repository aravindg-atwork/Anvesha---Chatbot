"""Deterministic document labels, tags and source-grounded question suggestions."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('catalog_rules.json').read_text(encoding='utf-8'))
GENERIC = re.compile(r'^(document|table\s*\d+|image\s*\d+.*|embedded image.*|paragraph\s*\d+)$', re.I)


def describe_source(source):
    chunks = source.get('chunks', [])
    text = '\n'.join(chunk.get('text', '') for chunk in chunks)[:120000].casefold()
    title = source.get('title', 'this document')[:100]

    def matches(term):
        return re.search(r'(?<!\w)' + re.escape(term.casefold()) + r'(?!\w)', text) is not None

    ranked = [(sum(matches(term) for term in category['terms']), category['label']) for category in RULES['categories']]
    score, label = max(ranked, key=lambda value: value[0])
    if not score:
        label = {'XLSX': 'Spreadsheet', 'PPTX': 'Presentation', 'Image': 'Scanned information', 'Audio': 'Speech transcript',
                 'Video': 'Speech transcript', 'CSV': 'Table data'}.get(source.get('fileType'), 'Reference document')
    topics = [topic for topic in RULES['topics'] if any(matches(term) for term in topic['terms'])]
    headings = []
    for chunk in chunks:
        locator = chunk.get('locator', {})
        heading = locator.get('heading') if locator.get('kind') == 'section' else locator.get('sheet') if locator.get('kind') == 'sheet' else None
        if heading:
            heading = re.sub(r'^\d+(\.\d+)*\.?\s*', '', heading).strip()
            if 3 <= len(heading) <= 60 and not GENERIC.fullmatch(heading) and heading not in headings:
                headings.append(heading)
    tags = list(dict.fromkeys([label] + [topic['tag'] for topic in topics] + headings[:3]))[:8]
    questions = [f"{topic['question']} (Source: {title})" for topic in topics[:3]]
    for heading in headings:
        if len(questions) >= 4:
            break
        questions.append(f'What does "{heading}" cover in "{title}"?')
    if not questions:
        questions = [f'What information is available in "{title}"?', f'Which passages in "{title}" are relevant to my question?']
    return {'documentLabel': label, 'autoTags': tags, 'suggestedQuestions': questions[:4],
            'catalogMethod': RULES['version'], 'cataloguedAt': datetime.now(timezone.utc).isoformat()}
