import {expect, it, vi} from 'vitest';
import {FakeCalendar, labelsOf, nextTask, rangePicker} from './range-picker-fixtures.js';

vi.mock('cally', () => ({}));

// Its own file: the pickers on the page are written when the package is installed, once per page, so the markup comes
// first.
it('writes the pickers on the page from their fields, leaves the labels of days the server refused, and moves each calendar to its end day', async () => {
    customElements.define('calendar-range', FakeCalendar);
    document.body.innerHTML = rangePicker({id: 'shown'}) + rangePicker({id: 'refused'});
    const [shown, refused] = document.querySelectorAll('[data-range-picker]');
    const opener = (picker) => document.querySelector(`[popovertarget="${picker.id}"]`);
    const datesOf = (display) => display.querySelector('[data-range-dates]');
    datesOf(opener(shown)).textContent = 'Stale';
    datesOf(opener(refused)).textContent = 'As the server wrote it';
    refused.querySelector('[data-range-to]').value = '2026-01-31';
    const {installRangePicker} = await import('../src/range-picker.js');

    installRangePicker();
    await nextTask();

    expect(labelsOf(opener(shown))).toEqual(['Last 7 days', '14 Nov – 20 Nov']);
    expect(labelsOf(shown)).toEqual(['Last 7 days', '14 Nov – 20 Nov 2026']);
    expect([opener(shown).dataset.rangeState, shown.dataset.rangeState]).toEqual(['preset', 'preset']);
    expect(labelsOf(opener(refused))).toEqual(['Last 7 days', 'As the server wrote it']);
    expect(shown.querySelector('calendar-range').views).toEqual(['2026-10-01', '2026-11-20']);
    expect(refused.querySelector('calendar-range').views).toEqual(['2025-12-01', '2026-01-31']);
});
