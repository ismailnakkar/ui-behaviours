/**
 * Listens on the document for every behaviour, and opens the dialogs marked data-open-on-load. Call it once from the
 * layout script; a second call does nothing.
 */
export function installUiBehaviours(): void;

/** Writes text to the clipboard: false where navigator.clipboard is absent (plain http) or refuses. */
export function copyText(text: string): Promise<boolean>;
