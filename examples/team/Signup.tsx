import { useState } from 'react';

type Props = { onSubmit: (value: { email: string; password: string; terms: boolean }) => void };

export default function Signup({ onSubmit }: Props) {
  const [values, setValues] = useState({ email: '', password: '', terms: false });
  const [message, setMessage] = useState('');
  const update = (key: 'email' | 'password', value: string) => setValues(old => ({ ...old, [key]: value }));
  function register() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return setMessage('Please check your email.');
    if (values.password.length < 8) return setMessage('Your password needs 8 characters.');
    if (!values.terms) return setMessage('Please accept the terms.');
    setMessage(''); onSubmit(values);
  }
  return <form noValidate onSubmit={e => { e.preventDefault(); register(); }}>
    <h1>Join your team</h1>
    <div className="field"><label htmlFor="team-email">Email</label><input id="team-email" data-testid="email" type="email" value={values.email} onChange={e => update('email', e.target.value)} /></div>
    <div className="field"><label htmlFor="team-password">Password</label><input id="team-password" data-testid="password" type="password" value={values.password} onChange={e => update('password', e.target.value)} /></div>
    <label className="terms"><input data-testid="terms" type="checkbox" checked={values.terms} onChange={e => setValues(old => ({ ...old, terms: e.target.checked }))} />I agree to the terms</label>
    {message && <p className="form-error">{message}</p>}
    <button type="submit" className="submit" data-testid="submit">Create account</button>
  </form>;
}
