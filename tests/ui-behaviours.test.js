import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {copyText, installUiBehaviours, post} from '../src/index.js';

// The listeners sit on the document and outlive each test's markup: install once.
beforeAll(() => {
    installUiBehaviours();
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

const refused = () => new DOMException('The request is not allowed');

function submit(submitter) {
    const event = new SubmitEvent('submit', {bubbles: true, cancelable: true, submitter});

    document.querySelector('form').dispatchEvent(event);

    return !event.defaultPrevented;
}

// happy-dom's pageshow carries no persisted flag.
function showPage({persisted}) {
    window.dispatchEvent(Object.assign(new Event('pageshow'), {persisted}));
}

function click(target, options = {}) {
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, ...options});

    target.dispatchEvent(event);

    return event;
}

describe('installUiBehaviours', () => {
    it('adds no second set of listeners when called again', () => {
        installUiBehaviours();
        document.body.innerHTML = '<form data-confirm="Delete this ad?"><button>Delete</button></form>';
        const ask = vi.fn(() => true);
        vi.stubGlobal('confirm', ask);

        submit(document.querySelector('button'));

        expect(ask).toHaveBeenCalledTimes(1);
    });
});

describe('data-confirm', () => {
    it('asks the form\'s question for a button of its own, and only a yes submits', () => {
        document.body.innerHTML = '<form data-confirm="Delete this ad?"><button>Delete</button></form>';
        const button = document.querySelector('button');
        const ask = vi.fn(() => false);
        vi.stubGlobal('confirm', ask);

        expect(submit(button)).toBe(false);
        expect(ask).toHaveBeenCalledWith('Delete this ad?');

        ask.mockReturnValue(true);
        expect(submit(button)).toBe(true);
    });

    it('asks the pressed button\'s question when buttons share a form', () => {
        document.body.innerHTML = `
            <form>
                <button formaction="/admin/withdrawals/5/approve" data-confirm="Approve withdrawal #5?">Approve</button>
                <button formaction="/admin/withdrawals/5/complete" data-confirm="Complete withdrawal #5?">Complete</button>
                <button formaction="/admin/withdrawals/5/return">Return</button>
            </form>`;
        const [approve, complete, unguarded] = document.querySelectorAll('button');
        const ask = vi.fn(() => false);
        vi.stubGlobal('confirm', ask);

        expect(submit(complete)).toBe(false);
        expect(ask).toHaveBeenLastCalledWith('Complete withdrawal #5?');

        ask.mockReturnValue(true);
        expect(submit(approve)).toBe(true);
        expect(ask).toHaveBeenLastCalledWith('Approve withdrawal #5?');

        ask.mockClear();
        expect(submit(unguarded)).toBe(true);
        expect(ask).not.toHaveBeenCalled();
    });

    it('does not ask about a submit the page already stopped', () => {
        document.body.innerHTML = '<form data-confirm="Delete this ad?"><button>Delete</button></form>';
        document.querySelector('form').addEventListener('submit', (event) => event.preventDefault());
        const ask = vi.fn(() => true);
        vi.stubGlobal('confirm', ask);

        submit(document.querySelector('button'));

        expect(ask).not.toHaveBeenCalled();
    });
});

describe('data-submit-once', () => {
    it('sends the form once and marks it, keeping the pressed button\'s value', () => {
        document.body.innerHTML = '<form data-submit-once><button name="gateway" value="balance">Pay</button></form>';
        const button = document.querySelector('button');

        expect(submit(button)).toBe(true);
        expect(document.querySelector('form').hasAttribute('data-submitting')).toBe(true);
        expect(button.disabled).toBe(false);
        expect(submit(button)).toBe(false);
    });

    it('sends again once the page comes back from the back-forward cache, but not on a fresh show', () => {
        document.body.innerHTML = '<form data-submit-once><button>Pay</button></form>';
        const button = document.querySelector('button');
        submit(button);

        showPage({persisted: false});
        expect(submit(button)).toBe(false);

        showPage({persisted: true});
        expect(submit(button)).toBe(true);
    });

    it('leaves a submit the confirm refused unsent, so the next one goes', () => {
        document.body.innerHTML = '<form data-submit-once data-confirm="Cancel your plan?"><button>Cancel</button></form>';
        const button = document.querySelector('button');
        const ask = vi.fn(() => false);
        vi.stubGlobal('confirm', ask);

        expect(submit(button)).toBe(false);
        ask.mockReturnValue(true);
        expect(submit(button)).toBe(true);
        expect(submit(button)).toBe(false);
    });

    it('lets a form without the attribute submit again', () => {
        document.body.innerHTML = '<form><button>Search</button></form>';
        const button = document.querySelector('button');

        expect(submit(button)).toBe(true);
        expect(submit(button)).toBe(true);
    });
});

function change(box) {
    box.dispatchEvent(new Event('change', {bubbles: true}));
}

function renderRows() {
    document.body.innerHTML = `
        <input type="checkbox" data-check-all="ids[]">
        <input type="checkbox" name="ids[]">
        <input type="checkbox" name="ids[]" checked>
        <input type="checkbox" name="ids[]" disabled>
        <input type="checkbox" name="exclude[]">`;

    return {
        all: document.querySelector('[data-check-all]'),
        rows: [...document.querySelectorAll('input[name="ids[]"]:not([disabled])')],
        locked: document.querySelector('input[disabled]'),
        other: document.querySelector('input[name="exclude[]"]'),
    };
}

describe('data-check-all', () => {
    it('ticks and unticks every row it names to match the header box, and nothing else', () => {
        const {all, rows, locked, other} = renderRows();

        all.checked = true;
        change(all);
        expect(rows.map((box) => box.checked)).toEqual([true, true]);
        expect(locked.checked).toBe(false);
        expect(other.checked).toBe(false);

        all.checked = false;
        change(all);
        expect(rows.map((box) => box.checked)).toEqual([false, false]);
    });

    it('follows the rows: checked when all are, indeterminate when some are', () => {
        const {all, rows} = renderRows();

        change(rows[1]);
        expect([all.checked, all.indeterminate]).toEqual([false, true]);

        rows[0].checked = true;
        change(rows[0]);
        expect([all.checked, all.indeterminate]).toEqual([true, false]);

        rows[0].checked = false;
        rows[1].checked = false;
        change(rows[1]);
        expect([all.checked, all.indeterminate]).toEqual([false, false]);
    });

    it('leaves the header alone when another group changes', () => {
        const {all, other} = renderRows();

        other.checked = true;
        change(other);

        expect([all.checked, all.indeterminate]).toEqual([false, false]);
    });
});

describe('data-autoselect', () => {
    it('selects the whole value of an input or a textarea on a click', () => {
        document.body.innerHTML = `
            <input type="text" value="https://exe.io/abcd" readonly data-autoselect>
            <textarea readonly data-autoselect>https://exe.io/a</textarea>`;

        for (const field of document.querySelectorAll('[data-autoselect]')) {
            field.click();

            expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
        }
    });
});

function renderCopyField() {
    vi.useFakeTimers();
    document.body.innerHTML = `
        <input id="copy-1" type="text" value="https://exe.io/abcd" readonly data-autoselect>
        <button type="button" data-copy="copy-1"><span>Copy</span><span>Copied</span></button>`;

    return {
        input: document.querySelector('input'),
        button: document.querySelector('button'),
    };
}

/** Clicks a copy button and lets the clipboard answer. */
async function copyWith(button) {
    button.click();
    await vi.advanceTimersByTimeAsync(0);
}

describe('data-copy', () => {
    it('marks the button copied for 1.5 seconds, and a second copy restarts them', async () => {
        const {button} = renderCopyField();
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        // Clicked on the label, as a mouse does, not on the button itself.
        await copyWith(button.querySelector('span'));
        expect(write).toHaveBeenCalledWith('https://exe.io/abcd');
        expect(button.hasAttribute('data-copied')).toBe(true);

        await vi.advanceTimersByTimeAsync(1_000);
        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(button.hasAttribute('data-copied')).toBe(true);

        await vi.advanceTimersByTimeAsync(500);
        expect(button.hasAttribute('data-copied')).toBe(false);
    });

    it('selects the value when the browser refuses, and drops a stale copied mark', async () => {
        const {input, button} = renderCopyField();
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(button);
        expect(button.hasAttribute('data-copied')).toBe(true);

        write.mockRejectedValue(refused());
        await copyWith(button);

        expect(button.hasAttribute('data-copied')).toBe(false);
        expect(button.hasAttribute('data-copy-failed')).toBe(true);
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
    });

    it('marks a refusal for 1.5 seconds, restarts them on a second one, and a copy that works replaces it', async () => {
        const {button} = renderCopyField();
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(refused());

        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(button.hasAttribute('data-copy-failed')).toBe(true);

        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(button.hasAttribute('data-copy-failed')).toBe(true);

        await vi.advanceTimersByTimeAsync(500);
        expect(button.hasAttribute('data-copy-failed')).toBe(false);

        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        write.mockResolvedValue(undefined);
        await copyWith(button);
        expect(button.hasAttribute('data-copy-failed')).toBe(false);
        expect(button.hasAttribute('data-copied')).toBe(true);

        // Past the refusal's 1.5 seconds: its timer was cleared and cannot end the copied mark early.
        await vi.advanceTimersByTimeAsync(1_000);
        expect(button.hasAttribute('data-copied')).toBe(true);

        await vi.advanceTimersByTimeAsync(500);
        expect(button.hasAttribute('data-copied')).toBe(false);
    });

    it('copies what a textarea holds now', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <textarea id="all-links" readonly></textarea>
            <button type="button" data-copy="all-links">Copy</button>`;
        document.querySelector('textarea').value = 'https://exe.io/a\nhttps://exe.io/b';
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(document.querySelector('button'));

        expect(write).toHaveBeenCalledWith('https://exe.io/a\nhttps://exe.io/b');
    });

    it('copies the text a <pre> shows, and selects it when the browser refuses', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <pre id="fps-code"><code>&lt;script src="https://exe.io/js/full-page-script.js"&gt;&lt;/script&gt;</code></pre>
            <button type="button" data-copy="fps-code">Copy</button>`;
        const pre = document.querySelector('pre');
        const button = document.querySelector('button');
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(button);
        expect(write).toHaveBeenCalledWith('<script src="https://exe.io/js/full-page-script.js"></script>');
        expect(button.hasAttribute('data-copied')).toBe(true);

        write.mockRejectedValue(refused());
        await copyWith(button);

        expect(button.hasAttribute('data-copied')).toBe(false);
        expect(getSelection()?.anchorNode).toBe(pre);
    });

    it('copies the text without the whitespace around it', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <p id="code">
                ABCD-1234
            </p>
            <button type="button" data-copy="code">Copy</button>`;
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(document.querySelector('button'));

        expect(write).toHaveBeenCalledWith('ABCD-1234');
    });

    it('copies the source\'s data-copy-value over the text grouped for reading', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <code id="setup-key" data-copy-value="JBSWY3DPEHPK3PXP">JBSW Y3DP EHPK 3PXP</code>
            <button type="button" data-copy="setup-key">Copy</button>`;
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(document.querySelector('button'));

        expect(write).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
    });

    it('copies nothing when the page cancels the click, nor when the source is missing', async () => {
        const {button} = renderCopyField();
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
        const refuse = (event) => event.preventDefault();
        button.addEventListener('click', refuse);

        await copyWith(button);
        expect(write).not.toHaveBeenCalled();
        expect(button.hasAttribute('data-copied')).toBe(false);

        button.removeEventListener('click', refuse);
        button.dataset.copy = 'gone';
        await copyWith(button);
        expect(write).not.toHaveBeenCalled();
    });
});

function renderCopyStatus() {
    vi.useFakeTimers();
    document.body.innerHTML = `
        <input id="short-url" type="text" value="https://exe.io/abcd" readonly>
        <button type="button" data-copy="short-url" data-copy-status="copy-status">Copy</button>
        <p id="copy-status" role="status" data-copied-text="Link copied" data-copy-failed-text="Copy blocked: copy the selected link by hand"></p>`;

    return {
        button: document.querySelector('button'),
        status: document.querySelector('[role="status"]'),
    };
}

describe('data-copy-status', () => {
    it('says the copy in its live region while the button is marked, emptied at the click so a second copy is said again', async () => {
        const {button, status} = renderCopyStatus();
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(button);
        expect(status.textContent).toBe('Link copied');

        button.click();
        expect(status.textContent).toBe('');

        await vi.advanceTimersByTimeAsync(0);
        expect(status.textContent).toBe('Link copied');

        await vi.advanceTimersByTimeAsync(1_500);
        expect(button.hasAttribute('data-copied')).toBe(false);
        expect(status.textContent).toBe('');
    });

    it('says a refusal in the region\'s words for it, and nothing for a result it has no words for', async () => {
        const {button, status} = renderCopyStatus();
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(refused());

        await copyWith(button);
        expect(status.textContent).toBe('Copy blocked: copy the selected link by hand');

        delete status.dataset.copiedText;
        write.mockResolvedValue(undefined);
        await copyWith(button);
        expect(status.textContent).toBe('');
    });

    it('leaves words the page wrote in the region since', async () => {
        const {button, status} = renderCopyStatus();
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        await copyWith(button);
        expect(status.textContent).toBe('Link copied');

        status.textContent = 'Your short link is ready';
        await vi.advanceTimersByTimeAsync(1_500);
        expect(status.textContent).toBe('Your short link is ready');
    });
});

describe('data-submit-on-change', () => {
    it('sends the form of a select or a box it marks, through the form\'s submit event', () => {
        document.body.innerHTML = `
            <form>
                <select name="sort" data-submit-on-change>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                </select>
                <input type="checkbox" name="mine" value="1" data-submit-on-change>
                <input name="q">
            </form>`;
        const sent = vi.fn((event) => event.preventDefault());
        document.querySelector('form').addEventListener('submit', sent);

        change(document.querySelector('select'));
        expect(sent).toHaveBeenCalledOnce();

        document.querySelector('[name="mine"]').click();
        expect(sent).toHaveBeenCalledTimes(2);

        change(document.querySelector('[name="q"]'));
        expect(sent).toHaveBeenCalledTimes(2);
    });
});

describe('copyText', () => {
    it('answers whether the clipboard took the text', async () => {
        const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

        expect(await copyText('https://exe.io/abcd')).toBe(true);
        expect(write).toHaveBeenCalledWith('https://exe.io/abcd');

        write.mockRejectedValue(refused());
        expect(await copyText('https://exe.io/abcd')).toBe(false);
    });

    it('answers false where the page has no clipboard, as on plain http', async () => {
        vi.stubGlobal('navigator', {});

        expect(await copyText('https://exe.io/abcd')).toBe(false);
    });
});

const dialog = (id, attributes = '') => `<dialog id="${id}" ${attributes}><p>BODY</p><button type="button" data-close-modal><span>Cancel</span></button></dialog>`;

const shortenLink = '<a href="/tools/bulk-shorten" data-show-modal="shorten-dialog"><span>Shorten a link</span></a>';

describe('data-show-modal', () => {
    it('opens the named dialog instead of following the link', () => {
        document.body.innerHTML = shortenLink + dialog('shorten-dialog');

        // Clicked on the label, as a mouse does, not on the link itself.
        const event = click(document.querySelector('a span'));

        expect(event.defaultPrevented).toBe(true);
        expect(document.querySelector('dialog').open).toBe(true);
    });

    it('lets a modified click follow the link', () => {
        document.body.innerHTML = shortenLink + dialog('shorten-dialog');

        const event = click(document.querySelector('a span'), {ctrlKey: true});

        expect(event.defaultPrevented).toBe(false);
        expect(document.querySelector('dialog').open).toBe(false);
    });

    it('opens the dialog on a modified click on a button, which has no link to follow', () => {
        document.body.innerHTML = '<button type="button" data-show-modal="shorten-dialog">Shorten a link</button>' + dialog('shorten-dialog');

        click(document.querySelector('button'), {shiftKey: true});

        expect(document.querySelector('dialog').open).toBe(true);
    });

    it('does nothing when the page has no such dialog', () => {
        document.body.innerHTML = '<button type="button" data-show-modal="cancel-dialog">Cancel subscription</button>';

        expect(click(document.querySelector('button')).defaultPrevented).toBe(false);
    });

    it('opens nothing when the page cancels the click', () => {
        document.body.innerHTML = shortenLink + dialog('shorten-dialog');
        document.querySelector('a').addEventListener('click', (event) => event.preventDefault());

        click(document.querySelector('a'));

        expect(document.querySelector('dialog').open).toBe(false);
    });

    it('leaves an open dialog open', () => {
        document.body.innerHTML = shortenLink + dialog('shorten-dialog');
        const shorten = document.querySelector('dialog');
        shorten.showModal();
        const reopen = vi.spyOn(shorten, 'showModal');

        click(document.querySelector('a'));

        expect(reopen).not.toHaveBeenCalled();
        expect(shorten.open).toBe(true);
    });
});

describe('data-close-modal', () => {
    it('closes its own dialog and fires the native close event', async () => {
        document.body.innerHTML = dialog('one') + dialog('two');
        const [one, two] = document.querySelectorAll('dialog');
        const closed = vi.fn();
        one.addEventListener('close', closed);
        one.showModal();
        two.show();

        click(one.querySelector('[data-close-modal] span'));

        expect([one.open, two.open]).toEqual([false, true]);
        await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
    });

    it('closes without sending the form it submits', () => {
        document.body.innerHTML = `
            <dialog id="disable-2fa">
                <form method="POST" action="/two-factor"><input name="password" required>
                    <button data-close-modal>Cancel</button>
                </form>
            </dialog>`;
        const disable = document.querySelector('dialog');
        const sent = vi.fn((event) => event.preventDefault());
        disable.querySelector('form').addEventListener('submit', sent);
        disable.showModal();

        const event = click(disable.querySelector('button'));

        expect(event.defaultPrevented).toBe(true);
        expect(disable.open).toBe(false);
        expect(sent).not.toHaveBeenCalled();
    });
});

/** A dialog laid out at 100-300 × 100-300, as happy-dom lays nothing out. */
function renderLightDismiss(attributes = 'closedby="any"') {
    document.body.innerHTML = dialog('shorten-dialog', attributes);
    const shorten = document.querySelector('dialog');
    vi.spyOn(shorten, 'getBoundingClientRect').mockReturnValue({left: 100, right: 300, top: 100, bottom: 300});
    shorten.showModal();

    return shorten;
}

/** A press and its click on the dialog element, as the backdrop and the dialog's own padding both land there. */
function pressAndClick(target, from, to = from) {
    target.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: from[0], clientY: from[1]}));
    click(target, {clientX: to[0], clientY: to[1]});
}

const OUTSIDE = [20, 20];
const INSIDE = [200, 200];

describe('closedby="any"', () => {
    it('closes the dialog on a click on its backdrop', () => {
        const shorten = renderLightDismiss();

        pressAndClick(shorten, OUTSIDE);

        expect(shorten.open).toBe(false);
    });

    it('stays open on a click inside its box', () => {
        const shorten = renderLightDismiss();

        pressAndClick(shorten, INSIDE);
        pressAndClick(shorten.querySelector('p'), OUTSIDE);

        expect(shorten.open).toBe(true);
    });

    it('stays open when a text selection is dragged out of the body onto the backdrop', () => {
        const shorten = renderLightDismiss();

        pressAndClick(shorten, INSIDE, OUTSIDE);

        expect(shorten.open).toBe(true);
    });

    it('leaves a dialog without it open', () => {
        const shorten = renderLightDismiss('');

        pressAndClick(shorten, OUTSIDE);

        expect(shorten.open).toBe(true);
    });

    it('leaves the dismissal to a browser that does it natively', () => {
        Object.defineProperty(HTMLDialogElement.prototype, 'closedBy', {configurable: true, get: () => 'any'});

        try {
            const shorten = renderLightDismiss();
            const close = vi.spyOn(shorten, 'close');

            pressAndClick(shorten, OUTSIDE);

            expect(close).not.toHaveBeenCalled();
        } finally {
            delete HTMLDialogElement.prototype.closedBy;
        }
    });
});

/** A banner with its close button as a direct child, the one shape data-dismiss reads. */
const banner = (words) => `<div role="status"><div>${words}</div><button type="button" data-dismiss><svg></svg></button></div>`;

function reducedMotion(matches) {
    vi.stubGlobal('matchMedia', (media) => ({matches, media}));
}

describe('data-dismiss', () => {
    it('hides its own banner, leaves the page around it and hands focus to main', () => {
        reducedMotion(true);
        document.body.innerHTML = `<main tabindex="-1">${banner('Link saved.')}${banner('That link is gone.')}<p>Page</p></main>`;
        const [saved, gone] = document.querySelectorAll('[role="status"]');
        saved.querySelector('button').focus();

        // On the icon, as a mouse clicks, not on the button itself.
        click(saved.querySelector('svg'));

        expect(saved.hidden).toBe(true);
        expect(gone.hidden).toBe(false);
        expect(document.querySelector('p').textContent).toBe('Page');
        expect(document.activeElement).toBe(document.querySelector('main'));
    });

    it('fades the banner out, inert, before it hides, with focus already on main', async () => {
        reducedMotion(false);
        let finish;
        const fade = vi.spyOn(Element.prototype, 'animate').mockImplementation(() => ({
            finished: new Promise((resolve) => {
                finish = resolve;
            }),
        }));
        document.body.innerHTML = `<main tabindex="-1">${banner('Link saved.')}</main>`;
        const saved = document.querySelector('[role="status"]');
        saved.querySelector('button').focus();

        click(saved.querySelector('button'));

        expect(fade).toHaveBeenCalledWith({opacity: [1, 0]}, {duration: 150, easing: 'ease-in'});
        expect(saved.inert).toBe(true);
        expect(saved.hidden).toBe(false);
        expect(document.activeElement).toBe(document.querySelector('main'));

        finish();
        await Promise.resolve();

        expect(saved.hidden).toBe(true);
        expect(saved.inert).toBe(false);
    });

    it('dismisses a banner the page showed again, as a reused toast', () => {
        reducedMotion(true);
        document.body.innerHTML = banner('Link saved.');
        const toast = document.querySelector('[role="status"]');

        click(toast.querySelector('button'));
        toast.hidden = false;
        click(toast.querySelector('button'));

        expect(toast.hidden).toBe(true);
    });

    it('leaves a banner shown again mid-fade shown, once its fade is cancelled', async () => {
        reducedMotion(false);
        document.body.innerHTML = banner('Link saved.');
        const toast = document.querySelector('[role="status"]');

        click(toast.querySelector('button'));
        const [fade] = toast.getAnimations();
        const settled = fade.finished.catch(() => {});
        fade.cancel();
        toast.hidden = false;
        await settled;
        await Promise.resolve();

        expect(toast.hidden).toBe(false);
        expect(toast.inert).toBe(false);
    });

    it('leaves focus outside the banner where it is', () => {
        reducedMotion(true);
        document.body.innerHTML = `<main tabindex="-1"><input>${banner('Link saved.')}</main>`;
        const input = document.querySelector('input');
        input.focus();

        click(document.querySelector('[data-dismiss]'));

        expect(document.querySelector('[role="status"]').hidden).toBe(true);
        expect(document.activeElement).toBe(input);
    });

    it('ignores a click anywhere else in the banner, and a click the page cancelled', () => {
        reducedMotion(true);
        document.body.innerHTML = banner('Link saved.');
        const saved = document.querySelector('[role="status"]');
        const button = saved.querySelector('button');
        button.addEventListener('click', (event) => event.preventDefault());

        click(saved.querySelector('div'));
        click(button);

        expect(saved.hidden).toBe(false);
    });
});

function dropdown() {
    document.body.innerHTML = '<details data-dropdown open><summary>EN</summary><button>Français</button></details><main>Page</main>';

    return document.querySelector('details');
}

describe('data-dropdown', () => {
    it('closes on a click outside it', () => {
        const details = dropdown();

        click(document.querySelector('main'));

        expect(details.open).toBe(false);
    });

    it('stays open on a click inside it', () => {
        const details = dropdown();

        click(document.querySelector('button'));

        expect(details.open).toBe(true);
    });

    it('closes on Escape and hands focus back to its summary', () => {
        const details = dropdown();
        const summary = details.querySelector('summary');
        summary.tabIndex = 0;

        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

        expect(details.open).toBe(false);
        expect(document.activeElement).toBe(summary);
    });

    it('leaves any other details alone', () => {
        document.body.innerHTML = '<details open id="faq"><summary>Why?</summary></details><main>Page</main>';

        click(document.querySelector('main'));
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

        expect(document.querySelector('#faq').open).toBe(true);
    });
});

describe('post', () => {
    afterEach(() => {
        document.head.innerHTML = '';
        document.documentElement.lang = '';
    });

    it('posts the body with the AJAX, CSRF and language headers Laravel reads', async () => {
        document.head.innerHTML = '<meta name="csrf-token" content="token-123">';
        document.documentElement.lang = 'fr';
        const answer = new Response('{}');
        const send = vi.fn(async () => answer);
        vi.stubGlobal('fetch', send);
        const body = new FormData();
        body.append('url', 'https://example.com');

        expect(await post('/links/shorten', body)).toBe(answer);
        expect(send).toHaveBeenCalledWith('/links/shorten', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
                'X-CSRF-TOKEN': 'token-123',
                'Accept-Language': 'fr',
            },
            body,
        });
    });

    it('leaves the token and the language to the form and the browser on a page without them', async () => {
        const send = vi.fn(async () => new Response('{}'));
        vi.stubGlobal('fetch', send);

        await post('/contact', new URLSearchParams({_token: 'in-the-form'}));

        expect(send.mock.calls[0][1].headers).toStrictEqual({'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json'});
    });
});
