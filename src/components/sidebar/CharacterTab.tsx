import { useState, useMemo, type CSSProperties } from 'react';
import type { CharacterStore } from '../../types/stores';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  search: { padding: 'var(--spacing-xs)' },
  list: { flex: 1, overflow: 'auto', padding: '0 var(--spacing-xs)' },
  item: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius)',
    fontSize: 14, transition: 'background 0.1s',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 600, color: '#fff', flexShrink: 0,
  },
  name: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  empty: {
    padding: 16, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' as const,
  },
  footer: {
    display: 'flex', padding: 'var(--spacing-xs)', borderTop: '1px solid var(--color-border)',
  },
};

const AVATAR_COLORS = ['#3182CE', '#38A169', '#E53E3E', '#ED64A6', '#9F7AEA', '#DD6B20', '#319795'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return name.charAt(0) || '?';
}

interface CharacterTabProps {
  projectId: string;
  characterStore: CharacterStore;
  onSelectCharacter?: (id: string) => void;
  onAddCharacter?: () => void;
}

export function CharacterTab({ projectId, characterStore, onSelectCharacter, onAddCharacter }: CharacterTabProps) {
  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const characters = useMemo(() => {
    if (query.trim()) {
      return characterStore.searchCharacters(projectId, query.trim());
    }
    return characterStore.listCharacters(projectId);
  }, [characterStore, projectId, query]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.search}>
        <Input
          placeholder="搜索角色姓名/别名"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div style={styles.list}>
        {characters.length === 0 && (
          <div style={styles.empty}>暂无角色，点击下方按钮添加</div>
        )}
        {characters.map((ch) => (
          <div
            key={ch.id}
            style={{
              ...styles.item,
              background: hoveredId === ch.id ? '#EDF2F7' : 'transparent',
            }}
            onClick={() => onSelectCharacter?.(ch.id)}
            onMouseEnter={() => setHoveredId(ch.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={{ ...styles.avatar, background: getAvatarColor(ch.name) }}>
              {getInitial(ch.name)}
            </div>
            <span style={styles.name}>{ch.name}</span>
          </div>
        ))}
      </div>
      <div style={styles.footer}>
        <Button
          variant="secondary"
          style={{ flex: 1, fontSize: 12, height: 30 }}
          onClick={onAddCharacter}
        >
          添加角色
        </Button>
      </div>
    </div>
  );
}
