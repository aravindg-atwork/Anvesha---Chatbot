import { useState } from 'react';
import { Building2, Download, MessageSquareText, Radio, RotateCcw } from 'lucide-react';
import { dispatch, dispatchWith, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { DEMO_QUESTIONS } from '../../demo/vayutech';
import { navigate } from '../router';
import { Button, Confirm, toast, Toasts } from '../components/ui';
import { TopBar } from '../App';

const SAMPLE_FILES = [
  { file: 'VayuTech-Employee-Handbook.pdf', d: 'Text PDF with printed page labels (i, ii, 1, 2…), to show real page references.' },
  { file: 'VayuTech-Travel-Policy.docx', d: 'Word document with headings.' },
  { file: 'VayuTech-FAQ.csv', d: 'Questions and answers to import (includes one invalid row).' },
  { file: 'Scanned-Notice.pdf', d: 'Image-only PDF, to show the “Needs attention” state.' },
];

/** Private presenter controls, kept apart from customer workflows. */
export function DemoLauncher() {
  const hasSample = useAppState((s) => s.orgs.some((o) => o.isSample));
  const [confirm, setConfirm] = useState(false);

  const open = (kind: 'empty' | 'ready' | 'published') => {
    if (kind === 'empty') {
      dispatch((s) => ({ ...s, session: s.session ?? { kind: 'demo' } }));
      navigate('/start/new');
      return;
    }
    const { assistantId } = dispatchWith((s) => op.seedSample(s, kind));
    navigate(kind === 'ready' ? `/a/${assistantId}/setup/try` : `/a/${assistantId}`);
  };

  const options = [
    { kind: 'empty' as const, icon: <Building2 size={22} />, t: 'Empty new organisation', d: 'Start from the organisation name and go through all five steps.' },
    { kind: 'ready' as const, icon: <MessageSquareText size={22} />, t: 'Ready-to-test sample', d: 'VayuTech’s AskHR with documents added. Opens on “Try”.' },
    { kind: 'published' as const, icon: <Radio size={22} />, t: 'Published sample', d: 'AskHR already published, ready to try in the widget.' },
  ];

  return (
    <div className="page">
      <div className="demo-strip">
        <div className="container">
          <span>Presenter controls. Not part of the customer experience.</span>
        </div>
      </div>
      <TopBar />
      <main className="container narrow screen stack" style={{ '--gap': '32px' } as React.CSSProperties}>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <span className="eyebrow">Demo launcher</span>
          <h1>Choose where to start</h1>
          <p className="lead">Demo mode needs no account or internet connection. Sample data is fictional and stays in this browser.</p>
        </div>
        <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          {options.map((o) => (
            <button key={o.kind} className="choice" onClick={() => open(o.kind)}>
              <span className="choice-icon">{o.icon}</span>
              <span>
                <span className="choice-title">{o.t}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {o.d}
                </span>
              </span>
            </button>
          ))}
        </div>
        <section className="panel stack">
          <div className="spread">
            <h2 style={{ fontSize: '1.25rem' }}>Reset the sample</h2>
            <Button icon={<RotateCcw size={17} />} onClick={() => setConfirm(true)} disabled={!hasSample}>
              Reset sample
            </Button>
          </div>
          <p className="muted small">
            Removes VayuTech and its conversations, so the next launch starts fresh. Organisations you created yourself are kept.
          </p>
        </section>
        <section className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.25rem' }}>Demo questions</h2>
          <ul className="list small">
            {Object.entries({
              'Emergency (key story)': DEMO_QUESTIONS.emergency,
              Supported: DEMO_QUESTIONS.supported,
              Ambiguous: DEMO_QUESTIONS.ambiguous,
              Unsupported: DEMO_QUESTIONS.unsupported,
              'Conflicting versions': DEMO_QUESTIONS.conflict,
            }).map(([k, q]) => (
              <li key={k}>
                <span className="faint">{k}</span>
                <br />
                {q}
              </li>
            ))}
          </ul>
        </section>
        <section className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.25rem' }}>Sample files to upload</h2>
          <ul className="list">
            {SAMPLE_FILES.map((f) => (
              <li key={f.file} className="spread">
                <div style={{ minWidth: 0 }}>
                  <strong style={{ overflowWrap: 'anywhere' }}>{f.file}</strong>
                  <p className="muted small">{f.d}</p>
                </div>
                <a className="btn btn-sm" href={`/sample-files/${f.file}`} download>
                  <Download size={16} /> Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      {confirm && (
        <Confirm
          title="Reset the sample?"
          body="This removes the VayuTech sample and all its test and published conversations. It can’t be undone. Your own organisations are not affected."
          confirmLabel="Reset sample"
          danger
          onConfirm={() => {
            dispatch(op.removeSampleData);
            toast('Sample reset.');
          }}
          onClose={() => setConfirm(false)}
        />
      )}
      <Toasts />
    </div>
  );
}
