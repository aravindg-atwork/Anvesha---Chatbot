import { useState } from 'react';
import { Code2, MessageCircle, X } from 'lucide-react';
import type { Assistant, WidgetSettings } from '../../../domain/types';
import { dispatch } from '../../../domain/store';
import * as op from '../../../domain/operations';
import { Button, CopyBlock, Field, Modal, Notice, Segmented } from '../../components/ui';
import { PublishedChat } from './PublishedChat';

const COLOURS = ['#1d3a5f', '#2e6a4a', '#7a3b2e', '#4b3f72', '#23211e', '#0f6d7a'];
const SCRIPT_HOST = 'https://cdn.anvesha.example';

export function widgetSnippets(a: Assistant) {
  const w = a.share.widget;
  const div = `<!-- Anvesha assistant: ${a.published?.name ?? a.draft.name} -->
<div id="anvesha-assistant"
     data-assistant-id="${a.publicId}"
     data-mode="${w.mode}"
     data-position="${w.position}"
     data-color="${w.color}"></div>`;
  const script = `<script src="${SCRIPT_HOST}/widget.js" async></script>`;
  const js = `<script src="${SCRIPT_HOST}/widget.js"></script>
<script>
  Anvesha.mount({
    assistantId: "${a.publicId}",
    mode: "${w.mode}",          // "floating" or "inline"
    position: "${w.position}",       // "right" or "left"
    color: "${w.color}",
    target: "#anvesha-assistant" // used when mode is "inline"
  });
</script>`;
  return { div, script, js };
}

function InstallModal({ a, onClose }: { a: Assistant; onClose: () => void }) {
  const s = widgetSnippets(a);
  const handoff = `Hello,

Please add our Anvesha assistant to ${a.share.audience === 'public' ? 'our website' : 'our intranet'}.

1. Paste the code below just before the closing </body> tag on the pages where it should appear.
2. For an inline chat, place the <div> where the chat should sit on the page.
3. No secret keys are needed: the assistant ID below is public.

${s.div}
${s.script}

Assistant ID: ${a.publicId}
If anything is unclear, reply to this message.`;
  return (
    <Modal title="Installation instructions" onClose={onClose} wide description="Publishing is done. These steps put the assistant on your website.">
      <div className="stack" style={{ '--gap': '22px' } as React.CSSProperties}>
        <Notice tone="warn">
          Prototype: <code>{SCRIPT_HOST}</code> is a placeholder address. This code shows the real format, but it will not load a live assistant on an external website yet.
        </Notice>
        <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>If someone else manages your website</h3>
          <p className="muted">Send them this message. It has everything they need.</p>
          <CopyBlock code={handoff} label="Message for your web developer" />
        </section>
        <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>Simple: HTML</h3>
          <CopyBlock code={`${s.div}\n${s.script}`} label="HTML snippet" />
        </section>
        <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>Advanced: JavaScript</h3>
          <CopyBlock code={s.js} label="JavaScript snippet" />
        </section>
        <p className="faint small">
          The assistant ID <span className="mono">{a.publicId}</span> is public and safe to put in web pages. It always serves the latest published version.
        </p>
      </div>
    </Modal>
  );
}

export function WidgetSetup({ a, orgName }: { a: Assistant; orgName: string }) {
  const w = a.share.widget;
  const [open, setOpen] = useState(true);
  const [instructions, setInstructions] = useState(false);
  const set = (p: Partial<WidgetSettings>) => dispatch((s) => op.updateShare(s, a.id, { widget: { ...w, ...p } }));
  const side = w.position === 'right' ? { right: 20 } : { left: 20 };

  return (
    <div className="split split-wide" style={{ alignItems: 'start' }}>
      <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <div className="site-mock" aria-label="Website preview">
          <div className="site-mock-bar">
            <span />
            <span />
            <span />
            <span className="site-mock-url">{orgName.toLowerCase().replace(/\s+/g, '')}.example</span>
          </div>
          <div className="site-mock-content" aria-hidden={w.mode === 'floating'}>
            <div className="ph" style={{ width: '40%', height: 22 }} />
            <div className="ph" style={{ width: '90%' }} />
            <div className="ph" style={{ width: '76%' }} />
            <div className="ph" style={{ width: '82%' }} />
            {w.mode === 'inline' && (
              <div className="widget-panel inline" style={{ marginTop: 12 }}>
                <WidgetHead a={a} />
                <PublishedChat a={a} orgName={orgName} surface="widget-inline" compact showInspector={false} />
              </div>
            )}
          </div>
          {w.mode === 'floating' && (
            <>
              {open && (
                <div className="widget-panel" style={side} role="dialog" aria-label={`${a.published?.name} chat`}>
                  <WidgetHead a={a} onClose={() => setOpen(false)} />
                  <PublishedChat a={a} orgName={orgName} surface="widget" compact showInspector={false} />
                </div>
              )}
              <button className="widget-launcher" style={{ ...side, background: w.color }} aria-label={open ? 'Close chat' : 'Open chat'} onClick={() => setOpen(!open)}>
                {open ? <X size={26} /> : <MessageCircle size={26} />}
              </button>
            </>
          )}
        </div>
        <p className="faint small">Live preview. Answers come from published version {a.published?.version}, exactly as visitors would see them.</p>
      </div>

      <div className="stack" style={{ '--gap': '22px' } as React.CSSProperties}>
        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="field-label" id="colour-label">
            Colour
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="colour-label">
            {COLOURS.map((c) => (
              <button key={c} className="swatch" role="radio" aria-checked={w.color === c} aria-label={c} style={{ background: c }} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>
        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="field-label">Style</span>
          <Segmented
            label="Style"
            value={w.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'floating', label: 'Floating button' },
              { value: 'inline', label: 'Inside the page' },
            ]}
          />
        </div>
        {w.mode === 'floating' && (
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="field-label">Position</span>
            <Segmented
              label="Position"
              value={w.position}
              onChange={(position) => set({ position })}
              options={[
                { value: 'left', label: 'Bottom left' },
                { value: 'right', label: 'Bottom right' },
              ]}
            />
          </div>
        )}
        <Field label="Greeting" hint="Leave empty to use the assistant’s greeting.">
          {(id, h) => (
            <textarea id={id} aria-describedby={h} className="textarea" rows={2} value={w.greeting} placeholder={a.published?.greeting} onChange={(e) => set({ greeting: e.target.value })} />
          )}
        </Field>
        <p className="faint small">Appearance changes apply straight away. They don’t change what the assistant knows.</p>
        <div>
          <Button variant="primary" icon={<Code2 size={18} />} onClick={() => setInstructions(true)}>
            Get installation instructions
          </Button>
        </div>
      </div>
      {instructions && <InstallModal a={a} onClose={() => setInstructions(false)} />}
    </div>
  );
}

function WidgetHead({ a, onClose }: { a: Assistant; onClose?: () => void }) {
  return (
    <div className="widget-head" style={{ background: a.share.widget.color }}>
      <strong>{a.published?.name ?? a.draft.name}</strong>
      {onClose && (
        <button className="icon-btn" style={{ color: '#fff', width: 36, height: 36 }} aria-label="Close chat" onClick={onClose}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}
