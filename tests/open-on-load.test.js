import {expect, it, vi} from 'vitest';

// Its own file: dialogs open when the behaviours are installed, once per page, so the markup comes first.
it('opens each data-open-on-load dialog as a modal when installed, and only those', async () => {
    document.body.innerHTML = `
        <dialog id="2fa-done" data-open-on-load><p>Save your recovery codes.</p></dialog>
        <dialog id="disable-2fa"><p>Turn off two-factor?</p></dialog>`;
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const {installUiBehaviours} = await import('../src/index.js');

    installUiBehaviours();

    const [done, disable] = document.querySelectorAll('dialog');
    expect(showModal.mock.contexts).toEqual([done]);
    expect(done.open).toBe(true);
    expect(disable.open).toBe(false);

    // A second install does not reopen the dialog the user closed.
    done.close();
    installUiBehaviours();
    expect(done.open).toBe(false);
});
