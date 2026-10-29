import { useState } from 'react';

export default function Navigation({ onNavigate }: { onNavigate: (destination: string) => void }) {
  const [current, setCurrent] = useState('overview');
  return <section className="component-card"><h1>Your workspace</h1><p>Choose a destination.</p><nav aria-label="Workspace" className="nav-items">{['overview', 'projects', 'settings'].map(destination => <a key={destination} href={`#${destination}`} className={current === destination ? 'selected' : ''} aria-current={current === destination ? 'page' : undefined} data-testid={`nav-${destination}`} onClick={() => { setCurrent(destination); onNavigate(destination); }}>{destination[0].toUpperCase() + destination.slice(1)}</a>)}</nav></section>;
}
