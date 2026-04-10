import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createDailyGoalStore } from '../../stores/daily-goal-store';

/* ── singleton store ── */
const dailyGoalStore = createDailyGoalStore();

/* ── styles ── */
const s: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', position: 'relative', userSelect: 'none',
  },
  progressTrack: {
    width: 80, height: 6, borderRadius: 3,
    background: 'var(--color-border)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  label: { fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  completedLabel: { fontSize: 12, color: 'var(--color-success)', whiteSpace: 'nowrap', fontWeight: 600 },
  popover: {
    position: 'absolute', bottom: '100%', left: 0,
    marginBottom: 8, padding: '12px 14px',
    background: 'var(--color-card)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    zIndex: 200, minWidth: 200,
  },
  popoverTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    width: 80, height: 30, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', padding: '0 8px',
    fontSize: 13, color: 'var(--color-text)', outline: 'none',
  },
  saveBtn: {
    height: 30, padding: '0 12px', borderRadius: 'var(--radius)',
    border: 'none', background: 'var(--color-accent)', color: '#fff',
    fontSize: 12, cursor: 'pointer',
  },
};

interface DailyGoalProgressProps {
  projectId: string;
  wordCount: number;
}

export function DailyGoalProgress({ projectId, wordCount }: DailyGoalProgressProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const config = dailyGoalStore.getConfig(projectId);
  const goal = config.goalWordCount;
  const todayWritten = dailyGoalStore.getTodayWritten(projectId, wordCount);
  const isCompleted = goal > 0 && todayWritten >= goal;
  const percentage = goal > 0 ? Math.min(100, Math.round((todayWritten / goal) * 100)) : 0;

  /* ── close popover on outside click ── */
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  const handleOpen = useCallback(() => {
    const current = dailyGoalStore.getConfig(projectId);
    setGoalInput(current.goalWordCount > 0 ? String(current.goalWordCount) : '');
    setShowPopover(true);
  }, [projectId]);

  const handleSave = useCallback(() => {
    const val = parseInt(goalInput, 10);
    dailyGoalStore.setGoal(projectId, isNaN(val) || val < 0 ? 0 : val);
    setShowPopover(false);
  }, [projectId, goalInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setShowPopover(false);
  }, [handleSave]);

  /* ── hide when goal is 0 ── */
  if (goal === 0 && !showPopover) {
    return (
      <span
        style={{ ...s.label, cursor: 'pointer' }}
        onClick={handleOpen}
        title="设置日更目标"
      >
        🎯 日更目标
      </span>
    );
  }

  const fillColor = isCompleted ? 'var(--color-success)' : 'var(--color-accent)';

  return (
    <div style={s.wrapper} ref={popoverRef}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isCompleted ? (
          <span style={s.completedLabel}>🎉 目标达成！{todayWritten}/{goal}</span>
        ) : (
          <>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${percentage}%`, background: fillColor }} />
            </div>
            <span style={s.label}>{todayWritten}/{goal} 字</span>
          </>
        )}
      </div>

      {showPopover && (
        <div style={s.popover} onClick={(e) => e.stopPropagation()}>
          <div style={s.popoverTitle}>设置日更目标</div>
          <div style={s.inputRow}>
            <input
              style={s.input}
              type="number"
              min={0}
              placeholder="字数"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>字/天</span>
            <button style={s.saveBtn} onClick={handleSave}>确定</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            设为 0 或清空可隐藏进度条
          </div>
        </div>
      )}
    </div>
  );
}
