"""Local parsers and OCR. Progress is reported as real pages/images complete."""
import csv
import io
import os
import re
from pathlib import Path

import pymupdf
import pytesseract
from docx import Document
from PIL import Image, ImageOps, ImageSequence

Image.MAX_IMAGE_PIXELS = 40_000_000
EXTENSIONS = {'.pdf': 'PDF', '.docx': 'DOCX', '.txt': 'TXT', '.md': 'TXT', '.csv': 'CSV',
              '.xlsx': 'XLSX', '.pptx': 'PPTX',
              '.mp3': 'Audio', '.wav': 'Audio', '.m4a': 'Audio', '.ogg': 'Audio', '.flac': 'Audio',
              '.mp4': 'Video', '.webm': 'Video', '.mov': 'Video',
              '.png': 'Image', '.jpg': 'Image', '.jpeg': 'Image', '.webp': 'Image', '.tif': 'Image', '.tiff': 'Image', '.bmp': 'Image'}


def ocr(image):
    command = os.getenv('TESSERACT_CMD')
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
    try:
        image = ImageOps.exif_transpose(image).convert('RGB')
        if image.width * image.height > 40_000_000:
            raise ValueError('Image exceeds the 40 megapixel OCR limit.')
        return pytesseract.image_to_string(image, lang=os.getenv('OCR_LANGUAGES', 'eng'), timeout=90).strip()
    except pytesseract.TesseractNotFoundError:
        raise ValueError('OCR needs Tesseract. Use the Docker backend, which includes it, or set TESSERACT_CMD.')


def extract(path: Path, file_type: str, report):
    pages = []
    ocr_count = 0
    if file_type == 'PDF':
        with pymupdf.open(path) as doc:
            if doc.needs_pass:
                raise ValueError('This PDF is password protected. Upload an unlocked copy.')
            if len(doc) > 250:
                raise ValueError('This PDF exceeds the 250 page limit. Split it into smaller documents.')
            for i, page in enumerate(doc):
                text = page.get_text(sort=True).strip()
                # Sparse/scanned pages need OCR, including mixed text/image documents.
                if len(re.sub(r'\W', '', text)) < 40 or page.get_images():
                    report('OCR agent', 10 + int(45 * i / max(1, len(doc))), f'OCR page {i+1} of {len(doc)}')
                    pix = page.get_pixmap(dpi=180)
                    image = Image.open(io.BytesIO(pix.tobytes('png')))
                    scanned = ocr(image)
                    if len(scanned) > len(text):
                        text = scanned
                    ocr_count += 1
                pages.append((text, {'kind': 'pdf', 'pageIndex': i + 1}))
                report('Parsing agent', 10 + int(45 * (i+1) / max(1, len(doc))), f'Read page {i+1} of {len(doc)}')
    elif file_type == 'Image':
        with Image.open(path) as image:
            for i, frame in enumerate(ImageSequence.Iterator(image)):
                if i >= 50:
                    raise ValueError('This image contains more than 50 frames. Split it into smaller files.')
                report('OCR agent', min(50, 10 + i), f'Reading image {i+1}')
                pages.append((ocr(frame.copy()), {'kind': 'section', 'heading': f'Image {i+1} (OCR)', 'ordinal': i+1}))
                ocr_count += 1
    elif file_type == 'DOCX':
        doc = Document(path)
        heading = 'Document'
        lines = []
        for p in doc.paragraphs:
            if p.style and p.style.name.startswith('Heading'):
                if lines:
                    pages.append(('\n'.join(lines), {'kind': 'section', 'heading': heading, 'ordinal': len(pages)+1}))
                heading, lines = p.text, []
            elif p.text.strip():
                lines.append(p.text)
        if lines:
            pages.append(('\n'.join(lines), {'kind': 'section', 'heading': heading, 'ordinal': len(pages)+1}))
        for i, table in enumerate(doc.tables):
            text = '\n'.join(' | '.join(cell.text for cell in row.cells) for row in table.rows)
            pages.append((text, {'kind': 'section', 'heading': f'Table {i+1}', 'ordinal': len(pages)+1}))
        for relationship in doc.part.rels.values():
            if 'image' in relationship.reltype and not relationship.is_external:
                report('OCR agent', 40, 'Reading an embedded image')
                with Image.open(io.BytesIO(relationship.target_part.blob)) as image:
                    text = ocr(image)
                pages.append((text, {'kind': 'section', 'heading': 'Embedded image (OCR)', 'ordinal': len(pages)+1}))
                ocr_count += 1
    elif file_type == 'XLSX':
        from backend.office import spreadsheet
        pages = spreadsheet(path, report)
    elif file_type == 'PPTX':
        from backend.office import presentation
        pages, ocr_count = presentation(path, report, ocr)
    elif file_type in ('Audio', 'Video'):
        from backend.media import transcribe
        pages = transcribe(path, report)
    elif file_type == 'CSV':
        text = path.read_text(encoding='utf-8-sig')
        for i, row in enumerate(csv.reader(io.StringIO(text))):
            pages.append((' | '.join(row), {'kind': 'paragraph', 'ordinal': i+1}))
    else:
        text = path.read_text(encoding='utf-8-sig')
        pages = [(text, {'kind': 'paragraph', 'ordinal': 1})]
    if sum(len(text) for text, _ in pages) > 3_000_000:
        raise ValueError('Extracted text exceeds the 3 MB limit. Split this document into smaller files.')
    note = f'Read {len(pages)} page(s)/section(s) locally; OCR used on {ocr_count} image(s)/page(s).'
    if ocr_count:
        note += ' OCR may contain errors; review the extracted passages before relying on answers.'
    if file_type == 'XLSX':
        note += ' References preserve sheet names and cell ranges. Only cached formula results are read; formulas are not recalculated.'
    if file_type in ('Audio', 'Video'):
        note = 'Speech transcribed by Gemini with approximate timestamps. Media was sent to Google with your consent. Review transcription accuracy; video visuals are not indexed.'
    return pages, note


def chunk_pages(pages, source_id):
    chunks = []
    for text, locator in pages:
        text = text.replace('\x00', '').strip()
        start = 0
        while start < len(text):
            end = min(start + 1400, len(text))
            if end < len(text):
                boundary = text.rfind(' ', start + 900, end)
                if boundary > start:
                    end = boundary
            passage = text[start:end].strip()
            if passage:
                chunks.append({'id': f'{source_id}:c{len(chunks)+1}', 'sourceId': source_id, 'text': passage, 'locator': locator})
            if end >= len(text):
                break
            start = max(start + 1, end - 160)
    return chunks
