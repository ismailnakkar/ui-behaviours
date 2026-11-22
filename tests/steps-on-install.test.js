import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {$, buttons, enrolment, labels, marks, shown} from './steps-fixtures.js';

// A stepper opens as the behaviours are installed, once per page: each case loads a fresh copy after its markup.
async function install(markup) {
    document.body.innerHTML = markup;
    const {installUiBehaviours} = await import('../src/index.js');

    installUiBehaviours();
}

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('a stepper on install', () => {
    it('stays shut at its first step on a fresh page', async () => {
        await install(enrolment());

        expect($('dialog').open).toBe(false);
        expect(shown()).toEqual(['1']);
        expect(buttons()).toEqual(['Cancel', 'Next']);
    });

    it('opens at data-open-at-step, as on the page after "Email me a code"', async () => {
        await install(enrolment({dialog: 'data-open-at-step="2"'}));

        expect($('dialog').open).toBe(true);
        expect(shown()).toEqual(['2']);
        expect(marks()).toEqual(['done', 'current', null]);
        expect(labels()).toEqual(['Step 2 of 3']);
    });

    it('ignores a data-open-at-step it has no step for', async () => {
        await install(enrolment({dialog: 'data-open-at-step="7"'}));

        expect($('dialog').open).toBe(false);
        expect(shown()).toEqual(['1']);
    });

    // The mailed code is never handed back, so after a refused app code the empty email step comes first.
    it('opens a refused submit at the earliest step with a refused or an empty field', async () => {
        await install(enrolment({code: 'aria-invalid="true"'}));

        expect($('dialog').open).toBe(true);
        expect(shown()).toEqual(['2']);
    });

    it('opens at the refused field\'s step once the steps before it are filled, over data-open-at-step', async () => {
        await install(enrolment({dialog: 'data-open-at-step="2"', email: 'value="123456"', code: 'aria-invalid="true"'}));

        expect(shown()).toEqual(['3']);
        expect(buttons()).toEqual(['Back', 'Cancel', 'Turn on']);
    });

    it('takes only aria-invalid="true" as refused', async () => {
        await install(enrolment({code: 'aria-invalid="false"'}));

        expect($('dialog').open).toBe(false);
    });

    it('shows the step a box that is no dialog opens at', async () => {
        await install(`
            <form data-steps data-open-at-step="2">
                <section data-step="1"></section>
                <section data-step="2" hidden></section>
            </form>`);

        expect(shown()).toEqual(['2']);
    });

    // showModal() focuses the dialog's first focusable element, which must be in the step that shows.
    it('shows its step before data-open-on-load opens the same dialog', async () => {
        const {showModal} = HTMLDialogElement.prototype;
        const stepsAtOpen = [];
        vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () {
            stepsAtOpen.push(shown());
            showModal.call(this);
        });

        await install(enrolment({dialog: 'data-open-on-load data-open-at-step="2"'}));

        expect(stepsAtOpen).toEqual([['2']]);
    });
});
