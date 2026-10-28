import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { loadRemoteState } from '../../domain/store';
import { api } from '../../lib/api';
import { navigate } from '../router';
import { Field } from '../components/ui';
import { Brand } from '../App';
import { ShaderBackground } from '@/components/ui/dark-mono';
import { KnowledgeAtlas } from '@/components/ui/knowledge-atlas';

export function AuthScreen({ mode, redirectTo }: { mode: 'signin' | 'signup'; redirectTo?: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (signup && !name.trim()) return setError('Enter your name.');
    if (password.length < 8) return setError('Use at least 8 characters for the password.');
    setBusy(true); setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password, name: name.trim() }) });
      await loadRemoteState();
      setPassword('');
      navigate(redirectTo && !['/signin', '/signup'].includes(redirectTo) ? redirectTo : signup ? '/workspace/new' : '/projects');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in. Please retry.'); }
    finally { setBusy(false); }
  };
  return <div className="entry-page">
    <section className="entry-main"><header className="entry-nav"><Brand /><a href="#/" className="entry-back"><ArrowLeft size={14} /> Back to home</a></header>
      <main className="entry-form-wrap"><span className="journey-kicker">{signup ? 'YOUR NEXT CHAPTER STARTS HERE.' : 'YOUR KNOWLEDGE. RIGHT WHERE YOU LEFT IT.'}</span><h1>{signup ? 'A fresh start.' : 'Welcome back'}<span>{signup ? 'A clearer way.' : 'Make yourself at home.'}</span></h1><p>{signup ? 'Create an account. Give your information a place to become something useful.' : 'Sign in to your workspace and pick up the conversation.'}</p>
        <div className="entry-mode" aria-label="Account access"><a href="#/signin" aria-current={!signup ? 'page' : undefined}>Sign in</a><a href="#/signup" aria-current={signup ? 'page' : undefined}>Create account</a></div>
        <form onSubmit={submit} noValidate className="entry-form">
          {signup && <Field label="Your name">{(id) => <input id={id} className="input" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} />}</Field>}
          <Field label="Email">{(id) => <div className="entry-input-icon"><Mail size={17} /><input id={id} className="input" type="email" placeholder="you@yourcompany.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} /></div>}</Field>
          <Field label="Password" hint={signup ? 'Make it yours. At least 8 characters.' : undefined}>{(id, describedBy) => <div className="password-field"><input id={id} aria-describedby={describedBy} className="input" type={showPassword ? 'text' : 'password'} placeholder={signup ? 'Create a password' : 'Enter your password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} maxLength={256} /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}</Field>
          {error && <p className="entry-error" role="alert">{error}</p>}
          <button className="journey-button journey-button-ink entry-submit" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Opening your workspace…' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></button>
        </form>
        <div className="entry-privacy"><LockKeyhole size={15} /><p>Your account is saved on the local backend. Your sources stay local unless you choose AI answers.</p></div>
        <div className="entry-demo-link"><span>Just having a look around?</span><a href="#/demo">Try a sample workspace<ArrowUpRightIcon /></a></div>
      </main>
      <footer className="entry-footer"><span>Good knowledge deserves a good home.</span><span>© {new Date().getFullYear()} Anvesha</span></footer>
    </section>
    <aside className="entry-art" aria-label="Your information connected"><div className="entry-art-shader"><ShaderBackground /></div><span className="entry-art-edition">THE KNOWLEDGE EDITION / 001</span><KnowledgeAtlas /><div className="entry-art-copy"><span className="journey-kicker">A LITTLE CONNECTION GOES A LONG WAY.</span><h2>Everything connects.<br /><em>Something clicks.</em></h2><p>A document becomes an insight. A question becomes a conversation. Your knowledge becomes more useful.</p><div><span><Check size={13} /> Sources in view</span><span><Check size={13} /> Ideas in order</span></div></div></aside>
  </div>;
}

function ArrowUpRightIcon() {
  return <ArrowRight size={14} style={{ transform: 'rotate(-40deg)' }} aria-hidden />;
}
