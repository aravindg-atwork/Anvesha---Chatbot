import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Check, FolderOpen, GraduationCap, Headphones, LogOut, Plus, Sparkles } from 'lucide-react';
import type { Starter } from '../../domain/types';
import { dispatch, dispatchWith, flushRemote, signOut, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { STARTERS } from '../../domain/templates';
import { navigate } from '../router';
import { Button, Field, Modal, toast } from '../components/ui';
import { Brand, DemoStrip, projectPath } from '../App';

export function SignOut() {
  const [busy, setBusy] = useState(false);
  return <button className="studio-signout" type="button" aria-label="Sign out" title="Sign out" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await signOut(); navigate('/'); } catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out.'); }
    finally { setBusy(false); }
  }}><LogOut size={17} /></button>;
}

export function WorkspaceScreen() {
  const state = useAppState((s) => s);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const created = useRef<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Give your workspace a name to continue.');
    setBusy(true); setError(null);
    if (!created.current) created.current = dispatchWith((s) => op.createWorkspace(s, name)).orgId;
    else dispatch((s) => ({ ...s, orgs: s.orgs.map((o) => o.id === created.current ? { ...o, name: name.trim() } : o) }));
    try { await flushRemote(); navigate('/projects?new=1'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your workspace.'); }
    finally { setBusy(false); }
  };
  return <div className="onboard-page"><DemoStrip /><header className="onboard-nav"><Brand /><div><span>{state.session?.displayName || state.session?.email || 'Your account'}</span><SignOut /></div></header><main className="onboard-layout">
    <aside className="onboard-rail"><span className="journey-kicker">YOUR NEW BEGINNING</span><h2>A little setup.<br />A lot of possibility.</h2><ol><li className="is-done"><span><Check size={16} /></span><div><strong>Your account</strong><small>You’re in. Make yourself at home.</small></div></li><li className="is-current"><span>02</span><div><strong>Your workspace</strong><small>A place for your projects and ideas.</small></div></li><li><span>03</span><div><strong>Your first assistant</strong><small>Start with a purpose. Add what it needs.</small></div></li></ol><div className="onboard-rail-note"><FolderOpen size={22} /><p>One workspace can hold many projects. Each assistant keeps its own knowledge and personality.</p></div></aside>
    <section className="onboard-form-section"><span className="onboard-step">STEP 02 <span>OF 03</span></span><h1>Create your<br /><em>knowledge space.</em></h1><p>A home for your organisation, your team,<br className="launch-desktop-break" /> or simply the things you’re working on.</p><form onSubmit={submit} noValidate><Field label="Workspace name" hint="Your organisation, your team, or something that feels like you." error={error || undefined}>{(id, desc) => <input className="input" id={id} aria-describedby={desc} placeholder="For example, Acme Studio" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={100} autoFocus />}</Field><div className="onboard-preview"><span className="onboard-preview-avatar">{name.trim().slice(0, 1).toUpperCase() || <Building2 size={22} />}</span><div><strong>{name.trim() || 'Your workspace'}</strong><span>Your knowledge, all together.</span></div><span className="onboard-preview-tag">WORKSPACE</span></div><button type="submit" className="journey-button journey-button-ink" disabled={busy} aria-busy={busy}>{busy ? 'Making space…' : 'Create workspace'}<ArrowRight size={17} /></button>{state.orgs.length > 0 && <button type="button" className="onboard-back" onClick={() => navigate('/projects')}><ArrowLeft size={14} /> Back to your workspaces</button>}</form><span className="onboard-footnote"><Check size={13} /> Your workspace name can grow with you.</span></section>
  </main><footer className="onboard-footer">A place for what you know. Room for what comes next.</footer></div>;
}

const STARTER_ICONS = { employee: BriefcaseBusiness, admissions: GraduationCap, customer: Headphones, other: Sparkles };

export function NewProjectModal({ orgId, collectionId, onClose }: { orgId: string; collectionId?: string | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starter, setStarter] = useState<Starter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const created = useRef<string | null>(null);
  const create = async () => {
    if (busy) return;
    if (!description.trim()) return setError('Give your assistant a purpose to get started.');
    setBusy(true); setError(null);
    if (!created.current) created.current = dispatchWith((s) => {
      const result = op.createProject(s, orgId, { name, description, starter });
      return { ...result, state: collectionId ? op.arrangeProject(result.state, result.assistantId, { collectionId }) : result.state };
    }).assistantId;
    else dispatch((s) => op.updateDraft(s, created.current!, { ...(name.trim() ? { name: name.trim() } : {}), description: description.trim(), purpose: description.trim(), starter }));
    try { await flushRemote(); navigate(projectPath(created.current, 'upload')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create your project.'); }
    finally { setBusy(false); }
  };
  return <Modal title="New project" description="Every assistant starts with a little purpose." onClose={onClose} wide footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} iconEnd={<ArrowRight size={17} />} onClick={() => void create()}>Create project</Button></>}>
    <div className="project-create-content"><span className="journey-kicker">WHAT WILL YOUR ASSISTANT DO?</span><div className="project-starter-grid">{STARTERS.map((s) => {
      const Icon = STARTER_ICONS[s.id];
      return <button key={s.id} className="project-starter" aria-pressed={starter === s.id} onClick={() => { setStarter(s.id); if (s.example && (!description.trim() || STARTERS.some((item) => item.example === description))) setDescription(s.example); setError(null); }}><Icon size={23} strokeWidth={1.4} /><strong>{s.label}</strong>{starter === s.id && <Check size={13} className="project-starter-check" />}</button>;
    })}</div><Field label="Assistant name" optional hint="A name helps give it a little personality.">{(id, desc) => <input id={id} aria-describedby={desc} className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="For example, Atlas" />}</Field><Field label="What should it help with?" error={error || undefined}>{(id, desc) => <textarea id={id} aria-describedby={desc} className="textarea" rows={3} value={description} onChange={(e) => { setDescription(e.target.value); setError(null); }} placeholder="Help people find clear answers in our information." maxLength={2000} />}</Field><p className="project-create-note"><Plus size={14} /> You’ll add its documents and information next.</p></div>
  </Modal>;
}
