import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {installRangePicker} from '../src/range-picker.js';
import {FakeCalendar, labelsOf, nextTask, rangePicker} from './range-picker-fixtures.js';

vi.mock('cally', () => ({}));

// Installed before any markup, so every picker here is one added later.
beforeAll(() => {
    customElements.define('calendar-range', FakeCalendar);
    installRangePicker();
});

afterEach(() => {
    document.body.innerHTML = '';
});

function pickerParts(picker) {
    const radios = [...picker.querySelectorAll('input[type="radio"]')];

    return {
        picker,
        opener: document.querySelector(`[popovertarget="${picker.id}"]`),
        calendar: picker.querySelector('calendar-range'),
        custom: picker.querySelector('[data-range-custom]'),
        fields: () => [...picker.querySelectorAll('input[type="hidden"]')].map((field) => field.value),
        // Clicked on its label, as a mouse does.
        pick: (value) => radios.find((radio) => radio.value === value).closest('label').click(),
    };
}

function render(markup = rangePicker()) {
    document.body.innerHTML = markup;

    return pickerParts(document.querySelector('[data-range-picker]'));
}

const statesOf = (...displays) => displays.map((display) => display.dataset.rangeState);

describe('a preset', () => {
    it('moves the calendar to its dates and fills the fields, the button and the summary', () => {
        const {picker, opener, calendar, fields, pick} = render();

        pick('lastMonth');

        expect(calendar.value).toBe('2026-10-01/2026-10-31');
        expect(fields()).toEqual(['2026-10-01', '2026-10-31']);
        expect(labelsOf(opener)).toEqual(['Last month', '1 Oct – 31 Oct']);
        expect(labelsOf(picker)).toEqual(['Last month', '1 Oct – 31 Oct 2026']);
        expect(statesOf(opener, picker)).toEqual(['preset', 'preset']);
    });

    it('moves the view a month before its end day, then to that day, so the two months end on its', async () => {
        const {calendar, pick} = render();

        pick('lastMonth');

        expect(calendar.views).toEqual(['2026-09-01']);

        await nextTask();

        expect(calendar.views).toEqual(['2026-09-01', '2026-10-31']);
    });

    it('drops a pick waiting for its end day', () => {
        const {picker, calendar, pick} = render();

        calendar.pickStart('2026-11-03');
        pick('today');

        expect(calendar.tentative).toBe('');
        expect(calendar.value).toBe('2026-11-20/2026-11-20');
        expect(statesOf(picker)).toEqual(['preset']);
        expect(labelsOf(picker)).toEqual(['Today', '20 Nov 2026']);
    });
});

describe('the calendar', () => {
    it('makes the two days picked a custom range', () => {
        const {picker, opener, calendar, custom, fields} = render();

        calendar.pickStart('2026-10-28');
        calendar.pickEnd('2026-11-03');

        expect(custom.checked).toBe(true);
        expect(fields()).toEqual(['2026-10-28', '2026-11-03']);
        expect(labelsOf(opener)).toEqual(['Custom range', '28 Oct – 3 Nov']);
        expect(labelsOf(picker)).toEqual(['Custom range', '28 Oct – 3 Nov 2026']);
        expect(statesOf(opener, picker)).toEqual(['custom', 'custom']);
    });

    it('shows the start alone while the end is pending, and the form keeps the range it had', () => {
        const {picker, opener, calendar, custom, fields} = render();

        calendar.pickStart('2026-11-03');

        expect(statesOf(opener, picker)).toEqual(['preset', 'pending']);
        expect(labelsOf(picker)).toEqual(['Custom range', '3 Nov 2026']);
        expect(custom.checked).toBe(false);
        expect(picker.querySelector('input[value="last7"]').checked).toBe(true);
        expect(fields()).toEqual(['2026-11-14', '2026-11-20']);
        expect(labelsOf(opener)).toEqual(['Last 7 days', '14 Nov – 20 Nov']);
    });

    it('keeps the pick when only its view moves to another year or month', () => {
        const {picker, calendar, fields} = render();

        calendar.pickStart('2026-11-03');
        calendar.moveView('2025-11-03');

        expect(calendar.tentative).toBe('2026-11-03');
        expect(statesOf(picker)).toEqual(['pending']);
        expect(fields()).toEqual(['2026-11-14', '2026-11-20']);
    });

    it('names both years of a range across two, even on a compact label', () => {
        const {opener, calendar} = render();

        calendar.pickStart('2025-12-28');
        calendar.pickEnd('2026-01-03');

        expect(labelsOf(opener)).toEqual(['Custom range', '28 Dec 2025 – 3 Jan 2026']);
    });
});

describe('Custom range picked by hand', () => {
    it('names the range by its dates, which stay as they were, and drops a pick waiting for its end day', () => {
        const {picker, opener, calendar, fields, pick} = render();

        calendar.pickStart('2026-11-03');
        pick('custom');

        expect(calendar.tentative).toBe('');
        expect(fields()).toEqual(['2026-11-14', '2026-11-20']);
        expect(statesOf(opener, picker)).toEqual(['custom', 'custom']);
        expect(labelsOf(opener)).toEqual(['Custom range', '14 Nov – 20 Nov']);
        expect(labelsOf(picker)).toEqual(['Custom range', '14 Nov – 20 Nov 2026']);
    });
});

describe('the labels', () => {
    it('read in the page\'s language when the calendar names no locale', () => {
        const {picker, pick} = render(rangePicker({locale: null, lang: 'fr'}));

        pick('lastMonth');

        expect(labelsOf(picker)).toEqual(['Last month', '1 oct. – 31 oct. 2026']);
    });

    it('change only on the picker picked from and its button', () => {
        document.body.innerHTML = rangePicker({id: 'one'}) + rangePicker({id: 'two'});
        const [one, two] = [...document.querySelectorAll('[data-range-picker]')].map(pickerParts);

        two.pick('lastMonth');

        expect(two.fields()).toEqual(['2026-10-01', '2026-10-31']);
        expect(labelsOf(two.opener)).toEqual(['Last month', '1 Oct – 31 Oct']);
        expect(one.fields()).toEqual(['2026-11-14', '2026-11-20']);
        expect(labelsOf(one.opener)).toEqual(['Last 7 days', '14 Nov – 20 Nov']);
        expect(one.calendar.value).toBe('');
    });
});

describe('installRangePicker', () => {
    it('adds no second set of listeners, nor rewrites the labels or moves the calendar, when called again', () => {
        const {opener, calendar} = render();
        const listen = vi.spyOn(document, 'addEventListener');
        opener.querySelector('[data-range-dates]').textContent = 'As the server wrote it';

        installRangePicker();

        expect(listen).not.toHaveBeenCalled();
        expect(labelsOf(opener)).toEqual(['Last 7 days', 'As the server wrote it']);
        expect(calendar.views).toEqual([]);
    });
});
