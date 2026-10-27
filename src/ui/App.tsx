import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronLeft, FlaskConical } from 'lucide-react';
import { STEPS, type Assistant, type Organisation, type StepId } from '../domain/types';
import { useAppState, storageNotices, dispatch } from '../domain/store';
import * as op from '../domain/operations';
import { hasUnpublishedChanges } from '../domain/publish';
import { Redirect, match, navigate, usePath } from './router';
import { BrandMark, Button, Notice, Toasts } from './components/ui';
import { Landing } from './screens/Landing';
import { AuthScreen } from './screens/Auth';
import { StartScreen } from './screens/Start';
import { DemoLauncher } from './screens/DemoLauncher';
import { DescribeStep } from './screens/Describe';
import { KnowledgeStep } from './screens/Knowledge';
import { ReviewStep } from './screens/Review';
import { TryStep } from './screens/Try';
import { ShareStep } from './screens/Share';
import { HomeScreen } from './screens/Home';
import { ConversationsScreen } from './screens/Conversations';
import { SettingsScreen } from './screens/Settings';
import { PublicChat } from './screens/PublicChat';

export const STEP_LABEL: Record<StepId, string> = {
  describe: 'Describe',
  knowledge: 'Add knowledge',
  review: 'Review',
  try: 'Try',
  share: 'Share',
};

export interface StepProps {
  assistant: Assistant;
  org: Organisation;
  mode: 'setup' | 'update';
  onNext: () => void;
  onBack: () => void;
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <a className="brand" href={`#${to}`}>
      <BrandMark />
      Anvesha
    </a>
  );
}

function DemoStrip() {
  const session = useAppState((s) => s.session);
  if (session?.kind !== 'demo') return null;
  return (
    <div className="demo-strip" role="note">
      <div className="container">
        <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
          <FlaskConical size={15} aria-hidden /> Demo mode: no real sign-in. Everything stays in this browser.
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

function StorageBanner() {
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

// ── Guided setup ────────────────────────────────────────

function StepIndicator({ a, current, onGo }: { a: Assistant; current: StepId; onGo: (s: StepId) => void }) {
  return (
    <nav aria-label="Setup progress" style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'center' }}>
      <ol className="steps">
        {STEPS.map((s, i) => {
          const done = a.completedSteps.includes(s) && s !== current;
          const reachable = done || a.completedSteps.includes(STEPS[i - 1]) || i === 0;
          return (
            <li key={s} className="row" style={{ '--gap': '4px', flexWrap: 'nowrap' } as React.CSSProperties}>
              {i > 0 && <span className="step-sep" aria-hidden />}
              <button
                className={`step-btn ${s === current ? 'current' : ''} ${done || (reachable && s !== current) ? 'done' : ''}`}
                aria-current={s === current ? 'step' : undefined}
                disabled={!reachable || s === current}
                onClick={() => onGo(s)}
              >
                <span className="step-num">{done ? <CheckCircle2 size={14} /> : i + 1}</span>
                <span className="step-label">{STEP_LABEL[s]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SaveState() {
  return (
    <span className="save-state hide-sm" aria-live="polite">
      <CheckCircle2 size={15} aria-hidden /> Saved automatically
    </span>
  );
}

function Setup({ a, org, step }: { a: Assistant; org: Organisation; step: StepId }) {
  useEffect(() => {
    if (a.currentStep !== step) dispatch((s) => op.goToStep(s, a.id, step));
  }, [a.id, a.currentStep, step]);
  const i = STEPS.indexOf(step);
  const go = (s: StepId) => navigate(`/a/${a.id}/setup/${s}`);
  const props: StepProps = {
    assistant: a,
    org,
    mode: 'setup',
    onNext: () => {
      dispatch((s) => op.completeStep(s, a.id, step));
      if (i < STEPS.length - 1) go(STEPS[i + 1]);
    },
    onBack: () => (i === 0 ? navigate('/start') : go(STEPS[i - 1])),
  };
  return (
    <div className="page">
      <DemoStrip />
      <TopBar home="/start">
        <StepIndicator a={a} current={step} onGo={go} />
        <SaveState />
      </TopBar>
      <StorageBanner />
      <main className="container" key={step}>
        <StepBody step={step} props={props} />
      </main>
      <Toasts />
    </div>
  );
}

function StepBody({ step, props }: { step: StepId; props: StepProps }) {
  switch (step) {
    case 'describe':
      return <DescribeStep {...props} />;
    case 'knowledge':
      return <KnowledgeStep {...props} />;
    case 'review':
      return <ReviewStep {...props} />;
    case 'try':
      return <TryStep {...props} />;
    case 'share':
      return <ShareStep {...props} />;
  }
}

// ── After launch ────────────────────────────────────────

const EDIT_SECTIONS: { id: string; step: StepId; label: string }[] = [
  { id: 'knowledge', step: 'knowledge', label: 'Information' },
  { id: 'behaviour', step: 'review', label: 'How it helps' },
  { id: 'try', step: 'try', label: 'Try draft' },
  { id: 'share', step: 'share', label: 'Publish & install' },
];

export function UnpublishedBanner({ a }: { a: Assistant }) {
  if (!hasUnpublishedChanges(a) || a.status !== 'live') return null;
  return (
    <div className="banner-wrap">
      <div className="container banner">
        <span>
          You have draft changes that people can’t see yet. They still get <strong>version {a.published!.version}</strong>.
        </span>
        <Button size="sm" variant="primary" onClick={() => navigate(`/a/${a.id}/edit/share`)}>
          Review and publish
        </Button>
      </div>
    </div>
  );
}

export function OwnerShell({ a, children, back }: { a: Assistant; children: ReactNode; back?: { label: string; to: string } }) {
  return (
    <div className="page">
      <DemoStrip />
      <TopBar home={`/a/${a.id}`}>
        <span className="topbar-spacer" />
        <a className="btn btn-ghost btn-sm hide-sm" href="#/start">
          My assistants
        </a>
      </TopBar>
      <UnpublishedBanner a={a} />
      <StorageBanner />
      <main className="container">
        {back && (
          <div style={{ paddingTop: 20 }}>
            <button className="back-link" onClick={() => navigate(back.to)}>
              <ChevronLeft size={18} /> {back.label}
            </button>
          </div>
        )}
        {children}
      </main>
      <Toasts />
    </div>
  );
}

function Update({ a, org, section }: { a: Assistant; org: Organisation; section: string }) {
  const sec = EDIT_SECTIONS.find((s) => s.id === section) ?? EDIT_SECTIONS[0];
  const home = () => navigate(`/a/${a.id}`);
  const props: StepProps = { assistant: a, org, mode: 'update', onNext: home, onBack: home };
  return (
    <OwnerShell a={a} back={{ label: `${a.draft.name || 'Assistant'} home`, to: `/a/${a.id}` }}>
      <nav className="subnav" aria-label="Update sections" style={{ marginTop: 12, marginBottom: 0 }}>
        {EDIT_SECTIONS.map((s) => (
          <button key={s.id} aria-current={s.id === sec.id ? 'page' : undefined} onClick={() => navigate(`/a/${a.id}/edit/${s.id}`)}>
            {s.label}
          </button>
        ))}
      </nav>
      <div key={sec.id}>
        <StepBody step={sec.step} props={props} />
      </div>
    </OwnerShell>
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
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to the start
          </Button>
        </div>
      </main>
    </div>
  );
}

export function App() {
  const path = usePath();
  const state = useAppState((s) => s);

  const publicChat = match('/chat/:publicId', path);
  if (publicChat) return <PublicChat publicId={publicChat.publicId} />;

  if (path === '/' || path === '') return <Landing />;
  if (path === '/signin' || path === '/signup') return <AuthScreen mode={path === '/signin' ? 'signin' : 'signup'} />;
  if (path === '/demo') return <DemoLauncher />;

  if (!state.session) {
    // Owner pages need a (demo or local) session; send people to sign in rather than showing a broken page.
    return <AuthScreen mode="signin" redirectTo={path} />;
  }
  if (path === '/start' || path === '/start/new') return <StartScreen forceNew={path === '/start/new'} />;

  const m =
    match('/a/:id/setup/:step', path) ??
    match('/a/:id/edit/:section', path) ??
    match('/a/:id/conversations', path) ??
    match('/a/:id/settings', path) ??
    match('/a/:id', path);
  if (m) {
    const a = state.assistants.find((x) => x.id === m.id);
    const org = a && state.orgs.find((o) => o.id === a.orgId);
    if (!a || !org) return <NotFound text="This assistant could not be found. It may have been reset." />;
    if (m.step) {
      const step = (STEPS as readonly string[]).includes(m.step) ? (m.step as StepId) : 'describe';
      return <Setup a={a} org={org} step={step} />;
    }
    if (m.section) return <Update a={a} org={org} section={m.section} />;
    if (path.endsWith('/conversations')) return <ConversationsScreen a={a} org={org} />;
    if (path.endsWith('/settings')) return <SettingsScreen a={a} org={org} />;
    if (!a.setupComplete) return <Redirect to={`/a/${a.id}/setup/${a.currentStep}`} />;
    return <HomeScreen a={a} org={org} />;
  }
  return <NotFound />;
}

export { DemoStrip, StorageBanner };
