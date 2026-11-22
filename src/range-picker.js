import 'cally';
import {closestTo, isRadio, once} from './helpers.js';

const PICKER = '[data-range-picker]';
const CALENDAR = 'calendar-range';
const STATE = 'data-range-state';

/** The values of data-range-state: a preset's days, days picked on the calendar, or only the start picked. */
const State = Object.freeze({preset: 'preset', custom: 'custom', pending: 'pending'});

/** data-range-dates="compact" leaves out a year both ends share. */
const COMPACT = 'compact';

/** Between the two days of a Cally range value, and of a preset's data-range-preset: "2026-11-14/2026-11-20". */
const VALUE_SEPARATOR = '/';

/** A spaced en dash: "14 Nov – 20 Nov 2026". */
const DATES_SEPARATOR = ' – ';

// In UTC, as dayOf() reads each day as its UTC midnight.
const DAY = {day: 'numeric', month: 'short', timeZone: 'UTC'};
const DAY_AND_YEAR = {...DAY, year: 'numeric'};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const installRangePicker = once(() => {
    // Cally's change and rangestart don't bubble: listen in the capture phase.
    document.addEventListener('change', pickRange, true);
    document.addEventListener('rangestart', pickStart, true);

    for (const picker of document.querySelectorAll(PICKER)) {
        showRange(picker);
        viewEndDay(picker, fieldsOf(picker).to?.value);
    }
});

function isCalendar(element) {
    return element.localName === CALENDAR;
}

function pickRange(event) {
    const picker = closestTo(event, PICKER);

    if (!picker) {
        return;
    }

    const target = event.target;

    if (isCalendar(target)) {
        const [from, to] = target.value.split(VALUE_SEPARATOR);

        checkCustom(picker);
        applyRange(picker, from, to);
    } else if (isRadio(target)) {
        const preset = presetOf(target);

        dropStart(picker);

        if (preset) {
            moveCalendar(picker, preset.from, preset.to);
            applyRange(picker, preset.from, preset.to);
        } else if (target.hasAttribute('data-range-custom')) {
            showRange(picker);
        }
    }
}

// Only the picker shows the start, as a custom range: the radios, fields and buttons keep the range the form sends.
function pickStart(event) {
    const picker = closestTo(event, PICKER);

    if (!picker || !isCalendar(event.target)) {
        return;
    }

    const start = isoOf(event.detail);
    const range = {state: State.pending, name: nameOf(customRadioOf(picker)), from: start, to: start};

    showIn(picker, range, localeOf(picker));
}

/** A preset radio's days, worked out by the server, from its data-range-preset="from/to"; null for Custom range. */
function presetOf(radio) {
    const [from, to] = radio?.dataset.rangePreset?.split(VALUE_SEPARATOR) ?? [];

    return from && to ? {from, to} : null;
}

function calendarOf(picker) {
    return picker.querySelector(CALENDAR);
}

function checkedRadioOf(picker) {
    return picker.querySelector('input[type="radio"]:checked');
}

function customRadioOf(picker) {
    return picker.querySelector('input[type="radio"][data-range-custom]');
}

function checkCustom(picker) {
    const custom = customRadioOf(picker);

    if (custom) {
        custom.checked = true;
    }
}

/** Drops a start still waiting for its end day. */
function dropStart(picker) {
    const calendar = calendarOf(picker);

    if (calendar) {
        calendar.tentative = '';
    }
}

function moveCalendar(picker, from, to) {
    const calendar = calendarOf(picker);

    if (calendar) {
        calendar.value = from + VALUE_SEPARATOR + to;
        viewEndDay(picker, to);
    }
}

/**
 * Ends the two months on the end day's and focuses that day. Cally pages to a far day by whole pages, which can leave
 * it in the first month. So the view goes to the month before first, then, a task later once Cally has redrawn, to the
 * day itself: one page on with page-by="single".
 */
function viewEndDay(picker, to) {
    const calendar = calendarOf(picker);
    const monthBefore = dayOf(to);

    if (!calendar || !monthBefore) {
        return;
    }

    monthBefore.setUTCDate(1);
    monthBefore.setUTCMonth(monthBefore.getUTCMonth() - 1);
    calendar.focusedDate = isoOf(monthBefore);
    setTimeout(() => {
        calendar.focusedDate = to;
    });
}

function fieldsOf(picker) {
    return {
        from: picker.querySelector('input[data-range-from]'),
        to: picker.querySelector('input[data-range-to]'),
    };
}

function applyRange(picker, from, to) {
    const fields = fieldsOf(picker);

    if (fields.from && fields.to) {
        fields.from.value = from;
        fields.to.value = to;
    }

    showRange(picker);
}

/** Shows the range the form sends on the picker and the buttons that open it. */
function showRange(picker) {
    const radio = checkedRadioOf(picker);
    const fields = fieldsOf(picker);
    const range = {
        state: presetOf(radio) ? State.preset : State.custom,
        name: nameOf(radio),
        from: fields.from?.value,
        to: fields.to?.value,
    };
    const locale = localeOf(picker);

    for (const display of [picker, ...openersOf(picker)]) {
        showIn(display, range, locale);
    }
}

function showIn(display, {state, name, from, to}, locale) {
    display.setAttribute(STATE, state);

    for (const label of display.querySelectorAll('[data-range-name]')) {
        label.textContent = name;
    }

    for (const label of display.querySelectorAll('[data-range-dates]')) {
        const dates = datesOf(from, to, locale, label.dataset.rangeDates === COMPACT);

        // Days that aren't a range (a field the server refused) keep the server's words.
        if (dates !== null) {
            label.textContent = dates;
        }
    }
}

function nameOf(radio) {
    return radio?.labels?.[0]?.textContent.replace(/\s+/g, ' ').trim() ?? '';
}

function openersOf(picker) {
    if (!picker.id) {
        return [];
    }

    return [...document.querySelectorAll('[popovertarget]')]
        .filter((opener) => opener.getAttribute('popovertarget') === picker.id);
}

/** The calendar's locale, so the labels match its months; else the page's lang. */
function localeOf(picker) {
    return calendarOf(picker)?.getAttribute('locale') || picker.closest('[lang]')?.lang || undefined;
}

function isoOf(day) {
    return day.toISOString().slice(0, 10);
}

function dayOf(iso) {
    const day = ISO_DAY.test(iso) ? new Date(`${iso}T00:00:00Z`) : null;

    return day && !Number.isNaN(day.getTime()) ? day : null;
}

// The year once when both ends share it (none on a compact label), on both when not; one day alone.
function datesOf(from, to, locale, compact) {
    const start = dayOf(from);
    const end = dayOf(to);

    if (!start || !end || start > end) {
        return null;
    }

    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const day = new Intl.DateTimeFormat(locale, DAY);
    const dayAndYear = new Intl.DateTimeFormat(locale, DAY_AND_YEAR);
    const last = (compact && sameYear ? day : dayAndYear).format(end);

    if (start.getTime() === end.getTime()) {
        return last;
    }

    return (sameYear ? day : dayAndYear).format(start) + DATES_SEPARATOR + last;
}
