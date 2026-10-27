import { useState } from 'react';
import { Info } from 'lucide-react';
import { dispatch } from '../../domain/store';
import { navigate } from '../router';
import { Button, Field, Notice } from '../components/ui';
import { TopBar } from '../App';

export function AuthScreen({ mode, redirectTo }: { mode: 'signin' | 'signup'; redirectTo?: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = mode === 'signup';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter an email address, like name@example.com.');
    if (signup && !name.trim()) return setError('Enter your name.');
    if (password.length < 8) return setError('Use at least 8 characters for the password.');
    dispatch((s) => ({ ...s, session: { kind: 'local', email: email.trim(), displayName: name.trim() || undefined } }));
    navigate(redirectTo && redirectTo !== '/signin' ? redirectTo : signup ? '/start/new' : '/start');
  };

  return (
    <div className="page">
      <TopBar />
      <main className="auth-wrap">
        <div className="auth-card stack" style={{ '--gap': '22px' } as React.CSSProperties}>
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <h1 style={{ fontSize: '2.2rem' }}>{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="muted">{signup ? 'Start building an assistant for your organisation.' : 'Sign in to continue with your assistants.'}</p>
          </div>
          <form className="card card-pad stack" style={{ '--gap': '18px' } as React.CSSProperties} onSubmit={submit} noValidate>
            {signup && (
              <Field label="Your name">
                {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
              </Field>
            )}
            <Field label="Email">
              {(id) => <input id={id} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
            </Field>
            <Field label="Password">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                />
              )}
            </Field>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit" variant="primary" size="lg">
              {signup ? 'Create account' : 'Sign in'}
            </Button>
            <Notice tone="plain" icon={<Info size={17} />}>
              <span className="small muted">
                Prototype sign-in: this is not real authentication. Your details stay in this browser and the password is not stored or checked.
              </span>
            </Notice>
          </form>
          <div className="spread">
            <span className="muted">
              {signup ? 'Already have an account?' : 'New to Anvesha?'}{' '}
              <a href={signup ? '#/signin' : '#/signup'}>{signup ? 'Sign in' : 'Create an account'}</a>
            </span>
          </div>
          <div className="panel spread">
            <div>
              <strong>Just looking?</strong>
              <p className="muted small">Try Anvesha with a sample company. No account needed.</p>
            </div>
            <Button onClick={() => navigate('/demo')}>Explore demo</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
