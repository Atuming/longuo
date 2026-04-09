import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base: CSSProperties = {
  height: '36px',
  borderRadius: 'var(--radius)',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: 'none',
  transition: 'opacity 0.15s',
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: {
    ...base,
    background: 'var(--color-accent)',
    color: '#FFFFFF',
    border: '1px solid var(--color-accent)',
  },
  secondary: {
    ...base,
    background: '#FFFFFF',
    color: 'var(--color-accent)',
    border: '1px solid var(--color-accent)',
  },
};

export function Button({ variant = 'primary', style, disabled, ...rest }: ButtonProps) {
  return (
    <button
      style={{
        ...variants[variant],
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
      disabled={disabled}
      {...rest}
    />
  );
}
