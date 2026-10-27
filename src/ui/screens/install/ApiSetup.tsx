import { useState } from 'react';
import { Play } from 'lucide-react';
import type { Assistant } from '../../../domain/types';
import { viewFromSnapshot, formatLocator } from '../../../domain/knowledge';
import { answerExtractive } from '../../../domain/engine/extractive';
import { Button, CopyBlock, Notice } from '../../components/ui';

const API_BASE = 'https://api.anvesha.example/v1';

export function ApiSetup({ a }: { a: Assistant }) {
  const endpoint = `${API_BASE}/assistants/${a.publicId}/answers`;
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<string | null>(null);

  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer $ANVESHA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "How many days of annual leave do I get?", "user_id": "employee-123"}'`;

  const node = `// Run this on your server. Never put the secret key in browser code.
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.ANVESHA_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ question, user_id: currentUser.id }),
});
const { answer, sources, evidence } = await res.json();`;

  /** Builds the same response shape the API would return, computed locally from the published snapshot. */
  const simulate = () => {
    if (!question.trim()) return;
    if (a.status !== 'live' || !a.published) {
      setResponse(JSON.stringify({ error: 'assistant_unavailable', message: 'This assistant is not published.' }, null, 2));
      return;
    }
    const ans = answerExtractive(viewFromSnapshot(a.published, a.isSample), question);
    setResponse(
      JSON.stringify(
        {
          version: a.published.version,
          answer: ans.text,
          evidence: ans.evidence,
          sources: ans.citations.map((c) => ({ n: c.n, title: c.sourceTitle, reference: formatLocator(c.locator), excerpt: c.highlight })),
        },
        null,
        2,
      ),
    );
  };

  return (
    <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
      <Notice tone="warn">
        Prototype: the endpoint below is an example address and is not live. The format is real, and the simulator further down shows what it would return.
      </Notice>
      <div className="card card-pad stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        <div className="spread">
          <strong>Endpoint</strong>
          <span className="mono" style={{ overflowWrap: 'anywhere' }}>
            POST {endpoint}
          </span>
        </div>
        <hr className="divider" />
        <div className="spread">
          <strong>Assistant ID</strong>
          <span className="mono">{a.publicId}</span>
        </div>
        <hr className="divider" />
        <div className="stack" style={{ '--gap': '4px' } as React.CSSProperties}>
          <strong>Authentication</strong>
          <p className="muted">
            Each request needs a secret key in the <span className="mono">Authorization</span> header. Keep the key on your server, in an environment variable such as{' '}
            <span className="mono">ANVESHA_API_KEY</span>. Anvesha never shows secret keys in the browser, and this prototype does not issue real ones.
          </p>
        </div>
      </div>
      <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h3>cURL</h3>
        <CopyBlock code={curl} label="cURL example" />
      </section>
      <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h3>Server-side JavaScript</h3>
        <CopyBlock code={node} label="JavaScript example" />
      </section>
      <section className="panel stack">
        <h3>Try a request</h3>
        <p className="muted small">Simulated in your browser, using published version {a.published?.version} — the same version the widget uses.</p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            simulate();
          }}
        >
          <label className="sr-only" htmlFor="api-q">
            Question
          </label>
          <input id="api-q" className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Type a question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Button type="submit" icon={<Play size={16} />} disabled={!question.trim()}>
            Send
          </Button>
        </form>
        {response && <CopyBlock code={response} label="Simulated response" />}
      </section>
    </div>
  );
}
