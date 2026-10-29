import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, CircleAlert, Clock3, LayoutGrid, Monitor, Cpu } from 'lucide-react';
import { Logo } from './components/ui';
import Workbench from './components/Workbench';
import History from './components/History';
import Setup from './components/Setup';
import { useWorkbench } from './hooks/useWorkbench';

type Page = 'workbench' | 'history' | 'setup';
const pageFromHash = (): Page => location.hash === '#history' ? 'history' : location.hash === '#setup' ? 'setup' : 'workbench';
export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const model = useWorkbench();
  const navigate = (next: Page) => { setPage(next); location.hash = next; };
  useEffect(() => { const listener = () => setPage(pageFromHash()); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); }, []);
  useEffect(() => { document.title = `AccessFix · ${page === 'history' ? 'Run history' : page === 'setup' ? 'Setup guide' : 'Accessibility workbench'}`; }, [page]);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to workspace</a><aside className="sidebar"><a className="brand-link" href="#workbench" aria-label="AccessFix workbench"><Logo /></a><nav aria-label="Workspace"><span className="nav-label">WORKSPACE</span>{([{ id: 'workbench', label: 'Workbench', icon: LayoutGrid }, { id: 'history', label: 'Run history', icon: Clock3 }, { id: 'setup', label: 'Setup guide', icon: BookOpen }] as const).map(item => <button key={item.id} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={20} strokeWidth={1.8} />{item.label}</button>)}</nav><button className="provider-card" onClick={() => navigate('setup')}><div><Cpu size={25} /><span><strong>NVIDIA</strong><span>Nemotron</span><small>on Nebius Token Factory</small></span><ChevronRight size={15} /></div><span className="provider-status"><i className={model.config?.providerConfigured ? 'configured-dot' : ''} />{model.config ? model.config.hostedDemo ? model.config.repairAvailable ? 'Live repair available' : 'Recorded demo available' : model.config.providerConfigured ? 'Key configured' : 'Add your API key' : 'Connecting to runner'}</span></button></aside>
    <main id="main-content" className="main-content" tabIndex={-1}><header className="topbar"><div><span>Workspace</span><span className="slash">/</span><strong>{page === 'workbench' ? 'Signup accessibility' : page === 'history' ? 'Run history' : 'Setup guide'}</strong></div><span className="local-label"><Monitor size={17} />{model.config?.hostedDemo ? 'Judge demo' : 'Local workspace'}</span></header>
      {model.connectionError && <div className="error-panel connection-error" role="alert"><CircleAlert size={18} />{model.connectionError}</div>}
      {model.error && <div className="error-panel" role="alert"><CircleAlert size={18} />{model.error}</div>}
      {page === 'workbench' && <Workbench config={model.config} run={model.run} active={model.active} busy={model.busy} loading={model.loading} start={model.start} cancel={model.cancel} clear={() => model.select('')} setup={() => navigate('setup')} />}
      {page === 'history' && <History runs={model.runs} inspect={id => { model.select(id); navigate('workbench'); }} back={() => navigate('workbench')} />}
      {page === 'setup' && <Setup config={model.config} refresh={() => { void model.refresh().catch(() => undefined); }} />}
      <footer className="page-footer"><span>AccessFix · Local preview</span><span>NVIDIA Nemotron × Nebius Token Factory</span></footer>
    </main></div>;
}
