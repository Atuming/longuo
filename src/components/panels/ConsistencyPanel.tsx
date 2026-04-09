import { type CSSProperties } from 'react';
import type { ConsistencyIssue } from '../../types/consistency';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12 },
  summary: {
    fontSize: 14, color: 'var(--color-text)', padding: '8px 12px',
    background: '#F7FAFC', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
  },
  summaryNum: { fontWeight: 600, color: 'var(--color-accent)' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    padding: '8px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', cursor: 'pointer',
    transition: 'background 0.1s',
  },
  itemHover: { background: '#F7FAFC' },
  foundText: {
    fontSize: 14, fontWeight: 500, color: '#E53E3E',
    textDecoration: 'line-through', marginRight: 8,
  },
  arrow: { fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 4px' },
  suggested: { fontSize: 14, fontWeight: 500, color: '#38A169' },
  similarity: { fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 8 },
  actions: { display: 'flex', gap: 6, marginTop: 6 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center' as const, padding: 16 },
};

interface ConsistencyPanelProps {
  issues: ConsistencyIssue[];
  fixedCount: number;
  onApply?: (issue: ConsistencyIssue) => void;
  onIgnore?: (issue: ConsistencyIssue) => void;
  onLocateIssue?: (issue: ConsistencyIssue) => void;
}

export function ConsistencyPanel({ issues, fixedCount, onApply, onIgnore, onLocateIssue }: ConsistencyPanelProps) {
  const visibleIssues = issues.filter((i) => !i.ignored);
  const totalIssues = issues.length;

  return (
    <div style={styles.wrapper}>
      <div style={styles.summary}>
        发现 <span style={styles.summaryNum}>{totalIssues}</span> 个问题，
        已修正 <span style={styles.summaryNum}>{fixedCount}</span> 个
      </div>

      <div style={styles.list}>
        {visibleIssues.length === 0 && (
          <div style={styles.empty}>没有待处理的一致性问题</div>
        )}
        {visibleIssues.map((issue, idx) => (
          <div
            key={idx}
            style={styles.item}
            onClick={() => onLocateIssue?.(issue)}
          >
            <div>
              <span style={styles.foundText}>{issue.foundText}</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.suggested}>{issue.suggestedName}</span>
              <span style={styles.similarity}>{Math.round(issue.similarity * 100)}%</span>
            </div>
            <div style={styles.actions}>
              <Button
                variant="primary"
                style={{ height: 24, fontSize: 11, padding: '0 10px' }}
                onClick={(e) => { e.stopPropagation(); onApply?.(issue); }}
              >
                应用
              </Button>
              <Button
                variant="secondary"
                style={{ height: 24, fontSize: 11, padding: '0 10px' }}
                onClick={(e) => { e.stopPropagation(); onIgnore?.(issue); }}
              >
                忽略
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
