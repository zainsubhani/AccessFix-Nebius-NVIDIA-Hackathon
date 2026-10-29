import { useState } from 'react';

export default function Confirmation({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return <section className="component-card"><h1>Publish changes</h1><p>Review before publishing.</p><button className="submit" data-testid="open-dialog" onClick={() => setOpen(true)}>Review changes</button>
    {open && <div className="dialog-backdrop"><div className="dialog-card" data-testid="dialog"><h2>Publish changes?</h2><p>This will publish your prepared changes.</p><button data-testid="cancel" onClick={() => setOpen(false)}>Cancel</button><button data-testid="confirm" onClick={() => { onConfirm(); setOpen(false); }}>Publish</button></div></div>}
  </section>;
}
