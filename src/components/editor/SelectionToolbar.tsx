import { useState, useEffect, useRef, type CSSProperties } from 'react';

export type AIQuickAction = 'polish' | 'expand' | 'rewrite' | 'dialogue';

interface SelectionToolbarProps {
  /** Position to render at (relative to editor container) */
  position: { top: number; left: number } | null;
  /** The selected text */
  selectedText: string;
  /** Called when user clicks an AI action */
  onAction: (action: AIQuickAction, text: string) => void;
  /** Called when user clicks a markdown format button */
  onFormat: (prefix: string, suffix: string) => void;
}

const s: Record<string, CSSProperties> = {
  container: {
    position: 'absolute', zIndex: 100,
    display: 'flex', gap: 2, padding: '4px 6px',
    background: 'var(--color-card, white)',
    border: '1px solid var(--color-border)', borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    fontSize: 12, userSelect: 'none',
    transform: 'translate(-50%, -120%)',
  },
  btn: {
    height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg, #fafafa)', cursor: 'pointer',
    color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 3,
    whiteSpace: 'nowrap', transition: 'background 0.15s',
  },
  aiBtn: {
    height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4,
    border: '1px solid var(--color-accent, #3182CE)',
    background: 'var(--color-accent-light, #EBF8FF)', cursor: 'pointer',
    color: 'var(--color-accent, #3182CE)', display: 'flex', alignItems: 'center', gap: 3,
    whiteSpace: 'nowrap', transition: 'background 0.15s', fontWeight: 500,
  },
  divider: {
    width: 1, background: 'var(--color-border)', margin: '2px 2px',
  },
};

const AI_ACTIONS: { action: AIQuickAction; icon: string; label: string }[] = [
  { action: 'polish', icon: '💎', label: '润色' },
  { action: 'expand', icon: '📝', label: '扩写' },
  { action: 'rewrite', icon: '🔄', label: '改写' },
];

const FORMAT_ACTIONS: { prefix: string; suffix: string; label: string }[] = [
  { prefix: '**', suffix: '**', label: 'B' },
  { prefix: '*', suffix: '*', label: 'I' },
  { prefix: '> ', suffix: '', label: '引' },
];

export function SelectionToolbar({ position, selectedText, onAction, onFormat }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: only show after selection stabilizes
  useEffect(() => {
    if (position && selectedText) {
      timerRef.current = setTimeout(() => setVisible(true), 200);
    } else {
      setVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [position, selectedText]);

  if (!visible || !position) return null;

  return (
    <div
      style={{
        ...s.container,
        top: position.top,
        left: position.left,
      }}
      onMouseDown={(e) => e.preventDefault()} // prevent editor losing selection
    >
      {AI_ACTIONS.map((item) => (
        <button
          key={item.action}
          style={s.aiBtn}
          onClick={() => onAction(item.action, selectedText)}
          title={`AI ${item.label}`}
        >
          {item.icon} {item.label}
        </button>
      ))}
      <div style={s.divider} />
      {FORMAT_ACTIONS.map((item) => (
        <button
          key={item.label}
          style={s.btn}
          onClick={() => onFormat(item.prefix, item.suffix)}
          title={item.label}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
