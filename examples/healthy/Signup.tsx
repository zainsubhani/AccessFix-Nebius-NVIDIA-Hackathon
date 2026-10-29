import { useRef, useState } from 'react';

type Props = { onSubmit: (value: { email: string; password: string; terms: boolean }) => void };

export default function Signup({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ field: 'email', text: 'Enter a valid email address.' }); emailRef.current?.focus(); return;
    }
    if (password.length < 8) {
      setError({ field: 'password', text: 'Use at least 8 characters.' }); passwordRef.current?.focus(); return;
    }
    if (!terms) {
      setError({ field: 'terms', text: 'Accept the terms to continue.' }); termsRef.current?.focus(); return;
    }
    setError(null); onSubmit({ email, password, terms });
  }
  return <form noValidate onSubmit={event => { event.preventDefault(); submit(); }}>
    <h1>Create your account</h1>
    <div className="field"><label htmlFor="email">Email</label><input ref={emailRef} id="email" data-testid="email" autoComplete="email" type="email" value={email} placeholder="you@example.com" aria-invalid={error?.field === 'email'} aria-describedby={error?.field === 'email' ? 'signup-error' : undefined} onChange={e => setEmail(e.target.value)} /></div>
    <div className="field"><label htmlFor="password">Password</label><input ref={passwordRef} id="password" data-testid="password" autoComplete="new-password" type="password" value={password} placeholder="At least 8 characters" aria-invalid={error?.field === 'password'} aria-describedby={error?.field === 'password' ? 'signup-error' : undefined} onChange={e => setPassword(e.target.value)} /></div>
    <label className="terms"><input ref={termsRef} data-testid="terms" type="checkbox" checked={terms} aria-invalid={error?.field === 'terms'} aria-describedby={error?.field === 'terms' ? 'signup-error' : undefined} onChange={e => setTerms(e.target.checked)} />I agree to the terms</label>
    {error && <p id="signup-error" className="form-error" role="alert">{error.text}</p>}
    <button className="submit" data-testid="submit" type="submit">Create account</button>
  </form>;
}
