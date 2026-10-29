import { useState } from 'react';

export default function Navigation({ onNavigate }: { onNavigate: (destination: string) => void }) {
  const [current, setCurrent] = useState('overview');
  return <section className="component-card"><h1>Your workspace</h1><p>Choose a destination.</p><div className="nav-items">{['overview', 'projects', 'settings'].map(destination => <div key={destination} className={current === destination ? 'selected' : ''} data-testid={`nav-${destination}`} onClick={() => { setCurrent(destination); onNavigate(destination); }}>{destination[0].toUpperCase() + destination.slice(1)}</div>)}</div></section>;
}
