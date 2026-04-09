import { useState, useEffect, useCallback, type CSSProperties } from 'react';

type ToastType = 'success' | 'error' | 'warning';

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

const typeColors: Record<ToastType, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
};

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: 'var(--spacing-sm)',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2000,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs)',
  pointerEvents: 'none',
};

const itemStyle = (type: ToastType): CSSProperties => ({
  background: typeColors[type],
  color: '#FFFFFF',
  padding: '10px 20px',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  pointerEvents: 'auto',
});

// Global toast state
let toastListeners: Array<(msg: ToastMessage) => void> = [];
let nextId = 0;

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(type: ToastType, text: string) {
  const msg: ToastMessage = { id: nextId++, type, text };
  toastListeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addMessage = useCallback((msg: ToastMessage) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }, 3000);
  }, []);

  useEffect(() => {
    toastListeners.push(addMessage);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== addMessage);
    };
  }, [addMessage]);

  if (messages.length === 0) return null;

  return (
    <div style={containerStyle}>
      {messages.map((msg) => (
        <div key={msg.id} style={itemStyle(msg.type)}>
          {msg.text}
        </div>
      ))}
    </div>
  );
}
