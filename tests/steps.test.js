import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {installUiBehaviours} from '../src/index.js';
import {$, buttons, enrolment, marks, progress, shown} from './steps-fixtures.js';

// The listeners sit on the document and outlive each test's markup: install once. Opening on load has its own file.
beforeAll(() => {
    installUiBehaviours();
});

let submitted;

beforeEach(() => {
    submitted = 0;
    document.body.innerHTML = enrolment();
    $('form').addEventListener('submit', (event) => {
        event.preventDefault();
        submitted++;
    });
});

afterEach(() => {
    document.body.innerHTML = '';
});

const click = (selector) => $(selector).click();

function type(selector, value) {
    $(selector).value = value;
}

function pressEnter(selector, options = {}) {
    const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true, ...options});

    $(selector).dispatchEvent(event);

    return event;
}

describe('data-steps', () => {
    it('walks the steps, the marks behind done and the one showing current', () => {
        click('[data-step-next]');
        expect(shown()).toEqual(['email']);
        expect(marks()).toEqual(['done', 'current', null]);
        expect(progress()).toBe('Step 2 of 3');
        expect(buttons()).toEqual(['Back', 'Cancel', 'Next']);
        expect(document.activeElement.textContent).toBe('Confirm your email');

        type('#email_code', '123456');
        click('[data-step-next]');
        expect(shown()).toEqual(['app']);
        expect(marks()).toEqual(['done', 'done', 'current']);
        expect(progress()).toBe('Step 3 of 3');
        expect(buttons()).toEqual(['Back', 'Cancel', 'Turn on']);

        click('[data-step-back]');
        expect(shown()).toEqual(['email']);

        click('[data-step-back]');
        expect(shown()).toEqual(['scan']);
        expect(marks()).toEqual(['current', null, null]);
        expect(buttons()).toEqual(['Cancel', 'Next']);
    });

    // The wording is the page's: a language may put the count first, and :steps is never read as :step plus an s.
    it('fills data-step-progress\'s placeholders wherever the wording puts them', () => {
        $('[data-step-progress]').dataset.stepProgress = ':steps steps; this is :step';

        click('[data-step-next]');

        expect(progress()).toBe('3 steps; this is 2');
    });

    it('holds a step until its fields pass', () => {
        click('[data-step-next]');

        click('[data-step-next]');

        expect(shown()).toEqual(['email']);
    });

    it('submits only once every step passes, showing the step of a field left empty', () => {
        click('[data-step-next]');
        type('#email_code', '123456');
        click('[data-step-next]');
        type('#email_code', '');
        type('#code', '654321');

        click('[data-step-submit]');
        expect(submitted).toBe(0);
        expect(shown()).toEqual(['email']);
        expect(buttons()).toEqual(['Back', 'Cancel', 'Next']);

        type('#email_code', '123456');
        click('[data-step-next]');
        click('[data-step-submit]');
        expect(submitted).toBe(1);
    });

    it('moves on with Enter in a field, and submits from the last step', () => {
        click('[data-step-next]');
        type('#email_code', '123456');

        expect(pressEnter('#email_code').defaultPrevented).toBe(true);
        expect(shown()).toEqual(['app']);

        type('#code', '654321');
        pressEnter('#code');
        expect(submitted).toBe(1);
    });

    it('leaves Enter alone while an input method composes, or once the page cancelled it', () => {
        click('[data-step-next]');
        type('#email_code', '123456');

        expect(pressEnter('#email_code', {isComposing: true}).defaultPrevented).toBe(false);
        expect(shown()).toEqual(['email']);

        $('#email_code').addEventListener('keydown', (event) => event.preventDefault(), {once: true});
        pressEnter('#email_code');
        expect(shown()).toEqual(['email']);
    });

    it('moves nothing on a click the page cancelled', () => {
        $('[data-step-next]').addEventListener('click', (event) => event.preventDefault());

        click('[data-step-next]');

        expect(shown()).toEqual(['scan']);
    });

    it('moves without sending the form when a control is a submit button', () => {
        $('form').append($('[data-step-next]'));
        $('[data-step-next]').type = 'submit';
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});

        $('[data-step-next]').dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(shown()).toEqual(['email']);
    });

    it('works on any box, and the buttons outside a stepper do nothing', () => {
        document.body.innerHTML = `
            <form data-steps>
                <section data-step="name"><input name="name" value="Jane"></section>
                <section data-step="email" hidden><input name="email" required></section>
                <button type="button" data-step-next>Next</button>
            </form>
            <button type="button" data-step-next id="stray">Next</button>`;

        click('#stray');
        expect(shown()).toEqual(['name']);

        click('form [data-step-next]');
        expect(shown()).toEqual(['email']);
    });
});

const showing = () => [...document.querySelectorAll('[data-show-if]')].filter((element) => !element.hidden).map((element) => element.dataset.showIf);

const change = (selector) => $(selector).dispatchEvent(new Event('change', {bubbles: true}));

describe('data-show-if and data-clear-on', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <form>
                <input name="full_name" value="Jane Doe">
                <input type="radio" name="method" value="paypal" checked>
                <input type="radio" name="method" value="usdt_polygon">
                <input type="radio" name="network" value="ethereum" checked>
                <input type="radio" name="network" value="polygon">
                <input name="account" value="payee@example.com" data-clear-on="method">
                <p data-show-if="method=paypal">Your PayPal email address.</p>
                <p data-show-if="method=usdt_polygon" hidden>Your USDT address on Polygon.</p>
                <p data-show-if="network=polygon" hidden>Polygon only.</p>
            </form>`;
    });

    it('shows the picked value\'s elements and empties the fields of the value picked before, on every pick', () => {
        click('[value="usdt_polygon"]');

        expect($('[name="account"]').value).toBe('');
        expect(showing()).toEqual(['method=usdt_polygon']);

        type('[name="account"]', 'someone@example.com');
        click('[value="paypal"]');

        expect($('[name="account"]').value).toBe('');
        expect(showing()).toEqual(['method=paypal']);
    });

    it('leaves the hints and fields of another radio group alone', () => {
        click('[name="network"][value="polygon"]');

        expect($('[name="account"]').value).toBe('payee@example.com');
        expect(showing()).toEqual(['method=paypal', 'network=polygon']);
    });

    it('leaves the form alone when another field changes', () => {
        change('[name="full_name"]');

        expect($('[name="account"]').value).toBe('payee@example.com');
        expect(showing()).toEqual(['method=paypal']);
    });

    it('stays inside the picked radio\'s form', () => {
        document.body.insertAdjacentHTML('beforeend', `
            <form id="other">
                <input type="radio" name="method" value="usdt_polygon">
                <input name="account" value="kept" data-clear-on="method">
            </form>`);

        click('form:not(#other) [value="usdt_polygon"]');

        expect($('#other [name="account"]').value).toBe('kept');
    });
});

describe('data-show-if on a select or a checkbox', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <form>
                <select name="driver">
                    <option value="local" selected>Local</option>
                    <option value="s3">S3</option>
                </select>
                <div data-show-if="driver=local">The local root.</div>
                <div data-show-if="driver=s3" hidden>The bucket.</div>

                <input type="checkbox" name="csam" value="1">
                <div data-show-if="csam=1" hidden>How was this reported to us?</div>

                <input type="checkbox" name="notify[]" value="email">
                <input type="checkbox" name="notify[]" value="sms">
                <p data-show-if="notify[]=sms" hidden>Your phone number.</p>
            </form>`;
    });

    it('shows the selected option\'s elements and hides the others\'', () => {
        $('[name="driver"]').value = 's3';
        change('[name="driver"]');

        expect(showing()).toEqual(['driver=s3']);

        $('[name="driver"]').value = 'local';
        change('[name="driver"]');

        expect(showing()).toEqual(['driver=local']);
    });

    it('shows each option a multiple select holds', () => {
        $('[name="driver"]').multiple = true;

        for (const option of $('[name="driver"]').options) {
            option.selected = true;
        }

        change('[name="driver"]');

        expect(showing()).toEqual(['driver=local', 'driver=s3']);
    });

    it('shows a box\'s elements while it is ticked', () => {
        click('[name="csam"]');

        expect(showing()).toEqual(['driver=local', 'csam=1']);

        click('[name="csam"]');

        expect(showing()).toEqual(['driver=local']);
    });

    it('leaves the elements of another box of the same name alone', () => {
        click('[value="sms"]');
        click('[value="email"]');

        expect(showing()).toEqual(['driver=local', 'notify[]=sms']);

        click('[value="email"]');

        expect(showing()).toEqual(['driver=local', 'notify[]=sms']);
    });
});
