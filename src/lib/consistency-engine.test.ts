import { describe, it, expect } from 'vitest';
import { createConsistencyEngine, levenshteinDistance, similarity } from './consistency-engine';
import type { Character } from '../types/character';

function makeCharacter(name: string, aliases: string[] = []): Character {
  return {
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    name,
    aliases,
    appearance: '',
    personality: '',
    backstory: '',
    customAttributes: {},
  };
}

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('should return length of other string when one is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('should return 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('should compute single substitution', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
  });

  it('should compute single insertion', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
  });

  it('should compute single deletion', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1);
  });

  it('should handle Chinese characters', () => {
    expect(levenshteinDistance('张三', '张四')).toBe(1);
    expect(levenshteinDistance('李明', '李明')).toBe(0);
  });
});

describe('similarity', () => {
  it('should return 1 for identical strings', () => {
    expect(similarity('abc', 'abc')).toBe(1);
  });

  it('should return 0 for completely different strings of same length', () => {
    // 'abc' vs 'xyz' => distance 3, maxLen 3 => 1 - 3/3 = 0
    expect(similarity('abc', 'xyz')).toBe(0);
  });

  it('should return 1 for two empty strings', () => {
    expect(similarity('', '')).toBe(1);
  });
});

describe('ConsistencyEngine', () => {
  const engine = createConsistencyEngine();

  describe('checkChapter', () => {
    it('should return empty array for empty content', () => {
      const chars = [makeCharacter('张三')];
      expect(engine.checkChapter('', chars)).toEqual([]);
    });

    it('should return empty array for empty characters', () => {
      expect(engine.checkChapter('一些内容', [])).toEqual([]);
    });

    it('should not flag exact matches', () => {
      const chars = [makeCharacter('张三')];
      const issues = engine.checkChapter('张三走了过来', chars);
      expect(issues).toEqual([]);
    });

    it('should detect similar but not exact names (substitution)', () => {
      const chars = [makeCharacter('张三')];
      // '张四' has edit distance 1 from '张三'
      const issues = engine.checkChapter('张四走了过来', chars);
      expect(issues.length).toBeGreaterThan(0);
      const issue = issues.find((i) => i.foundText === '张四');
      expect(issue).toBeDefined();
      expect(issue!.suggestedName).toBe('张三');
      expect(issue!.offset).toBe(0);
      expect(issue!.length).toBe(2);
    });

    it('should detect similar names from aliases', () => {
      const chars = [makeCharacter('张三', ['小张'])];
      // '小章' has edit distance 1 from '小张'
      const issues = engine.checkChapter('他叫小章', chars);
      const issue = issues.find((i) => i.foundText === '小章');
      expect(issue).toBeDefined();
      expect(issue!.suggestedName).toBe('小张');
    });

    it('should not flag names with length < 2', () => {
      const chars = [makeCharacter('张')];
      const issues = engine.checkChapter('李走了过来', chars);
      expect(issues).toEqual([]);
    });

    it('should detect insertion-based similarity', () => {
      // '李鸣' has edit distance 1 from '李明' (substitution)
      // For insertion: '赵明月' (3 chars) vs '赵明' (2 chars) => distance 1
      const chars2 = [makeCharacter('赵明')];
      const issues = engine.checkChapter('赵鸣来了', chars2);
      const issue = issues.find((i) => i.foundText === '赵鸣');
      expect(issue).toBeDefined();
      expect(issue!.suggestedName).toBe('赵明');
    });

    it('should detect deletion-based similarity', () => {
      const chars = [makeCharacter('王小明')];
      // '王明' has edit distance 1 from '王小明' (deletion) — window size 2 vs name len 3
      // Actually '王明' length 2 vs '王小明' length 3 => distance 1? No, distance is 1 (delete '小')
      // Wait: levenshtein('王明', '王小明') = 1
      const issues = engine.checkChapter('王明来了', chars);
      const issue = issues.find((i) => i.foundText === '王明');
      expect(issue).toBeDefined();
      expect(issue!.suggestedName).toBe('王小明');
    });

    it('should return issues sorted by offset', () => {
      const chars = [makeCharacter('张三'), makeCharacter('李四')];
      const content = '张四说了什么，李五也来了';
      const issues = engine.checkChapter(content, chars);
      for (let i = 1; i < issues.length; i++) {
        expect(issues[i].offset).toBeGreaterThanOrEqual(issues[i - 1].offset);
      }
    });

    it('should handle multiple characters', () => {
      const chars = [makeCharacter('张三'), makeCharacter('李四')];
      const content = '张四和李五一起走了';
      const issues = engine.checkChapter(content, chars);
      const foundTexts = issues.map((i) => i.foundText);
      expect(foundTexts).toContain('张四');
      expect(foundTexts).toContain('李五');
    });

    it('should handle English names (substitution)', () => {
      const chars = [makeCharacter('John')];
      // 'Jahn' has edit distance 1 from 'John' (o→a substitution)
      const issues = engine.checkChapter('Jahn went home', chars);
      const issue = issues.find((i) => i.foundText === 'Jahn');
      expect(issue).toBeDefined();
      expect(issue!.suggestedName).toBe('John');
    });
  });

  // ── 边界场景：需求 9.1 空内容 ──
  describe('boundary: empty content (Req 9.1)', () => {
    it('should return empty array for empty string with multiple characters', () => {
      const chars = [makeCharacter('张三'), makeCharacter('李四', ['小李'])];
      const issues = engine.checkChapter('', chars);
      expect(issues).toEqual([]);
    });

    it('should not throw for empty string content', () => {
      const chars = [makeCharacter('王小明', ['小明'])];
      expect(() => engine.checkChapter('', chars)).not.toThrow();
    });
  });

  // ── 边界场景：需求 9.2 无角色 ──
  describe('boundary: no characters (Req 9.2)', () => {
    it('should return empty array when characters array is empty and content has text', () => {
      const issues = engine.checkChapter('这是一段很长的小说内容，包含各种文字', []);
      expect(issues).toEqual([]);
    });

    it('should return empty array when all character names are empty strings', () => {
      const chars = [makeCharacter('', []), makeCharacter('', [''])];
      const issues = engine.checkChapter('一些内容', chars);
      expect(issues).toEqual([]);
    });
  });

  // ── 边界场景：需求 9.3 单字符角色名 ──
  describe('boundary: single-character names (Req 9.3)', () => {
    it('should skip single-character name detection', () => {
      const chars = [makeCharacter('张')];
      const issues = engine.checkChapter('王走了过来，李也来了', chars);
      expect(issues).toEqual([]);
    });

    it('should skip single-character alias detection', () => {
      const chars = [makeCharacter('张三', ['张'])];
      // '张' alias is 1 char, should be skipped; '张三' is 2 chars, exact match should not be flagged
      const issues = engine.checkChapter('张三走了过来，李也来了', chars);
      expect(issues).toEqual([]);
    });

    it('should still detect 2-character names while skipping 1-character names', () => {
      const chars = [makeCharacter('张', []), makeCharacter('李四')];
      // '张' (1 char) should be skipped, '李四' (2 chars) should be checked
      // '李五' has edit distance 1 from '李四'
      const issues = engine.checkChapter('李五走了过来', chars);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].foundText).toBe('李五');
      expect(issues[0].suggestedName).toBe('李四');
    });

    it('should skip all characters when all names and aliases are single-character', () => {
      const chars = [makeCharacter('张', ['李']), makeCharacter('王', ['赵'])];
      const issues = engine.checkChapter('这是一段包含各种单字的内容', chars);
      expect(issues).toEqual([]);
    });
  });

  describe('applySuggestion', () => {
    it('should replace text at the specified offset', () => {
      const content = '张四走了过来';
      const issue = {
        chapterId: '',
        offset: 0,
        length: 2,
        foundText: '张四',
        suggestedName: '张三',
        similarity: 0.5,
        ignored: false,
      };
      const result = engine.applySuggestion(content, issue);
      expect(result).toBe('张三走了过来');
    });

    it('should handle replacement in the middle of text', () => {
      const content = '他叫小章，是个好人';
      const issue = {
        chapterId: '',
        offset: 2,
        length: 2,
        foundText: '小章',
        suggestedName: '小张',
        similarity: 0.5,
        ignored: false,
      };
      const result = engine.applySuggestion(content, issue);
      expect(result).toBe('他叫小张，是个好人');
    });

    it('should handle replacement at the end of text', () => {
      const content = '他是张四';
      const issue = {
        chapterId: '',
        offset: 2,
        length: 2,
        foundText: '张四',
        suggestedName: '张三',
        similarity: 0.5,
        ignored: false,
      };
      const result = engine.applySuggestion(content, issue);
      expect(result).toBe('他是张三');
    });

    it('should handle replacement with different length names', () => {
      const content = '王明来了';
      const issue = {
        chapterId: '',
        offset: 0,
        length: 2,
        foundText: '王明',
        suggestedName: '王小明',
        similarity: 0.67,
        ignored: false,
      };
      const result = engine.applySuggestion(content, issue);
      expect(result).toBe('王小明来了');
    });

    it('should not modify other parts of the content', () => {
      const content = '张四和张四一起走了';
      const issue = {
        chapterId: '',
        offset: 0,
        length: 2,
        foundText: '张四',
        suggestedName: '张三',
        similarity: 0.5,
        ignored: false,
      };
      const result = engine.applySuggestion(content, issue);
      // Only the first occurrence at offset 0 should be replaced
      expect(result).toBe('张三和张四一起走了');
    });
  });
});
