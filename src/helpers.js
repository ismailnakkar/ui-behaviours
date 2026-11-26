/** tabindex="-1": script may focus the element, Tab still skips it. */
const FOCUSABLE_FROM_SCRIPT = -1;

/** Wraps an install function so only its first call runs. */
export function once(install) {
    let installed = false;

    return () => {
        if (!installed) {
            installed = true;
            install();
        }
    };
}

/** The element matching selector at or above the event's target: a click on a button's icon lands on the icon. */
export function closestTo({target}, selector) {
    return target instanceof Element ? target.closest(selector) : null;
}

export function isRadio(element) {
    return element instanceof HTMLInputElement && element.type === 'radio';
}

export function isCheckbox(element) {
    return element instanceof HTMLInputElement && element.type === 'checkbox';
}

/**
 * Focuses an element that takes no focus of its own, such as <main> or a heading, giving it tabindex="-1" first, so the
 * page needs none in its markup; a tabindex the page set is kept. A missing element leaves focus where it is.
 */
export function moveFocusTo(element, options) {
    if (!element) {
        return;
    }

    if (!element.hasAttribute('tabindex')) {
        element.tabIndex = FOCUSABLE_FROM_SCRIPT;
    }

    element.focus(options);
}
