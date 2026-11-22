import {closestTo} from './helpers.js';

const STEPPER = '[data-steps]';
const STEP = '[data-step]';
const FIELDS = 'input, select, textarea';
const HEADING = 'h1, h2, h3, h4, h5, h6';
const BACK = '[data-step-back]';
const NEXT = '[data-step-next]';
const SUBMIT = '[data-step-submit]';
const MARK_STATE = 'data-step-state';

/** Steps are numbered from 1, in the order they come. */
const FIRST_STEP = 1;

/** The values of data-step-state on a progress mark: the steps behind are done, the one showing is current. */
const MarkState = Object.freeze({done: 'done', current: 'current'});

/** Listens for the steppers' buttons and Enter, and shows each stepper on the page at the step it opens at. */
export function installSteps() {
    document.addEventListener('click', stepOnClick);
    document.addEventListener('keydown', stepOnEnter);

    for (const stepper of document.querySelectorAll(STEPPER)) {
        openStepper(stepper);
    }
}

// preventDefault(): a control that is a submit button moves the steps without sending the form.
function stepOnClick(event) {
    const control = closestTo(event, `${BACK}, ${NEXT}, ${SUBMIT}`);
    const stepper = control?.closest(STEPPER);

    if (!stepper || event.defaultPrevented) {
        return;
    }

    event.preventDefault();

    if (control.matches(BACK)) {
        back(stepper);
    } else if (control.matches(NEXT)) {
        advance(stepper);
    } else {
        submit(stepper);
    }
}

// Enter in a field moves on, as Next does: the form's own submit would skip the steps' checks.
function stepOnEnter(event) {
    const field = event.target;
    const stepper = field instanceof HTMLInputElement ? field.closest(STEP)?.closest(STEPPER) : null;

    if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented || !stepper) {
        return;
    }

    event.preventDefault();
    advance(stepper);
}

/**
 * A refused submit comes back with its errors in the stepper: it opens at the earliest step with a refused or an empty
 * field, as a field the server never hands back (a mailed code) is empty again. Otherwise at data-open-at-step, or
 * shut at the step it shows.
 */
function openStepper(stepper) {
    const opening = openingStepOf(stepper);

    show(stepper, opening ?? currentStepOf(stepper));

    if (opening !== null && stepper instanceof HTMLDialogElement && !stepper.open) {
        stepper.showModal();
    }
}

function openingStepOf(stepper) {
    const fields = fieldsOf(stepper);

    if (fields.some(isRefused)) {
        return stepOf(fields.find((field) => isRefused(field) || !field.checkValidity()));
    }

    const asked = Number(stepper.dataset.openAtStep);

    return sectionOf(stepper, asked) ? asked : null;
}

/** A field the server refused: aria-invalid="true" beside its message. */
function isRefused(field) {
    return field.getAttribute('aria-invalid') === 'true';
}

function back(stepper) {
    const step = currentStepOf(stepper);

    if (step > FIRST_STEP) {
        moveTo(stepper, step - 1);
    }
}

/** Moves on once the step's fields pass, or submits from the last step. */
function advance(stepper) {
    const step = currentStepOf(stepper);

    if (isLast(stepper, step)) {
        submit(stepper);
    } else if (fieldsOf(sectionOf(stepper, step)).every((field) => field.reportValidity())) {
        moveTo(stepper, step + 1);
    }
}

// An empty field on another step would block the submit with nothing on screen to say why: show its step instead.
function submit(stepper) {
    const invalid = fieldsOf(stepper).find((field) => !field.checkValidity());

    if (invalid) {
        show(stepper, stepOf(invalid));
        invalid.reportValidity();

        return;
    }

    stepper.querySelector(STEP)?.closest('form')?.requestSubmit();
}

// To the new step's heading, so a screen reader starts where the step does.
function moveTo(stepper, step) {
    show(stepper, step);
    sectionOf(stepper, step)?.querySelector(HEADING)?.focus();
}

function show(stepper, step) {
    for (const section of stepsOf(stepper)) {
        section.hidden = stepOf(section) !== step;
    }

    for (const mark of stepper.querySelectorAll('[data-step-mark]')) {
        const state = markStateOf(Number(mark.dataset.stepMark), step);

        if (state === null) {
            mark.removeAttribute(MARK_STATE);
        } else {
            mark.setAttribute(MARK_STATE, state);
        }
    }

    for (const label of stepper.querySelectorAll('[data-step-label]')) {
        label.hidden = Number(label.dataset.stepLabel) !== step;
    }

    hideAll(stepper, BACK, step === FIRST_STEP);
    hideAll(stepper, NEXT, isLast(stepper, step));
    hideAll(stepper, SUBMIT, !isLast(stepper, step));
}

function markStateOf(mark, step) {
    if (mark < step) {
        return MarkState.done;
    }

    return mark === step ? MarkState.current : null;
}

function hideAll(stepper, selector, hidden) {
    for (const element of stepper.querySelectorAll(selector)) {
        element.hidden = hidden;
    }
}

function stepsOf(stepper) {
    return [...stepper.querySelectorAll(STEP)];
}

function sectionOf(stepper, step) {
    return stepsOf(stepper).find((section) => stepOf(section) === step);
}

/** The step a section or a field belongs to. */
function stepOf(element) {
    return Number(element.closest(STEP).dataset.step);
}

/** The step showing; the first when none does. */
function currentStepOf(stepper) {
    const showing = stepsOf(stepper).find((section) => !section.hidden);

    return showing ? stepOf(showing) : FIRST_STEP;
}

function isLast(stepper, step) {
    return step >= stepsOf(stepper).length;
}

/** The fields of a step, or of every step in a stepper. */
function fieldsOf(element) {
    return [...element.querySelectorAll(FIELDS)].filter((field) => field.closest(STEP));
}
