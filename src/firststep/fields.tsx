import type { TextareaHTMLAttributes } from 'react';

/** Shared practice field: predictable geometry with native keyboard/scroll behaviour. */
export function PracticeTextarea({ className = '', style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`resize-none ${className}`} {...props} style={{ ...style, resize: 'none' }} />;
}
