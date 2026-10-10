/**
 * Pan momentum (#28): after a quick pan the view glides on and slows to a stop. Pure;
 * `pointer.ts` records the pan's pointer moves and starts the glide. The glide eases
 * out cubically over `GLIDE_MS`, which starts at three times its average speed, so a
 * glide of a third of speed × time begins at exactly the release speed: no jolt.
 */

export interface PointerSample {
    x: number;
    y: number;
    /** Milliseconds, on the clock of `Event.timeStamp`. */
    t: number;
}

export interface Velocity {
    /** CSS pixels per millisecond. */
    vx: number;
    vy: number;
}

export const GLIDE_MS = 600;
// Moves this recent count toward the release speed; older ones are the pan's past.
const SAMPLE_WINDOW_MS = 100;
// A pointer still for this long before release had stopped: no glide.
const MAX_STILL_BEFORE_RELEASE_MS = 50;
// Guards the division when moves arrive at (nearly) the same instant.
const MIN_SAMPLE_SPAN_MS = 10;
// About as fast as a hand flicks; caps jittery or synthetic input.
const MAX_SPEED = 4;
// Slower releases just stop.
const MIN_GLIDE_SPEED = 0.2;

const STILL: Velocity = { vx: 0, vy: 0 };

/** The pointer's velocity at release, from the pan's recent moves. */
export function releaseVelocity(samples: readonly PointerSample[], releaseMs: number): Velocity {
    const recent = samples.filter(({ t }) => t >= releaseMs - SAMPLE_WINDOW_MS);
    const maybeFirst = recent[0];
    const maybeLast = recent.at(-1);
    if (recent.length < 2 || !maybeFirst || !maybeLast || maybeLast.t < releaseMs - MAX_STILL_BEFORE_RELEASE_MS) {
        return STILL;
    }
    const span = Math.max(MIN_SAMPLE_SPAN_MS, maybeLast.t - maybeFirst.t);
    const vx = (maybeLast.x - maybeFirst.x) / span;
    const vy = (maybeLast.y - maybeFirst.y) / span;
    const speed = Math.hypot(vx, vy);
    const scale = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
    return { vx: vx * scale, vy: vy * scale };
}

/** How far (CSS pixels) the pointer's motion carries on, or null for no glide. */
export function glideDistance({ vx, vy }: Velocity): { dx: number, dy: number } | null {
    if (Math.hypot(vx, vy) < MIN_GLIDE_SPEED) {
        return null;
    }
    return { dx: (vx * GLIDE_MS) / 3, dy: (vy * GLIDE_MS) / 3 };
}
