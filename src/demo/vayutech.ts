import type { Conflict, FaqEntry, Source, Visibility } from '../domain/types';
import { chunkPlainText } from '../domain/ingest/txt';

// Fictional presentation dataset. VayuTech and every detail below are invented for demonstration.

export const SAMPLE_ORG_NAME = 'VayuTech';

export const REQUIRED_PASSAGE =
  'Employees on probation are not eligible for casual leave. Requests concerning family emergencies must be submitted to HR for individual review. Submission does not guarantee approval.';

const LEAVE_2025 = `Who this policy covers
This edition applies to all VayuTech employees in India from the effective date shown in the document details. It replaces the earlier edition.

1. Purpose
This policy explains the types of leave available to VayuTech employees, who is eligible, and how to request leave.

2. Annual leave
Full-time employees receive 18 days of paid annual leave per calendar year. Annual leave is earned at 1.5 days per completed month of service. Up to 6 unused days may be carried forward to the next year. Annual leave should be requested in the HR portal at least 7 days in advance.

3. Casual leave
Confirmed employees receive 8 days of casual leave per calendar year for short personal needs. Casual leave cannot be carried forward.

${REQUIRED_PASSAGE}

4. Sick leave
Employees receive 10 days of paid sick leave per calendar year, including during probation. A medical certificate is required for sick leave longer than 2 consecutive days.

5. Probation
New employees serve a probation period of 6 months. During probation, annual leave is earned but can only be used after confirmation.

6. Requesting leave
Submit all leave requests through the HR portal. Your manager reviews annual and casual leave requests. HR reviews family emergency requests and any request that falls outside this policy. You will receive the outcome by email.`;

const LEAVE_2023 = `Who this policy covers
This edition applies to all VayuTech employees in India from the effective date shown in the document details.

1. Purpose
This policy explains the types of leave available to VayuTech employees, who is eligible, and how to request leave.

3. Casual leave
Confirmed employees receive 12 days of casual leave per calendar year for short personal needs. Casual leave cannot be carried forward. Employees on probation are not eligible for casual leave.

4. Sick leave
Employees receive 10 days of paid sick leave per calendar year, including during probation. A medical certificate is required for sick leave longer than 2 consecutive days.`;

const BENEFITS = `Health insurance
All employees are covered by group health insurance from their first day of work, including during probation. Cover is up to ₹5,00,000 per family per year. A spouse, children and parents can be added as dependants.

Hospitalisation
If you or a dependant is admitted to hospital, inform the HR Care desk within 48 hours so the insurance claim can be started. Cashless treatment is available at network hospitals listed in the HR portal.

Wellness allowance
Employees can claim up to ₹6,000 per year for wellness activities such as yoga classes or meditation apps. Claims are submitted with receipts through the HR portal.

Learning allowance
Confirmed employees can claim up to ₹25,000 per year for courses and certifications related to their role, with their manager’s agreement.`;

const OFFICES = `Bengaluru office
Level 4, Indiranagar Tech Park. Open Monday to Friday, 9:00 to 18:00.

Pune office
Baner Business Centre, 2nd floor. Open Monday to Friday, 9:30 to 18:30.

Visitors
Visitors must be registered by an employee at least one day in advance and should bring photo identification.`;

interface SampleDef {
  key: string;
  title: string;
  fileName: string;
  text: string;
  visibility: Visibility;
  version?: string;
  effectiveDate?: string;
  reviewBy?: string;
  supersedesKey?: string;
}

export const SAMPLE_SOURCES: SampleDef[] = [
  {
    key: 'leave-2025',
    title: 'VayuTech Leave Policy (2025 edition)',
    fileName: 'VayuTech-Leave-Policy-2025.txt',
    text: LEAVE_2025,
    visibility: 'internal',
    version: '2025',
    effectiveDate: '2025-04-01',
    reviewBy: '2027-03-31',
  },
  {
    key: 'leave-2023',
    title: 'VayuTech Leave Policy (2023 edition)',
    fileName: 'VayuTech-Leave-Policy-2023.txt',
    text: LEAVE_2023,
    visibility: 'internal',
    version: '2023',
    effectiveDate: '2023-04-01',
  },
  {
    key: 'benefits',
    title: 'VayuTech Employee Benefits Guide',
    fileName: 'VayuTech-Benefits-Guide.txt',
    text: BENEFITS,
    visibility: 'internal',
    version: '2024',
    effectiveDate: '2024-01-01',
    reviewBy: '2026-03-31', // deliberately past, to show the outdated-source notice
  },
  {
    key: 'offices',
    title: 'VayuTech Office Locations and Hours',
    fileName: 'VayuTech-Offices.txt',
    text: OFFICES,
    visibility: 'public',
    reviewBy: '2027-06-30',
  },
];

export function buildSampleSources(prefix: string, addedAt: string): Source[] {
  return SAMPLE_SOURCES.map((d) => {
    const id = `${prefix}-${d.key}`;
    return {
      id,
      title: d.title,
      fileName: d.fileName,
      fileType: 'TXT',
      size: new TextEncoder().encode(d.text).length,
      hash: `sample-${d.key}`,
      status: 'ready',
      extractionNote: 'Bundled sample document (fictional), read with the same text reader used for uploaded .txt files.',
      chunks: chunkPlainText(d.text, id),
      visibility: d.visibility,
      version: d.version,
      effectiveDate: d.effectiveDate,
      reviewBy: d.reviewBy,
      origin: 'sample',
      sampleKey: d.key,
      addedAt,
    } satisfies Source;
  });
}

export function sampleFaqs(prefix: string): FaqEntry[] {
  const rows: [string, string, Visibility][] = [
    ['How do I apply for leave?', 'Open the HR portal, choose Leave, then New request. Your manager is notified automatically.', 'internal'],
    ['When is salary paid?', 'Salary is paid on the last working day of each month.', 'internal'],
    ['Where can I find the list of network hospitals?', 'The current list of network hospitals is in the HR portal under Benefits, then Health insurance.', 'internal'],
    ['What are your office hours?', 'Our Bengaluru and Pune offices are open Monday to Friday. See the office locations page for exact hours.', 'public'],
  ];
  return rows.map(([question, answer, visibility], i) => ({
    id: `${prefix}-faq${i + 1}`,
    code: `FAQ-${String(i + 1).padStart(2, '0')}`,
    question,
    answer,
    visibility,
    approved: true,
    createdFrom: 'sample',
  }));
}

/** Conflict between the two leave policy editions, annotated by hand in the sample data. */
export function sampleConflicts(sources: Source[]): Conflict[] {
  const s25 = sources.find((s) => s.sampleKey === 'leave-2025');
  const s23 = sources.find((s) => s.sampleKey === 'leave-2023');
  const c25 = s25?.chunks.find((c) => c.locator.kind === 'section' && c.locator.heading.startsWith('3.'));
  const c23 = s23?.chunks.find((c) => c.locator.kind === 'section' && c.locator.heading.startsWith('3.'));
  if (!s25 || !s23 || !c25 || !c23) return [];
  return [
    {
      id: `${s25.id}-conflict-casual`,
      topic: 'Casual leave allowance',
      a: { sourceId: s25.id, chunkId: c25.id },
      b: { sourceId: s23.id, chunkId: c23.id },
      detectedBy: 'sample-annotation',
      resolution: null,
    },
  ];
}

export const DEMO_QUESTIONS = {
  emergency: 'I am on probation and my mother is hospitalised. Can I take three days’ leave?',
  supported: 'How many days of annual leave do I get?',
  ambiguous: 'How much leave do I get?',
  unsupported: 'Does VayuTech pay for a gym membership?',
  conflict: 'How many casual leave days do I get?',
};
