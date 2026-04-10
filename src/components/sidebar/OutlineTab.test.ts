import { describe, it, expect } from 'vitest';
import { calculateDropPosition, isValidDrop } from './outline-drag-utils';
import type { Chapter } from '../../types/chapter';

describe('calculateDropPosition', () => {
  it('returns "before" when mouse is in the top 1/4 of the target', () => {
    // Target: top=100, height=100 → top 1/4 is [100, 125)
    expect(calculateDropPosition(100, 100, 100)).toBe('before');
    expect(calculateDropPosition(110, 100, 100)).toBe('before');
    expect(calculateDropPosition(124, 100, 100)).toBe('before');
  });

  it('returns "inside" when mouse is in the middle 1/2 of the target', () => {
    // Target: top=100, height=100 → middle is [125, 175]
    expect(calculateDropPosition(125, 100, 100)).toBe('inside');
    expect(calculateDropPosition(150, 100, 100)).toBe('inside');
    expect(calculateDropPosition(175, 100, 100)).toBe('inside');
  });

  it('returns "after" when mouse is in the bottom 1/4 of the target', () => {
    // Target: top=100, height=100 → bottom 1/4 is (175, 200]
    expect(calculateDropPosition(176, 100, 100)).toBe('after');
    expect(calculateDropPosition(190, 100, 100)).toBe('after');
    expect(calculateDropPosition(200, 100, 100)).toBe('after');
  });

  it('returns "inside" when target height is 0', () => {
    expect(calculateDropPosition(100, 100, 0)).toBe('inside');
  });

  it('handles small target heights correctly', () => {
    // height=4: top 1/4 is [0,1), middle [1,3], bottom (3,4]
    expect(calculateDropPosition(50, 50, 4)).toBe('before');
    expect(calculateDropPosition(52, 50, 4)).toBe('inside');
    expect(calculateDropPosition(54, 50, 4)).toBe('after');
  });
});

describe('isValidDrop', () => {
  const noDescendants = () => [] as string[];

  describe('self-drop prevention', () => {
    it('rejects dropping a node on itself', () => {
      expect(isValidDrop('volume', 'volume', 'inside', 'a', 'a', noDescendants)).toBe(false);
      expect(isValidDrop('chapter', 'chapter', 'before', 'a', 'a', noDescendants)).toBe(false);
    });
  });

  describe('descendant drop prevention', () => {
    it('rejects dropping a node into its own descendant', () => {
      const getDescendants = (id: string) => id === 'parent' ? ['child', 'grandchild'] : [];
      expect(isValidDrop('volume', 'chapter', 'inside', 'parent', 'child', getDescendants)).toBe(false);
      expect(isValidDrop('volume', 'section', 'inside', 'parent', 'grandchild', getDescendants)).toBe(false);
    });
  });

  describe('hierarchy validation for "inside" position', () => {
    it('rejects volume inside chapter', () => {
      expect(isValidDrop('volume', 'chapter', 'inside', 'a', 'b', noDescendants)).toBe(false);
    });

    it('rejects volume inside section', () => {
      expect(isValidDrop('volume', 'section', 'inside', 'a', 'b', noDescendants)).toBe(false);
    });

    it('rejects chapter inside section', () => {
      expect(isValidDrop('chapter', 'section', 'inside', 'a', 'b', noDescendants)).toBe(false);
    });

    it('allows volume inside volume (nesting volumes)', () => {
      expect(isValidDrop('volume', 'volume', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });

    it('allows chapter inside volume', () => {
      expect(isValidDrop('chapter', 'volume', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });

    it('allows chapter inside chapter', () => {
      expect(isValidDrop('chapter', 'chapter', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });

    it('allows section inside chapter', () => {
      expect(isValidDrop('section', 'chapter', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });

    it('allows section inside volume', () => {
      expect(isValidDrop('section', 'volume', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });

    it('allows section inside section', () => {
      expect(isValidDrop('section', 'section', 'inside', 'a', 'b', noDescendants)).toBe(true);
    });
  });

  describe('before/after positions (sibling placement)', () => {
    it('allows any level combination for before position', () => {
      const levels: Chapter['level'][] = ['volume', 'chapter', 'section'];
      for (const src of levels) {
        for (const tgt of levels) {
          expect(isValidDrop(src, tgt, 'before', 'a', 'b', noDescendants)).toBe(true);
        }
      }
    });

    it('allows any level combination for after position', () => {
      const levels: Chapter['level'][] = ['volume', 'chapter', 'section'];
      for (const src of levels) {
        for (const tgt of levels) {
          expect(isValidDrop(src, tgt, 'after', 'a', 'b', noDescendants)).toBe(true);
        }
      }
    });

    it('still rejects self-drop for before/after', () => {
      expect(isValidDrop('volume', 'volume', 'before', 'a', 'a', noDescendants)).toBe(false);
      expect(isValidDrop('chapter', 'chapter', 'after', 'a', 'a', noDescendants)).toBe(false);
    });
  });
});
