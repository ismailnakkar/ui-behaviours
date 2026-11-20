/** How long a copy button keeps data-copied or data-copy-failed. */
const COPY_FLASH_MS = 1500;

const COPIED = 'data-copied';
const COPY_FAILED = 'data-copy-failed';

/** The mark a data-submit-once form carries once sent: a second submit is refused until the page is shown again. */
const SUBMITTING = 'data-submitting';

/** The native light-dismiss value of a dialog's closedby attribute, polyfilled where the browser lacks it. */
const CLOSED_BY_ANY = 'any';

const copyTimers = new WeakMap();

let installed = false;

/** The dialog a pointer was pressed on outside its box, so a text selection dragged out of the body doesn't close it. */
let pressedBackdrop = null;

/**
 * Listens on the document for every behaviour, and opens the dialogs marked data-open-on-load. Call it once from the
 * layout script; a second call does nothing.
 */
export function installUiBehaviours() {
    if (installed) {
        return;
    }

    installed = true;

    document.addEventListener('submit', confirmSubmit);
    // After the confirm: a submit refused there was never sent.
    document.addEventListener('submit', submitOnce);
    window.addEventListener('pageshow', releaseSubmitted);
    document.addEventListener('change', checkAll);
    document.addEventListener('click', autoselect);
    document.addEventListener('click', copyButton);
    document.addEventListener('click', showModal);
    document.addEventListener('click', closeModal);
    document.addEventListener('pointerdown', pressBackdrop);
    document.addEventListener('click', closeOnBackdrop);

    openOnLoad();
}

/** navigator.clipboard is absent on plain http and rejects where permission is refused. */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);

        return true;
    } catch {
        return false;
    }
}

/** The element matching $selector at or above a click's target, as a click on a button's label or icon lands there. */
function closestTo({target}, selector) {
    return target instanceof Element ? target.closest(selector) : null;
}

/** A click the browser handles itself: not the main button, or a modified one (new tab, new window, download). */
function isModifiedClick(event) {
    return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function confirmSubmit(event) {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
        return;
    }

    const message = event.submitter?.dataset.confirm ?? event.target.dataset.confirm;

    if (message && !confirm(message)) {
        event.preventDefault();
    }
}

// The submit is refused, not the buttons disabled: a disabled submitter would drop its name and value from the form.
function submitOnce(event) {
    const form = event.target;

    if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !form.hasAttribute('data-submit-once')) {
        return;
    }

    if (form.hasAttribute(SUBMITTING)) {
        event.preventDefault();
    } else {
        form.setAttribute(SUBMITTING, '');
    }
}

// A page restored from the back-forward cache (Back from a payment page) may send its forms again.
function releaseSubmitted({persisted}) {
    if (persisted) {
        for (const form of document.querySelectorAll(`form[${SUBMITTING}]`)) {
            form.removeAttribute(SUBMITTING);
        }
    }
}

function checkboxesNamed(name) {
    return [...document.querySelectorAll('input[type="checkbox"]')].filter((box) => box.name === name && !box.disabled);
}

// The header box sets every row; a row sets the header to checked, unchecked or indeterminate.
function checkAll({target}) {
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
        return;
    }

    const group = target.dataset.checkAll;

    if (group !== undefined) {
        for (const box of checkboxesNamed(group)) {
            box.checked = target.checked;
        }

        return;
    }

    for (const header of document.querySelectorAll('input[data-check-all]')) {
        if (header.dataset.checkAll === target.name) {
            const rows = checkboxesNamed(target.name);
            const checked = rows.filter((box) => box.checked).length;
            const total = rows.length;

            header.checked = total > 0 && checked === total;
            header.indeterminate = checked > 0 && checked < total;
        }
    }
}

// Tabbing in selects a field's text natively; a click only places a caret.
function autoselect({target}) {
    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.matches('[data-autoselect]')) {
        target.select();
    }
}

function isField(element) {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

// data-copy-value wins, for text grouped on screen for reading (a setup key); innerText keeps one line per block
// (a list of recovery codes), where the browser lays the page out.
function copiedTextOf(source) {
    if (source.dataset.copyValue !== undefined) {
        return source.dataset.copyValue;
    }

    if (isField(source)) {
        return source.value;
    }

    return (source.innerText ?? source.textContent ?? '').trim();
}

// A page cancels a copy, say to ask for a missing field first, with preventDefault() in its own click listener.
async function copyButton(event) {
    const button = closestTo(event, '[data-copy]');
    const source = button ? document.getElementById(button.dataset.copy) : null;

    if (!source || event.defaultPrevented) {
        return;
    }

    const copied = await copyText(copiedTextOf(source));

    flashCopied(button, copied);

    if (!copied) {
        selectForManualCopy(source);
    }
}

function flashCopied(button, copied) {
    clearTimeout(copyTimers.get(button));
    button.toggleAttribute(COPIED, copied);
    button.toggleAttribute(COPY_FAILED, !copied);
    copyTimers.set(button, setTimeout(() => {
        button.removeAttribute(COPIED);
        button.removeAttribute(COPY_FAILED);
    }, COPY_FLASH_MS));
}

// Explicit focus(): Safari does not focus a clicked button.
function selectForManualCopy(source) {
    if (isField(source)) {
        source.focus();
        source.select();
    } else {
        getSelection()?.selectAllChildren(source);
    }
}

// Modified clicks, and triggers whose dialog is not on this page, keep the browser's own behaviour (a link's href).
function showModal(event) {
    const opener = closestTo(event, '[data-show-modal]');
    const dialog = opener ? document.getElementById(opener.dataset.showModal) : null;

    if (!(dialog instanceof HTMLDialogElement) || event.defaultPrevented || isModifiedClick(event)) {
        return;
    }

    event.preventDefault();

    if (!dialog.open) {
        dialog.showModal();
    }
}

// preventDefault(): a close button that is a form's submit button closes without sending the form.
function closeModal(event) {
    const dialog = closestTo(event, '[data-close-modal]')?.closest('dialog');

    if (dialog && !event.defaultPrevented) {
        event.preventDefault();
        dialog.close();
    }
}

function openOnLoad() {
    for (const dialog of document.querySelectorAll('dialog[data-open-on-load]')) {
        if (!dialog.open) {
            dialog.showModal();
        }
    }
}

function lightDismissIsNative() {
    return 'closedBy' in HTMLDialogElement.prototype;
}

/** The open dialog with closedby="any" whose backdrop the event is on: on the dialog element, outside its box. */
function backdropDialogOf({target, clientX, clientY}) {
    if (!(target instanceof HTMLDialogElement) || !target.open || target.getAttribute('closedby') !== CLOSED_BY_ANY) {
        return null;
    }

    const box = target.getBoundingClientRect();
    const inside = clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;

    return inside ? null : target;
}

function pressBackdrop(event) {
    pressedBackdrop = lightDismissIsNative() ? null : backdropDialogOf(event);
}

function closeOnBackdrop(event) {
    const dialog = pressedBackdrop;

    pressedBackdrop = null;

    if (dialog && backdropDialogOf(event) === dialog) {
        dialog.close();
    }
}
