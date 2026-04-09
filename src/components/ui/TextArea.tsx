import type { TextareaHTMLAttributes, CSSProperties } from 'react';

const textareaStyle: CSSProperties = {
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  padding: '8px 12px',
  fontSize: '14px',
  color: 'var(--color-text)',
  outline: 'none',
  width: '100%',
  resize: 'vertical',
  minHeight: '80px',
  fontFamily: 'var(--font-family)',
  transition: 'border-color 0.15s',
};

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ style, ...rest }: TextAreaProps) {
  return (
    <textarea
      style={{ ...textareaStyle, ...style }}
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
