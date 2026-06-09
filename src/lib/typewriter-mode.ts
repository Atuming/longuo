import { EditorView } from '@codemirror/view';

/**
 * Create a CodeMirror extension that keeps the cursor line
 * at roughly 1/3 from the top of the viewport while typing.
 *
 * Pass `enabled` as a { current: boolean } ref so the extension
 * can be toggled on/off without recreating the editor.
 */
export function typewriterMode(enabled: { current: boolean }) {
  return EditorView.updateListener.of((update) => {
    if (!enabled.current) return;
    // Only auto-scroll on user-driven cursor moves, not on remote doc changes
    if (!update.selectionSet || !update.view.hasFocus) return;

    const view = update.view;
    const pos = view.state.selection.main.head;
    const line = view.lineBlockAt(pos);

    // Don't scroll when cursor is at the very top of the document
    if (line.top < 60) return;

    const viewportHeight = view.scrollDOM.clientHeight;
    const targetScroll = line.top - viewportHeight * 0.3;

    if (Math.abs(view.scrollDOM.scrollTop - targetScroll) > 12) {
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = Math.max(0, targetScroll);
      });
    }
  });
}
