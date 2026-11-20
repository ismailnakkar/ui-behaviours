import 'cally';

const PICKER = '[data-range-picker]';
const CALENDAR = 'calendar-range';

/** What a picker's data-range-state says: a preset's dates, days picked on the calendar, or only the start picked. */
const PRESET = 'preset';
const CUSTOM = 'custom';
const PENDING = 'pending';

const STATE = 'data-range-state';

/** A data-range-dates="compact" label leaves the year out when both ends fall in the same one. */
const COMPACT = 'compact';

const DAY = {day: 'numeric', month: 'short', timeZone: 'UTC'};
const DAY_AND_YEAR = {...DAY, year: 'numeric'};

/** Between a range's two ends: "14 Nov – 20 Nov 2026". */
const DATES_SEPARATOR = ' – ';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

let installed = false;

/**
 * Listens on the document for the range pickers, and writes the labels of those on the page from their fields and
 * moves their calendars to the range's end day. Call it once from the layout script; a second call does nothing.
 */
export function installRangePicker() {
    if (installed) {
        return;
    }

    installed = true;

    // Cally's change and rangestart don't bubble: listen while they travel down.
    document.addEventListener('change', pickRange, true);
    document.addEventListener('rangestart', pickStart, true);

    for (const picker of document.querySelectorAll(PICKER)) {
        showRange(picker);
        viewEndDay(picker, fieldsOf(picker)[1]?.value);
    }
}

function pickerOf({target}) {
    return target instanceof Element ? target.closest(PICKER) : null;
}

function isCalendar(element) {
    return element.localName === CALENDAR;
}

// Two days on the calendar make a custom range; a preset moves the calendar to its dates, which come from the server.
function pickRange(event) {
    const picker = pickerOf(event);
    const target = event.target;

    if (!picker) {
        return;
    }

    if (isCalendar(target)) {
        const [from, to] = target.value.split('/');

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

// Only the start is picked: the radios, the fields and the buttons keep the range the form sends, and the picker alone
// shows the start, named as a custom range, while it waits for the end.
function pickStart(event) {
    const picker = pickerOf(event);

    if (!picker || !isCalendar(event.target)) {
        return;
    }

    const start = isoOf(event.detail);

    showIn(picker, {state: PENDING, name: nameOf(customRadioOf(picker)), from: start, to: start}, localeOf(picker));
}

function isRadio(element) {
    return element instanceof HTMLInputElement && element.type === 'radio';
}

/** A preset radio's days, worked out by the server; null for Custom range. */
function presetOf(radio) {
    const {from, to} = radio?.dataset ?? {};

    return from && to ? {from, to} : null;
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

/** A radio picked drops a pick waiting for its end day. */
function dropStart(picker) {
    const calendar = picker.querySelector(CALENDAR);

    if (calendar) {
        calendar.tentative = '';
    }
}

function moveCalendar(picker, from, to) {
    const calendar = picker.querySelector(CALENDAR);

    if (calendar) {
        calendar.value = `${from}/${to}`;
        viewEndDay(picker, to);
    }
}

/**
 * Moves the calendar's two months to end on the range's end day's, and its keyboard focus to that day. Cally pages to a
 * day next to its months by one, but to a farther one by whole pages, which may leave the day in the first month. So a
 * month before it first, which lands in either month; then, once Cally has drawn that (in microtasks, so a task later),
 * the day itself, now at most one month on (page-by="single").
 */
function viewEndDay(picker, to) {
    const calendar = picker.querySelector(CALENDAR);
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

/** The form's from and to fields, in the picker. */
function fieldsOf(picker) {
    return [picker.querySelector('input[data-range-from]'), picker.querySelector('input[data-range-to]')];
}

function applyRange(picker, from, to) {
    const [fromField, toField] = fieldsOf(picker);

    if (fromField && toField) {
        fromField.value = from;
        toField.value = to;
    }

    showRange(picker);
}

/** The range the form sends, on the picker and on the buttons that open it. */
function showRange(picker) {
    const radio = checkedRadioOf(picker);
    const [fromField, toField] = fieldsOf(picker);
    const range = {
        state: presetOf(radio) ? PRESET : CUSTOM,
        name: nameOf(radio),
        from: fromField?.value,
        to: toField?.value,
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

/** A preset's name is its label's text: the app's words. */
function nameOf(radio) {
    return radio?.labels?.[0]?.textContent.replace(/\s+/g, ' ').trim() ?? '';
}

function openersOf(picker) {
    if (!picker.id) {
        return [];
    }

    return [...document.querySelectorAll('[popovertarget]')].filter((opener) => opener.getAttribute('popovertarget') === picker.id);
}

/** The calendar's locale, so the labels read as its months do, else the page's language. */
function localeOf(picker) {
    return picker.querySelector(CALENDAR)?.getAttribute('locale') || picker.closest('[lang]')?.lang || undefined;
}

function isoOf(day) {
    return day.toISOString().slice(0, 10);
}

function dayOf(iso) {
    const day = ISO_DAY.test(iso) ? new Date(`${iso}T00:00:00Z`) : null;

    return day && !Number.isNaN(day.getTime()) ? day : null;
}

function datesOf(from, to, locale, compact) {
    const [start, end] = [dayOf(from), dayOf(to)];

    if (!start || !end || start > end) {
        return null;
    }

    // Each end as a day, the year once where both share it (none on a compact label), the one day alone.
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const [day, dayAndYear] = [new Intl.DateTimeFormat(locale, DAY), new Intl.DateTimeFormat(locale, DAY_AND_YEAR)];
    const last = (compact && sameYear ? day : dayAndYear).format(end);

    if (start.getTime() === end.getTime()) {
        return last;
    }

    return (sameYear ? day : dayAndYear).format(start) + DATES_SEPARATOR + last;
}
