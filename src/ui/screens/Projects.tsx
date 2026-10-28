import { useState } from 'react';
import { ArrowRight, Building2, FileStack, FolderOpen, LayoutGrid, List, LogOut, Plus, Radio, Search, Sparkles } from 'lucide-react';
import { ShaderBackground } from '@/components/ui/dark-mono';
import type { Starter } from '../../domain/types';
import { STEPS } from '../../domain/types';
import { dispatchWith, useAppState, flushRemote, signOut } from '../../domain/store';
import * as op from '../../domain/operations';
import { STARTERS } from '../../domain/templates';
import { navigate } from '../router';
import { Button, Field, Modal, toast } from '../components/ui';
import { AppFrame, Avatar, Brand, DemoStrip, STEP_LABEL, StatusPill, TopBar, projectPath } from '../App';

function SignOut() {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<LogOut size={16} />}
      onClick={async () => {
        try { await signOut(); navigate('/'); }
        catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out.'); }
      }}
    >
      Sign out
    </Button>
  );
}

/** Step 2 of the journey: a workspace holds all of an organisation's projects. */
export function WorkspaceScreen() {
  const hasOrgs = useAppState((s) => s.orgs.length > 0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="page">
      <DemoStrip />
      <TopBar home="/projects">
        <span className="topbar-spacer" />
        <SignOut />
      </TopBar>
      <main className="container narrow screen">
        <form
          className="stack"
          style={{ '--gap': '28px' } as React.CSSProperties}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return setError('Enter a name for your workspace.');
            dispatchWith((s) => op.createWorkspace(s, name));
            try { await flushRemote(); navigate('/projects?new=1'); }
            catch (e) { setError(e instanceof Error ? e.message : 'Could not save workspace.'); }
          }}
        >
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <h1>What’s the name of your organisation?</h1>
            <p className="lead">Your workspace holds all of your organisation’s assistants. You can add more later.</p>
          </div>
          <Field label="Workspace name" error={error ?? undefined}>
            {(id, d) => (
              <input
                id={id}
                aria-describedby={d}
                className="input"
                style={{ fontSize: '1.2rem', minHeight: 58 }}
                placeholder="For example, VayuTech"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
            )}
          </Field>
          <div className="row">
            <Button type="submit" variant="primary" size="lg" iconEnd={<ArrowRight size={20} />}>
              Create workspace
            </Button>
            {hasOrgs && (
              <Button variant="ghost" size="lg" onClick={() => navigate('/projects')}>
                Back
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

function NewProjectModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starter, setStarter] = useState<Starter | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="New project"
      description="A project is one assistant. You can change everything later."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            iconEnd={<ArrowRight size={18} />}
            onClick={async () => {
              if (!description.trim()) return setError('Tell us briefly what it should help with.');
              const { assistantId } = dispatchWith((s) => op.createProject(s, orgId, { name, description, starter }));
              try { await flushRemote(); navigate(projectPath(assistantId, 'upload')); }
              catch (e) { setError(e instanceof Error ? e.message : 'Could not save project.'); }
            }}
          >
            Create project
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="field-label" id="starter-label">
            What kind of assistant?
          </span>
          <div className="row" style={{ '--gap': '8px' } as React.CSSProperties} role="group" aria-labelledby="starter-label">
            {STARTERS.map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={starter === s.id}
                onClick={() => {
                  setStarter(starter === s.id ? null : s.id);
                  if (s.example && (!description.trim() || STARTERS.some((x) => x.example === description))) setDescription(s.example);
                  setError(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="What should it help with?" error={error ?? undefined}>
          {(id, d) => (
            <textarea
              id={id}
              aria-describedby={d}
              className="textarea"
              rows={3}
              placeholder="Help employees understand our leave policy and benefits."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <Field label="Assistant name" optional hint="Leave empty and we’ll suggest one, like AskHR.">
          {(id, d) => <input id={id} aria-describedby={d} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

/** Step 3 of the journey: the projects in a workspace. */
export function ProjectsScreen() {
  const state = useAppState((s) => s);
  const [orgId, setOrgId] = useState<string>(() => state.orgs.find((o) => !o.isSample)?.id ?? state.orgs[0].id);
  const org = state.orgs.find((o) => o.id === orgId) ?? state.orgs[0];
  const [creating, setCreating] = useState(() => window.location.hash.includes('new=1') && !state.assistants.some((a) => a.orgId === org.id));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const projects = state.assistants.filter((a) => a.orgId === org.id);
  const visibleProjects = projects.filter((a) => (filter === 'all' || (filter === 'live' ? a.status === 'live' : a.status !== 'live')) &&
    `${a.draft.name} ${a.draft.purpose}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sourceCount = projects.reduce((sum, a) => sum + a.draft.sources.length + a.draft.faqs.length, 0);

  return (
    <AppFrame
      sidebar={
        <>
          <Brand to="/projects" />
          <nav className="side-group" aria-label="Workspaces">
            <span className="side-group-label">Workspaces</span>
            {state.orgs.map((o) => (
              <button key={o.id} className={`side-row ${o.id === org.id ? 'current' : ''}`} aria-current={o.id === org.id ? 'page' : undefined} onClick={() => setOrgId(o.id)}>
                <Building2 size={16} aria-hidden />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                {o.isSample && <span className="faint small">sample</span>}
              </button>
            ))}
            <button className="side-row" onClick={() => navigate('/workspace/new')}>
              <Plus size={16} aria-hidden /> New workspace
            </button>
          </nav>
          <div className="side-foot">
            <div className="account-summary"><span className="account-avatar">{(state.session?.displayName || state.session?.email || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{state.session?.displayName || 'Your account'}</strong><span>{state.session?.kind === 'demo' ? 'Demo workspace' : state.session?.email}</span></div></div>
            <SignOut />
          </div>
        </>
      }
      topbar={
        <nav aria-label="Breadcrumb" className="crumbs">
          <span>{org.name}</span>
        </nav>
      }
    >
      <main id="main" className="content screen">
        <section className="workspace-hero">
          <div className="workspace-shader" aria-hidden><ShaderBackground /></div>
          <div className="workspace-hero-content"><span className="glass-tag"><Sparkles size={13} /> A home for your knowledge</span>
            <h2>Everything you know.<br /><span>Ready to be helpful.</span></h2>
            <p>Turn the information in your workspace into assistants people can trust.</p>
          </div>
          <div className="workspace-hero-glass"><span className="hero-orbit"><FileStack size={26} /></span><strong>{org.name}</strong><span>Your workspace, connected.</span><div className="hero-dots"><i /><i /><i /><span>Built around your sources</span></div></div>
        </section>
        <div className="workspace-metrics" aria-label="Workspace summary">
          <div><span className="metric-icon"><FolderOpen size={18} /></span><span><strong>{projects.length}</strong><span>Projects</span></span></div>
          <div><span className="metric-icon"><FileStack size={18} /></span><span><strong>{sourceCount}</strong><span>Knowledge sources</span></span></div>
          <div><span className="metric-icon"><Radio size={18} /></span><span><strong>{projects.filter((a) => a.status === 'live').length}</strong><span>Published previews</span></span></div>
        </div>
        <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <h1>Your projects</h1>
            <p className="muted">
              {projects.length ? `${projects.length} assistant${projects.length === 1 ? '' : 's'} in ${org.name}` : `No assistants in ${org.name} yet`}
            </p>
          </div>
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
            New project
          </Button>
        </div>

        <div className="project-toolbar">
          <label className="project-search"><Search size={17} aria-hidden /><input type="search" aria-label="Search projects" placeholder="Find an assistant…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="project-toolbar-end"><select className="input project-filter" aria-label="Filter projects" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All projects</option><option value="draft">Drafts</option><option value="live">Published</option></select>
          <div className="view-toggle" aria-label="Project layout"><button type="button" aria-label="Grid view" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><LayoutGrid size={17} /></button><button type="button" aria-label="List view" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={17} /></button></div></div>
        </div>
        {projects.length > 0 && visibleProjects.length === 0 && <div className="project-no-results"><Search size={25} /><h2>No projects found</h2><p className="muted">Try another name or clear your filters.</p><Button onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button></div>}
        <div className={`project-grid ${layout === 'list' ? 'project-list-view' : ''}`}>
          {visibleProjects.map((a) => {
            const done = a.completedSteps.filter((s) => s !== 'publish').length;
            const stepNo = STEPS.indexOf(a.currentStep) + 1;
            return (
              <button key={a.id} className="project-card" onClick={() => navigate(a.history.length ? projectPath(a.id) : projectPath(a.id, a.currentStep))}>
                <span className="row" style={{ '--gap': '12px', flexWrap: 'nowrap' } as React.CSSProperties}>
                  <Avatar a={a} size={44} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="choice-title" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                      {a.draft.name || 'Untitled project'}
                    </span>
                    <StatusPill a={a} />
                  </span>
                </span>
                <span className="muted small clamp-2">{a.draft.purpose}</span>
                {a.history.length ? (
                  <span className="small faint">
                    {a.draft.sources.length} sources · {a.draft.faqs.length} Q&amp;A
                  </span>
                ) : (
                  <span className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                    <span className="small faint">
                      Step {stepNo} of {STEPS.length}: {STEP_LABEL[a.currentStep]}
                    </span>
                    <span className="progress" aria-hidden>
                      <span style={{ width: `${(done / (STEPS.length - 1)) * 100}%` }} />
                    </span>
                  </span>
                )}
                <span className="project-card-cta">
                  {a.history.length ? 'Open' : 'Continue'} <ArrowRight size={16} />
                </span>
              </button>
            );
          })}
          <button className="project-card project-card-new" onClick={() => setCreating(true)}>
            <span className="choice-icon">
              <Plus size={22} />
            </span>
            <span className="choice-title">New project</span>
            <span className="muted small">Create an assistant from your documents.</span>
          </button>
        </div>
      </main>
      {creating && <NewProjectModal orgId={org.id} onClose={() => setCreating(false)} />}
    </AppFrame>
  );
}
