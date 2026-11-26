import {closestTo, moveFocusTo} from './helpers.js';

const STEPPER = '[data-steps]';
const STEP = '[data-step]';
const MARK = '[data-step-mark]';
const PROGRESS = '[data-step-progress]';
const FIELDS = 'input, select, textarea';
const HEADING = 'h1, h2, h3, h4, h5, h6';
const BACK = '[data-step-back]';
const NEXT = '[data-step-next]';
const SUBMIT = '[data-step-submit]';
const MARK_STATE = 'data-step-state';

/** Steps go by their place in the markup: the first is 0 here, and 1 in data-step-progress's wording. */
const FIRST_STEP = 0;

/** data-step-progress's placeholders, as Laravel's __() leaves them when given none: the showing step's place and the count. */
const PROGRESS_PLACEHOLDER = /:(steps|step)\b/g;

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
 * field, as a field the server never hands back (a mailed code) is empty again. Otherwise at the step
 * data-open-at-step names, or shut at the step it shows.
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
        return stepOf(stepper, fields.find((field) => isRefused(field) || !field.checkValidity()));
    }

    // Unnamed steps carry an empty data-step, which an empty data-open-at-step must not pick.
    const name = stepper.dataset.openAtStep;
    const named = name ? stepsOf(stepper).findIndex((section) => section.dataset.step === name) : -1;

    return named === -1 ? null : named;
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
    } else if (fieldsOf(stepsOf(stepper)[step]).every((field) => field.reportValidity())) {
        moveTo(stepper, step + 1);
    }
}

// An empty field on another step would block the submit with nothing on screen to say why: show its step instead.
function submit(stepper) {
    const invalid = fieldsOf(stepper).find((field) => !field.checkValidity());

    if (invalid) {
        show(stepper, stepOf(stepper, invalid));
        invalid.reportValidity();

        return;
    }

    stepper.querySelector(STEP)?.closest('form')?.requestSubmit();
}

// To the new step's heading, so a screen reader starts where the step does.
function moveTo(stepper, step) {
    show(stepper, step);
    moveFocusTo(stepsOf(stepper)[step]?.querySelector(HEADING));
}

function show(stepper, step) {
    const steps = stepsOf(stepper);

    steps.forEach((section, place) => {
        section.hidden = place !== step;
    });

    // Marks pair with the steps by place: the first mark is the first step's.
    stepper.querySelectorAll(MARK).forEach((mark, place) => {
        const state = markStateOf(place, step);

        if (state === null) {
            mark.removeAttribute(MARK_STATE);
        } else {
            mark.setAttribute(MARK_STATE, state);
        }
    });

    for (const progress of stepper.querySelectorAll(PROGRESS)) {
        progress.textContent = progress.dataset.stepProgress.replace(
            PROGRESS_PLACEHOLDER,
            (_placeholder, name) => String(name === 'steps' ? steps.length : step + 1),
        );
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

/** The place of the step a field belongs to. */
function stepOf(stepper, field) {
    return stepsOf(stepper).indexOf(field.closest(STEP));
}

/** The step showing; the first when none does. */
function currentStepOf(stepper) {
    const showing = stepsOf(stepper).findIndex((section) => !section.hidden);

    return showing === -1 ? FIRST_STEP : showing;
}

function isLast(stepper, step) {
    return step >= stepsOf(stepper).length - 1;
}

/** The fields of a step, or of every step in a stepper. */
function fieldsOf(element) {
    return [...element.querySelectorAll(FIELDS)].filter((field) => field.closest(STEP));
}
