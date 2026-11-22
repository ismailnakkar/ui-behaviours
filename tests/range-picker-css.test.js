import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

// From the package's root, where the suite runs.
const css = readFileSync('src/range-picker.css', 'utf8');
const readme = readFileSync('README.md', 'utf8');

const PROPERTY = /--range-picker-[a-z-]+/g;

const defaultsBlock = css.match(/:where\(:root\) \{([^}]*)\}/)[1];
const declared = new Set([...defaultsBlock.matchAll(/(--range-picker-[a-z-]+):/g)].map(([, property]) => property));

/** Each var(--range-picker-…) the rules read, with whether it carries a fallback. */
const reads = [...css.matchAll(/var\((--range-picker-[a-z-]+)(,)?/g)].map(([, property, fallback]) => ({property, fallback: fallback !== undefined}));

describe('range-picker.css', () => {
    it('gives every property it reads a default, in :where(:root) or beside each read', () => {
        const bare = reads.filter(({property, fallback}) => !declared.has(property) && !fallback).map(({property}) => property);

        expect(bare).toEqual([]);
    });

    it('reads every property it declares', () => {
        const unread = [...declared].filter((property) => !reads.some((read) => read.property === property));

        expect(unread).toEqual([]);
    });

    it('lists every property in the README', () => {
        const documented = new Set(readme.match(PROPERTY));
        const missing = [...new Set(css.match(PROPERTY))].filter((property) => !documented.has(property));

        expect(missing).toEqual([]);
    });

    it('closes every block it opens', () => {
        const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

        expect(stripped.split('{').length).toBe(stripped.split('}').length);
    });
});
