import {closestTo, once} from './helpers.js';

const COPY_FLASH_MS = 1500;

const COPIED = 'data-copied';
const COPY_FAILED = 'data-copy-failed';
const SUBMITTING = 'data-submitting';

/** closedby's light-dismiss value, polyfilled where the browser lacks it. */
const CLOSED_BY_ANY = 'any';

const copyTimers = new WeakMap();

/** The dialog a press landed on outside its box: a selection dragged out of the body must not close it. */
let pressedBackdrop = null;

export const installUiBehaviours = once(() => {
    document.addEventListener('submit', confirmSubmit);
    // After the confirm: a refused submit was never sent.
    document.addEventListener('submit', submitOnce);
    window.addEventListener('pageshow', releaseSubmitted);
    document.addEventListener('change', checkAll);
    document.addEventListener('click', autoselect);
    document.addEventListener('click', copyOnClick);
    document.addEventListener('click', showModal);
    document.addEventListener('click', closeModal);
    document.addEventListener('pointerdown', pressBackdrop);
    document.addEventListener('click', closeOnBackdrop);

    openOnLoad();
});

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);

        return true;
    } catch {
        // Absent on plain http, rejects when refused.
        return false;
    }
}

function isField(element) {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

/** A link clicked to open elsewhere: a new tab, a new window, a download. */
function followsLink(opener, event) {
    return opener instanceof HTMLAnchorElement
        && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
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

// Refuses the submit rather than disabling the buttons: a disabled submitter drops its name and value.
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

// A page back from the back-forward cache (Back from a payment page) may send its forms again.
function releaseSubmitted({persisted}) {
    if (persisted) {
        for (const form of document.querySelectorAll(`form[${SUBMITTING}]`)) {
            form.removeAttribute(SUBMITTING);
        }
    }
}

function checkboxesNamed(name) {
    return [...document.getElementsByName(name)].filter((box) => box.type === 'checkbox' && !box.disabled);
}

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

            header.checked = rows.length > 0 && checked === rows.length;
            header.indeterminate = checked > 0 && checked < rows.length;
        }
    }
}

// Tabbing in selects a field's text natively; a click only places a caret.
function autoselect({target}) {
    if (isField(target) && target.matches('[data-autoselect]')) {
        target.select();
    }
}

// innerText, not textContent: one line per block as laid out, so a list of recovery codes copies one a line.
function copiedTextOf(source) {
    if (source.dataset.copyValue !== undefined) {
        return source.dataset.copyValue;
    }

    if (isField(source)) {
        return source.value;
    }

    return (source.innerText ?? source.textContent).trim();
}

async function copyOnClick(event) {
    const button = closestTo(event, '[data-copy]');
    const source = button ? document.getElementById(button.dataset.copy) : null;

    if (!source || event.defaultPrevented) {
        return;
    }

    const copied = await copyText(copiedTextOf(source));

    flashCopyResult(button, copied);

    if (!copied) {
        selectForManualCopy(source);
    }
}

function flashCopyResult(button, copied) {
    clearTimeout(copyTimers.get(button));
    button.toggleAttribute(COPIED, copied);
    button.toggleAttribute(COPY_FAILED, !copied);
    copyTimers.set(button, setTimeout(() => {
        button.removeAttribute(COPIED);
        button.removeAttribute(COPY_FAILED);
    }, COPY_FLASH_MS));
}

// select() alone may leave the field unfocused; focused, Ctrl/Cmd+C copies it by hand.
function selectForManualCopy(source) {
    if (isField(source)) {
        source.focus();
        source.select();
    } else {
        getSelection()?.selectAllChildren(source);
    }
}

// A link's href stays the fallback: a modified click, or a page without the dialog, follows it.
function showModal(event) {
    const opener = closestTo(event, '[data-show-modal]');
    const dialog = opener ? document.getElementById(opener.dataset.showModal) : null;

    if (!(dialog instanceof HTMLDialogElement) || event.defaultPrevented || followsLink(opener, event)) {
        return;
    }

    event.preventDefault();

    if (!dialog.open) {
        dialog.showModal();
    }
}

// preventDefault(): a submit button closes without sending its form.
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

// A backdrop click lands on the dialog element itself, outside its box.
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
