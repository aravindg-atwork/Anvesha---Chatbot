import { IntegrationBeam } from '@/components/ui/integration-beam';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, FileText, Fingerprint, Image, Layers3, Menu, MessageCircle, Plus, ScanText, Search, Sparkles, X } from 'lucide-react';
import { useAppState } from '../../domain/store';
import { emptyState, seedSample, instructionsFor } from '../../domain/operations';
import { viewFromDraft } from '../../domain/knowledge';
import { answerExtractive } from '../../domain/engine/extractive';
import { DEMO_QUESTIONS } from '../../demo/vayutech';
import { navigate } from '../router';
import { Brand } from '../App';
import { AnswerText } from '../chat/ChatPanel';
import { ShaderBackground } from '@/components/ui/dark-mono';

const EXAMPLES = [
  { label: 'Annual leave', question: DEMO_QUESTIONS.supported },
  { label: 'Emergency leave', question: DEMO_QUESTIONS.emergency },
  { label: 'Something not covered', question: DEMO_QUESTIONS.unsupported },
];

function ProductWindow() {
  const view = useMemo(() => {
    const { state, assistantId } = seedSample(emptyState(), 'ready');
    const assistant = state.assistants.find((a) => a.id === assistantId)!;
    return viewFromDraft(assistant, instructionsFor(state, assistant));
  }, []);
  const [selected, setSelected] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const answer = useMemo(() => answerExtractive(view, EXAMPLES[selected].question), [view, selected]);
  const sources = view.sources.filter((s) => s.status === 'ready').slice(0, 3);
  return <div className="product-window">
    <div className="product-window-bar"><div className="window-dots"><i /><i /><i /></div><span>anvesha / your knowledge, connected</span><span className="window-demo"><span /> Interactive sample</span></div>
    <div className="product-window-body">
      <aside className="product-window-nav" aria-label="Sample information"><span className="window-org"><span>V</span> VayuTech <small>Sample workspace</small></span><span className="window-nav-active"><Layers3 size={16} /> Knowledge library <span>{view.sources.length}</span></span><span className="window-nav-label">CONNECTED SOURCES</span>{sources.map((s) => <span className="window-source" key={s.id}><FileText size={17} /><span>{s.title}<small>{s.chunks.length} passages · Ready</small></span><Check size={13} /></span>)}<div className="window-local-note"><Fingerprint size={19} /><span>Your knowledge.<br />Always traceable.</span></div></aside>
      <div className="product-window-chat"><div className="window-chat-heading"><span className="window-assistant"><Sparkles size={20} /></span><div><strong>AskHR</strong><span>Answers from VayuTech’s information</span></div><span className="window-ready"><span /> Ready to help</span></div>
        <div className="window-conversation"><span className="window-conversation-date">A little clarity, on demand</span><p className="window-user-question">{EXAMPLES[selected].question}</p><div className="window-answer" aria-live="polite"><span className="window-answer-name"><Sparkles size={14} /> AskHR</span><div className="window-answer-scroll"><AnswerText text={answer.text} /></div><div className="window-answer-footer"><span><CheckCheck size={14} /> {answer.citations.length ? 'Sources included' : 'No guessing'}</span>{answer.citations.length > 0 && <button onClick={() => setSourceOpen((v) => !v)} aria-expanded={sourceOpen}><BookOpen size={13} /> {sourceOpen ? 'Hide sources' : 'View sources'}</button>}</div>{sourceOpen && answer.citations[0] && <div className="window-source-excerpt"><strong>{answer.citations[0].sourceTitle}</strong><p>{answer.citations[0].highlight || answer.citations[0].excerpt.slice(0, 220)}</p></div>}</div></div>
        <div className="window-prompts" aria-label="Example questions">{EXAMPLES.map((example, i) => <button key={example.label} onClick={() => { setSelected(i); setSourceOpen(false); }} aria-pressed={selected === i}>{example.label}<ArrowUpRight size={12} /></button>)}</div><div className="window-composer"><span>Try one of the questions above</span><span><ArrowRight size={17} /></span></div>
      </div>
    </div>
  </div>;
}

const QUESTIONS = [
  ['What can I give my assistant?', 'Documents, PDFs, Word files, text, images, scanned pages and Q&A spreadsheets. You can also write information directly.'],
  ['Does “training” change an AI model?', 'No. Anvesha reads, checks and indexes your information so your assistant can retrieve and cite relevant passages. Images and scans are processed with OCR.'],
  ['Do I need an AI key?', 'You can search and quote your sources locally without one. Conversational explanations use a configured AI provider and require available model quota.'],
  ['Where does my information live?', 'Your local installation stores workspaces, uploads and conversations on your machine. When you select AI answers, matching sources and conversation context are sent to the configured AI provider.'],
];

export function Landing() {
  const session = useAppState((s) => s.session);
  const [menuOpen, setMenuOpen] = useState(false);
  const start = () => navigate(session ? '/projects' : '/signup');
  const scroll = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setMenuOpen(false); };
  return <div className="launch-page">
    <header className="launch-nav"><Brand /><nav className={menuOpen ? 'is-open' : ''} aria-label="Main navigation"><button onClick={() => scroll('inside')}>The product</button><button onClick={() => scroll('workflow')}>How it works</button><button onClick={() => scroll('questions')}>Good to know</button></nav><div className="launch-nav-actions"><button className="launch-signin" onClick={() => navigate(session ? '/projects' : '/signin')}>{session ? 'Your workspace' : 'Sign in'}<ArrowUpRight size={15} /></button><button className="journey-button journey-button-ink" onClick={start}>Start building<ArrowRight size={15} /></button><button className="launch-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div></header>
    <main>
      <section className="launch-hero"><div className="launch-hero-grid" aria-hidden /><span className="launch-eyebrow"><span /> A home for what you know <ArrowUpRight size={13} /></span><h1>Great answers.<br /><em>Already in your files.</em></h1><p>The documents. The scanned notes. The answers in someone’s head.<br className="launch-desktop-break" /> Bring them together in an assistant that makes knowledge useful.</p><div className="launch-hero-actions"><button className="journey-button journey-button-ink" onClick={start}>Create your assistant<ArrowRight size={17} /></button><button className="launch-text-action" onClick={() => navigate('/demo')}><span><ArrowUpRight size={15} /></span> Explore the live demo</button></div><span className="launch-hero-note"><Check size={13} /> Your sources. Your workspace. Your way.</span>
        <div className="launch-stage" id="inside"><div className="launch-stage-label"><span>MEET YOUR KNOWLEDGE’S NEW HOME</span><ArrowDown size={15} /></div><ProductWindow /><span className="launch-stage-caption">A fictional workspace. A real source-based answer. Try the questions above.</span></div>
      </section>
      <section className="launch-formats" aria-label="Supported source formats"><span>A place for every piece<br /><strong>of the bigger picture.</strong></span><div><FileText size={21} /><span>Documents<small>PDF · Word · Text</small></span></div><div><Image size={21} /><span>Images & scans<small>Readable with OCR</small></span></div><div><MessageCircle size={21} /><span>Questions & answers<small>Write it or import a CSV</small></span></div></section>
      <section className="launch-workflow" id="workflow"><div className="launch-section-intro"><span className="journey-kicker">LESS SEARCHING. MORE UNDERSTANDING.</span><h2>From scattered information<br />to a shared understanding.</h2><p>Keep the complexity behind the scenes.<br />A clear path gets you from your first file to your first answer.</p></div><div className="launch-steps">
        <article><span className="launch-step-number">01 / COLLECT</span><div className="launch-file-art"><div><FileText /><span>Employee handbook.pdf<small>Document connected</small></span><Check size={14} /></div><div><ScanText /><span>A page of possibilities.jpg<small>Image connected</small></span><Check size={14} /></div><div className="launch-file-add"><Plus size={17} /><span>Room for everything you know</span></div></div><h3>Start with what you have.</h3><p>Upload your files, add useful Q&A, or simply write it down. All of it belongs together.</p></article>
        <article><span className="launch-step-number">02 / CONNECT</span><div className="launch-process-art"><div><Search size={20} /><span>Reading between the files.</span></div><span><Check size={13} /> Read & parse</span><span><Check size={13} /> Prepare passages</span><span><Check size={13} /> Build a searchable library</span></div><h3>Let your knowledge connect.</h3><p>Watch real processing turn documents and images into passages your assistant can find.</p></article>
        <article><span className="launch-step-number">03 / UNDERSTAND</span><div className="launch-citation-art"><span><Sparkles size={14} /> An answer with a place to begin.</span><p>“Employees receive <mark>18 days of annual leave</mark> each year.”</p><small><BookOpen size={13} /> Sample policy · Source passage</small></div><h3>Ask. Understand. Go deeper.</h3><p>Test your assistant, open its sources, and ask the follow-up that helps everything click.</p></article>
      </div></section>
      <section className="launch-knowledge-flow" aria-label="How your knowledge becomes an answer">
        <div><span className="journey-kicker">A CLEAR PATH FROM SOURCE TO ANSWER</span><h2>Your information.<br />Working together.</h2><p>Bring documents, images and questions into one project. Anvesha prepares searchable passages so your assistant can find relevant information and show its sources.</p></div>
        <div className="launch-flow-demo"><IntegrationBeam /><p className="launch-flow-caption">Interactive illustration. Select a tile to pause its animation.</p></div>
      </section>
      <section className="launch-principles"><div className="launch-principle-art"><ShaderBackground /><div className="launch-principle-glass"><Fingerprint size={37} strokeWidth={1} /><span>THE SOURCE IS THE STARTING POINT.</span><h3>Good answers<br />have roots.</h3><div><span /><span /><span /></div></div></div><div className="launch-principle-copy"><span className="journey-kicker">CLARITY YOU CAN LOOK INTO.</span><h2>A useful answer.<br />An open book.</h2><p>Your assistant’s answer is just the beginning. See the exact passage behind it, understand what it can and can’t support, and improve the information at the source.</p><ul><li><Check size={16} /><div><strong>Follow the source.</strong><span>Open citations instead of taking an answer on faith.</span></div></li><li><Check size={16} /><div><strong>Give each idea its own space.</strong><span>Separate workspaces, organized projects and a place for every source.</span></div></li><li><Check size={16} /><div><strong>Make it feel like yours.</strong><span>Choose the name, tone, greeting and appearance.</span></div></li></ul><button className="launch-text-action" onClick={start}>Build something useful<ArrowRight size={17} /></button></div></section>
      <section className="launch-faq" id="questions"><div><span className="journey-kicker">A FEW THINGS, CLEARLY.</span><h2>Good questions.<br />Straight answers.</h2><p>Before your knowledge gets a new home.</p></div><div>{QUESTIONS.map(([q, a]) => <details key={q}><summary>{q}<Plus size={18} /></summary><p>{a}</p></details>)}</div></section>
      <section className="launch-final"><span className="journey-kicker">THERE’S SOMETHING GOOD IN THOSE FILES.</span><h2>Let’s give it<br /><em>a voice.</em></h2><button className="journey-button journey-button-gold" onClick={start}>Start your workspace<ArrowUpRight size={18} /></button><span>Build from your own information. Start at your own pace.</span></section>
    </main>
    <footer className="launch-footer"><Brand /><span>For the knowledge you already have.</span><button onClick={() => navigate('/demo')}>Explore demo<ArrowUpRight size={14} /></button></footer>
  </div>;
}
