import { useState, useCallback, type CSSProperties } from 'react';
import type { WorldStore, CharacterStore } from '../../types/stores';
import type { WorldEntry } from '../../types/world';
import type { ExtractedWorldEntry, ExtractedCharacter, ExtractedResult } from '../../types/world';
import { BUILT_IN_CATEGORIES, getCategoryInfo } from '../../types/world';
import type { Character } from '../../types/character';
import { Button } from '../ui/Button';

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    padding: 'var(--spacing-md)',
    minWidth: '560px',
    maxWidth: '720px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    font: 'var(--font-h2)',
    marginBottom: 'var(--spacing-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '20px 0',
    fontSize: 14,
    color: 'var(--color-text-secondary)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0 4px',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sectionToggle: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-accent)',
    fontSize: 12,
    padding: 0,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 'var(--spacing-sm)',
    minHeight: 0,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg, #fafafa)',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: 'pointer',
    accentColor: 'var(--color-accent, #3182CE)',
  },
  nameInput: {
    flex: 1,
    height: 26,
    padding: '0 8px',
    fontSize: 13,
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)',
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  typeSelect: {
    height: 26,
    padding: '0 6px',
    fontSize: 12,
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)',
    color: 'var(--color-text)',
    outline: 'none',
    cursor: 'pointer',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 12,
  },
  fieldLabel: {
    minWidth: 48,
    color: 'var(--color-text-secondary)',
    fontSize: 11,
    paddingTop: 5,
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: 12,
    lineHeight: '1.4',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)',
    color: 'var(--color-text)',
    outline: 'none',
    fontFamily: 'var(--font-family)',
    boxSizing: 'border-box' as const,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--spacing-xs)',
    borderTop: '1px solid var(--color-border)',
    paddingTop: 'var(--spacing-sm)',
  },
  error: {
    background: '#FFF5F5',
    border: '1px solid #FEB2B2',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
    fontSize: 13,
    color: '#E53E3E',
  },
  empty: {
    padding: 12,
    textAlign: 'center' as const,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  countBadge: {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: 11,
    background: 'var(--color-accent, #3182CE)',
    color: '#fff',
  },
  aliasesInput: {
    flex: 1,
    height: 24,
    padding: '0 8px',
    fontSize: 12,
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)',
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
};

interface WorldExtractDialogProps {
  open: boolean;
  fileName: string;
  extractedResult: ExtractedResult;
  isExtracting: boolean;
  extractError: string | null;
  projectId: string;
  worldStore: WorldStore;
  characterStore: CharacterStore;
  onConfirm: (characters: Character[], worldEntries: WorldEntry[]) => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function WorldExtractDialog({
  open,
  fileName,
  extractedResult,
  isExtracting,
  extractError,
  projectId,
  worldStore,
  characterStore,
  onConfirm,
  onCancel,
  onRetry,
}: WorldExtractDialogProps) {
  const [characters, setCharacters] = useState<ExtractedCharacter[]>(extractedResult.characters);
  const [worldEntries, setWorldEntries] = useState<ExtractedWorldEntry[]>(extractedResult.worldEntries);

  // Sync state when extractedResult changes
  if (characters !== extractedResult.characters && extractedResult.characters.length > 0 && characters.length === 0) {
    setCharacters(extractedResult.characters);
    setWorldEntries(extractedResult.worldEntries);
  }

  const customCategories = worldStore.listCustomCategories(projectId);
  const allCategories = [
    ...BUILT_IN_CATEGORIES,
    ...customCategories.map((c) => ({ key: c.key, label: c.label, color: { bg: '#EDF2F7', text: '#4A5568' } })),
  ];

  const selectedCharCount = characters.filter((c) => c.selected).length;
  const selectedWorldCount = worldEntries.filter((e) => e.selected).length;
  const totalSelected = selectedCharCount + selectedWorldCount;

  // Character handlers
  const handleToggleAllChars = useCallback(() => {
    const allSelected = characters.length > 0 && characters.every((c) => c.selected);
    setCharacters((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  }, [characters]);

  const handleToggleChar = useCallback((index: number) => {
    setCharacters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  }, []);

  const handleUpdateChar = useCallback((index: number, updates: Partial<ExtractedCharacter>) => {
    setCharacters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  // World entry handlers
  const handleToggleAllWorld = useCallback(() => {
    const allSelected = worldEntries.length > 0 && worldEntries.every((e) => e.selected);
    setWorldEntries((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
  }, [worldEntries]);

  const handleToggleWorld = useCallback((index: number) => {
    setWorldEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  }, []);

  const handleUpdateWorld = useCallback((index: number, updates: Partial<ExtractedWorldEntry>) => {
    setWorldEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    // Create characters
    const createdChars: Character[] = [];
    for (const char of characters.filter((c) => c.selected)) {
      const created = characterStore.createCharacter(projectId, {
        name: char.name,
        aliases: char.aliases,
        appearance: char.appearance,
        personality: char.personality,
        backstory: char.backstory,
        customAttributes: {},
      });
      createdChars.push(created);
    }

    // Create world entries
    const createdEntries: WorldEntry[] = [];
    for (const entry of worldEntries.filter((e) => e.selected)) {
      const created = worldStore.createEntry({
        projectId,
        type: entry.type,
        name: entry.name,
        description: entry.description,
        associatedCharacterIds: [],
      });
      createdEntries.push(created);
    }

    onConfirm(createdChars, createdEntries);
  }, [characters, worldEntries, projectId, characterStore, worldStore, onConfirm]);

  if (!open) return null;

  const hasAnyResult = characters.length > 0 || worldEntries.length > 0;

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={s.title}>
          <span>从文档导入资料</span>
          {fileName && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 400 }}>{fileName}</span>}
        </div>

        {isExtracting && (
          <div style={s.loading}>
            <span>⏳</span> AI 正在分析文本，提取角色和世界观设定...
          </div>
        )}

        {extractError && (
          <div style={s.error}>
            <div>{extractError}</div>
            <Button variant="secondary" onClick={onRetry} style={{ height: 24, fontSize: 11, marginTop: 6 }}>
              重试
            </Button>
          </div>
        )}

        {!isExtracting && !extractError && !hasAnyResult && (
          <div style={s.empty}>未从文本中提取到角色或世界观设定</div>
        )}

        {!isExtracting && hasAnyResult && (
          <div style={{ ...s.list, maxHeight: '55vh' }}>
            {/* Characters section */}
            {characters.length > 0 && (
              <>
                <div style={s.sectionHeader}>
                  <div style={s.sectionTitle}>
                    <span>👤 角色</span>
                    <span style={s.countBadge}>{selectedCharCount}/{characters.length}</span>
                  </div>
                  <button style={s.sectionToggle} onClick={handleToggleAllChars}>
                    {characters.every((c) => c.selected) ? '取消全选' : '全选'}
                  </button>
                </div>
                {characters.map((char, i) => (
                  <div key={`char-${i}`} style={{ ...s.item, opacity: char.selected ? 1 : 0.5 }}>
                    <div style={s.itemHeader}>
                      <input type="checkbox" checked={char.selected} onChange={() => handleToggleChar(i)} style={s.checkbox} />
                      <input type="text" value={char.name} onChange={(e) => handleUpdateChar(i, { name: e.target.value })} style={s.nameInput} placeholder="姓名" />
                      <input type="text" value={char.aliases.join('、')} onChange={(e) => handleUpdateChar(i, { aliases: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} style={s.aliasesInput} placeholder="别名（用顿号分隔）" />
                    </div>
                    <div style={s.fieldRow}>
                      <span style={s.fieldLabel}>外貌</span>
                      <input type="text" value={char.appearance} onChange={(e) => handleUpdateChar(i, { appearance: e.target.value })} style={s.fieldInput} placeholder="外貌描写" />
                    </div>
                    <div style={s.fieldRow}>
                      <span style={s.fieldLabel}>性格</span>
                      <input type="text" value={char.personality} onChange={(e) => handleUpdateChar(i, { personality: e.target.value })} style={s.fieldInput} placeholder="性格特点" />
                    </div>
                    <div style={s.fieldRow}>
                      <span style={s.fieldLabel}>背景</span>
                      <input type="text" value={char.backstory} onChange={(e) => handleUpdateChar(i, { backstory: e.target.value })} style={s.fieldInput} placeholder="背景故事" />
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* World entries section */}
            {worldEntries.length > 0 && (
              <>
                <div style={s.sectionHeader}>
                  <div style={s.sectionTitle}>
                    <span>🌍 世界观</span>
                    <span style={s.countBadge}>{selectedWorldCount}/{worldEntries.length}</span>
                  </div>
                  <button style={s.sectionToggle} onClick={handleToggleAllWorld}>
                    {worldEntries.every((e) => e.selected) ? '取消全选' : '全选'}
                  </button>
                </div>
                {worldEntries.map((entry, i) => (
                  <div key={`world-${i}`} style={{ ...s.item, opacity: entry.selected ? 1 : 0.5 }}>
                    <div style={s.itemHeader}>
                      <input type="checkbox" checked={entry.selected} onChange={() => handleToggleWorld(i)} style={s.checkbox} />
                      <input type="text" value={entry.name} onChange={(e) => handleUpdateWorld(i, { name: e.target.value })} style={s.nameInput} placeholder="名称" />
                      <select value={entry.type} onChange={(e) => handleUpdateWorld(i, { type: e.target.value })} style={s.typeSelect}>
                        {allCategories.map((cat) => (
                          <option key={cat.key} value={cat.key}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={s.fieldRow}>
                      <span style={s.fieldLabel}>描述</span>
                      <input type="text" value={entry.description} onChange={(e) => handleUpdateWorld(i, { description: e.target.value })} style={s.fieldInput} placeholder="描述" />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div style={s.footer}>
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          {!isExtracting && hasAnyResult && (
            <Button variant="primary" onClick={handleConfirm} disabled={totalSelected === 0}>
              导入选中的 {totalSelected} 项
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
