import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OutlineTab } from '../sidebar/OutlineTab';
import { CharacterTab } from '../sidebar/CharacterTab';
import { WorldTab } from '../sidebar/WorldTab';
import { TimelineTab } from '../sidebar/TimelineTab';
import { PlotTab } from '../sidebar/PlotTab';
import { CharacterDetailPanel } from '../panels/CharacterDetailPanel';
import { WorldDetailPanel } from '../panels/WorldDetailPanel';
import { TimelineDetailPanel } from '../panels/TimelineDetailPanel';
import type {
  ChapterStore,
  CharacterStore,
  WorldStore,
  TimelineStore,
  PlotStore,
  RelationshipStore,
} from '../../types/stores';

/**
 * 空状态 UI 测试
 * Validates: Requirements 18.1-18.6, 18.9-18.11
 */

// --- Minimal store mocks ---

function createEmptyChapterStore(): ChapterStore {
  return {
    listChapters: vi.fn(() => []),
    getChapter: vi.fn(() => undefined),
    createChapter: vi.fn() as any,
    updateChapter: vi.fn(),
    deleteChapter: vi.fn(),
    reorderChapter: vi.fn(),
    getWordCount: vi.fn(() => 0),
  };
}

function createEmptyCharacterStore(): CharacterStore {
  return {
    listCharacters: vi.fn(() => []),
    searchCharacters: vi.fn(() => []),
    getCharacter: vi.fn(() => undefined),
    createCharacter: vi.fn() as any,
    updateCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    getSnapshotAtTimeline: vi.fn(() => undefined),
    setSnapshotAtTimeline: vi.fn(),
  };
}

function createEmptyWorldStore(): WorldStore {
  return {
    listEntries: vi.fn(() => []),
    filterByType: vi.fn(() => []),
    searchEntries: vi.fn(() => []),
    getEntry: vi.fn(() => undefined),
    createEntry: vi.fn() as any,
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    listCustomCategories: vi.fn(() => []),
    addCustomCategory: vi.fn() as any,
    updateCustomCategory: vi.fn(),
    deleteCustomCategory: vi.fn(),
    getAllCategories: vi.fn(() => []),
  };
}

function createEmptyTimelineStore(): TimelineStore {
  return {
    listTimelinePoints: vi.fn(() => []),
    getTimelinePoint: vi.fn(() => undefined),
    createTimelinePoint: vi.fn() as any,
    updateTimelinePoint: vi.fn(),
    deleteTimelinePoint: vi.fn(),
    reorderTimelinePoint: vi.fn(),
    filterByChapter: vi.fn(() => []),
    filterByCharacter: vi.fn(() => []),
    getReferences: vi.fn(() => ({ characterSnapshots: 0, relationships: 0 })),
  };
}

function createEmptyPlotStore(): PlotStore {
  return {
    listThreads: vi.fn(() => []),
    filterByStatus: vi.fn(() => []),
    getThread: vi.fn(() => undefined),
    createThread: vi.fn() as any,
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
  };
}

function createEmptyRelationshipStore(): RelationshipStore {
  return {
    listRelationships: vi.fn(() => []),
    listRelationshipsAtTimeline: vi.fn(() => []),
    listRelationshipsForCharacter: vi.fn(() => []),
    getRelationship: vi.fn(() => undefined),
    createRelationship: vi.fn() as any,
    updateRelationship: vi.fn(),
    deleteRelationship: vi.fn(),
    filterByType: vi.fn(() => []),
  };
}

// ============================================================
// Tab 组件空状态测试 (需求 18.1-18.5)
// ============================================================

describe('OutlineTab 空状态 (需求 18.1)', () => {
  it('should display empty prompt when no chapters exist', () => {
    render(
      <OutlineTab projectId="proj-1" chapterStore={createEmptyChapterStore()} />,
    );
    expect(screen.getByText('暂无章节，点击下方按钮添加')).toBeInTheDocument();
  });
});

describe('CharacterTab 空状态 (需求 18.2)', () => {
  it('should display empty prompt when no characters exist', () => {
    render(
      <CharacterTab projectId="proj-1" characterStore={createEmptyCharacterStore()} />,
    );
    expect(screen.getByText('暂无角色，点击下方按钮添加')).toBeInTheDocument();
  });
});

describe('WorldTab 空状态 (需求 18.3)', () => {
  it('should display empty prompt when no world entries exist', () => {
    render(
      <WorldTab projectId="proj-1" worldStore={createEmptyWorldStore()} />,
    );
    expect(screen.getByText('暂无世界观条目，点击下方按钮添加')).toBeInTheDocument();
  });
});

describe('TimelineTab 空状态 (需求 18.4)', () => {
  it('should display empty prompt when no timeline points exist', () => {
    render(
      <TimelineTab
        projectId="proj-1"
        timelineStore={createEmptyTimelineStore()}
        chapterStore={createEmptyChapterStore()}
        characterStore={createEmptyCharacterStore()}
      />,
    );
    expect(screen.getByText('暂无时间节点，点击下方按钮添加')).toBeInTheDocument();
  });
});

describe('PlotTab 空状态 (需求 18.5)', () => {
  it('should display empty prompt when no plot threads exist', () => {
    render(
      <PlotTab projectId="proj-1" plotStore={createEmptyPlotStore()} />,
    );
    expect(screen.getByText('暂无情节线索，点击下方按钮添加')).toBeInTheDocument();
  });
});

// ============================================================
// 详情面板 ID 不存在测试 (需求 18.9-18.11)
// ============================================================

describe('CharacterDetailPanel 角色未找到 (需求 18.9)', () => {
  it('should display "角色未找到" when character ID does not exist', () => {
    render(
      <CharacterDetailPanel
        characterId="non-existent-id"
        projectId="proj-1"
        characterStore={createEmptyCharacterStore()}
        relationshipStore={createEmptyRelationshipStore()}
        timelineStore={createEmptyTimelineStore()}
      />,
    );
    expect(screen.getByText('角色未找到')).toBeInTheDocument();
  });
});

describe('WorldDetailPanel 条目未找到 (需求 18.10)', () => {
  it('should display "条目未找到" when entry ID does not exist', () => {
    render(
      <WorldDetailPanel
        entryId="non-existent-id"
        projectId="proj-1"
        worldStore={createEmptyWorldStore()}
        characterStore={createEmptyCharacterStore()}
      />,
    );
    expect(screen.getByText('条目未找到')).toBeInTheDocument();
  });
});

describe('TimelineDetailPanel 节点未找到 (需求 18.11)', () => {
  it('should display "时间节点未找到" when timeline point ID does not exist', () => {
    render(
      <TimelineDetailPanel
        timelinePointId="non-existent-id"
        projectId="proj-1"
        timelineStore={createEmptyTimelineStore()}
        chapterStore={createEmptyChapterStore()}
        characterStore={createEmptyCharacterStore()}
      />,
    );
    expect(screen.getByText('时间节点未找到')).toBeInTheDocument();
  });
});
