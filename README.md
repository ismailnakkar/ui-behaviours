# @ismailnakkar/ui-behaviours

Page behaviours from plain HTML attributes: copy to the clipboard and say the result to screen readers, confirm
a submit, send a form once, send a form on a change, open, close and light-dismiss a native `<dialog>`, walk a form's
steps one at a time, show what a radio, a checkbox or a select chose, check every row from a header box, select a
field's text on a click, dismiss a banner, and close a `<details>` menu on an outside click or Escape. They listen on
the document, so markup added later works too. A `post()` helper sends a page script's request the way Laravel expects
one.

A date range picker over [Cally](https://wicky.nillia.ms/cally/) has its own entry, so pages without one never load the
calendar, and an optional stylesheet themed by custom properties. Nothing else ships styles, and nothing ships wording:
the app styles the states the package sets, and every word comes from the app's markup.

## Install

```bash
npm i @ismailnakkar/ui-behaviours
```

The behaviours have no dependencies. The [range picker](#range-picker) needs Cally 0.9.2 or a later 0.9 release, an
optional peer dependency (`npm i cally`). Type declarations are included.

## Usage

Call `installUiBehaviours()` once from the layout's script, on every page, after the page is parsed (a module or a
deferred script): it also opens the page's `data-open-on-load` dialogs and shows each stepper at the step it opens at. A
second call does nothing.

```js
import {installUiBehaviours} from '@ismailnakkar/ui-behaviours';

installUiBehaviours();
```

Then mark up the page:

| Attribute | On | Does |
|---|---|---|
| [`data-copy="id"`](#data-copyid) | a button | copies the element with that id |
| [`data-copy-value`](#data-copyid) | the copied element | the text to copy instead of what it shows |
| [`data-copy-status="id"`](#data-copy-statusid) | a copy button | says the result in the live region with that id |
| [`data-confirm="question"`](#data-confirmquestion) | a form or a submit button | asks before submitting |
| [`data-submit-once`](#data-submit-once) | a form | refuses a second submit |
| [`data-submit-on-change`](#data-submit-on-change) | a select, a checkbox or a radio in a form | submits the form when it changes |
| [`data-show-modal="id"`](#data-show-modalid) | a button or a link | opens the dialog with that id as a modal |
| [`data-close-modal`](#data-close-modal) | a button in a dialog | closes that dialog |
| [`closedby="any"`](#closedbyany) | a dialog | closes it on a backdrop click |
| [`data-open-on-load`](#data-open-on-load) | a dialog | opens it on install |
| [`data-steps`](#data-steps) | a dialog or any box | shows its `data-step` sections one at a time |
| [`data-show-if="name=value"`](#data-show-ifnamevalue-and-data-clear-onname) | any element in a form | shows it only while the radio, checkbox or select `name` holds that value |
| [`data-clear-on="name"`](#data-show-ifnamevalue-and-data-clear-onname) | a field in a form | empties it when another radio `name` is picked |
| [`data-check-all="name"`](#data-check-allname) | a header checkbox | checks every row named `name` |
| [`data-autoselect`](#data-autoselect) | an input or a textarea | selects its text on a click |
| [`data-dismiss`](#data-dismiss) | a button in a banner | fades the banner out and hides it |
| [`data-dropdown`](#data-dropdown) | a `<details>` | closes it on a click outside it or Escape |

### `data-copy="id"`

On a button: a click copies the element with that id, taking the first of:

1. its `data-copy-value`, for text grouped on screen for reading, such as a setup key;
2. an input's or a textarea's current value;
3. its text as laid out (`innerText`: one line per block, so a list copies one item a line), trimmed.

```html
<input id="short-url" value="https://example.com/abcd" readonly data-autoselect>
<button type="button" data-copy="short-url"><span>Copy</span><span>Copied</span></button>

<code id="setup-key" data-copy-value="JBSWY3DPEHPK3PXP">JBSW Y3DP EHPK 3PXP</code>
<button type="button" data-copy="setup-key">Copy key</button>
```

The button gets `data-copied` when the copy worked, or `data-copy-failed` when the browser refused, for 1.5 seconds; a
second click restarts the 1.5 seconds and replaces the other mark. On a refusal the field or text is selected, a field
focused too, so the user copies it by hand. A missing source copies nothing.

To refuse a copy (asking for a missing field first), call `event.preventDefault()` in a click listener of your own on
the button or an element around it: the copy skips a cancelled click.

### `data-copy-status="id"`

On a copy button: names a live region (`role="status"`) that says the result, as the button's own marks are not read
out. The region holds the words: its `data-copied-text` for a copy that worked, its `data-copy-failed-text` for a
refusal; a result it has no words for says nothing.

```html
<input id="short-url" value="https://example.com/abcd" readonly data-autoselect>
<button type="button" data-copy="short-url" data-copy-status="short-url-status">
    <span>Copy</span><span>Copied</span>
</button>
<p id="short-url-status" role="status" class="sr-only"
   data-copied-text="Link copied" data-copy-failed-text="Copy blocked: copy the selected link by hand"></p>
```

The click empties the region, so the same words said again are read out again; the words go in once the clipboard
answers and leave with the button's marks, 1.5 seconds later, unless the page has written something else there since.
Buttons may share one region, and the page may use it for its own news too. Keep the region in place, never `hidden`:
a hidden element is out of the accessibility tree, and one that appears as it speaks is not reliably read.

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
a payment button pays once. The buttons stay enabled, as a disabled submitter would drop its `name` and `value`; style
the mark to show the wait. A submit refused by `data-confirm`, or cancelled by a listener on the form, was never sent
and leaves no mark. A page restored from the back-forward cache (Back from a provider's page) drops the mark, so its
forms send again.

```html
<form method="POST" action="/subscription" data-submit-once>
    <button name="gateway" value="stripe">Pay by card</button>
    <button name="gateway" value="balance">Pay with balance</button>
</form>
```

### `data-submit-on-change`

On a select, a checkbox or a radio in a form: a change submits the form with `requestSubmit()`, as its submit button
would, so the browser checks the fields and `data-confirm` and `data-submit-once` apply. A field in no form sends
nothing. Mark only choices whose result the label makes plain, such as a sort or a filter.

```html
<form method="GET" action="/admin/reports">
    <label for="sort">Sort by</label>
    <select id="sort" name="sort" data-submit-on-change>…</select>
    <noscript><button>Sort</button></noscript>
</form>
```

### `data-show-modal="id"`

On a button or a link: a click opens the `<dialog>` with that id with `showModal()`. On a link the `href` is the
fallback: a modified click (new tab, new window) follows it, as does any click on a page without that dialog. A click
the page cancelled opens nothing, and an open dialog stays open.

```html
<a href="/links/create" data-show-modal="shorten-dialog">Shorten a link</a>
```

### `data-close-modal`

On a button inside a dialog: a click closes that dialog, and the native `close` event fires. On a submit button it
closes without sending the form, so a Cancel button may sit in the dialog's form.

```html
<button type="button" data-close-modal>Cancel</button>
```

Without script, `<form method="dialog">` and Escape close a dialog natively.

### `closedby="any"`

On a dialog: the native light-dismiss attribute. A click on the backdrop closes the dialog; a press inside its box
dragged out onto the backdrop (a text selection) does not. A browser that supports `closedby` does this itself;
elsewhere the package does.

```html
<dialog id="shorten-dialog" aria-labelledby="shorten-dialog-title" closedby="any">…</dialog>
```

### `data-open-on-load`

On a dialog: it opens with `showModal()` when the behaviours are installed, say to show a dialog again after a failed
submit inside it, or a one-time result.

```html
<dialog id="recovery-codes" data-open-on-load>…</dialog>
```

### `data-steps`

On a dialog or any other box: a form's fields in steps, one showing at a time, each checked before the next shows, and
the form sent from the last. Two-factor enrolment is one: scan the code, the mailed code, the app's code, all posted
by one form.

```html
<dialog id="two-factor-dialog" aria-labelledby="two-factor-title" data-steps>
    <h2 id="two-factor-title">Turn on two-factor</h2>
    <div aria-hidden="true">
        <i data-step-mark data-step-state="current"></i><i data-step-mark></i><i data-step-mark></i>
    </div>
    <p aria-live="polite" data-step-progress="Step :step of :steps"></p>

    <form id="two-factor-enable" method="POST" action="/user/two-factor-authentication">
        <section data-step="scan">
            <h3 tabindex="-1">Scan the QR code</h3>
            …
        </section>
        <section data-step="email" hidden>
            <h3 tabindex="-1">Confirm your email</h3>
            <input name="email_code" required autocomplete="one-time-code">
        </section>
        <section data-step="app" hidden>
            <h3 tabindex="-1">Enter the code from your app</h3>
            <input name="code" required aria-invalid="true" aria-describedby="code-error" autocomplete="one-time-code">
            <p id="code-error">The code is not valid.</p>
        </section>
    </form>

    <button type="button" data-step-back hidden>Back</button>
    <button type="button" data-close-modal>Cancel</button>
    <button type="button" data-step-next>Next</button>
    <button type="button" data-step-submit hidden>Turn on</button>
</dialog>
```

- **`data-step`** on each step, all inside one form: the steps go in the order they come, so none is numbered. Its
  value is a name, needed only for `data-open-at-step` to point at; `data-step` alone is fine. Only the step showing is
  not `hidden`. Its fields are the inputs, selects and textareas in it.
- **`data-step-next`**: checks the step's fields (`reportValidity()`, so the browser says what is missing), then shows
  the next step and focuses its first heading; give the heading `tabindex="-1"`. From the last step it submits, as
  `data-step-submit` does. Enter in an input of a step does the same, so the form's own submit never skips a step's
  check; Enter while an input method composes is left alone.
- **`data-step-back`** shows the step before.
- **`data-step-submit`**: checks every step's fields; one left empty shows its step and the browser's message, else the
  form is sent (`requestSubmit()`, so `data-confirm` and `data-submit-once` apply).
- **`data-step-mark`**, a progress mark, one per step in the same order: gets `data-step-state="done"` behind the step
  showing and `"current"` for it; the marks ahead have none.
- **`data-step-progress="…"`**: the stepper writes this wording as the element's text, with `:step` as the showing
  step's place from 1 and `:steps` as the count, such as "Step 2 of 3" in a live region. Laravel's `__()` given no
  replacements leaves both placeholders in, so `data-step-progress="{{ __('enrolment.progress') }}"` works in every
  locale.

The controls may sit anywhere in the stepper, in or out of the form; one that is a submit button moves the steps without
sending the form. Back is hidden on the first step, Next on the last, and Submit on every other.

On install, a stepper opens (`showModal()` on a dialog) at:

1. the earliest step with a refused or an empty field, when a field carries **`aria-invalid="true"`**: the page a
   refused submit came back as. A field the server never hands back, such as a mailed code, is empty again, so its step
   comes first. `aria-invalid="true"` is the one error mark the stepper reads: set it on each field the server refused,
   with its message.
2. else **`data-open-at-step="name"`** on the stepper, the step whose `data-step` has that name, such as the email
   step on the page after "Email me a code";
3. else nowhere: a dialog stays shut, and the stepper shows the step the server drew.

Draw the first state on the server too (the first step showing, its mark current, Back and Submit hidden): it is what
shows before the script runs. The `data-step-progress` text is written on install. A stepper added later works, but opens at nothing.

### `data-show-if="name=value"` and `data-clear-on="name"`

In a form, for a choice: an element marked `data-show-if="name=value"` shows while the field named `name` holds that
value, and hides once it does not.

- **A radio**: picking one shows the elements naming its value and hides those naming another.
- **A checkbox**: ticking the box with that value shows them, unticking it hides them, and another box of the same name
  leaves them alone. A box without a `value` has the value `on`.
- **A select**: a change shows the elements naming a selected option's value and hides the rest.

Picking a radio named `name` also empties the fields marked `data-clear-on="name"`, which belonged to the value picked
before. A payout destination is one: the account depends on the method.

```html
<form method="POST" action="/withdrawals/destination">
    <label><input type="radio" name="method" value="paypal" checked> PayPal</label>
    <label><input type="radio" name="method" value="usdt_polygon"> USDT on Polygon</label>

    <input name="account" required data-clear-on="method" aria-describedby="account-hint">
    <div id="account-hint" aria-live="polite">
        <p data-show-if="method=paypal">Your PayPal email address.</p>
        <p data-show-if="method=usdt_polygon" hidden>Your USDT address on the Polygon network.</p>
    </div>
</form>
```

```html
<select name="driver">
    <option value="local" selected>Local disk</option>
    <option value="s3">S3</option>
</select>
<fieldset data-show-if="driver=s3" hidden>…</fieldset>

<label><input type="checkbox" name="report" value="1"> Report it</label>
<div data-show-if="report=1" hidden>…</div>
```

The server draws the chosen value's elements shown and the others `hidden`, a refused submit's page from the values
sent back; the script changes them on a change only. It reads within the changed field's form (the page, for a field in
no form). A hidden element's fields still submit, and a hidden `required` one blocks the submit: leave `required` off
them and let the server require each for its own value.

### `data-check-all="name"`

On a header checkbox: checking or unchecking it does the same to every enabled checkbox named `name`. When a row
changes, the header follows: checked when every row is, indeterminate when some are.

```html
<input type="checkbox" data-check-all="ids[]" aria-label="Select all">
<input type="checkbox" name="ids[]" value="5">
```

The header sets the rows without firing `change` on them, so a page counting selected rows listens to the header too.

### `data-autoselect`

On an input or a textarea: a click selects all of its text, as tabbing in already does.

```html
<input value="https://example.com/abcd" readonly data-autoselect>
```

### `data-dismiss`

On a button that is a direct child of a banner (a flash message, a toast): a click fades the banner out over 150ms,
`inert` meanwhile, then sets `hidden` on it. Under reduced motion, or without the Web Animations API, it hides at once.
The banner stays in the page, so a script may show it again by clearing `hidden` (`banner.hidden = false`); during the
fade, cancel it first (`banner.getAnimations().forEach((animation) => animation.cancel())`), or it hides. When focus
was inside the banner it moves to the page's `<main>` first, so a keyboard user keeps their place. A click the page
cancelled dismisses nothing.

```html
<div role="status" class="flash">
    <p>Link saved.</p>
    <button type="button" data-dismiss aria-label="Dismiss">×</button>
</div>
```

### `data-dropdown`

On a `<details>` used as a menu: a click anywhere outside an open one closes it, and Escape closes every open one and
focuses its `<summary>`, which a `<details>` does not do itself. Other `<details>` (an FAQ) are left alone.

```html
<details data-dropdown>
    <summary>English</summary>
    <form method="POST" action="/locale">…</form>
</details>
```

## Styling

The package sets attributes and the browser's own states; the app styles them:

- `[data-copied]` and `[data-copy-failed]` on a copy button: show its "Copied" or "Copy it by hand" label instead of
  "Copy". The words are the app's, in the button.
- `[data-submitting]` on a form sent once, to show the wait.
- `[hidden]` on a dismissed banner. A `display` of the app's own on the banner (a `flex` class, an inline
  `style="display: flex"`) beats the attribute: hide it with `[hidden] { display: none !important; }` (Tailwind 4's
  preflight has this rule), and show a reused banner by clearing `hidden`, not by setting `display`.
- `details[open]` for an open `data-dropdown`.
- `[data-step-state="done"]` and `[data-step-state="current"]` on a stepper's progress marks.
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

## Accessibility

- Dialogs are native `<dialog>` opened with `showModal()`: focus moves in, the page behind is inert, Escape closes,
  and focus goes back to the opener on close. Give each one an `aria-labelledby`.
- Put the copy state in the button's text (two spans, one hidden), so it never relies on colour alone.
- A refused copy selects and focuses the field, so the user can copy it with the keyboard.
- The copy marks change an attribute only, which screen readers do not read out: give the button a
  [`data-copy-status`](#data-copy-statusid) region with the words for both results, so the result is heard.
- A change that submits moves the page under the user, and on some desktop browsers an arrow key on a closed select
  changes it at once: keep `data-submit-on-change` to a sort or a filter that is cheap to redo, and give the form a
  submit button for a page without script.
- A stepper moves focus to the new step's heading, so a screen reader starts where the step does: give each a
  `tabindex="-1"`. Hide the progress marks (`aria-hidden="true"`) and give the `data-step-progress` element
  `aria-live="polite"`.
- Point a field's `aria-describedby` at its `data-show-if` hints' box, in an `aria-live="polite"` region, so a warning
  shown on a pick is read out.
- A dismissed banner hands focus to `<main>`: give it `tabindex="-1"` (a skip link's target already has it), or focus
  falls to `<body>`. Give a `data-dismiss` button that shows only an icon an `aria-label`.
- A `data-dropdown`'s `<summary>` is its button: put the menu's name in it, and a `<details>` says itself whether it is
  open.

## Range picker

A date range for a GET form: a button opens a native popover with the app's preset ranges beside a Cally
`<calendar-range>`, and the picks fill the form's `from` and `to` fields. Its own entry loads Cally:

```js
import {installRangePicker} from '@ismailnakkar/ui-behaviours/range-picker';

installRangePicker();
```

Call it after the page is parsed; a second call does nothing. For each picker already on the page it rewrites the
labels from the fields and moves the calendar to the end day. A picker added later works too, but keeps the server's
labels and view until its first pick.

It needs the browser's Popover API (Chrome 114, Safari 17, Firefox 125), which npm cannot check: without it the button
opens nothing and the box shows in place, where its radios and fields still submit.

### The markup

The classes are the [stylesheet](#styling-the-picker)'s, for an app that uses it.

```html
<form method="get" action="/reports">
    <div class="field">
        <button type="button" class="range-picker-button" popovertarget="report-range" data-range-state="preset">
            <svg aria-hidden="true">…</svg>
            <span data-range-name>Last 7 days</span>
            <span data-range-dates="compact">14 Nov – 20 Nov</span>
        </button>

        <div id="report-range" popover data-range-picker data-range-state="preset">
            <div class="range-picker-panel">
                <div class="range-picker-presets" role="radiogroup" aria-label="Range">
                    <label class="range-picker-preset"><input type="radio" name="range" value="today" data-range-preset="2026-11-20/2026-11-20"> Today</label>
                    <label class="range-picker-preset"><input type="radio" name="range" value="last7" data-range-preset="2026-11-14/2026-11-20" checked> Last 7 days</label>
                    <label class="range-picker-preset"><input type="radio" name="range" value="custom" data-range-custom> Custom range</label>
                </div>

                <calendar-range months="2" page-by="single" value="2026-11-14/2026-11-20" focused-date="2026-11-20"
                                min="2025-03-02" max="2026-11-20" today="2026-11-20" locale="en-GB" first-day-of-week="1">
                    <svg slot="previous" role="img" aria-label="Previous">…</svg>
                    <svg slot="next" role="img" aria-label="Next">…</svg>
                    <calendar-select-year slot="heading"><span slot="label">Year</span></calendar-select-year>
                    <div class="range-picker-months">
                        <calendar-month></calendar-month>
                        <calendar-month offset="1"></calendar-month>
                    </div>
                </calendar-range>
            </div>

            <div class="range-picker-foot">
                <p class="range-picker-summary" aria-live="polite">
                    <span class="when-preset"><b data-range-name>Last 7 days</b>, </span>
                    <span data-range-dates>14 Nov – 20 Nov 2026</span>
                    <span class="when-pending">– <span class="range-picker-pick-end">pick the end day</span></span>
                </p>
                <input type="hidden" name="from" value="2026-11-14" data-range-from>
                <input type="hidden" name="to" value="2026-11-20" data-range-to>
                <button type="button" popovertarget="report-range" popovertargetaction="hide">Set</button>
            </div>
        </div>
    </div>

    <button>Show</button>
</form>
```

Set only closes the popover, with the picks already in the fields: the form's own submit button runs it.

- **`data-range-picker`** marks the box holding the rest, a `popover` here. Its buttons are the elements whose
  `popovertarget` names its id.
- **`data-range-preset="from/to"`** on a preset's radio gives its days as `YYYY-MM-DD/YYYY-MM-DD`, the format of
  Cally's `value`; the server works them out, the package does no calendar maths. Picking it sets the calendar's
  `value` and moves its view so the two months end on the end day's, with keyboard focus on that day (this needs
  `page-by="single"`), then fills the fields and labels.
- **`data-range-custom`** on the Custom range radio: two days picked on the calendar check it and fill the fields.
  While only the start is picked, the picker shows that day alone, named as Custom range, and the radios, the fields and
  the buttons keep the range the form sends. Paging the calendar or changing its year or month only moves the view and
  keeps the pick; picking a radio, this one too, drops it.
- **`data-range-from` and `data-range-to`** on the two hidden fields the form sends, inside the picker.
- **`<calendar-range>`** is set up by the app: its months, `min`, `max`, `today`, `locale`, `page-by` and slots. The
  package sets only its `value`, `focusedDate` and `tentative`; the stylesheet styles its parts.
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

### Styling the picker

The stylesheet styles the button's layout and open look, the popover, the presets, Cally's parts and the state words.
Import it once, from the page's script or the app's CSS:

```js
import '@ismailnakkar/ui-behaviours/range-picker.css';
```

```css
@import '@ismailnakkar/ui-behaviours/range-picker.css' layer(components);
```

It is in no cascade layer, so it beats layered utility classes (Tailwind v4's) on the picker; the second form puts it in
the app's `components` layer, under its utilities.

It styles these, and nothing outside them:

| Selector | On |
|---|---|
| `.range-picker-button` | the button that opens the picker: the app draws the control (border, height, padding); the stylesheet lays out its icon, name and days, anchors the popover to it, and marks it while the popover is open. Put the popover after it in the same parent. |
| `[data-range-picker]` | the popover |
| `.range-picker-panel` | the presets beside the calendar |
| `.range-picker-presets`, `.range-picker-preset` | the radio group, and each preset's label around its radio |
| `.range-picker-months` | the calendar's months, inside `<calendar-range>` |
| `.range-picker-foot`, `.range-picker-summary`, `.range-picker-pick-end` | the row under the calendar, its summary line, and the "pick the end day" words in it |
| `.when-preset`, `.when-pending` | the words for each `data-range-state` |

It draws no icons: the app sizes the button's, the arrows' in Cally's `previous` and `next` slots and any in a preset,
and mirrors the arrows on a right-to-left page.

Under 56rem the presets turn into a row of chips over the calendar. From 64rem, where the browser has anchor
positioning (Chrome 129, Safari 26), the popover opens under its button toward the line's end, flipped where that runs
out of room and no taller than the room it opens into, so a short window scrolls it; under 64rem it is centred. A
second picker on the same page anchors to the last button.

Override these custom properties on `:root`, or on one picker and its button. The defaults sit in `:where(:root)`, so
any rule of yours wins; the ones defaulting to another property follow it.

| Property | Default | Styles |
|---|---|---|
| `--range-picker-text-color` | `#1c2130` | The popover's text, the days, the month and year, the summary's range name, and a custom range's days on the button |
| `--range-picker-muted-color` | `#687086` | The button's days and the summary |
| `--range-picker-preset-color` | `--range-picker-muted-color` | The presets |
| `--range-picker-preset-hover-background` | `--range-picker-hover-background` | A preset under the pointer |
| `--range-picker-arrow-color` | `--range-picker-muted-color` | Cally's previous and next buttons |
| `--range-picker-weekday-color` | `--range-picker-muted-color` | The weekday names |
| `--range-picker-background` | `#fff` | The popover, the arrows and the year select |
| `--range-picker-hover-background` | `#f4f6fb` | A day, an arrow and the year select under the pointer, and the button while the popover is open |
| `--range-picker-border-color` | `#e6e8ef` | The popover's border |
| `--range-picker-rule-color` | `--range-picker-border-color` | The rule beside the presets (under them as chips) and the one over the summary |
| `--range-picker-control-border-color` | `#cfd4df` | The arrows, the year select and the presets as chips |
| `--range-picker-accent-color` | `#3d5afe` | The picked preset's text, the range's two ends, today, the "pick the end day" words, focus rings, and the button's border while the popover is open |
| `--range-picker-accent-hover-color` | `#2f48d4` | The range's ends under the pointer: set it to the accent to keep them as they are |
| `--range-picker-on-accent-color` | `#fff` | The range's ends' text |
| `--range-picker-selected-background` | `#eef1ff` | The picked preset |
| `--range-picker-band-background` | `--range-picker-selected-background` | The days between the ends |
| `--range-picker-band-color` | `#2f48d4` | Their text |
| `--range-picker-disabled-color` | `#aeb5c6` | The days out of the calendar's bounds |
| `--range-picker-disabled-band-background` | `--range-picker-border-color` | Picked days out of the bounds (a preset reaching before the first day) |
| `--range-picker-disabled-band-color` | `--range-picker-muted-color` | Their text |
| `--range-picker-disabled-end-background` | `--range-picker-control-border-color` | A range end out of the bounds |
| `--range-picker-disabled-end-color` | `--range-picker-text-color` | Its text |
| `--range-picker-radius` | `0.75rem` | The popover's corners |
| `--range-picker-control-radius` | `0.5rem` | The presets', the days', the arrows' and the year select's corners |
| `--range-picker-padding` | `1.25rem` | The popover's padding: set a smaller one under your phone width |

The weights and the text sizes are the stylesheet's: the popover's text is `0.875rem`, the year select's `1rem`, the
button's days `0.8125rem` and the weekday names `0.75rem`.

The colours are light; a dark page sets its own under its dark selector. The stylesheet uses no `light-dark()`:
Lightning CSS (in Vite and Tailwind v4) lowers it to variables it sets only where the same stylesheet declares
`color-scheme`.

Without the stylesheet, the app shows the words each state calls for itself:

```css
[data-range-state] .when-pending,
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
style `[data-range-state="pending"] label:has([data-range-custom])` as checked, and the checked label as not, as the
stylesheet does.

### The picker's accessibility

- Label the radio group (`aria-label`) and the button (`aria-labelledby` on its field label and itself), and give the
  summary `aria-live="polite"`, so a pick is read out.
- Give Cally's previous and next slots an `aria-label`, and its year select a `label` slot.

## API

| Import | Does |
|---|---|
| `installUiBehaviours()` | listens on the document for every behaviour above, opens the `data-open-on-load` dialogs and shows each stepper at the step it opens at; later calls do nothing |
| `copyText(text)` | the copy buttons' clipboard write: resolves to `true` when the clipboard took the text, `false` where `navigator.clipboard` is absent (plain http) or refuses |
| `post(url, body)` | `fetch()`es a `FormData` or `URLSearchParams` body to `url` as a POST that Laravel answers as an AJAX request; resolves to the `Response` |
| `installRangePicker()`, from `@ismailnakkar/ui-behaviours/range-picker` | listens on the document for range pickers and writes those already on the page; later calls do nothing |
| `@ismailnakkar/ui-behaviours/range-picker.css` | the range picker's [stylesheet](#styling-the-picker) |

`copyText()` serves a page's own script, copying a link it just made:

```js
import {copyText} from '@ismailnakkar/ui-behaviours';

if (!(await copyText(url))) {
    field.select();
}
```

`post()` serves a page script that sends a form itself. It sends `X-Requested-With: XMLHttpRequest` (so
`$request->ajax()` holds), `Accept: application/json` (so a refusal comes back as JSON: a 422 with the field errors, not
a redirect), the `<meta name="csrf-token" content="{{ csrf_token() }}">` token as `X-CSRF-TOKEN`, and the page's
`<html lang>` as `Accept-Language`, so a route with no language in its URL answers in the page's language. A page
without the meta tag sends the form's `@csrf` field instead; one without a `lang` sends the browser's language. Like
`fetch()`, it rejects only when the request fails: check `response.ok` or `response.status` for a refusal.

```js
import {post} from '@ismailnakkar/ui-behaviours';

const response = await post(form.action, new FormData(form));

if (response.status === 422) {
    showErrors((await response.json()).errors);
}
```

## Events

The package fires none of its own. A dialog's native `close` fires when a close button or the backdrop closes it, a
`data-dropdown`'s native `toggle` when it closes, the range picker's radios fire the native `change`, and a
`data-submit-on-change` field's form the native `submit`. Cally's `change` and `rangestart` do not bubble: listen to
them in the capture phase, as the package does.

## Testing

The listeners need a DOM, so run your app's tests in happy-dom or jsdom (Vitest: `environment: 'happy-dom'`). They sit
on the document and outlive a test's markup: install them once per test file (`beforeAll`).

happy-dom and jsdom cannot run Cally. For the range picker, mock it, and define a `calendar-range` of your own that
holds `value`, `focusedDate` and `tentative`, and dispatches Cally's events, not bubbling: `change` once `value` holds
both days, `rangestart` with the start day as a `Date` in `detail`.

```js
vi.mock('cally', () => ({}));

customElements.define('calendar-range', class extends HTMLElement {
    value = '';
    focusedDate = undefined;
    tentative = '';
});
```

A dismissed banner hides once its 150ms fade ends: wait for it (`vi.waitFor`), or stub `matchMedia` to match
`(prefers-reduced-motion: reduce)` so it hides at once. A test of a script that calls `post()` stubs `fetch`
(`vi.stubGlobal('fetch', …)`).

A stepper needs nothing more: happy-dom and jsdom check `required` fields and send a form with `requestSubmit()`. To
test one opening on load, put its markup in place before installing, in a test file of its own or after
`vi.resetModules()` with a fresh `import()`.

Run this package's suite with `npm test`: oxlint, then Vitest.

## Upgrading

### From 0.6

The package now acts on `data-dismiss` and `details[data-dropdown]`. A page without either works as before; one with
them:

- Remove any script of your own for either attribute, or both run (a banner faded twice).
- A `data-dismiss` that another script reads, such as Bootstrap 4's `data-dismiss="modal"`, now also hides its button's
  parent: give that script an attribute of its own (Bootstrap 5's `data-bs-dismiss`).
- A dismissed banner is `hidden`, not removed: a test that checked it was gone checks `hidden`, and a `display` of
  your own on the banner needs `[hidden] { display: none !important; }` to lose to it (see [Styling](#styling)).

### From 0.5

Steppers go by order and name, never by number:

- `data-step="1"`, `"2"`, … become `data-step`, or `data-step="name"` for a step that `data-open-at-step` points at.
- `data-open-at-step` takes that name: `data-open-at-step="2"` opens nothing now.
- `data-step-mark="n"` becomes `data-step-mark`, one per step in the same order.
- `data-step-label="n"` is gone: one `data-step-progress="Step :step of :steps"` element replaces the labels.

### From 0.4

- The stylesheet no longer reads `--range-picker-shadow`, `--range-picker-font-size`, `--range-picker-window-gap`,
  `--range-picker-offset`, `--range-picker-anchored-max-height`, `--range-picker-position-try-order`,
  `--range-picker-day-size`, `--range-picker-preset-height`, `--range-picker-chip-height`,
  `--range-picker-preset-hover-color` or `--range-picker-arrow-hover-color`: it draws their old defaults. A page that
  set one gets the default instead.

### From 0.3

Nothing changes for a page on 0.3: copy buttons without `data-copy-status` and radios work as before, a select or a
checkbox changes nothing unless a `data-show-if` names its field, and only a field marked `data-submit-on-change`
submits.

### From 0.2

Nothing changes for a page on 0.2: the stepper, `data-show-if` and `data-clear-on` read only attributes of their own,
and the stylesheet loads only when imported.

### From 0.1

- A preset radio gives its days in one attribute, `data-range-preset="from/to"`, in place of `data-from` and `data-to`:
  `data-from="2026-11-14" data-to="2026-11-20"` becomes `data-range-preset="2026-11-14/2026-11-20"`. The old pair is
  no longer read: picking a radio marked with it fills nothing, and checked it shows as `custom`.
