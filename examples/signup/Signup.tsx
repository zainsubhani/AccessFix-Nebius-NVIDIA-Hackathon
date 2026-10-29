import { useState } from 'react';

type Props = { onSubmit: (value: { email: string; password: string; terms: boolean }) => void };

export default function Signup({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (!terms) return setError('Accept the terms to continue.');
    setError('');
    onSubmit({ email, password, terms });
  }
  return <form noValidate onSubmit={event => { event.preventDefault(); submit(); }}>
    <h1>Create your account</h1>
    <div className="field"><span>Email</span><input data-testid="email" type="email" value={email} placeholder="you@example.com" onChange={e => setEmail(e.target.value)} /></div>
    <div className="field"><span>Password</span><input data-testid="password" type="password" value={password} placeholder="At least 8 characters" onChange={e => setPassword(e.target.value)} /></div>
    <label className="terms"><input data-testid="terms" type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />I agree to the terms</label>
    {error && <p className="form-error">{error}</p>}
    <div className="submit" data-testid="submit" onClick={submit}>Create account</div>
  </form>;
}
