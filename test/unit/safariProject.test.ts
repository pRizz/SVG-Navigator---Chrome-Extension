import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * The Safari app bundles the web build by referencing each top-level entry of
 * `dist/safari` from the Xcode project. Each entry of `src/` builds to an entry of
 * the same name there, so a new one has to be added to the project too.
 */
describe('Safari Xcode project', () => {
    test('references every top-level entry of the extension source', () => {
        // Arrange
        const project = readFileSync(new URL('../../safari/SVG Navigator.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
        const group = /\/\* Web Extension \*\/ = \{(.*?)\n\t\t\};/s.exec(project)?.[1];
        assert.ok(group, 'the project has no "Web Extension" group');
        const referencedIds = [...group.matchAll(/^\t{4}(\w+) \/\*/gm)].map((match) => match[1]);
        const referencedPaths = referencedIds.map((id) => new RegExp(`\\t\\t${id} /\\* .*? \\*/ = \\{isa = PBXFileReference;.*? path = ([^;]+);`).exec(project)?.[1]);

        // Act
        const sourceEntries = readdirSync(new URL('../../src/', import.meta.url)).filter((name) => !name.startsWith('.'));

        // Assert
        assert.deepEqual(referencedPaths.toSorted(), sourceEntries.toSorted());
    });
});
