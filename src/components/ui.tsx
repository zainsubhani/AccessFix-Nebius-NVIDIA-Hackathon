import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { RunState } from '../../shared/types';

export function Button({ children, variant = 'secondary', busy = false, className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet'; busy?: boolean }) {
  return <button type="button" {...props} className={`button button-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>{busy && <LoaderCircle className="spinner" size={16} aria-hidden="true" />}{children}</button>;
}
const labels: Record<RunState, string> = { queued: 'Queued', auditing: 'Auditing', proposing: 'Proposing a patch', verifying: 'Verifying', audited: 'Audit complete', accepted: 'Passed · review patch', rejected: 'Patch rejected', unresolved: 'Unresolved', clean: 'Checks passed', error: 'Run blocked', cancelled: 'Cancelled' };
export function Status({ state }: { state: RunState }) { return <span className={`status status-${state}`}><span className="status-dot" aria-hidden="true" />{labels[state]}</span>; }
export function Logo() { return <span className="brand"><svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M12 6H5v28h7m16-28h7v28h-7M13 20l5 5 10-12" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" /></svg><span>AccessFix</span></span>; }
export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{children}</p></div>; }
