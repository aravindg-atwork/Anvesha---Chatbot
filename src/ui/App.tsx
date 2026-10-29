import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ExternalLink,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Settings,
} from 'lucide-react';
import { STEPS, type Assistant, type Organisation, type StepId } from '../domain/types';
import { useAppState, storageNotices, dispatch, dispatchWith } from '../domain/store';
import * as op from '../domain/operations';
import { hasUnpublishedChanges } from '../domain/publish';
import { Redirect, match, navigate, usePath } from './router';
import { BrandMark, Button, Notice, Toasts } from './components/ui';
import { Avatar } from './components/avatar';
export { Avatar, AvatarGlyph, AVATAR_KEYS } from './components/avatar';
const Landing = lazy(() => import('./screens/Landing').then(module => ({ default: module.Landing })));
const AuthScreen = lazy(() => import('./screens/Auth').then(module => ({ default: module.AuthScreen })));
const WorkspaceScreen = lazy(() => import('./screens/Projects').then(module => ({ default: module.WorkspaceScreen })));
const ProjectsScreen = lazy(() => import('./screens/Projects').then(module => ({ default: module.ProjectsScreen })));
const DemoLauncher = lazy(() => import('./screens/DemoLauncher').then(module => ({ default: module.DemoLauncher })));
const KnowledgeStep = lazy(() => import('./screens/Knowledge').then(module => ({ default: module.KnowledgeStep })));
const TrainingStep = lazy(() => import('./screens/Training').then(module => ({ default: module.TrainingStep })));
const TryStep = lazy(() => import('./screens/Try').then(module => ({ default: module.TryStep })));
const ReviewStep = lazy(() => import('./screens/Review').then(module => ({ default: module.ReviewStep })));
const MakeStep = lazy(() => import('./screens/Make').then(module => ({ default: module.MakeStep })));
const ShareStep = lazy(() => import('./screens/Share').then(module => ({ default: module.ShareStep })));
const HomeScreen = lazy(() => import('./screens/Home').then(module => ({ default: module.HomeScreen })));
const ConversationsScreen = lazy(() => import('./screens/Conversations').then(module => ({ default: module.ConversationsScreen })));
const SettingsScreen = lazy(() => import('./screens/Settings').then(module => ({ default: module.SettingsScreen })));
const PublicChat = lazy(() => import('./screens/PublicChat').then(module => ({ default: module.PublicChat })));

export const STEP_LABEL: Record<StepId, string> = {
  upload: 'Upload',
  training: 'Training',
  try: 'Try',
  review: 'Review',
  make: 'Make',
  publish: 'Publish',
};

export const STEP_HINT: Record<StepId, string> = {
  upload: 'Add the information it should know',
  training: 'Anvesha prepares your information',
  try: 'Ask questions and check the answers',
  review: 'Decide how it behaves',
  make: 'Choose how it looks',
  publish: 'Share it with people',
};

export interface StepProps {
  assistant: Assistant;
  org: Organisation;
  onNext: () => void;
  onBack: () => void;
  /** 1-based position, for "Step 2 of 6". */
  stepNumber: number;
  nextLabel?: string;
}

export const projectPath = (id: string, step?: StepId | 'conversations' | 'settings') => (step ? `/p/${id}/${step}` : `/p/${id}`);

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <a className="brand" href={`#${to}`}>
      <BrandMark />
      Anvesha
    </a>
  );
}

export function DemoStrip() {
  const session = useAppState((s) => s.session);
  if (session?.kind !== 'demo') return null;
  return (
    <div className="demo-strip" role="note">
      <div className="container">
        <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
          <FlaskConical size={15} aria-hidden />
          <span>
            Demo mode<span className="hide-sm">: no real sign-in. Everything stays in this browser.</span>
          </span>
        </span>
        <a href="#/demo">Demo launcher</a>
      </div>
    </div>
  );
}

function useScrolled() {
  const [s, set] = useState(false);
  useEffect(() => {
    const on = () => set(window.scrollY > 4);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return s;
}

export function TopBar({ children, home = '/' }: { children?: ReactNode; home?: string }) {
  const scrolled = useScrolled();
  return (
    <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container topbar-inner">
        <Brand to={home} />
        {children}
      </div>
    </header>
  );
}

export function StorageBanner() {
  const [notice, setNotice] = useState(storageNotices.loadNotice());
  const saveError = useAppState(() => storageNotices.saveError());
  if (!notice && !saveError) return null;
  return (
    <div className="container" style={{ paddingTop: 12 }}>
      <Notice tone="warn">
        <div className="spread">
          <span>{saveError ?? notice}</span>
          {notice && (
            <button
              className="link-btn"
              onClick={() => {
                storageNotices.clearLoadNotice();
                setNotice(null);
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </Notice>
    </div>
  );
}

export function StatusPill({ a }: { a: Assistant }) {
  if (a.status === 'live')
    return (
      <span className="pill pill-ok">
        <span className="dot" aria-hidden /> Live · v{a.published?.version}
      </span>
    );
  if (a.status === 'unpublished') return <span className="pill pill-warn">Unpublished</span>;
  return <span className="pill">Draft</span>;
}


// ── Project shell: one place for every step ───────────────────────────────

function StepNav({ a, current }: { a: Assistant; current: StepId | null }) {
  return (
    <nav aria-label="Project steps" className="side-group">
      <span className="side-group-label">Build</span>
      {STEPS.map((s, i) => {
        const done = a.completedSteps.includes(s);
        const isCurrent = s === current;
        return (
          <button
            key={s}
            className={`side-row ${isCurrent ? 'current' : ''} ${done ? 'done' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            title={STEP_HINT[s]}
            onClick={() => navigate(projectPath(a.id, s))}
          >
            <span className="side-num" aria-hidden>
              {done && !isCurrent ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            {STEP_LABEL[s]}
            {done && !isCurrent && <span className="sr-only">(done)</span>}
          </button>
        );
      })}
    </nav>
  );
}

type ShellSection = StepId | 'overview' | 'conversations' | 'settings';

/** Framed sheet: one ivory frame (sidebar + top bar), the work on a white sheet. */
export function AppFrame({ sidebar, topbar, children, className = '' }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePath();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className={`page ${className}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <DemoStrip />
      <div className={`app-frame ${open ? 'menu-open' : ''}`}>
        <aside
          className="sidebar"
          aria-label="Navigation"
          onClick={(e) => {
            // Any choice in the menu closes it, including the page you are already on.
            if ((e.target as HTMLElement).closest('a, button')) setOpen(false);
          }}
        >
          {sidebar}
        </aside>
        {open && <div className="menu-scrim" onClick={() => setOpen(false)} aria-hidden />}
        <header className="app-topbar">
          <button className="icon-btn menu-toggle" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          {topbar}
        </header>
        <div className="app-sheet">{children}</div>
      </div>
      <Toasts />
    </div>
  );
}

export function ProjectShell({ a, org, current, children }: { a: Assistant; org: Organisation; current: ShellSection; children: ReactNode }) {
  const step = (STEPS as readonly string[]).includes(current) ? (current as StepId) : null;
  const manage: { id: ShellSection; label: string; icon: ReactNode; show: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} />, show: a.history.length > 0 },
    { id: 'conversations', label: 'Conversations', icon: <BarChart3 size={17} />, show: true },
    { id: 'settings', label: 'Settings', icon: <Settings size={17} />, show: true },
  ];
  return (
    <AppFrame
      sidebar={
        <>
          <Brand to="/projects" />
          <a className="side-row" href="#/projects">
            <ChevronLeft size={16} aria-hidden /> All projects
          </a>
          <div className="side-project">
            <Avatar a={a} size={36} />
            <div style={{ minWidth: 0 }}>
              <span className="side-project-name">{a.draft.name || 'New project'}</span>
              <span className="small muted">{org.name}</span>
            </div>
          </div>
          <StepNav a={a} current={step} />
          <nav className="side-group" aria-label="Manage">
            <span className="side-group-label">Manage</span>
            {manage
              .filter((m) => m.show)
              .map((m) => (
                <button
                  key={m.id}
                  className={`side-row ${current === m.id ? 'current' : ''}`}
                  aria-current={current === m.id ? 'page' : undefined}
                  onClick={() => navigate(m.id === 'overview' ? projectPath(a.id) : projectPath(a.id, m.id as 'conversations' | 'settings'))}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
          </nav>
        </>
      }
      topbar={
        <>
          <nav aria-label="Breadcrumb" className="crumbs">
            <a href="#/projects">{org.name}</a>
            <span aria-hidden>/</span>
            <span>{a.draft.name || 'New project'}</span>
          </nav>
          <StatusPill a={a} />
          <span className="topbar-spacer" />
          {a.status === 'live' && current !== 'overview' && (
            <a className="btn btn-sm hide-sm" href={`#/chat/${a.publicId}`} target="_blank" rel="noreferrer">
              Open assistant <ExternalLink size={15} />
            </a>
          )}
        </>
      }
    >
      {hasUnpublishedChanges(a) && a.status === 'live' && current !== 'publish' && (
        <div className="banner-wrap">
          <div className="banner" style={{ padding: '12px 40px' }}>
            <span>
              Your changes are saved as a draft. People still see <strong>version {a.published!.version}</strong> until you publish.
            </span>
            <Button size="sm" variant="primary" onClick={() => navigate(projectPath(a.id, 'publish'))}>
              Review and publish
            </Button>
          </div>
        </div>
      )}
      <StorageBanner />
      <main id="main" className="content" key={current}>
        {children}
      </main>
    </AppFrame>
  );
}

function StepPage({ a, org, step }: { a: Assistant; org: Organisation; step: StepId }) {
  useEffect(() => {
    if (a.currentStep !== step) dispatch((s) => op.goToStep(s, a.id, step));
  }, [a.id, a.currentStep, step]);
  const i = STEPS.indexOf(step);
  const props: StepProps = {
    assistant: a,
    org,
    stepNumber: i + 1,
    nextLabel: i < STEPS.length - 1 ? `Continue to ${STEP_LABEL[STEPS[i + 1]]}` : undefined,
    onNext: () => {
      dispatch((s) => op.completeStep(s, a.id, step));
      navigate(i < STEPS.length - 1 ? projectPath(a.id, STEPS[i + 1]) : projectPath(a.id));
    },
    onBack: () => navigate(i === 0 ? '/projects' : projectPath(a.id, STEPS[i - 1])),
  };
  return (
    <ProjectShell a={a} org={org} current={step}>
      {step === 'upload' && <KnowledgeStep {...props} />}
      {step === 'training' && <TrainingStep {...props} />}
      {step === 'try' && <TryStep {...props} />}
      {step === 'review' && <ReviewStep {...props} />}
      {step === 'make' && <MakeStep {...props} />}
      {step === 'publish' && <ShareStep {...props} />}
    </ProjectShell>
  );
}

export function StepHeading({ title, intro }: { step: StepId; n: number; title: string; intro?: ReactNode }) {
  return (
    <div className="screen-head">
      <h1>{title}</h1>
      {intro && <p className="lead">{intro}</p>}
    </div>
  );
}

// ── Routes ──────────────────────────────────────────────

function NotFound({ text = 'This page doesn’t exist.' }: { text?: string }) {
  return (
    <div className="page">
      <TopBar />
      <main className="container narrow screen stack">
        <h1>Not found</h1>
        <p className="lead">{text}</p>
        <div>
          <Button variant="primary" onClick={() => navigate('/projects')}>
            Go to your projects
          </Button>
        </div>
      </main>
    </div>
  );
}

export function App() {
  return <Suspense fallback={<div className="app-opening" role="status"><Brand /><span>Opening your workspace…</span></div>}><AppRoutes /></Suspense>;
}

function AppRoutes() {
  const path = usePath();
  const state = useAppState((s) => s);

  const publicChat = match('/chat/:publicId', path);
  if (publicChat) return <PublicChat publicId={publicChat.publicId} />;

  if (path === '/' || path === '') return <Landing />;
  if (path === '/signin' || path === '/signup') return <AuthScreen mode={path === '/signin' ? 'signin' : 'signup'} />;
  if (path === '/demo') return <DemoLauncher />;
  const demoLink = match('/demo/:kind/:section', path) ?? match('/demo/:kind', path);
  if (demoLink && (demoLink.kind === 'ready' || demoLink.kind === 'published')) return <DemoDeepLink kind={demoLink.kind} section={demoLink.section} />;

  if (!state.session) return <AuthScreen mode="signin" redirectTo={path} />;

  if (path === '/workspace/new') return <WorkspaceScreen />;
  if (path.startsWith('/projects')) {
    if (!state.orgs.length) return <Redirect to="/workspace/new" />;
    return <ProjectsScreen />;
  }
  // Older links from the first prototype.
  if (path === '/start' || path === '/start/new') return <Redirect to="/projects" />;

  const m = match('/p/:id/:section', path) ?? match('/p/:id', path);
  if (m) {
    const a = state.assistants.find((x) => x.id === m.id);
    const org = a && state.orgs.find((o) => o.id === a.orgId);
    if (!a || !org) return <NotFound text="This project could not be found. It may have been reset." />;
    const section = m.section;
    if (section && (STEPS as readonly string[]).includes(section)) return <StepPage a={a} org={org} step={section as StepId} />;
    if (section === 'conversations') return <ConversationsScreen a={a} org={org} />;
    if (section === 'settings') return <SettingsScreen a={a} org={org} />;
    if (section) return <NotFound />;
    if (!a.history.length) return <Redirect to={projectPath(a.id, a.currentStep)} />;
    return <HomeScreen a={a} org={org} />;
  }
  return <NotFound />;
}

/** Presenter deep links (#/demo/ready, #/demo/published[/step]): seed a fresh sample and open it. */
function DemoDeepLink({ kind, section }: { kind: 'ready' | 'published'; section?: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const { assistantId } = dispatchWith((s) => op.seedSample(s, kind));
    const target = section ?? (kind === 'ready' ? 'try' : '');
    navigate(target ? `/p/${assistantId}/${target}` : `/p/${assistantId}`, { replace: true });
  }, [kind, section]);
  return null;
}
