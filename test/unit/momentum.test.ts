import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GLIDE_MS, glideDistance, releaseVelocity } from '../../src/js/input/momentum.ts';

describe('releaseVelocity', () => {
    test('measures the speed over the moves just before release', () => {
        // Arrange: 1 px/ms to the right, 0.5 px/ms down
        const samples = [0, 20, 40, 60, 80].map((t) => ({ x: t, y: t / 2, t }));

        // Act
        const velocity = releaseVelocity(samples, 85);

        // Assert
        assert.ok(Math.abs(velocity.vx - 1) < 1e-9 && Math.abs(velocity.vy - 0.5) < 1e-9, JSON.stringify(velocity));
    });

    test('ignores moves older than the last 100 ms', () => {
        // Arrange: fast early on, then slow
        const samples = [{ x: 0, y: 0, t: 0 }, { x: 500, y: 0, t: 10 }, { x: 510, y: 0, t: 300 }, { x: 520, y: 0, t: 400 }];

        // Act
        const velocity = releaseVelocity(samples, 400);

        // Assert
        assert.ok(Math.abs(velocity.vx - 0.1) < 1e-9, JSON.stringify(velocity));
    });

    test('is zero when the pointer stopped before release', () => {
        // Arrange
        const samples = [{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 50 }];

        // Act
        const velocity = releaseVelocity(samples, 200);

        // Assert
        assert.deepEqual(velocity, { vx: 0, vy: 0 });
    });

    test('is zero with fewer than two moves', () => {
        assert.deepEqual(releaseVelocity([{ x: 5, y: 5, t: 10 }], 10), { vx: 0, vy: 0 });
    });

    test('caps the speed, so a burst of moves at one instant can\'t fling the view away', () => {
        // Arrange: synthetic input can report several moves at the same timestamp
        const samples = [{ x: 0, y: 0, t: 100 }, { x: 300, y: 0, t: 100 }];

        // Act
        const velocity = releaseVelocity(samples, 100);

        // Assert
        assert.ok(Math.abs(velocity.vx) <= 4, JSON.stringify(velocity));
    });
});

describe('glideDistance', () => {
    test('continues at the release speed: one third of speed × glide time', () => {
        // Act
        const maybeDistance = glideDistance({ vx: 1.5, vy: -0.6 });

        // Assert
        assert.deepEqual(maybeDistance, { dx: (1.5 * GLIDE_MS) / 3, dy: (-0.6 * GLIDE_MS) / 3 });
    });

    test('does not glide after a slow release', () => {
        assert.equal(glideDistance({ vx: 0.05, vy: 0.05 }), null);
    });
});
