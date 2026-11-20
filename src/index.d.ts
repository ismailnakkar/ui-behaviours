/** Listens on the document for every behaviour and opens the data-open-on-load dialogs. Later calls do nothing. */
export function installUiBehaviours(): void;

/** Writes text to the clipboard: false where navigator.clipboard is absent (plain http) or refuses. */
export function copyText(text: string): Promise<boolean>;
