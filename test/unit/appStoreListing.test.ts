import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listing = readFileSync(new URL('../../store/app-store/listing.md', import.meta.url), 'utf8');

/** Returns the text between `<!-- name -->` and `<!-- /name -->`. */
function section(name: string): string {
    const text = new RegExp(`<!-- ${name} -->\\n(.*?)\\n<!-- /${name} -->`, 's').exec(listing)?.[1];
    assert.ok(text, `listing.md has no ${name} section`);
    return text;
}

/** Returns the value of a `- **Label** [limit]: value` line. */
function field(label: string): string {
    const value = new RegExp(`^- \\*\\*${label}\\*\\* \\[\\d+\\]: (.+)$`, 'm').exec(listing)?.[1];
    assert.ok(value, `listing.md has no ${label} field`);
    return value;
}

/** App Store Connect counts keywords in bytes. */
const byteLength = (text: string): number => Buffer.byteLength(text, 'utf8');

describe('App Store listing', () => {
    test('name fits in 30 characters', () => {
        assert.ok(field('Name').length <= 30);
    });

    test('subtitle fits in 30 characters', () => {
        assert.ok(field('Subtitle').length <= 30);
    });

    test('promotional text fits in 170 characters', () => {
        assert.ok(section('promotional-text').length <= 170);
    });

    test('keywords fit in 100 bytes', () => {
        // Act
        const bytes = byteLength(section('keywords'));

        // Assert
        assert.ok(bytes <= 100, `${bytes} bytes`);
    });

    // A space after a comma would spend part of the 100-byte budget.
    test('keywords have no spaces after the commas', () => {
        assert.doesNotMatch(section('keywords'), /, /);
    });

    test('description fits in 4000 characters', () => {
        assert.ok(section('description').length <= 4000);
    });

    test('review notes fit in 4000 characters', () => {
        assert.ok(section('review-notes').length <= 4000);
    });
});
