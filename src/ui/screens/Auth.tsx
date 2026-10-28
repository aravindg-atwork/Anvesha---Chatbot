import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, FileText, Image, LockKeyhole, MessagesSquare, Sparkles } from 'lucide-react';
import { loadRemoteState } from '../../domain/store';
import { api } from '../../lib/api';
import { navigate } from '../router';
import { Button, Field } from '../components/ui';
import { Brand } from '../App';
import { ShaderBackground } from '@/components/ui/dark-mono';

export function AuthScreen({ mode, redirectTo }: { mode: 'signin' | 'signup'; redirectTo?: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter an email address, like priya@greenfield.edu.');
    if (signup && !name.trim()) return setError('Enter your name.');
    if (password.length < 8) return setError('Use at least 8 characters for the password.');
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password, name: name.trim() }) });
      await loadRemoteState();
      setPassword('');
      navigate(redirectTo && redirectTo !== '/signin' ? redirectTo : signup ? '/workspace/new' : '/projects');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed. Please retry.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page auth-experience">
      <div className="auth-shader"><ShaderBackground /></div>
      <div className="auth-vignette" aria-hidden />
      <header className="auth-nav"><Brand /><a className="auth-nav-link" href="#/demo">Explore the demo <ArrowRight size={15} /></a></header>
      <main className="auth-layout">
        <section className="auth-story" aria-label="About Anvesha">
          <span className="glass-tag"><span className="live-dot" /> Your knowledge. Connected.</span>
          <h2>Good answers<br />start with<br /><em>your information.</em></h2>
          <p>Bring your documents, images and ideas together. Build an assistant that knows where every answer comes from.</p>
          <div className="auth-source-scene" aria-hidden="true">
            <div className="glass-source glass-source-back"><Image size={20} /><span>Even the scanned pages.</span><Check size={16} /></div>
            <div className="glass-source glass-source-front"><div className="glass-source-icon"><FileText size={23} /></div><div><strong>A place for everything you know</strong><span>Documents · Images · Questions & answers</span></div><span className="source-orbit"><Sparkles size={18} /></span></div>
            <div className="glass-answer"><span className="glass-answer-mark"><MessagesSquare size={17} /></span><span>Clear answers. Sources included.</span><ArrowRight size={16} /></div>
          </div>
          <div className="auth-proof"><span><Check size={15} /> Built from your sources</span><span><LockKeyhole size={14} /> Yours to control</span></div>
        </section>
        <section className="auth-glass" aria-label={signup ? 'Create an account' : 'Sign in'}>
          <div className="auth-form-heading">
            <span className="auth-form-icon"><Sparkles size={22} /></span>
            <span className="eyebrow">{signup ? 'A fresh start' : 'Your workspace awaits'}</span>
            <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p>{signup ? 'A little knowledge. A lot of possibility.' : 'Pick up where your ideas left off.'}</p>
          </div>
          <form className="auth-form stack" style={{ '--gap': '18px' } as React.CSSProperties} onSubmit={submit} noValidate>
            {signup && (
              <Field label="Your name">
                {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
              </Field>
            )}
            <Field label="Email">
              {(id) => <input id={id} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
            </Field>
            <Field label="Password" hint={signup ? 'At least 8 characters' : undefined}>
              {(id) => (
                <div className="password-field">
                <input
                  id={id}
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                />
                <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              )}
            </Field>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit" variant="primary" size="lg" disabled={busy} iconEnd={!busy && <ArrowRight size={18} />}>
              {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <p className="auth-switch">
              {signup ? 'Already have an account?' : 'New to Anvesha?'}{' '}
              <a href={signup ? '#/signin' : '#/signup'}>{signup ? 'Sign in' : 'Create an account'}</a>
          </p>
          <div className="auth-privacy"><LockKeyhole size={15} /><p>Your account is saved on the local backend. Your sources stay local unless you choose AI answers.</p></div>
        </section>
      </main>
      <footer className="auth-footer"><span>A little clarity goes a long way.</span><span>Made for the knowledge you already have.</span></footer>
    </div>
  );
}
