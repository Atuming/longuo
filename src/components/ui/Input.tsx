import type { InputHTMLAttributes, CSSProperties } from 'react';

const inputStyle: CSSProperties = {
  height: '36px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  padding: '0 12px',
  fontSize: '14px',
  color: 'var(--color-text)',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
};

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ style, ...rest }: InputProps) {
  return (
    <input
      style={{ ...inputStyle, ...style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        rest.onBlur?.(e);
      }}
      {...rest}
    />
  );
}
