# @ismailnakkar/ui-behaviours

Small page behaviours driven by plain HTML attributes: copy to the clipboard, confirm a submit, send a form once, open,
close and light-dismiss a native `<dialog>`, check every row from a header box, and select a field's text on a click.
One call installs them all as delegated listeners on the document, so markup added later works too. A date range picker
over [Cally](https://wicky.nillia.ms/cally/) sits on its own entry, so pages without one never load the calendar. The
package ships no styles and no wording: the app styles the states it sets, and every question or label comes from the
app's markup.

## Install

```bash
npm i @ismailnakkar/ui-behaviours
```

No dependencies for the behaviours. The [range picker](#range-picker) needs Cally 0.9, an optional peer dependency:
`npm i cally`. Type declarations are included.

## Usage

Call it once from the layout's script, on every page:

```js
import {installUiBehaviours} from '@ismailnakkar/ui-behaviours';

installUiBehaviours();
```

A second call does nothing: no second set of listeners, and no dialog opened again. Run it after the page is parsed
(a module script, or a deferred one), as it opens the `data-open-on-load` dialogs there and then.

`copyText(text)` is the clipboard write the copy buttons use, for a page's own script (copying a link it just made):
it resolves to `true` when the clipboard took the text, `false` where `navigator.clipboard` is absent (plain http) or
refuses.

```js
import {copyText} from '@ismailnakkar/ui-behaviours';

if (!(await copyText(url))) {
    field.select();
}
```

## The attributes

### `data-copy="id"`

On a button: a click copies the element with that id. That is its `data-copy-value` when it has one (text grouped on
screen for reading, such as a setup key), else an input's or a textarea's current value, else its text as laid out
(`innerText`: one line per block, so a list copies one item a line), trimmed.

```html
<input id="short-url" value="https://cuty.io/abcd" readonly data-autoselect>
<button type="button" data-copy="short-url"><span>Copy</span><span>Copied</span></button>

<code id="setup-key" data-copy-value="JBSWY3DPEHPK3PXP">JBSW Y3DP EHPK 3PXP</code>
<button type="button" data-copy="setup-key">Copy key</button>
```

The button gets `data-copied` for 1.5 seconds when the copy worked, or `data-copy-failed` when the browser refused;
the field or text is then selected, focused for a field, so the user copies it by hand. A second click restarts the
1.5 seconds and replaces the other mark. A missing source copies nothing.

To refuse a copy (asking for a missing field first), call `event.preventDefault()` in a click listener of the page's
own on the button or an element around it: the copy skips a cancelled click.

### `data-confirm="question"`

On a form, or on one of its submit buttons: the browser's `confirm()` asks that question, and only a yes submits. The
pressed button's question wins over the form's, so buttons sharing a form ask their own; a button without one asks the
form's. A submit the page already cancelled asks nothing.

```html
<form method="POST" action="/links/5" data-confirm="Delete this link?">…</form>

<button formaction="/admin/withdrawals/5/approve" data-confirm="Approve withdrawal #5?">Approve</button>
```

### `data-submit-once`

On a form: the first submit goes and marks the form `data-submitting`; every later one is refused, so a double click on
a payment button pays once. The buttons stay enabled, as a disabled submitter would drop its `name` and `value` from
the form; style the mark to show the wait. A submit `data-confirm` refused was never sent and leaves no mark. A page
restored from the back-forward cache (Back from a provider's page) drops the mark, so its forms send again.

```html
<form method="POST" action="/subscription" data-submit-once>
    <button name="gateway" value="stripe">Pay by card</button>
    <button name="gateway" value="balance">Pay with balance</button>
</form>
```

### `data-show-modal="id"`

On a button or a link: a click opens the `<dialog>` with that id with `showModal()` (Escape closes it, focus moves in,
the page behind is inert). On a link, the `href` is the fallback: a modified click (new tab, new window), or a page
without that dialog, follows it. A click the page cancelled opens nothing, and an open dialog stays as it is.

```html
<a href="/links/create" data-show-modal="shorten-dialog">Shorten a link</a>
```

### `data-close-modal`

On a button inside a dialog: a click closes that dialog (the native `close` event fires). On a submit button it closes
without sending the form, so a Cancel button may sit in the dialog's form.

```html
<button type="button" data-close-modal>Cancel</button>
```

The native `<form method="dialog">` closes a dialog without script, as does Escape.

### `closedby="any"`

On a dialog: the native attribute for light dismiss. A click on the backdrop closes the dialog; a press inside its box
dragged out onto the backdrop (a text selection) does not. Where the browser supports `closedby` the package leaves it
to the browser, elsewhere it does it itself.

```html
<dialog id="shorten-dialog" aria-labelledby="shorten-dialog-title" closedby="any">…</dialog>
```

### `data-open-on-load`

On a dialog: it opens with `showModal()` when the behaviours are installed, say to show a dialog again after a failed
submit inside it, or a one-time result.

```html
<dialog id="recovery-codes" data-open-on-load>…</dialog>
```

### `data-check-all="name"`

On a header checkbox: checking or unchecking it does the same to every enabled checkbox named `name`. When a row
changes, the header follows: checked when every row is, indeterminate when some are.

```html
<input type="checkbox" data-check-all="ids[]" aria-label="Select all">
<input type="checkbox" name="ids[]" value="5">
```

Setting the rows from the header fires no `change` on them: a page counting selected rows listens to the header too.

### `data-autoselect`

On an input or a textarea: a click selects all of its text, as tabbing in already does natively.

```html
<input value="https://cuty.io/abcd" readonly data-autoselect>
```

## Styling

The package sets attributes and the browser's own states; the app styles them:

- `[data-copied]` and `[data-copy-failed]` on a copy button: show its "Copied" or "Copy it by hand" label, hide
  "Copy". The words are the app's, in the button.
- `dialog`, `dialog::backdrop`, and `dialog[open]` for an opening transition.
- `:indeterminate` on a header checkbox, if the app restyles checkboxes.

```html
<button type="button" data-copy="short-url">
    <span class="copy-label">Copy</span>
    <span class="copied-label">Copied</span>
    <span class="failed-label">Copy it by hand</span>
</button>
```

```css
.copied-label,
.failed-label,
[data-copied] > .copy-label,
[data-copy-failed] > .copy-label {
    display: none;
}

[data-copied] > .copied-label,
[data-copy-failed] > .failed-label {
    display: inline;
}
```

## Events

The package fires none of its own. A dialog's native `close` event fires when a close button or the backdrop closes it.

## Accessibility

- Dialogs are native `<dialog>` opened with `showModal()`: focus moves in, the page behind is inert, Escape closes,
  and focus goes back to the opener on close. Give each one an `aria-labelledby`.
- Put the copy state in the button's text (two spans, one hidden), so it never relies on colour alone.
- A refused copy selects and focuses the field, so the user can copy it with the keyboard.
- The copy marks change an attribute only, so screen readers announce nothing. A page that needs it adds a
  `role="status"` line and fills it when `data-copied` appears (a `MutationObserver`).

## Testing

The listeners need a DOM, so run your app's tests in happy-dom or jsdom (Vitest: `environment: 'happy-dom'`). They sit
on the document and outlive a test's markup: install them once per test file (`beforeAll`).

Run this package's suite with `npm test`.

## Range picker

A date range for a GET form: a button opens a native popover with the app's preset ranges beside a Cally
`<calendar-range>`, and the picks fill the form's `from` and `to` fields. It is its own entry, which loads Cally:

```js
import {installRangePicker} from '@ismailnakkar/ui-behaviours/range-picker';

installRangePicker();
```

As with `installUiBehaviours()`: call it once, after the page is parsed; a second call does nothing. It listens on the
document, so a picker added later works too, and it writes the labels of the pickers already on the page from their
fields, so they read as a pick will, and moves their calendars to the end day; one added later keeps the server's
labels and view until its first pick.

It needs the browser's Popover API (Chrome 114, Safari 17, Firefox 125), which npm cannot check: without it the button
opens nothing and the box shows in place, where its radios and fields still submit.

### The markup

```html
<form method="get" action="/reports">
    <button type="button" popovertarget="report-range" data-range-state="preset">
        <svg aria-hidden="true">…</svg>
        <span data-range-name>Last 7 days</span>
        <span data-range-dates="compact">14 Nov – 20 Nov</span>
    </button>

    <div id="report-range" popover data-range-picker data-range-state="preset">
        <div role="radiogroup" aria-label="Range">
            <label><input type="radio" name="range" value="today" data-from="2026-11-20" data-to="2026-11-20"> Today</label>
            <label><input type="radio" name="range" value="last7" data-from="2026-11-14" data-to="2026-11-20" checked> Last 7 days</label>
            <label><input type="radio" name="range" value="custom" data-range-custom> Custom range</label>
        </div>

        <calendar-range months="2" page-by="single" value="2026-11-14/2026-11-20" focused-date="2026-11-20"
                        min="2025-03-02" max="2026-11-20" today="2026-11-20" locale="en-GB" first-day-of-week="1">
            <svg slot="previous" role="img" aria-label="Previous">…</svg>
            <svg slot="next" role="img" aria-label="Next">…</svg>
            <calendar-select-year slot="heading"><span slot="label">Year</span></calendar-select-year>
            <calendar-month></calendar-month>
            <calendar-month offset="1"></calendar-month>
        </calendar-range>

        <p aria-live="polite">
            <span class="when-preset"><b data-range-name>Last 7 days</b>, </span>
            <span data-range-dates>14 Nov – 20 Nov 2026</span>
            <span class="when-pending">– pick the end day</span>
        </p>

        <input type="hidden" name="from" value="2026-11-14" data-range-from>
        <input type="hidden" name="to" value="2026-11-20" data-range-to>
        <button>Show</button>
    </div>
</form>
```

- **`data-range-picker`** marks the box holding the rest, a `popover` here. Its buttons are the elements whose
  `popovertarget` names its id.
- **`data-from` and `data-to`** on a preset's radio give its days as `YYYY-MM-DD`; the server works them out, the
  package does no calendar maths. Picking it sets the calendar's `value` and moves its view so the two months end on
  the end day's, with keyboard focus on that day (this needs `page-by="single"`), then fills the fields and labels.
- **`data-range-custom`** on the Custom range radio: two days picked on the calendar check it and fill the fields.
  While only the start is picked, the picker shows that day alone, named as Custom range, and the radios, the fields and
  the buttons keep the range the form sends. Paging the calendar or changing its year or month only moves the view and
  keeps the pick; picking a radio, this one too, drops it.
- **`data-range-from` and `data-range-to`** on the two hidden fields the form sends, inside the picker.
- **`<calendar-range>`** is set up and styled (`::part`) by the app: its months, `min`, `max`, `today`, `locale`,
  `page-by` and slots. The package sets only its `value`, `focusedDate` and `tentative`.
- **`data-range-name`**, in the picker or a button: the checked radio's label text.
- **`data-range-dates`**, in the picker or a button: each end by `Intl.DateTimeFormat` (day, short month) in the
  calendar's `locale`, else the page's `lang`, joined by a spaced en dash, with the year once when both ends share it
  ("14 Nov – 20 Nov 2026"), on both when not ("28 Dec 2025 – 3 Jan 2026"), and one day alone ("20 Nov 2026").
  `data-range-dates="compact"` leaves a shared year out ("14 Nov – 20 Nov"). Days that are no range (a field the
  server refused) keep their text.
- **`data-range-state`**: `preset` or `custom` for the checked radio, and on the picker `pending` while only the start
  is picked. The buttons show the range the form sends, so never `pending`.

Render the labels and the states on the server too: they are what shows before the script runs, and on a picker added
later until its first pick.

### Styling

The words for each state are the app's, in the markup; the app shows the ones `data-range-state` calls for:

```css
.when-pending,
[data-range-state="custom"] .when-preset,
[data-range-state="pending"] .when-preset,
[data-range-state="custom"] > [data-range-name] {
    display: none;
}

[data-range-state="pending"] .when-pending {
    display: inline;
}
```

While `pending` the checked radio is still the range the form sends. To show Custom range as the one being picked,
style `[data-range-state="pending"] label:has([data-range-custom])` as checked, and the checked label as not.

### Events

The package fires none of its own. Cally's `change` and `rangestart` do not bubble, so the package listens to them in
the capture phase; a page's own listener does the same. The radios fire the native `change`.

### Accessibility

- Label the radio group (`aria-label`) and the button (`aria-labelledby` on its field label and itself), and give the
  summary `aria-live="polite"`, so a pick is read out.
- Give Cally's previous and next slots an `aria-label`, and its year select a `label` slot.

### Testing

happy-dom and jsdom cannot run Cally. Mock it, and define a `calendar-range` of your own that holds `value`,
`focusedDate` and `tentative`, and dispatches Cally's events, not bubbling: `change` once `value` holds both days,
`rangestart` with the start day as a `Date` in `detail`.

```js
vi.mock('cally', () => ({}));

customElements.define('calendar-range', class extends HTMLElement {
    value = '';
    focusedDate = undefined;
    tentative = '';
});
```

## Upgrading

### From an app's own code

0.1.0 is the first release. An app moving from its own copy of these behaviours changes:

- **exe** (`resources/js/site/behaviours.ts`): `data-check-all` names its rows, `data-check-all="ids[]"`. Copy marks
  last 1.5 seconds, not 2. `data-dismiss` and `data-dropdown` are exe's alone and stay in its own script.
  `copyText` comes from the package.
- **cuty** (`modal.js`, `copy.js`): `id="modal-open-{id}"` openers become `data-show-modal="modal-{id}"`,
  `data-modal-close` becomes `data-close-modal`, the backdrop click needs `closedby="any"` on the dialog, and
  `data-open-on-load` stays. On a copy source, `data-key` becomes `data-copy-value` and the source gets the id the
  button's `data-copy` names; `.copied-button` becomes `[data-copied]`.
- **upfiles** (`copy-buttons.js`, `confirm-action.js`, `form-affordances.js`, the select-all boxes):
  `data-copy-target="#id"` becomes `data-copy="id"`, with both labels in the button styled on `[data-copied]` and
  `[data-copy-failed]` instead of `data-copied-label` and `data-failed-label`; `data-confirm` on a submit button is
  unchanged, and on a form now works too; a refused copy selects the field instead of trying
  `document.execCommand('copy')`; `data-select-on-focus` becomes `data-autoselect`; a `#select-all` box
  becomes `data-check-all="{its rows' name}"`.
