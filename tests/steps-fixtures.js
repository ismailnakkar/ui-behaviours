/**
 * The two-factor enrolment dialog: scan the code, the mailed code, the app's code. `dialog` lands on the dialog,
 * `email` and `code` on the two fields.
 */
export function enrolment({dialog = '', email = '', code = ''} = {}) {
    return `
        <dialog id="two-factor-dialog" data-steps ${dialog}>
            <i data-step-mark data-step-state="current"></i><i data-step-mark></i><i data-step-mark></i>
            <p aria-live="polite" data-step-progress="Step :step of :steps"></p>
            <form id="two-factor-enable" method="POST" action="/user/two-factor-authentication">
                <input type="hidden" name="_token" value="csrf">
                <section data-step="scan"><h3>Scan the QR code</h3></section>
                <section data-step="email" hidden>
                    <h3>Confirm your email</h3>
                    <input id="email_code" name="email_code" required ${email}>
                </section>
                <section data-step="app" hidden>
                    <h3>Enter the code from your app</h3>
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

/** The steps showing, by name. */
export const shown = () => [...document.querySelectorAll('[data-step]')].filter((step) => !step.hidden).map((step) => step.dataset.step);

export const marks = () => [...document.querySelectorAll('[data-step-mark]')].map((mark) => mark.getAttribute('data-step-state'));

export const progress = () => $('[data-step-progress]').textContent;

export const buttons = () => [...document.querySelectorAll('footer > button')].filter((button) => !button.hidden).map((button) => button.textContent);
