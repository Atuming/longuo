import type { CSSProperties, HTMLAttributes } from 'react';

const cardStyle: CSSProperties = {
  background: 'var(--color-card)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-card)',
  padding: 'var(--spacing-sm)',
};

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ style, ...rest }: CardProps) {
  return <div style={{ ...cardStyle, ...style }} {...rest} />;
}
