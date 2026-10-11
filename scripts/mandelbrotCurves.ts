/**
 * The `curves` style: each palette band as smooth, filled ribbons instead of pixels.
 *
 * The escape time is sampled at the corners of the `width`×`height` grid and treated
 * as a continuous field. For each band threshold, marching squares traces where the
 * field crosses it, and the closed loops become one even-odd filled `<path>` drawn
 * through smooth quadratic curves. The layers stack from the lowest threshold up, so
 * each point shows the band its escape time falls in, as the `pixels` style does;
 * the set itself is traced the same way and drawn on top.
 */

import { bandColors, maybeEscapeTime, type MandelbrotOptions } from './mandelbrot.ts';

/** The drawing for the `curves` style, ready to wrap in an `<svg>`. */
export interface CurveLayers {
    /** The color under every layer: the band of the lowest escape time in view. */
    readonly backgroundColor: string;
    readonly paths: readonly string[];
    /** Closed loops across all paths. */
    readonly loopCount: number;
}

/** A sampled field on a grid one sample wider on every side than the image's corners. */
interface PaddedGrid {
    readonly values: Float64Array;
    /** Vertices per row, padding included. */
    readonly columns: number;
    /** Vertex rows, padding included. */
    readonly rows: number;
}

type Point = readonly [number, number];

/** Traces the bands, and then the set, of the image `options` describes. */
export function curveLayers(options: MandelbrotOptions): CurveLayers {
    const { width, height, bands, cycle, interiorColor, curveDetail } = options;
    const colors = bandColors(options.paletteStops, bands);
    const levelStep = cycle / bands;
    const escapeTimes = sampleCornerEscapeTimes(options);
    const isInterior = escapeTimes.map((time) => (Number.isNaN(time) ? 1 : 0));
    // Near the set's edge the escape time climbs steeply, and every band between a
    // sample and its neighbor would trace its own outline along that edge: hundreds of
    // nearly identical loops. Capping the climb keeps `curveDetail` outlines per cell.
    const field = limitSlope(fillInterior(escapeTimes, width + 1, height + 1), width + 1, height + 1, levelStep * curveDetail);

    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const time of field) {
        minTime = Math.min(minTime, time);
        maxTime = Math.max(maxTime, time);
    }
    const lowestLevel = Math.floor(minTime / levelStep);
    const highestLevel = Math.floor(maxTime / levelStep);
    const bandGrid = padGrid(field, width + 1, height + 1, lowestLevel * levelStep - 1);

    const paths: string[] = [];
    let loopCount = 0;
    const addLayer = (loops: readonly Point[][], color: string): void => {
        if (loops.length === 0) {
            return;
        }
        loopCount += loops.length;
        paths.push(`<path fill="${color}" d="${loops.map((loop) => smoothLoopPath(loop, width, height)).join('')}"/>`);
    };
    const cellsByLevel = cellsCrossingLevels(bandGrid, levelStep, lowestLevel + 1, highestLevel);
    cellsByLevel.forEach((cells, offset) => {
        const level = lowestLevel + 1 + offset;
        addLayer(traceLoops(bandGrid, level * levelStep, cells), colors[modulo(level, bands)] ?? interiorColor);
    });
    const interiorGrid = padGrid(isInterior, width + 1, height + 1, 0);
    addLayer(traceLoops(interiorGrid, 0.5, cellsCrossingLevels(interiorGrid, 0.5, 1, 1)[0] ?? []), interiorColor);

    return { backgroundColor: colors[modulo(lowestLevel, bands)] ?? interiorColor, paths, loopCount };
}

/** Smoothed escape times at the grid's `(width + 1)×(height + 1)` corners, NaN inside the set. */
function sampleCornerEscapeTimes(options: MandelbrotOptions): Float64Array {
    const { width, height, centerRe, centerIm, span, maxIterations } = options;
    const step = span / width;
    const left = centerRe - span / 2;
    const top = centerIm + (step * height) / 2;
    const columns = width + 1;
    const times = new Float64Array(columns * (height + 1));
    for (let row = 0; row <= height; row++) {
        for (let column = 0; column <= width; column++) {
            times[row * columns + column] = maybeEscapeTime(left + column * step, top - row * step, maxIterations) ?? NaN;
        }
    }
    return times;
}

/**
 * Gives each NaN (interior) sample the value of a nearby escaping sample.
 *
 * The set is drawn over the bands, so these values never show; they only keep the
 * field continuous at the set's edge, where a jump to some fixed value would stack
 * every band in between into one cell.
 */
export function fillInterior(times: Float64Array, columns: number, rows: number): Float64Array {
    const filled = Float64Array.from(times);
    const queue = new Int32Array(filled.length);
    let queueEnd = 0;
    filled.forEach((time, index) => {
        if (!Number.isNaN(time)) {
            queue[queueEnd++] = index;
        }
    });
    if (queueEnd === 0) {
        return filled.fill(0);
    }
    for (let queueStart = 0; queueStart < queueEnd; queueStart++) {
        const index = queue[queueStart] ?? 0;
        const column = index % columns;
        const neighbors = [
            column > 0 ? index - 1 : -1,
            column < columns - 1 ? index + 1 : -1,
            index - columns,
            index + columns < columns * rows ? index + columns : -1,
        ];
        for (const neighbor of neighbors) {
            if (neighbor >= 0 && Number.isNaN(filled[neighbor])) {
                filled[neighbor] = filled[index] ?? 0;
                queue[queueEnd++] = neighbor;
            }
        }
    }
    return filled;
}

/**
 * Lowers samples so none rises more than `maxRise` above a neighbor (`maxRise × √2`
 * diagonally), with one forward and one backward chamfer sweep.
 */
export function limitSlope(field: Float64Array, columns: number, rows: number, maxRise: number): Float64Array {
    const limited = Float64Array.from(field);
    const diagonalRise = maxRise * Math.SQRT2;
    const lower = (index: number, neighbor: number, rise: number): void => {
        const ceiling = (limited[neighbor] ?? Infinity) + rise;
        if (ceiling < (limited[index] ?? 0)) {
            limited[index] = ceiling;
        }
    };
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const index = row * columns + column;
            if (column > 0) lower(index, index - 1, maxRise);
            if (row > 0) {
                lower(index, index - columns, maxRise);
                if (column > 0) lower(index, index - columns - 1, diagonalRise);
                if (column < columns - 1) lower(index, index - columns + 1, diagonalRise);
            }
        }
    }
    for (let row = rows - 1; row >= 0; row--) {
        for (let column = columns - 1; column >= 0; column--) {
            const index = row * columns + column;
            if (column < columns - 1) lower(index, index + 1, maxRise);
            if (row < rows - 1) {
                lower(index, index + columns, maxRise);
                if (column < columns - 1) lower(index, index + columns + 1, diagonalRise);
                if (column > 0) lower(index, index + columns - 1, diagonalRise);
            }
        }
    }
    return limited;
}

/** Surrounds a `columns`×`rows` field with `padValue`, below every traced level, so every loop closes. */
function padGrid(values: ArrayLike<number>, columns: number, rows: number, padValue: number): PaddedGrid {
    const padded = { values: new Float64Array((columns + 2) * (rows + 2)).fill(padValue), columns: columns + 2, rows: rows + 2 };
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            padded.values[(row + 1) * padded.columns + column + 1] = values[row * columns + column] ?? padValue;
        }
    }
    return padded;
}

/**
 * For each level `firstLevel..lastLevel` (at `level × levelStep`), the cells whose
 * corners straddle it: the only cells marching squares needs to visit for that level.
 */
function cellsCrossingLevels(grid: PaddedGrid, levelStep: number, firstLevel: number, lastLevel: number): Int32Array[] {
    const levelCount = Math.max(0, lastLevel - firstLevel + 1);
    const ranges: number[] = [];
    const counts = new Int32Array(levelCount);
    forEachCell(grid, (cell, a, b, c, d) => {
        const from = Math.max(firstLevel, Math.floor(Math.min(a, b, c, d) / levelStep) + 1);
        const to = Math.min(lastLevel, Math.floor(Math.max(a, b, c, d) / levelStep));
        if (from > to) {
            return;
        }
        ranges.push(cell, from, to);
        for (let offset = from - firstLevel; offset <= to - firstLevel; offset++) {
            counts[offset] = (counts[offset] ?? 0) + 1;
        }
    });
    const cellsByLevel = Array.from(counts, (count) => new Int32Array(count));
    const filledCounts = new Int32Array(levelCount);
    for (let i = 0; i < ranges.length; i += 3) {
        const cell = ranges[i] ?? 0;
        for (let offset = (ranges[i + 1] ?? 0) - firstLevel; offset <= (ranges[i + 2] ?? -1) - firstLevel; offset++) {
            const filled = filledCounts[offset] ?? 0;
            const cells = cellsByLevel[offset];
            if (cells !== undefined) {
                cells[filled] = cell;
                filledCounts[offset] = filled + 1;
            }
        }
    }
    return cellsByLevel;
}

function forEachCell(grid: PaddedGrid, visit: (cell: number, a: number, b: number, c: number, d: number) => void): void {
    const { values, columns, rows } = grid;
    for (let row = 0; row < rows - 1; row++) {
        for (let column = 0; column < columns - 1; column++) {
            const cell = row * columns + column;
            visit(cell, values[cell] ?? 0, values[cell + 1] ?? 0, values[cell + columns + 1] ?? 0, values[cell + columns] ?? 0);
        }
    }
}

// Marching-squares segments by case, as pairs of cell edges. The case sets bit 8 for
// the top-left corner, 4 top-right, 2 bottom-right, and 1 bottom-left when it is at
// or above the level. Cases 5 and 10 are saddles, resolved by the cell's mean.
type Edge = 'top' | 'right' | 'bottom' | 'left';
const SEGMENTS: Readonly<Record<number, readonly (readonly [Edge, Edge])[]>> = {
    1: [['left', 'bottom']], 2: [['bottom', 'right']], 3: [['left', 'right']], 4: [['top', 'right']],
    6: [['top', 'bottom']], 7: [['left', 'top']], 8: [['left', 'top']], 9: [['top', 'bottom']],
    11: [['top', 'right']], 12: [['left', 'right']], 13: [['bottom', 'right']], 14: [['left', 'bottom']],
};
const SADDLE_SPLIT_AT_TOP_LEFT: readonly (readonly [Edge, Edge])[] = [['left', 'top'], ['bottom', 'right']];
const SADDLE_SPLIT_AT_TOP_RIGHT: readonly (readonly [Edge, Edge])[] = [['top', 'right'], ['left', 'bottom']];

/**
 * The closed loops, in image coordinates, where `grid` crosses `level`, visiting
 * only `cells`. Points on the padding are pulled onto the image's border.
 */
function traceLoops(grid: PaddedGrid, level: number, cells: ArrayLike<number>): Point[][] {
    const { values, columns } = grid;
    const points = new Map<number, Point>();
    const firstNeighbor = new Map<number, number>();
    const secondNeighbor = new Map<number, number>();
    const link = (from: number, to: number): void => {
        (firstNeighbor.has(from) ? secondNeighbor : firstNeighbor).set(from, to);
    };

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? 0;
        const corners = [values[cell] ?? 0, values[cell + 1] ?? 0, values[cell + columns + 1] ?? 0, values[cell + columns] ?? 0];
        const [a = 0, b = 0, c = 0, d = 0] = corners;
        const caseIndex = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
        const isMeanAbove = (a + b + c + d) / 4 >= level;
        const segments = caseIndex === 5
            ? (isMeanAbove ? SADDLE_SPLIT_AT_TOP_LEFT : SADDLE_SPLIT_AT_TOP_RIGHT)
            : caseIndex === 10
                ? (isMeanAbove ? SADDLE_SPLIT_AT_TOP_RIGHT : SADDLE_SPLIT_AT_TOP_LEFT)
                : SEGMENTS[caseIndex] ?? [];
        for (const [fromEdge, toEdge] of segments) {
            const from = edgeKey(cell, fromEdge, columns);
            const to = edgeKey(cell, toEdge, columns);
            for (const key of [from, to]) {
                if (!points.has(key)) {
                    points.set(key, edgePoint(grid, key, level));
                }
            }
            link(from, to);
            link(to, from);
        }
    }
    return linkLoops(points, firstNeighbor, secondNeighbor);
}

/** An edge's key: twice its starting vertex, plus 1 for a vertical edge. */
function edgeKey(cell: number, edge: Edge, columns: number): number {
    switch (edge) {
    case 'top': return cell * 2;
    case 'bottom': return (cell + columns) * 2;
    case 'left': return cell * 2 + 1;
    case 'right': return (cell + 1) * 2 + 1;
    }
}

/** Where `level` crosses an edge, interpolated, in image coordinates. */
function edgePoint(grid: PaddedGrid, key: number, level: number): Point {
    const { values, columns, rows } = grid;
    const vertex = Math.floor(key / 2);
    const isVertical = key % 2 === 1;
    const column = vertex % columns;
    const row = Math.floor(vertex / columns);
    const endVertex = isVertical ? vertex + columns : vertex + 1;
    const start = values[vertex] ?? 0;
    const end = values[endVertex] ?? 0;
    const isStartPadding = isVertical ? row === 0 : column === 0;
    const isEndPadding = isVertical ? row + 1 === rows - 1 : column + 1 === columns - 1;
    const t = isStartPadding ? 1 : isEndPadding ? 0 : (level - start) / (end - start);
    // Padded vertex (1, 1) is the image's corner (0, 0).
    return isVertical ? [column - 1, row - 1 + t] : [column - 1 + t, row - 1];
}

function linkLoops(points: Map<number, Point>, firstNeighbor: Map<number, number>, secondNeighbor: Map<number, number>): Point[][] {
    const visited = new Set<number>();
    const loops: Point[][] = [];
    for (const start of firstNeighbor.keys()) {
        if (visited.has(start)) {
            continue;
        }
        const loop: Point[] = [];
        let previous = -1;
        let current = start;
        do {
            visited.add(current);
            const point = points.get(current);
            if (point !== undefined) {
                loop.push(point);
            }
            const maybeFirst = firstNeighbor.get(current);
            const next = maybeFirst !== previous ? maybeFirst : secondNeighbor.get(current);
            previous = current;
            current = next ?? start;
        } while (current !== start);
        const simplified = withoutRedundantPoints(loop);
        if (simplified.length >= 3) {
            loops.push(simplified);
        }
    }
    return loops;
}

/** Drops repeated points and points on a straight line between their neighbors. */
export function withoutRedundantPoints(loop: readonly Point[]): Point[] {
    const kept: Point[] = [];
    loop.forEach((point, index) => {
        const previous = kept[kept.length - 1] ?? loop[loop.length - 1];
        const next = loop[(index + 1) % loop.length];
        if (previous === undefined || next === undefined) {
            return;
        }
        const cross = (point[0] - previous[0]) * (next[1] - point[1]) - (point[1] - previous[1]) * (next[0] - point[0]);
        if (Math.abs(cross) > 1e-9) {
            kept.push(point);
        }
    });
    return kept;
}

/**
 * Path data for a closed loop, curving through the midpoints of its sides with each
 * point as a control point. Points on the image's border stay sharp corners, so a
 * layer that reaches the border still covers the image up to its edge.
 *
 * Coordinates are rounded to hundredths, then written relative to the previous end
 * point, which keeps the numbers short without rounding errors adding up.
 */
export function smoothLoopPath(loop: readonly Point[], width: number, height: number): string {
    const toHundredths = ([x, y]: Point): Point => [Math.round(x * 100), Math.round(y * 100)];
    const midpoint = (from: Point, to: Point): Point => toHundredths([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    const isOnBorder = ([x, y]: Point): boolean => x <= 0 || y <= 0 || x >= width || y >= height;
    const last = loop[loop.length - 1];
    const first = loop[0];
    if (last === undefined || first === undefined) {
        return '';
    }
    let current = midpoint(last, first);
    const relative = (to: Point): number[] => [to[0] - current[0], to[1] - current[1]];
    const commands = [`M${formatHundredths(current)}`];
    loop.forEach((point, index) => {
        const next = loop[(index + 1) % loop.length] ?? first;
        const control = toHundredths(point);
        const end = midpoint(point, next);
        if (isOnBorder(point)) {
            commands.push(`l${formatHundredths(relative(control))}`);
            current = control;
            commands.push(`l${formatHundredths(relative(end))}`);
        } else {
            commands.push(`q${formatHundredths([...relative(control), ...relative(end)])}`);
        }
        current = end;
    });
    return `${commands.join('')}z`;
}

/**
 * Writes hundredths as path numbers with only the separators SVG needs: none before
 * a minus sign, or before a leading `.` after a number that already has one.
 */
function formatHundredths(hundredths: readonly number[]): string {
    let text = '';
    let previous = '';
    for (const value of hundredths) {
        const number = String(value / 100).replace(/^(-?)0\./, '$1.');
        const isSelfSeparating = number.startsWith('-') || (number.startsWith('.') && previous.includes('.'));
        text += previous === '' || isSelfSeparating ? number : ` ${number}`;
        previous = number;
    }
    return text;
}

function modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
}
