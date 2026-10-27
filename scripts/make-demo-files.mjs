// Generates the fictional sample files offered in the demo launcher (public/sample-files).
// Run with: npm run demo-files
import { writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';

const OUT = new URL('../public/sample-files/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function wrap(text, font, size, width) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// ── Handbook PDF with printed page labels: i, ii, then 1, 2, 3 ──────────────
async function handbook() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = [
    { label: 'i', title: 'VayuTech Employee Handbook', body: 'Fictional sample document for the Anvesha demonstration.\nEdition 2025.' },
    { label: 'ii', title: 'Contents', body: 'Working hours ... 1\nRemote work ... 2\nExpense claims ... 3' },
    {
      label: '1',
      title: 'Working hours',
      body: 'Standard working hours are 9:30 to 18:00, Monday to Friday, with a one-hour lunch break. Core collaboration hours are 11:00 to 16:00, when employees should be available for meetings.',
    },
    {
      label: '2',
      title: 'Remote work',
      body: 'Employees may work remotely up to 2 days per week with their manager’s agreement. Remote work is not available during the first month of employment. Employees working remotely must be reachable during core collaboration hours.',
    },
    {
      label: '3',
      title: 'Expense claims',
      body: 'Business expenses must be claimed within 30 days through the HR portal, with receipts attached. Claims above ₹10,000 need approval from a department head before submission.'.replace('₹', 'Rs. '),
    },
  ];
  for (const p of pages) {
    const page = doc.addPage([595, 842]);
    page.drawText(p.title, { x: 64, y: 760, size: 22, font: bold, color: rgb(0.11, 0.23, 0.37) });
    let y = 720;
    for (const line of wrap(p.body, font, 12, 467)) {
      page.drawText(line, { x: 64, y, size: 12, font });
      y -= 19;
    }
    page.drawText(p.label, { x: 290, y: 40, size: 11, font }); // the printed page number
  }
  // Store the printed labels in the PDF itself (roman for front matter, then 1, 2, 3).
  doc.catalog.set(PDFName.of('PageLabels'), doc.context.obj({ Nums: [0, { S: 'r' }, 2, { S: 'D', St: 1 }] }));
  doc.setTitle('VayuTech Employee Handbook');
  writeFileSync(new URL('VayuTech-Employee-Handbook.pdf', OUT), await doc.save());
}

// ── Image-only "scanned" PDF: shapes, no text layer ──────────────────────────
async function scanned() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.96, 0.95, 0.92) });
  for (let i = 0; i < 22; i++) {
    const w = 380 + ((i * 37) % 90);
    page.drawRectangle({ x: 64, y: 740 - i * 26, width: w, height: 9, color: rgb(0.55, 0.55, 0.55) });
  }
  writeFileSync(new URL('Scanned-Notice.pdf', OUT), await doc.save());
}

// ── Word document with headings ──────────────────────────────────────────────
async function travelDocx() {
  const para = (text, style) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const body = [
    para('VayuTech Travel Policy', 'Title'),
    para('Booking travel', 'Heading1'),
    para('All business travel must be booked through the company travel desk at least 10 days before departure. Economy class is used for flights shorter than 6 hours.'),
    para('Daily allowance', 'Heading1'),
    para('Employees receive a daily allowance of Rs. 2,500 for meals and local transport during domestic travel.'),
    para('Hotels', 'Heading1'),
    para('Hotel stays are covered up to Rs. 6,000 per night in metro cities and Rs. 4,000 per night elsewhere.'),
  ].join('');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  writeFileSync(new URL('VayuTech-Travel-Policy.docx', OUT), await zip.generateAsync({ type: 'nodebuffer' }));
}

function faqCsv() {
  const rows = [
    ['Question', 'Answer'],
    ['How do I reset my laptop password?', 'Use the self-service portal at it.vayutech.example, or call the IT desk on extension 3000.'],
    ['Is there a canteen at the Bengaluru office?', 'Yes. The canteen on level 2 is open from 8:00 to 16:00 on working days.'],
    ['Can I bring a guest to the office?', 'Yes, if you register them at least one day in advance. Guests must carry photo identification.'],
    ['What is the dress code?', ''],
  ];
  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(new URL('VayuTech-FAQ.csv', OUT), rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n');
}

await handbook();
await scanned();
await travelDocx();
faqCsv();
console.log('Sample files written to public/sample-files');
