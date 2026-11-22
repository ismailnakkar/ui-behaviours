/**
 * Listens on the document for every behaviour, opens the data-open-on-load dialogs and shows each data-steps stepper at
 * the step it opens at. Later calls do nothing.
 */
export function installUiBehaviours(): void;

/** Writes text to the clipboard: false where navigator.clipboard is absent (plain http) or refuses. */
export function copyText(text: string): Promise<boolean>;
