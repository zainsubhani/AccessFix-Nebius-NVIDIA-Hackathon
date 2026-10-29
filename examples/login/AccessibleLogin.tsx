import { useRef, useState } from 'react';

export default function Login({ onSubmit }: { onSubmit: (value: { email: string; password: string }) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null); const passwordRef = useRef<HTMLInputElement>(null);
  function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError({ field: 'email', message: 'Enter a valid email address.' }); emailRef.current?.focus(); return; }
    if (!password) { setError({ field: 'password', message: 'Enter your password.' }); passwordRef.current?.focus(); return; }
    setError(null); onSubmit({ email, password });
  }
  return <form noValidate onSubmit={event => { event.preventDefault(); submit(); }}><h1>Welcome back</h1><p>Sign in to your workspace.</p>
    <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" ref={emailRef} data-testid="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={error?.field === 'email'} aria-describedby={error?.field === 'email' ? 'login-error' : undefined} /></div>
    <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" ref={passwordRef} data-testid="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} aria-invalid={error?.field === 'password'} aria-describedby={error?.field === 'password' ? 'login-error' : undefined} /></div>
    {error && <p className="form-error" id="login-error" role="alert">{error.message}</p>}<button className="submit" data-testid="submit" type="submit">Sign in</button>
  </form>;
}
