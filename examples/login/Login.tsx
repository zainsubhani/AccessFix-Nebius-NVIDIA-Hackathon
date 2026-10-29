import { useState } from 'react';

export default function Login({ onSubmit }: { onSubmit: (value: { email: string; password: string }) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    onSubmit({ email, password });
  }
  return <form noValidate onSubmit={event => { event.preventDefault(); submit(); }}><h1>Welcome back</h1><p>Sign in to your workspace.</p>
    <div className="field"><span>Email</span><input data-testid="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} /></div>
    <div className="field"><span>Password</span><input data-testid="password" type="password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)} /></div>
    {error && <p className="form-error">{error}</p>}<div className="submit" data-testid="submit" onClick={submit}>Sign in</div>
  </form>;
}
