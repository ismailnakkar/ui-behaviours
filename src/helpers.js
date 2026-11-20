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
