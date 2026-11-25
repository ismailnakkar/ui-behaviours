/**
 * Listens on the document for every behaviour, opens the data-open-on-load dialogs and shows each data-steps stepper at
 * the step it opens at. Later calls do nothing.
 */
export function installUiBehaviours(): void;

/** Writes text to the clipboard: false where navigator.clipboard is absent (plain http) or refuses. */
export function copyText(text: string): Promise<boolean>;

/**
 * POSTs body to url with fetch() as a Laravel AJAX request: X-Requested-With, Accept: application/json and, when the
 * page has them, its meta csrf-token as X-CSRF-TOKEN and its <html lang> as Accept-Language. Rejects only when the
 * request fails; a refusal resolves with its status.
 */
export function post(url: string, body: FormData | URLSearchParams): Promise<Response>;
