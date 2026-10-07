import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate } from '../../scripts/fillTemplate.ts';

describe('fillTemplate', () => {
    test('replaces every placeholder with its value', () => {
        // Act
        const filled = fillTemplate('<h1>{{title}}</h1><p>{{title}} {{size}}px</p>', { title: 'Zoom', size: '12' });

        // Assert
        assert.equal(filled, '<h1>Zoom</h1><p>Zoom 12px</p>');
    });

    test('inserts values verbatim, including replacement patterns like $&', () => {
        // Act
        const filled = fillTemplate('{{price}}', { price: 'costs $& more' });

        // Assert
        assert.equal(filled, 'costs $& more');
    });

    test('rejects a placeholder without a value', () => {
        assert.throws(() => fillTemplate('{{missing}}', {}), /\{\{missing\}\}/);
    });
});
