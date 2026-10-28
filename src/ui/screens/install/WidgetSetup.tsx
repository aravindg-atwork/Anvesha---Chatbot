import { useState } from 'react';
import { Code2, MessageCircle, X } from 'lucide-react';
import type { Assistant } from '../../../domain/types';
import { Button, CopyBlock, Modal, Notice } from '../../components/ui';
import { Avatar, projectPath } from '../../App';
import { navigate } from '../../router';
import { PublishedChat } from './PublishedChat';

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

      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <h3>Put it on your website</h3>
        <ol className="install-steps">
          <li>Get the installation code.</li>
          <li>Paste it into your website, or send it to whoever manages your site.</li>
          <li>Your assistant appears with the look you chose in Make.</li>
        </ol>
        <div>
          <Button variant="primary" icon={<Code2 size={18} />} onClick={() => setInstructions(true)}>
            Get installation instructions
          </Button>
        </div>
        <p className="muted small">
          Want a different colour, avatar or position?{' '}
          <button className="link-btn" onClick={() => navigate(projectPath(a.id, 'make'))}>
            Change it in Make
          </button>
        </p>
      </div>
      {instructions && <InstallModal a={a} onClose={() => setInstructions(false)} />}
    </div>
  );
}

function WidgetHead({ a, onClose }: { a: Assistant; onClose?: () => void }) {
  return (
    <div className="widget-head" style={{ background: a.share.widget.color }}>
      <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
        <Avatar a={a} size={28} inverse />
        <strong>{a.published?.name ?? a.draft.name}</strong>
      </span>
      {onClose && (
        <button className="icon-btn" style={{ color: '#fff', width: 36, height: 36 }} aria-label="Close chat" onClick={onClose}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}
