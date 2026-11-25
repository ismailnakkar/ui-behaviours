import {closestTo, isCheckbox, isRadio, once} from './helpers.js';
import {installSteps} from './steps.js';

const COPY_FLASH_MS = 1500;

const COPIED = 'data-copied';
const COPY_FAILED = 'data-copy-failed';
const SUBMITTING = 'data-submitting';

/** closedby's light-dismiss value, polyfilled where the browser lacks it. */
const CLOSED_BY_ANY = 'any';

/** Between a field's name and its value in data-show-if: "method=paypal". */
const SHOW_IF_SEPARATOR = '=';

const DISMISS_FADE_MS = 150;

const OPEN_DROPDOWNS = 'details[data-dropdown][open]';

/** Laravel's layout tag for the session's CSRF token: <meta name="csrf-token" content="{{ csrf_token() }}">. */
const CSRF_TOKEN = 'meta[name="csrf-token"]';

const copyTimers = new WeakMap();

/** The dialog a press landed on outside its box: a selection dragged out of the body must not close it. */
let pressedBackdrop = null;

export const installUiBehaviours = once(() => {
    document.addEventListener('submit', confirmSubmit);
    // After the confirm: a refused submit was never sent.
    document.addEventListener('submit', submitOnce);
    window.addEventListener('pageshow', releaseSubmitted);
    document.addEventListener('change', checkAll);
    document.addEventListener('change', showOnChange);
    document.addEventListener('change', clearOnPick);
    // Last: the form goes as the other behaviours leave it.
    document.addEventListener('change', submitOnChange);
    document.addEventListener('click', autoselect);
    document.addEventListener('click', copyOnClick);
    document.addEventListener('click', showModal);
    document.addEventListener('click', closeModal);
    document.addEventListener('pointerdown', pressBackdrop);
    document.addEventListener('click', closeOnBackdrop);
    document.addEventListener('click', dismissBanner);
    document.addEventListener('click', closeDropdownsOutside);
    document.addEventListener('keydown', closeDropdownsOnEscape);

    // First: a stepper dialog opened on load shows its step before showModal() moves focus in.
    installSteps();
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

/**
 * X-Requested-With makes it $request->ajax(); Accept has Laravel answer a refusal (422, 419) as JSON, not a redirect;
 * the page's language serves a route with none in its URL, where the browser's own would win.
 */
export function post(url, body) {
    const headers = {'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json'};
    const token = document.querySelector(CSRF_TOKEN)?.content;
    const language = document.documentElement.lang;

    if (token) {
        headers['X-CSRF-TOKEN'] = token;
    }

    if (language) {
        headers['Accept-Language'] = language;
    }

    return fetch(url, {method: 'POST', headers, body});
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

// requestSubmit(), not submit(): the browser checks the fields, and data-confirm and data-submit-once apply.
function submitOnChange({target}) {
    if (target instanceof Element && target.hasAttribute('data-submit-on-change')) {
        target.form?.requestSubmit();
    }
}

function checkboxesNamed(name) {
    return [...document.getElementsByName(name)].filter((box) => isCheckbox(box) && !box.disabled);
}

function checkAll({target}) {
    if (!isCheckbox(target)) {
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

/**
 * A radio picked, a box ticked or a select changed shows its form's data-show-if="name=value" elements while it holds
 * that value and hides them once it does not.
 */
function showOnChange({target}) {
    if (!isRadio(target) && !isCheckbox(target) && !(target instanceof HTMLSelectElement)) {
        return;
    }

    for (const element of (target.form ?? document).querySelectorAll('[data-show-if]')) {
        const condition = showIfOf(element);

        if (condition?.name === target.name && speaksFor(target, condition.value)) {
            element.hidden = !holds(target, condition.value);
        }
    }
}

/** A box speaks for its own value alone, as other boxes of its name keep theirs; a radio or select for every value. */
function speaksFor(field, value) {
    return !isCheckbox(field) || field.value === value;
}

// options, not selectedOptions: happy-dom's list goes stale after its first read, so app tests would see an old pick.
function holds(field, value) {
    return field instanceof HTMLSelectElement
        ? [...field.options].some((option) => option.selected && option.value === value)
        : field.checked && field.value === value;
}

/** A radio picked empties its form's fields marked data-clear-on="name", which belong to the value picked before. */
function clearOnPick({target}) {
    if (!isRadio(target)) {
        return;
    }

    for (const field of (target.form ?? document).querySelectorAll('[data-clear-on]')) {
        if (field.dataset.clearOn === target.name) {
            field.value = '';
        }
    }
}

function showIfOf(element) {
    const condition = element.dataset.showIf;
    const at = condition.indexOf(SHOW_IF_SEPARATOR);

    return at > 0 ? {name: condition.slice(0, at), value: condition.slice(at + 1)} : null;
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

    const status = button.dataset.copyStatus ? document.getElementById(button.dataset.copyStatus) : null;

    // Emptied first, so the same words said again are read out again.
    status?.replaceChildren();

    const copied = await copyText(copiedTextOf(source));

    flashCopyResult(button, copied, status);

    if (!copied) {
        selectForManualCopy(source);
    }
}

function flashCopyResult(button, copied, status) {
    const said = status ? sayCopyResult(status, copied) : null;

    clearTimeout(copyTimers.get(button));
    button.toggleAttribute(COPIED, copied);
    button.toggleAttribute(COPY_FAILED, !copied);
    copyTimers.set(button, setTimeout(() => {
        button.removeAttribute(COPIED);
        button.removeAttribute(COPY_FAILED);

        // Its own words only: the page may have said something else there since.
        if (status?.textContent === said) {
            status.textContent = '';
        }
    }, COPY_FLASH_MS));
}

/** Writes the live region's words for the result, its data-copied-text or data-copy-failed-text, and returns them. */
function sayCopyResult(status, copied) {
    status.textContent = (copied ? status.dataset.copiedText : status.dataset.copyFailedText) ?? '';

    return status.textContent;
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

// Focus is moved out first: focus inside a hidden element falls to <body> and loses the keyboard user's place.
function dismissBanner(event) {
    const banner = closestTo(event, '[data-dismiss]')?.parentElement;

    if (!banner || event.defaultPrevented) {
        return;
    }

    if (banner.contains(document.activeElement)) {
        document.querySelector('main')?.focus({preventScroll: true});
    }

    fadeOut(banner);
}

// Hidden, not removed, so a page may show the banner again; inert while it fades, at once under reduced motion or
// without the Web Animations API. A cancelled fade leaves it shown: that is how a page shows it again mid-fade.
function fadeOut(banner) {
    const release = () => {
        banner.inert = false;
    };
    const hide = () => {
        banner.hidden = true;
        release();
    };

    if (typeof banner.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        hide();

        return;
    }

    banner.inert = true;
    banner.animate({opacity: [1, 0]}, {duration: DISMISS_FADE_MS, easing: 'ease-in'}).finished.then(hide, release);
}

// A <details> has no light dismiss of its own, unlike a popover.
function closeDropdownsOutside({target}) {
    for (const dropdown of document.querySelectorAll(OPEN_DROPDOWNS)) {
        if (!(target instanceof Node && dropdown.contains(target))) {
            dropdown.open = false;
        }
    }
}

function closeDropdownsOnEscape({key}) {
    if (key !== 'Escape') {
        return;
    }

    for (const dropdown of document.querySelectorAll(OPEN_DROPDOWNS)) {
        dropdown.open = false;
        dropdown.querySelector(':scope > summary')?.focus();
    }
}
