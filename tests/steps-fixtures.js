/**
 * The two-factor enrolment dialog: scan the code, the mailed code, the app's code. `dialog` lands on the dialog,
 * `email` and `code` on the two fields.
 */
export function enrolment({dialog = '', email = '', code = ''} = {}) {
    return `
        <dialog id="two-factor-dialog" data-steps ${dialog}>
            <i data-step-mark="1" data-step-state="current"></i><i data-step-mark="2"></i><i data-step-mark="3"></i>
            <p aria-live="polite">
                <span data-step-label="1">Step 1 of 3</span>
                <span data-step-label="2" hidden>Step 2 of 3</span>
                <span data-step-label="3" hidden>Step 3 of 3</span>
            </p>
            <form id="two-factor-enable" method="POST" action="/user/two-factor-authentication">
                <input type="hidden" name="_token" value="csrf">
                <section data-step="1"><h3 tabindex="-1">Scan the QR code</h3></section>
                <section data-step="2" hidden>
                    <h3 tabindex="-1">Confirm your email</h3>
                    <input id="email_code" name="email_code" required ${email}>
                </section>
                <section data-step="3" hidden>
                    <h3 tabindex="-1">Enter the code from your app</h3>
                    <input id="code" name="code" required ${code}>
                </section>
            </form>
            <footer>
                <button type="button" data-step-back hidden>Back</button>
                <button type="button" data-close-modal>Cancel</button>
                <button type="button" data-step-next>Next</button>
                <button type="button" data-step-submit hidden>Turn on</button>
            </footer>
        </dialog>`;
}

export const $ = (selector) => document.querySelector(selector);

/** The steps showing, by number. */
export const shown = () => [...document.querySelectorAll('[data-step]')].filter((step) => !step.hidden).map((step) => step.dataset.step);

export const marks = () => [...document.querySelectorAll('[data-step-mark]')].map((mark) => mark.getAttribute('data-step-state'));

export const labels = () => [...document.querySelectorAll('[data-step-label]')].filter((label) => !label.hidden).map((label) => label.textContent);

export const buttons = () => [...document.querySelectorAll('footer > button')].filter((button) => !button.hidden).map((button) => button.textContent);
