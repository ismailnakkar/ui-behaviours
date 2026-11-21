/** happy-dom can't run Cally: a <calendar-range> with its properties, firing its events as Cally does, not bubbling. */
export class FakeCalendar extends HTMLElement {
    value = '';
    tentative = '';
    /** Every day focusedDate was set to, in order: where the view moved. */
    views = [];

    get focusedDate() {
        return this.views.at(-1);
    }

    set focusedDate(day) {
        this.views.push(day);
    }

    pickStart(day) {
        this.tentative = day;
        this.dispatchEvent(new CustomEvent('rangestart', {detail: new Date(`${day}T00:00:00Z`)}));
    }

    pickEnd(day) {
        this.value = [this.tentative, day].sort().join('/');
        this.tentative = '';
        this.dispatchEvent(new Event('change'));
    }

    // The year or month select, or the previous and next buttons.
    moveView(day) {
        this.focusedDate = day;
        this.dispatchEvent(new CustomEvent('focusday', {detail: new Date(`${day}T00:00:00Z`)}));
    }
}

/** After the timers the package sets: the calendar's second move. */
export const nextTask = () => new Promise((resolve) => setTimeout(resolve));

/** A display's name and dates labels, their spaces (the thin ones around a range's dash too) as plain ones. */
export function labelsOf(display) {
    return ['[data-range-name]', '[data-range-dates]'].map((label) => display.querySelector(label).textContent.replace(/\s+/g, ' ').trim());
}

/** The reports toolbar's range: the server picked Last 7 days on 20 Nov 2026. */
export function rangePicker({id = 'report-range', locale = 'en-GB', lang = 'en'} = {}) {
    return `
        <form method="get" lang="${lang}">
            <button type="button" popovertarget="${id}" data-range-state="preset">
                <svg aria-hidden="true"></svg>
                <span data-range-name>Last 7 days</span>
                <span data-range-dates="compact">14 Nov – 20 Nov</span>
            </button>
            <div id="${id}" popover data-range-picker data-range-state="preset">
                <div role="radiogroup" aria-label="Range">
                    <label><input type="radio" name="range" value="today" data-range-preset="2026-11-20/2026-11-20"> Today</label>
                    <label><input type="radio" name="range" value="last7" data-range-preset="2026-11-14/2026-11-20" checked> Last 7 days</label>
                    <label><input type="radio" name="range" value="lastMonth" data-range-preset="2026-10-01/2026-10-31"> Last month</label>
                    <label>
                        <input type="radio" name="range" value="custom" data-range-custom>
                        <svg aria-hidden="true"></svg>
                        <span>Custom range</span>
                    </label>
                </div>
                <calendar-range months="2" page-by="single" ${locale ? `locale="${locale}"` : ''}></calendar-range>
                <p data-summary>
                    <span class="when-preset"><b data-range-name>Last 7 days</b>, </span>
                    <span data-range-dates>14 Nov – 20 Nov 2026</span>
                    <span class="when-pending">– pick the end day</span>
                </p>
                <input type="hidden" name="from" value="2026-11-14" data-range-from>
                <input type="hidden" name="to" value="2026-11-20" data-range-to>
                <button>Show</button>
            </div>
        </form>`;
}
