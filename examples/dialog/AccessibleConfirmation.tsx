import { useEffect, useRef, useState } from 'react';

export default function Confirmation({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); const modal = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { modal.current?.showModal(); cancel.current?.focus(); } }, [open]);
  function close() { modal.current?.close(); setOpen(false); trigger.current?.focus(); }
  return <section className="component-card"><h1>Publish changes</h1><p>Review before publishing.</p><button className="submit" ref={trigger} data-testid="open-dialog" onClick={() => setOpen(true)}>Review changes</button>
    <dialog ref={modal} data-testid="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = modal.current?.querySelectorAll<HTMLButtonElement>('button'); if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    }}><h2 id="dialog-title">Publish changes?</h2><p id="dialog-description">This will publish your prepared changes.</p><button ref={cancel} data-testid="cancel" onClick={close}>Cancel</button><button data-testid="confirm" onClick={() => { onConfirm(); close(); }}>Publish</button></dialog>
  </section>;
}
