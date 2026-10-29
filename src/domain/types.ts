// Core domain types. Business logic lives in src/domain; UI only reads these.

export type Visibility = 'internal' | 'public';
export type SourceStatus = 'reading' | 'ready' | 'attention';
export type FileType = 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'XLSX' | 'PPTX' | 'Audio' | 'Video' | 'Image' | 'Written' | 'Other';

/** Where a passage came from, using only references that extraction actually produced. */
export type Locator =
  | { kind: 'pdf'; pageIndex: number; pageLabel?: string } // pageIndex is 1-based physical page
  | { kind: 'section'; heading: string; ordinal: number }
  | { kind: 'paragraph'; ordinal: number }
  | { kind: 'sheet'; sheet: string; range: string }
  | { kind: 'slide'; slide: number }
  | { kind: 'media'; startSeconds: number; endSeconds: number }
  | { kind: 'faq'; entryId: string; code: string; question: string };

export interface Chunk {
  id: string;
  sourceId: string;
  text: string;
  locator: Locator;
}

export interface Source {
  documentLabel?: string;
  autoTags?: string[];
  tags?: string[];
  suggestedQuestions?: string[];
  catalogMethod?: string;
  cataloguedAt?: string;
  driveFileId?: string;
  driveRevision?: string;
  sourceUrl?: string;
  transcriptionConsent?: boolean;
  folderPath?: string;
  serverManaged?: boolean;
  id: string;
  title: string;
  fileName?: string;
  fileType: FileType;
  size?: number;
  hash?: string;
  status: SourceStatus;
  attention?: string;
  /** Honest note about how text was obtained, shown in the preview. */
  extractionNote?: string;
  chunks: Chunk[];
  visibility: Visibility;
  version?: string;
  effectiveDate?: string;
  reviewBy?: string;
  supersedes?: string; // id of an older source this one replaces
  origin: 'upload' | 'written' | 'sample';
  /** Stable key for bundled demo sources; scripted demo answers only cite sources carrying it. */
  sampleKey?: string;
  addedAt: string;
}

export interface FaqEntry {
  id: string;
  code: string; // human-facing ID, e.g. FAQ-04
  question: string;
  answer: string;
  visibility: Visibility;
  /** Entries created from feedback stay unapproved until the owner approves an answer. */
  approved: boolean;
  createdFrom?: 'feedback' | 'manual' | 'csv' | 'sample';
}

export type ConflictDetector = 'sample-annotation' | 'number-check';

export interface Conflict {
  id: string;
  topic: string;
  a: { sourceId: string; chunkId: string };
  b: { sourceId: string; chunkId: string };
  detectedBy: ConflictDetector;
  resolution: null | { kind: 'prefer'; sourceId: string } | { kind: 'both' };
}

export interface Handover {
  contact: string;
  process: string;
}

export interface AssistantDraft {
  folders?: string[];
  description: string;
  starter: Starter | null;
  name: string;
  purpose: string;
  language: string;
  greeting: string;
  behaviour: string;
  handover: Handover;
  /** null means "use the generated instructions". */
  customInstructions: string | null;
  tone: Tone;
  /** One or two characters (letter or emoji) shown as the assistant's avatar. */
  avatar: string;
  /** Owner-chosen starter questions; null means "suggest from the sources". */
  starterQuestions: string[] | null;
  sources: Source[];
  faqs: FaqEntry[];
  conflicts: Conflict[];
}

export type Starter = 'employee' | 'admissions' | 'customer' | 'other';
export type Tone = 'friendly' | 'formal' | 'concise';

export type Audience = 'public' | 'authorised';
export type Channel = 'website' | 'application';

export interface WidgetSettings {
  color: string;
  position: 'right' | 'left';
  mode: 'floating' | 'inline';
  greeting: string;
}

export interface ShareSettings {
  audience: Audience | null;
  channel: Channel | null;
  widget: WidgetSettings;
}

/** Immutable copy of everything a published assistant answers from. */
export interface Snapshot {
  id: string;
  version: number;
  publishedAt: string;
  draftRevision: number;
  audience: Audience;
  name: string;
  purpose: string;
  greeting: string;
  language: string;
  instructions: string;
  handover: Handover;
  tone: Tone;
  starterQuestions: string[] | null;
  sources: Source[];
  faqs: FaqEntry[];
  conflicts: Conflict[];
  widget: WidgetSettings;
}

export type PublishStatus = 'draft' | 'live' | 'unpublished';

export const STEPS = ['upload', 'training', 'try', 'review', 'make', 'publish'] as const;
export type StepId = (typeof STEPS)[number];

export interface Assistant {
  pinned?: boolean;
  collectionId?: string | null;
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  isSample: boolean;
  publicId: string; // public widget identifier
  setupComplete: boolean;
  completedSteps: StepId[];
  currentStep: StepId;
  /** Signature of the information when the training step last prepared it. */
  trainedSignature: string | null;
  draft: AssistantDraft;
  draftRevision: number;
  status: PublishStatus;
  published: Snapshot | null; // the currently live (or last) snapshot
  history: Snapshot[];
  share: ShareSettings;
}

export interface Organisation {
  collections?: { id: string; name: string }[];
  id: string;
  name: string;
  createdAt: string;
  isSample: boolean;
}

export type EvidenceLevel = 'strong' | 'partial' | 'none';
export type AnswerMethod = 'scripted-demo' | 'extractive' | 'model' | 'limitation';
export type AnswerKind = 'answer' | 'clarify' | 'conflict' | 'no-info' | 'unavailable';

export interface Citation {
  n: number;
  sourceId: string;
  sourceTitle: string;
  fileType: FileType;
  chunkId: string;
  locator: Locator;
  excerpt: string; // full passage text
  highlight: string; // exact substring of excerpt that supports the answer
}

export interface AnswerPayload {
  kind: AnswerKind;
  text: string; // paragraphs separated by blank lines; [n] citation markers
  citations: Citation[];
  evidence: EvidenceLevel;
  evidenceReason: string;
  method: AnswerMethod;
  showHandover: boolean;
  suggestions?: string[];
  model?: string | null;
  framework?: string;
  grounding?: 'reviewed' | 'rejected';
  warnings?: string[];
  sourceRevision?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  answer?: AnswerPayload;
  draftRevision?: number;
  snapshotVersion?: number;
  feedback?: 'up' | 'down';
  error?: string;
}

export type ConversationChannel = 'test' | 'published';

export interface Conversation {
  id: string;
  assistantId: string;
  channel: ConversationChannel;
  startedAt: string;
  messages: Message[];
}

export interface Session {
  kind: 'demo' | 'local';
  email?: string;
  displayName?: string;
}

export interface AppState {
  schemaVersion: number;
  session: Session | null;
  orgs: Organisation[];
  assistants: Assistant[];
  conversations: Conversation[];
  modelPreference: 'demo' | 'model';
}
