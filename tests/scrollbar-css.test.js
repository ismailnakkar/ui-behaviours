import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

// From the package's root, where the suite runs.
const css = readFileSync('src/scrollbar.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const readme = readFileSync('README.md', 'utf8');

const PROPERTY = /--scrollbar-[a-z-]+/g;

const defaultsBlock = css.match(/:where\(:root\) \{([^}]*)\}/)[1];
const declared = new Set([...defaultsBlock.matchAll(/(--scrollbar-[a-z-]+):/g)].map(([, property]) => property));
const reads = new Set([...css.matchAll(/var\((--scrollbar-[a-z-]+)\)/g)].map(([, property]) => property));

const FIREFOX_GUARD = '@supports not selector(::-webkit-scrollbar) {';

describe('scrollbar.css', () => {
    it('gives every property it reads a default in :where(:root)', () => {
        expect([...reads].filter((property) => !declared.has(property))).toEqual([]);
    });

    it('reads every property it declares', () => {
        expect([...declared].filter((property) => !reads.has(property))).toEqual([]);
    });

    it('lists every property in the README', () => {
        const documented = new Set(readme.match(PROPERTY));

        expect([...declared].filter((property) => !documented.has(property))).toEqual([]);
    });

    it('styles only the scrollbar class', () => {
        const selectors = [...css.matchAll(/^([^@{}\s][^{]*)\{/gm)].map(([, selector]) => selector.trim()).filter((selector) => selector !== ':where(:root)');

        expect(selectors.length).toBeGreaterThan(0);
        expect(selectors.filter((selector) => !selector.startsWith('.scrollbar'))).toEqual([]);
    });

    // Chrome 121+ reads the standard pair too, and drops every ::-webkit-scrollbar rule once either is set.
    it('sets scrollbar-width and scrollbar-color only where ::-webkit-scrollbar is unknown', () => {
        const guard = css.indexOf(FIREFOX_GUARD);
        const outside = guard === -1 ? css : css.slice(0, guard);

        expect(guard).toBeGreaterThan(-1);
        expect(outside).not.toMatch(/scrollbar-(width|color)\s*:/);
        expect(css.slice(guard)).toMatch(/scrollbar-width:\s*thin/);
    });

    it('closes every block it opens', () => {
        expect(css.split('{').length).toBe(css.split('}').length);
    });
});
