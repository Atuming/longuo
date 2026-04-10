import { EditorView, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate, hoverTooltip, type Tooltip } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { Character } from '../types/character';

/** Set of characters that have special meaning in regular expressions */
const REGEX_SPECIAL_CHARS = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

/**
 * Escape special regex characters in a string.
 * Exported for independent testing (Property 9 dependency).
 */
export function escapeRegExp(str: string): string {
  let result = '';
  for (const ch of str) {
    if (REGEX_SPECIAL_CHARS.has(ch)) {
      result += '\\' + ch;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Find all character name/alias matches in a text string.
 * Returns an array of match objects with from, to, and characterId.
 * Exported for independent testing (Property 9).
 */
export function findCharacterMatches(
  text: string,
  characters: Character[],
): Array<{ from: number; to: number; characterId: string }> {
  if (!text || characters.length === 0) return [];

  // Collect all (name, characterId) pairs
  const entries: Array<{ pattern: string; characterId: string }> = [];
  for (const ch of characters) {
    if (ch.name) entries.push({ pattern: ch.name, characterId: ch.id });
    for (const alias of ch.aliases ?? []) {
      if (alias) entries.push({ pattern: alias, characterId: ch.id });
    }
  }

  if (entries.length === 0) return [];

  // Sort longest first so the regex alternation prefers longer matches
  entries.sort((a, b) => b.pattern.length - a.pattern.length);

  // Build a single regex with alternation
  const combined = entries.map((e) => escapeRegExp(e.pattern)).join('|');
  const regex = new RegExp(combined, 'g');

  // Build a lookup: matched text -> characterId (first match wins due to sort order)
  const patternToId = new Map<string, string>();
  for (const e of entries) {
    if (!patternToId.has(e.pattern)) {
      patternToId.set(e.pattern, e.characterId);
    }
  }

  const results: Array<{ from: number; to: number; characterId: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const matched = m[0];
    const characterId = patternToId.get(matched);
    if (characterId) {
      results.push({ from: m.index, to: m.index + matched.length, characterId });
    }
  }

  return results;
}

/**
 * Filter characters whose name or any alias contains the query string (case-insensitive).
 * Exported for independent testing (Property 10).
 */
export function filterCharacters(characters: Character[], query: string): Character[] {
  if (!query) return characters;
  const lowerQuery = query.toLowerCase();
  return characters.filter((ch) => {
    if (ch.name.toLowerCase().includes(lowerQuery)) return true;
    return (ch.aliases ?? []).some((alias) => alias.toLowerCase().includes(lowerQuery));
  });
}

/* ── CodeMirror highlighting styles ── */
const characterHighlightTheme = EditorView.baseTheme({
  '.cm-character-name': {
    color: '#2563eb',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '3px',
    cursor: 'pointer',
  },
});

const characterMark = Decoration.mark({ class: 'cm-character-name' });

/* ── Highlight ViewPlugin ── */
function createHighlightPlugin(getCharacters: () => Character[]) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const characters = getCharacters();
        if (characters.length === 0) return builder.finish();

        // Only scan visible ranges for performance
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.sliceDoc(from, to);
          const matches = findCharacterMatches(text, characters);
          // Matches are already in document order from regex exec
          for (const match of matches) {
            builder.add(from + match.from, from + match.to, characterMark);
          }
        }

        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/* ── Autocomplete source ── */
function createCharacterCompletionSource(getCharacters: () => Character[]) {
  return (context: CompletionContext): CompletionResult | null => {
    // Look for @ trigger followed by optional word/CJK characters
    const word = context.matchBefore(/@[\w\u4e00-\u9fff\u3400-\u4dbf]*/);
    if (!word) return null;

    // The query is everything after the @
    const query = word.text.slice(1);
    const characters = getCharacters();
    const filtered = filterCharacters(characters, query);

    return {
      from: word.from,
      options: filtered.map((ch) => ({
        label: `@${ch.name}`,
        displayLabel: ch.name,
        detail: ch.aliases.length > 0 ? `别名: ${ch.aliases.join(', ')}` : undefined,
        apply: ch.name,
      })),
      filter: false, // We already filtered
    };
  };
}

/* ── Tooltip styles ── */
const characterTooltipTheme = EditorView.baseTheme({
  '.cm-character-tooltip': {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    lineHeight: '1.5',
    maxWidth: '280px',
    background: 'var(--color-card, #fff)',
    color: 'var(--color-text, #1a202c)',
    border: '1px solid var(--color-border, #e2e8f0)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  },
  '.cm-character-tooltip-name': {
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '4px',
    color: 'var(--color-primary, #2563eb)',
  },
  '.cm-character-tooltip-field': {
    marginTop: '4px',
    color: 'var(--color-text-secondary, #718096)',
  },
  '.cm-character-tooltip-label': {
    fontWeight: '600',
    color: 'var(--color-text, #1a202c)',
  },
});

/* ── Hover tooltip ── */
function createCharacterHoverTooltip(getCharacters: () => Character[]) {
  return hoverTooltip((view, pos): Tooltip | null => {
    const characters = getCharacters();
    if (characters.length === 0) return null;

    // Check visible ranges around the hover position
    for (const { from, to } of view.visibleRanges) {
      if (pos < from || pos > to) continue;
      const text = view.state.sliceDoc(from, to);
      const matches = findCharacterMatches(text, characters);
      for (const match of matches) {
        const absFrom = from + match.from;
        const absTo = from + match.to;
        if (pos >= absFrom && pos <= absTo) {
          const character = characters.find((c) => c.id === match.characterId);
          if (!character) continue;
          return {
            pos: absFrom,
            end: absTo,
            above: true,
            create() {
              const dom = document.createElement('div');
              dom.className = 'cm-character-tooltip';

              const nameEl = document.createElement('div');
              nameEl.className = 'cm-character-tooltip-name';
              nameEl.textContent = character.name;
              dom.appendChild(nameEl);

              if (character.appearance) {
                const field = document.createElement('div');
                field.className = 'cm-character-tooltip-field';
                const label = document.createElement('span');
                label.className = 'cm-character-tooltip-label';
                label.textContent = '外貌: ';
                field.appendChild(label);
                field.appendChild(document.createTextNode(character.appearance));
                dom.appendChild(field);
              }

              if (character.personality) {
                const field = document.createElement('div');
                field.className = 'cm-character-tooltip-field';
                const label = document.createElement('span');
                label.className = 'cm-character-tooltip-label';
                label.textContent = '性格: ';
                field.appendChild(label);
                field.appendChild(document.createTextNode(character.personality));
                dom.appendChild(field);
              }

              return { dom };
            },
          };
        }
      }
    }
    return null;
  });
}

/**
 * Create CodeMirror extensions for cross-reference highlighting, autocomplete, and hover tooltip.
 * Pass a getter function that returns the current character list.
 */
export function createCrossReferenceExtension(
  getCharacters: () => Character[],
): Extension[] {
  return [
    characterHighlightTheme,
    characterTooltipTheme,
    createHighlightPlugin(getCharacters),
    autocompletion({
      override: [createCharacterCompletionSource(getCharacters)],
      activateOnTyping: true,
    }),
    createCharacterHoverTooltip(getCharacters),
  ];
}
