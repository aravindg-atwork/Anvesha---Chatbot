import { useState } from 'react';
import { ArrowRight, ChevronLeft, FileUp, FolderOpen, Search, SlidersHorizontal, ShieldCheck, MessagesSquare, PenLine, Sparkles } from 'lucide-react';
import type { Source, Visibility } from '../../domain/types';
import { dispatch, useAppState, isRemoteSession } from '../../domain/store';
import * as op from '../../domain/operations';
import { chunkPlainText } from '../../domain/ingest/txt';
import { ACCEPTED, fileTypeOf } from '../../domain/ingest';
import { uid, nowIso } from '../../lib/id';
import { Button, Field, FilePicker, Modal, Notice, toast } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import BranchedMenu, { type BranchedMenuItem } from '../components/BranchedMenu';
import { FrostCloud } from '@/components/ui/frost-cloud';
import { IntakeArt, ReadinessBadge, useStudioEntrance } from './knowledge/KnowledgeCanvas';
import './knowledge/studio.css';
import { GoogleDrive } from './knowledge/GoogleDrive';
import { SourceList } from './knowledge/SourceList';
import { FaqManager, useFaqCsvImport } from './knowledge/FaqManager';
import { addFile } from './knowledge/processing';
import { useProcessing } from './knowledge/useProcessing';

function WriteModal({ onSave, onClose }: { onSave: (title: string, text: string, vis: Visibility) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [pub, setPub] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      title="Write information"
      description="Paste or type information. Short headings on their own line help the assistant point to the right part."
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!title.trim()) return setErr('Give this information a title.');
              if (!text.trim()) return setErr('Write some information first.');
              onSave(title.trim(), text, pub ? 'public' : 'internal');
              onClose();
            }}
          >
            Add to project
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <Field label="Title">{(id) => <input id={id} className="input" placeholder="For example, Office opening hours" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Information">
          {(id) => <textarea id={id} className="textarea" rows={12} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 280 }} />}
        </Field>
        <label className="check">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
          <span>
            Public information
            <br />
            <span className="muted small">Allow a public assistant to use it. Leave unticked for internal information.</span>
          </span>
        </label>
        {err && <p className="field-error">{err}</p>}
      </div>
    </Modal>
  );
}

export function KnowledgeStep({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const processing = useProcessing(a.id);
  const studioRef = useStudioEntrance();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ready' | 'attention'>('all');
  const [sourceSort, setSourceSort] = useState('newest');
  const d = a.draft;
  const isDemo = useAppState((s) => s.session?.kind === 'demo');
  const [mediaConsent, setMediaConsent] = useState(false);
  const [csvMode, setCsvMode] = useState<'faq' | 'document'>('faq');
  const [writing, setWriting] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const csv = useFaqCsvImport(a);
  const [folder, setFolder] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const folders = [...new Set([...(d.folders ?? []), ...d.sources.map(s => s.folderPath ?? '')].flatMap(path => path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'))).filter(Boolean))].sort();
  const tree = (parent = ''): BranchedMenuItem[] => folders.filter(path => path.split('/').slice(0, -1).join('/') === parent).map(path => ({
    value: path, label: `${path.split('/').at(-1)} (${d.sources.filter(s => s.folderPath === path || s.folderPath?.startsWith(path + '/')).length})`, children: tree(path),
  }));
  const createFolder = () => {
    const path = newFolder.trim();
    if (!path || path.length > 240 || path.split('/').length > 10 || path.split('/').some(p => !/^[\p{L}\p{N}_ .()-]{1,60}$/u.test(p) || p === '.' || p === '..' || p !== p.trim() || p.endsWith('.'))) {
      toast('Enter a folder path such as HR/Policies, up to 10 levels and 240 characters.'); return;
    }
    dispatch(st => op.updateDraft(st, a.id, { folders: [...new Set([...folders, path])] }));
    setFolder(path); setNewFolder('');
  };

  const handleFiles = (list: FileList | File[]) => {
    setBlocked(null);
    for (const f of Array.from(list)) {
      // CSVs are question-and-answer imports, with their own preview.
      if (fileTypeOf(f.name) === 'CSV' && csvMode === 'faq') csv.start(f);
      else addFile(a.id, f, folder === '*' ? '' : folder, mediaConsent);
    }
  };

  const ready = d.sources.filter((s) => s.status === 'ready').length + d.faqs.filter((f) => f.approved).length;
  const reading = d.sources.some((s) => s.status === 'reading');
  const hasSample = d.sources.some((s) => s.sampleKey);
  const readySources = d.sources.filter(source => source.status === 'ready').length;
  const attentionSources = d.sources.filter(source => source.status === 'attention').length;
  const visibleSources = d.sources.filter(source => (folder === '*' || (source.folderPath ?? '') === folder)
    && (sourceFilter === 'all' || source.status === sourceFilter)
    && `${source.title} ${source.fileName ?? ''} ${source.fileType} ${source.documentLabel ?? ''} ${(source.autoTags ?? []).join(' ')} ${(source.tags ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => sourceSort === 'name' ? left.title.localeCompare(right.title) : right.addedAt.localeCompare(left.addedAt));


  return (
    <div className={`screen knowledge-studio ${d.sources.length ? 'has-sources' : ''}`} ref={studioRef}>
      <header className="knowledge-studio-hero" data-studio-enter>
        <div><span className="studio-section-kicker"><span>01</span> Your knowledge studio</span><StepHeading step="upload" n={stepNumber} title="Give your assistant the information it needs." intro="A home for your documents, ideas and everything worth knowing." /></div>
        <ReadinessBadge total={d.sources.length} ready={readySources} />
      </header>
      <div className="knowledge-workspace" data-studio-enter>
        <aside className="knowledge-rail" aria-label="Organize your knowledge">
          <div className="knowledge-rail-heading"><span><FolderOpen size={18} />Your folders</span><span>{folders.length}</span></div>
          <BranchedMenu active={folder} onSelect={setFolder} items={[{ value: '*', label: `All sources (${d.sources.length})` }, { value: '', label: `Unfiled (${d.sources.filter(source => !source.folderPath).length})` }, ...tree()]} />
          <div className="knowledge-folder-create"><label className="field-label" htmlFor="knowledge-new-folder">Make room for an idea</label><input id="knowledge-new-folder" className="input" aria-label="New folder path" placeholder="e.g. Product/Guides" value={newFolder} onChange={e => setNewFolder(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createFolder(); }} /><Button size="sm" onClick={createFolder}>Create folder</Button></div>
          <Field label="Upload destination" hint="New files and Drive imports go here.">{id => <select id={id} className="select" value={folder === '*' ? '' : folder} onChange={e => setFolder(e.target.value)}><option value="">Unfiled</option>{folders.map(path => <option key={path} value={path}>{path}</option>)}</select>}</Field>
          <div className="knowledge-rail-note"><ShieldCheck size={18} /><p>Your information, organized your way.<span>Original sources stay linked to every passage.</span></p></div>
        </aside>
        <div className="knowledge-main">
          <section className={`intake-well dropzone ${over ? 'over' : ''}`} aria-label="Upload documents" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }} onDrop={e => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}>
            <span className="intake-destination"><FolderOpen size={13} /> {folder && folder !== '*' ? folder : 'Your knowledge library'}</span>
            <IntakeArt />
            <h2>{over ? 'A good place to drop it.' : 'Good answers start with your files.'}</h2>
            <p>Drop your documents here. Anvesha takes it from there.</p>
            <FilePicker variant="primary" accept={ACCEPTED} multiple onFiles={handleFiles} testId="file-input" icon={<FileUp size={17} />}>Choose files</FilePicker>
            <div className="intake-format-tags" aria-label="Supported document families"><span>PDF & Word</span><span>Spreadsheets</span><span>Slides</span><span>Images & scans</span><span>Audio & video</span></div>
            <span className="intake-limits">Documents up to 15 MB. Audio/video up to 10 MB with transcription consent.</span>
          </section>
          <div className="knowledge-quick-actions">
            <button type="button" className="knowledge-quick-action" aria-expanded={faqOpen} onClick={() => setFaqOpen(!faqOpen)}><span><MessagesSquare size={20} /></span><div><strong>Add questions and answers</strong><small>{d.faqs.length ? `${d.faqs.length} entries in your project` : 'The questions you know people will ask'}</small></div><ArrowRight size={17} /></button>
            <button type="button" className="knowledge-quick-action" onClick={() => setWriting(true)}><span><PenLine size={20} /></span><div><strong>Write information</strong><small>A thought, a note, a little context</small></div><ArrowRight size={17} /></button>
          </div>
          <details className="knowledge-import-options"><summary><SlidersHorizontal size={15} /><span>Import preferences</span><small>CSV and media settings</small></summary><div className="stack"><Field label="CSV content">{id => <select id={id} className="select" value={csvMode} onChange={e => setCsvMode(e.target.value as 'faq' | 'document')}><option value="faq">Questions and answers (preview before import)</option><option value="document">Table data (index rows as a document)</option></select>}</Field><label className="check"><input type="checkbox" checked={mediaConsent} onChange={e => setMediaConsent(e.target.checked)} /><span>Allow uploaded audio/video to be sent to Google Gemini for speech transcription.<small>Requires a server API key. Provider usage may be billed. Video visuals are not indexed.</small></span></label></div></details>
          {isDemo && !hasSample && <button className="knowledge-sample-action" onClick={() => { dispatch(st => op.addSampleDocuments(st, a.id)); toast('VayuTech sample documents added.'); }}><Sparkles size={17} /><span><strong>Use VayuTech sample documents</strong><small>Explore with fictional policies and FAQs</small></span><ArrowRight size={16} /></button>}
          {faqOpen && <section className="knowledge-library"><FaqManager a={a} /></section>}
          <section className="knowledge-library" aria-label="Your information">
            <div className="knowledge-library-heading"><div><span className="studio-section-kicker">The source of it all</span><h2>Your information <span>{d.sources.length}</span></h2></div><span className="knowledge-library-scope"><FolderOpen size={14} />{folder === '*' ? 'All sources' : folder || 'Unfiled'}</span></div>
            {d.sources.length > 0 ? <>
              <div className="knowledge-library-tools"><label className="knowledge-source-search"><Search size={17} /><input type="search" aria-label="Search sources" placeholder="Find a document?" value={query} onChange={e => setQuery(e.target.value)} /></label><select className="select" aria-label="Sort sources" value={sourceSort} onChange={e => setSourceSort(e.target.value)}><option value="newest">Newest first</option><option value="name">Name A to Z</option></select></div>
              <div className="knowledge-source-filters" aria-label="Filter source status">{([['all', 'All sources', d.sources.length], ['ready', 'Ready', readySources], ['attention', 'Needs attention', attentionSources]] as const).map(([value, label, count]) => <button type="button" key={value} aria-pressed={sourceFilter === value} onClick={() => setSourceFilter(value)}>{label}<span>{count}</span></button>)}</div>
              {visibleSources.length ? <SourceList a={a} sources={visibleSources} /> : <div className="knowledge-no-results"><Search size={24} /><p>{query || sourceFilter !== 'all' ? 'No sources match these filters.' : 'This folder is ready for your first file.'}</p>{(query || sourceFilter !== 'all') && <Button size="sm" onClick={() => { setQuery(''); setSourceFilter('all'); }}>Clear filters</Button>}</div>}
            </> : <div className="knowledge-library-empty"><FrostCloud background={false} color="brand" /><div><h3>A little empty. Full of possibilities.</h3><p>Your files will appear here, with clear status and a place of their own.</p></div></div>}
          </section>
          <GoogleDrive projectId={a.id} destination={folder === '*' ? '' : folder} onRefresh={processing.refresh} />
          {!faqOpen && d.faqs.length > 0 && <div className="knowledge-faq-summary"><MessagesSquare size={18} /><span><strong>{d.faqs.length} questions and answers</strong><small>Part of your assistant?s knowledge</small></span><Button size="sm" onClick={() => setFaqOpen(true)}>Manage</Button></div>}
          {processing.error && <Notice tone="danger">{processing.error}</Notice>}
          {blocked && <Notice tone="warn">{blocked}</Notice>}
        </div>
      </div>
      <div className="action-bar knowledge-studio-footer"><button className="back-link" onClick={onBack}><ChevronLeft size={18} /> Projects</button><span className="knowledge-footer-state"><i />{d.sources.length} sources in your library</span><Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={() => {
        if (isRemoteSession() && (d.sources.length || processing.jobs.some(job => job.kind === 'drive_sync' && ['queued', 'running'].includes(job.status)))) { onNext(); return; }
        if (reading) return setBlocked('Please wait until all files have been read.');
        if (!ready) return setBlocked('Add at least one file that is ready, or a question and answer, to continue.');
        onNext();
      }}>{nextLabel}</Button></div>
      {writing && (
        <WriteModal
          onClose={() => setWriting(false)}
          onSave={(title, text, visibility) => {
            const id = uid('src');
            const chunks = chunkPlainText(text, id);
            const s: Source = {
              id,
              folderPath: folder === '*' ? '' : folder,
              title,
              fileType: 'Written',
              status: chunks.length ? 'ready' : 'attention',
              attention: chunks.length ? undefined : 'No readable text.',
              extractionNote: 'Written in Anvesha. References use headings or paragraph positions.',
              chunks,
              visibility,
              origin: 'written',
              addedAt: nowIso(),
            };
            dispatch((st) => op.addSource(st, a.id, s));
            toast('Information added.');
          }}
        />
      )}
      {csv.modal}
    </div>
  );
}
