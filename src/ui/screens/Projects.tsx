import { FrostCloud } from '@/components/ui/frost-cloud';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, Command, FileStack, FolderClosed, FolderOpen, Kanban, LayoutGrid, List, MessageSquare, MoreHorizontal, Pin, Plus, Search, Sparkles, X } from 'lucide-react';
import type { Assistant, Organisation } from '../../domain/types';
import { STEPS } from '../../domain/types';
import { dispatch, dispatchWith, flushRemote, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { navigate } from '../router';
import { Button, Field, Modal, toast } from '../components/ui';
import { AppFrame, Avatar, Brand, STEP_LABEL, projectPath } from '../App';
import { NewProjectModal, SignOut } from './ProjectForms';
export { WorkspaceScreen } from './ProjectForms';

type Layout = 'grid' | 'list' | 'board';
type Phase = 'building' | 'ready' | 'live';
const PHASES: { id: Phase; label: string; caption: string }[] = [
  { id: 'building', label: 'In progress', caption: 'A little knowledge goes a long way.' },
  { id: 'ready', label: 'Ready to test', caption: 'Your next good answer starts here.' },
  { id: 'live', label: 'Published', caption: 'A preview of what you’ve made.' },
];
const phaseOf = (a: Assistant): Phase => a.status === 'live' ? 'live' : a.trainedSignature && !op.needsTraining(a) ? 'ready' : 'building';
const openProject = (a: Assistant) => navigate(a.history.length ? projectPath(a.id) : projectPath(a.id, a.currentStep));
function initialLayout(): Layout { try { const v = localStorage.getItem('anvesha:project-layout'); return v === 'list' || v === 'board' ? v : 'grid'; } catch { return 'grid'; } }
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Just started' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

function ProjectCard({ a, org, arrange }: { a: Assistant; org: Organisation; arrange: (id: string, patch: { pinned?: boolean; collectionId?: string | null }) => Promise<void> }) {
  const phase = phaseOf(a);
  const progress = a.completedSteps.filter((s) => s !== 'publish').length;
  const collection = org.collections?.find((c) => c.id === a.collectionId);
  return <article className={`studio-project phase-${phase}`} draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-anvesha-project-id', a.id); event.dataTransfer.effectAllowed = 'move'; }}>
    <button className="studio-project-open" aria-label={`Open project ${a.draft.name || 'Untitled project'}`} onClick={() => openProject(a)}>
      <span className="studio-project-top"><Avatar a={a} size={42} /><span className={`studio-phase phase-${phase}`}><i />{PHASES.find((p) => p.id === phase)!.label}</span></span>
      <strong className="studio-project-title">{a.draft.name || 'Untitled project'}</strong><span className="studio-project-purpose">{a.draft.purpose || 'A new home for your information.'}</span>
      <span className="studio-project-counts"><span><FileStack size={13} />{a.draft.sources.length} sources</span><span><MessageSquare size={13} />{a.draft.faqs.length} Q&A</span>{collection && <span className="studio-project-collection"><FolderClosed size={12} />{collection.name}</span>}</span>
      <span className="studio-project-progress"><span>{phase === 'live' ? `Version ${a.published?.version || 1} · Published preview` : `Step ${STEPS.indexOf(a.currentStep) + 1} of ${STEPS.length}: ${STEP_LABEL[a.currentStep]}`}</span><span className="progress"><span style={{ width: `${Math.max(5, (progress / (STEPS.length - 1)) * 100)}%` }} /></span></span>
      <span className="studio-project-bottom"><span>Edited {dateLabel(a.updatedAt)}</span><span>{phase === 'live' ? 'Open project' : 'Continue building'}<ArrowUpRight size={15} /></span></span>
    </button>
    <div className="studio-project-actions"><button className={`studio-pin ${a.pinned ? 'is-pinned' : ''}`} type="button" aria-label={`${a.pinned ? 'Unpin' : 'Pin'} ${a.draft.name}`} aria-pressed={!!a.pinned} onClick={() => void arrange(a.id, { pinned: !a.pinned })}><Pin size={14} /></button><details className="studio-project-menu"><summary aria-label={`Project actions for ${a.draft.name}`}><MoreHorizontal size={17} /></summary><div><strong>Move to a collection</strong><label className="sr-only" htmlFor={`move-${a.id}`}>Move {a.draft.name} to</label><select id={`move-${a.id}`} value={a.collectionId || ''} onChange={(e) => { void arrange(a.id, { collectionId: e.target.value || null }); e.currentTarget.closest('details')?.removeAttribute('open'); }}><option value="">No collection</option>{org.collections?.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select><span>Or drag this card onto a collection.</span></div></details></div>
  </article>;
}

export function ProjectsScreen() {
  const state = useAppState((s) => s);
  const [orgId, setOrgId] = useState(() => state.orgs.find((o) => !o.isSample)?.id || state.orgs[0].id);
  const org = state.orgs.find((o) => o.id === orgId) || state.orgs[0];
  const [creating, setCreating] = useState(() => window.location.hash.includes('new=1') && !state.assistants.some((a) => a.orgId === org.id));
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [phase, setPhase] = useState('all');
  const [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [arranging, setArranging] = useState(0);
  const [arrangementSaved, setArrangementSaved] = useState(false);
  const [arrangementError, setArrangementError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const projects = state.assistants.filter((a) => a.orgId === org.id);
  const collectionId = scope.startsWith('collection:') ? scope.slice(11) : null;
  const visible = projects.filter((a) => (scope !== 'pinned' || a.pinned) && (!collectionId || a.collectionId === collectionId) &&
    (phase === 'all' || phaseOf(a) === phase) && `${a.draft.name} ${a.draft.purpose}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) =>
    sort === 'name' ? a.draft.name.localeCompare(b.draft.name) : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
  const recent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const sources = projects.reduce((n, a) => n + a.draft.sources.length + a.draft.faqs.filter((f) => f.approved).length, 0);
  const conversations = state.conversations.filter((c) => projects.some((a) => a.id === c.assistantId));
  const title = scope === 'pinned' ? 'Pinned projects' : collectionId ? org.collections?.find((c) => c.id === collectionId)?.name || 'Collection' : 'Your projects';
  const firstName = (state.session?.displayName || state.session?.email?.split('@')[0] || 'there').split(' ')[0];
  useEffect(() => { try { localStorage.setItem('anvesha:project-layout', layout); } catch { /* visual preference only */ } }, [layout]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen((v) => !v); }
      else if (event.key === '/' && !(event.target instanceof HTMLElement && (event.target.closest('input,textarea,select') || event.target.isContentEditable))) { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const saveArrangement = async () => {
    setArranging((n) => n + 1); setArrangementError(false);
    try { await flushRemote(); setArrangementSaved(true); return true; }
    catch (err) { setArrangementError(true); toast(err instanceof Error ? err.message : 'Could not save this arrangement.'); return false; }
    finally { setArranging((n) => n - 1); }
  };
  const arrange = async (id: string, patch: { pinned?: boolean; collectionId?: string | null }) => {
    dispatch((s) => op.arrangeProject(s, id, patch));
    if (await saveArrangement() && 'collectionId' in patch) toast(patch.collectionId ? `Moved to ${org.collections?.find((c) => c.id === patch.collectionId)?.name || 'collection'}.` : 'Removed from collection.');
  };
  const drop = (target: string) => ({
    onDragOver: (event: React.DragEvent) => { if (event.dataTransfer.types.includes('application/x-anvesha-project-id')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(target); } },
    onDragLeave: () => setDropTarget(null),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDropTarget(null); const id = event.dataTransfer.getData('application/x-anvesha-project-id'); if (projects.some((a) => a.id === id)) void arrange(id, { collectionId: target === 'all' ? null : target }); },
  });
  const reset = () => { setQuery(''); setPhase('all'); setScope('all'); };
  const selectOrg = (id: string) => { setOrgId(id); reset(); };
  const createCollection = async () => {
    if (collectionBusy) return;
    if (!collectionName.trim()) return setCollectionError('Give your collection a name.');
    setCollectionBusy(true);
    const { collectionId: id } = dispatchWith((s) => op.addCollection(s, org.id, collectionName));
    try { await flushRemote(); setScope(`collection:${id}`); setCollectionOpen(false); setCollectionName(''); }
    catch (err) { setCollectionError(err instanceof Error ? err.message : 'Could not save your collection.'); }
    finally { setCollectionBusy(false); }
  };

  return <AppFrame className="studio-shell" sidebar={<>
    <Brand to="/projects" /><div className="studio-workspace-switch"><span className="studio-workspace-avatar">{org.name.slice(0, 1).toUpperCase()}</span><div><span>WORKSPACE</span><label className="sr-only" htmlFor="studio-workspace">Current workspace</label><select id="studio-workspace" value={org.id} onChange={(e) => selectOrg(e.target.value)}>{state.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div><ChevronDown size={14} /></div>
    <nav className="studio-nav-group" aria-label="Project library"><span className="studio-nav-label">LIBRARY</span><button className={`studio-nav-item ${scope === 'all' ? 'is-active' : ''} ${dropTarget === 'all' ? 'is-drop-target' : ''}`} onClick={reset} {...drop('all')}><LayoutGrid size={17} />All projects<span>{projects.length}</span></button><button className={`studio-nav-item ${scope === 'pinned' ? 'is-active' : ''}`} onClick={() => { setScope('pinned'); setPhase('all'); }}><Pin size={17} />Pinned<span>{projects.filter((a) => a.pinned).length}</span></button></nav>
    <nav className="studio-nav-group" aria-label="Collections"><div className="studio-nav-label"><span>COLLECTIONS</span><button type="button" aria-label="New collection" onClick={() => { setCollectionError(null); setCollectionOpen(true); }}><Plus size={15} /></button></div>{org.collections?.map((c) => <button className={`studio-nav-item ${scope === `collection:${c.id}` ? 'is-active' : ''} ${dropTarget === c.id ? 'is-drop-target' : ''}`} key={c.id} onClick={() => { setScope(`collection:${c.id}`); setPhase('all'); }} {...drop(c.id)}><FolderClosed size={17} /><span className="studio-collection-name">{c.name}</span><span>{projects.filter((a) => a.collectionId === c.id).length}</span></button>)}{!org.collections?.length && <button className="studio-collection-empty" onClick={() => setCollectionOpen(true)}>A place for related projects.<span>Create a collection <Plus size={12} /></span></button>}</nav>
    <div className="studio-nav-bottom"><button className="studio-nav-item" onClick={() => navigate('/workspace/new')}><Plus size={17} />New workspace</button><button className="studio-nav-item" onClick={() => navigate('/demo')}><BookOpen size={17} />Explore a sample<ArrowUpRight size={13} /></button><div className="studio-account"><span>{(state.session?.displayName || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{state.session?.displayName || 'Your account'}</strong><small>{state.session?.kind === 'demo' ? 'Demo account' : state.session?.email}</small></div><SignOut /></div></div>
  </>} topbar={<><nav className="crumbs" aria-label="Breadcrumb"><span>{org.name}</span><span className="studio-breadcrumb-separator">/</span><span>Overview</span></nav><span className="topbar-spacer" /><button className="studio-global-search" aria-label="Search your workspace" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Find anything</span><kbd><Command size={11} />K</kbd></button><span className="studio-header-avatar" aria-hidden>{firstName.slice(0, 1).toUpperCase()}</span></>}>
    <main className="content screen studio-content" id="main"><div className="studio-greeting"><span><span className="studio-greeting-dot" /> YOUR KNOWLEDGE STUDIO</span><span>Welcome back, {firstName}.</span></div>
      <section className="studio-overview"><div><h1>{title}<span className="studio-title-dot">.</span></h1><p>{scope === 'pinned' ? 'The work you like to keep close.' : collectionId ? 'Good ideas, grouped together.' : projects.length ? 'A place for your ideas to become useful.' : 'Your next good answer starts with a little knowledge.'}</p></div><button className="journey-button journey-button-ink" onClick={() => setCreating(true)}><Plus size={16} />New project</button></section>
      <div className="studio-dashboard-grid"><div className="studio-library">
        {scope === 'all' && !query && phase === 'all' && recent && <button className="studio-resume" aria-label="Continue last project" onClick={() => openProject(recent)}><span className="studio-resume-icon"><Sparkles size={23} strokeWidth={1.2} /></span><span><small>PICK UP WHERE YOU LEFT OFF</small><strong>{recent.draft.name}</strong><span>{STEP_LABEL[recent.currentStep]} · {recent.draft.sources.length} sources connected</span></span><span className="studio-resume-cta">Continue<ArrowRight size={16} /></span></button>}
        <div className="studio-library-heading"><div><FolderOpen size={17} /><strong>{scope === 'all' ? 'All projects' : title}</strong><span>{visible.length}</span></div><div className="studio-view-switch" aria-label="Project layout">{([{ id: 'grid', label: 'Grid view', Icon: LayoutGrid }, { id: 'list', label: 'List view', Icon: List }, { id: 'board', label: 'Board view', Icon: Kanban }] as const).map(({ id, label, Icon }) => <button key={id} aria-label={label} aria-pressed={layout === id} onClick={() => setLayout(id)}><Icon size={16} /></button>)}</div></div>
        <div className="studio-toolbar"><label className="studio-search"><Search size={16} /><input ref={searchRef} type="search" aria-label="Search projects" placeholder="Search your projects…" value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>/</kbd></label><select className="studio-filter" aria-label="Filter projects" value={phase} onChange={(e) => setPhase(e.target.value)}><option value="all">All stages</option>{PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select><label className="studio-sort"><ArrowDownUp size={14} /><select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Recent activity</option><option value="name">Name A–Z</option><option value="oldest">Oldest first</option></select></label></div>
        {visible.length ? layout === 'board' ? <div className="studio-board" aria-label="Projects grouped by progress">{PHASES.map((column) => <section className="studio-board-column" key={column.id}><h2><span className={`studio-phase-dot phase-${column.id}`} />{column.label}<span>{visible.filter((a) => phaseOf(a) === column.id).length}</span></h2>{visible.filter((a) => phaseOf(a) === column.id).map((a) => <ProjectCard key={a.id} a={a} org={org} arrange={arrange} />)}{!visible.some((a) => phaseOf(a) === column.id) && <p className="studio-board-empty">{column.caption}</p>}</section>)}</div> : <div className={`project-grid studio-project-grid ${layout === 'list' ? 'project-list-view studio-project-list' : ''}`}>{visible.map((a) => <ProjectCard key={a.id} a={a} org={org} arrange={arrange} />)}<button className="studio-add-project" aria-label="Start a new assistant" onClick={() => setCreating(true)}><span><Plus size={22} /></span><strong>Make something useful.</strong><small>Give your next idea an assistant.</small><span className="studio-add-label">Create a project<ArrowUpRight size={14} /></span></button></div> : <div className="studio-empty"><div className="studio-empty-art"><FrostCloud background={false} color="brand" /></div><h2>{query || phase !== 'all' ? 'No projects found' : scope === 'pinned' ? 'Keep the good ones close.' : collectionId ? 'A little room for good ideas.' : 'Every good answer starts somewhere.'}</h2><p>{query || phase !== 'all' ? 'Try a different name or clear your filters.' : scope === 'pinned' ? 'Pin a project to find it here, whenever you need it.' : collectionId ? 'Move a project here using its menu, or drag it onto this collection.' : 'Create your first assistant. Give it a purpose, add your information, and see what connects.'}</p>{query || phase !== 'all' ? <Button onClick={reset}>Clear filters</Button> : scope === 'pinned' ? <Button onClick={reset}>Browse projects</Button> : <button className="journey-button journey-button-ink" onClick={() => setCreating(true)}>Create your first project<Plus size={16} /></button>}</div>}
        <div className="studio-library-foot"><span role="status" aria-label="Project save status" aria-live="polite"><Check size={13} /> {state.session?.kind === 'demo' ? 'Demo changes stay in this browser' : arranging ? 'Saving changes...' : arrangementError ? 'Save failed' : arrangementSaved ? 'All changes saved' : 'Changes save to your workspace'}{arrangementError && <button type="button" onClick={() => void saveArrangement()}>Retry saving</button>}</span><span>{layout === 'board' ? 'Stages follow actual project progress' : 'Drag projects into collections to arrange them'}</span></div>
      </div><aside className="studio-insights" aria-label="Workspace overview"><div className="studio-insight-card"><span className="studio-insight-kicker">YOUR WORKSPACE, AT A GLANCE</span><div className="studio-insight-number"><strong>{projects.length.toString().padStart(2, '0')}</strong><span>ideas with<br />a place to grow</span></div><dl><div><dt><FileStack size={14} />Knowledge sources</dt><dd>{sources}</dd></div><div><dt><MessageSquare size={14} />Conversations</dt><dd>{conversations.length}</dd></div><div><dt><Check size={14} />Ready to test</dt><dd>{projects.filter((a) => phaseOf(a) === 'ready').length}</dd></div></dl></div><div className="studio-insight-guide"><span className="studio-guide-symbol"><Sparkles size={23} strokeWidth={1.1} /></span><h2>A little guidance<br />goes a long way.</h2><p>Not sure where to begin? Explore a sample assistant and see how the pieces connect.</p><button onClick={() => navigate('/demo')}>Take a look around<ArrowUpRight size={15} /></button></div>{recent && <div className="studio-recent-note"><Clock3 size={15} /><span>Last worked on<br /><strong>{recent.draft.name}</strong><small>{dateLabel(recent.updatedAt)}</small></span></div>}</aside></div>
    </main>
    {creating && <NewProjectModal orgId={org.id} collectionId={collectionId} onClose={() => setCreating(false)} />}
    {collectionOpen && <Modal title="New collection" description="A small home for projects that belong together." onClose={() => setCollectionOpen(false)} footer={<><Button onClick={() => setCollectionOpen(false)}>Cancel</Button><Button variant="primary" loading={collectionBusy} onClick={() => void createCollection()}>Create collection</Button></>}><Field label="Collection name" error={collectionError || undefined}>{(id, desc) => <input id={id} aria-describedby={desc} className="input" maxLength={40} placeholder="For example, Research" value={collectionName} autoFocus onChange={(e) => { setCollectionName(e.target.value); setCollectionError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') void createCollection(); }} />}</Field></Modal>}
    {commandOpen && <Modal title="Find anything" onClose={() => { setCommandOpen(false); setCommandQuery(''); }}><div className="studio-command"><label><Search size={18} /><input aria-label="Search projects and workspaces" placeholder="A project, workspace, or a fresh start…" value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} autoFocus /></label><span>PROJECTS</span>{state.assistants.filter((a) => `${a.draft.name} ${a.draft.purpose}`.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 8).map((a) => <button key={a.id} onClick={() => { setCommandOpen(false); openProject(a); }}><FolderOpen size={17} /><span>{a.draft.name}<small>{state.orgs.find((o) => o.id === a.orgId)?.name}</small></span><ArrowUpRight size={14} /></button>)}<span>WORKSPACES</span>{state.orgs.filter((o) => o.name.toLowerCase().includes(commandQuery.toLowerCase())).map((o) => <button key={o.id} onClick={() => { selectOrg(o.id); setCommandOpen(false); }}><LayersIcon />{o.name}<ArrowRight size={14} /></button>)}<button onClick={() => { setCommandOpen(false); setCreating(true); }}><Plus size={17} />Create a new project<ArrowRight size={14} /></button>{commandQuery && <button onClick={() => setCommandQuery('')}><X size={15} />Clear search</button>}</div></Modal>}
  </AppFrame>;
}

function LayersIcon() { return <LayoutGrid size={17} />; }
