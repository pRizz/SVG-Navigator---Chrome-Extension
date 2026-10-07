// bright-builds-rules-managed-file: scripts/bright-builds-check.ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWLIST_PATH = ".bright-builds-rules-checks.tsv";
export const FILE_LINE_LIMIT = 628;
export const LESSON_BYTE_BUDGET = 24_000;
export const LESSON_TOKEN_BUDGET = 8_000;

const lessonPaths = ["tasks/lessons.md", ".codex/tasks/lessons.md"];
const sourceExtensions = new Set([
  ".astro",
  ".bash",
  ".c",
  ".cc",
  ".clj",
  ".cljs",
  ".cljc",
  ".cjs",
  ".cpp",
  ".cs",
  ".css",
  ".cts",
  ".cxx",
  ".dart",
  ".el",
  ".ex",
  ".exs",
  ".fs",
  ".fsx",
  ".go",
  ".gql",
  ".graphql",
  ".graphqls",
  ".h",
  ".hh",
  ".hpp",
  ".hs",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".less",
  ".lua",
  ".m",
  ".mdx",
  ".mm",
  ".mjs",
  ".mts",
  ".php",
  ".pl",
  ".pm",
  ".proto",
  ".prisma",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".sass",
  ".scala",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".zig",
  ".zsh",
]);
const excludedPathSegments = new Set([
  ".next",
  ".nuxt",
  ".output",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "third_party",
  "vendor",
]);
const supportedCheckIds = new Set(["file-lengths", "lessons"]);
const lessonHeadingPattern =
  /^## (lesson-[a-z0-9]+(?:-[a-z0-9]+)*) \| (\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?: [A-Z]{2,5})?)?)$/u;
const lessonFieldPattern =
  /^(?:-\s+|\d+\.\s+)(Date|What went wrong|Preventive rule|Trigger signal(?: to catch it earlier)?):\s*(.*)$/u;

type CheckId = "file-lengths" | "lessons";
type AllowlistEntryKind = "directory" | "file";

interface AllowlistEntry {
  checkId: CheckId;
  kind: AllowlistEntryKind;
  path: string;
  reason: string;
}

interface CheckResult {
  findings: string[];
  messages: string[];
}

interface LessonBlock {
  id: string;
  lineNumber: number;
  lines: string[];
}

export class CheckConfigurationError extends Error {}

const usage = `Usage: bun scripts/bright-builds-check.ts [all|file-lengths|lessons]

Checks:
  all           Run every managed starter check (default).
  file-lengths  Fail when a tracked source file exceeds ${FILE_LINE_LIMIT} physical lines.
  lessons       Validate active lesson blocks and report their startup-context budget.

File-length scope:
  Extensions: ${[...sourceExtensions].join(", ")}
  Excluded path segments: ${[...excludedPathSegments].join(", ")}

Lesson sources:
  ${lessonPaths.join(", ")} when present at the repository root

Optional exceptions:
  ${ALLOWLIST_PATH}
  check-id<TAB>repo-relative-file-or-directory/<TAB>required reason

Supported check IDs are file-lengths and lessons. Blank lines and lines beginning
with # are ignored. File paths are exact. Directory paths must end with /, apply
only to file-lengths, and recursively exclude descendants. Globs are not supported.
The allowlist is user-owned and is never changed by Bright Builds.
`;

const normalizeRelativePath = (candidatePath: string): string => {
  if (/[*?[\]{}]/u.test(candidatePath)) {
    throw new CheckConfigurationError(
      `allowlist path globs are not supported: ${candidatePath}`,
    );
  }

  const normalizedPath = path.posix.normalize(candidatePath);
  if (
    candidatePath.length === 0 ||
    candidatePath.includes("\\") ||
    path.posix.isAbsolute(candidatePath) ||
    normalizedPath !== candidatePath ||
    normalizedPath === "." ||
    normalizedPath === "./" ||
    candidatePath.startsWith("../")
  ) {
    throw new CheckConfigurationError(
      `allowlist path must be a normalized repo-relative path: ${candidatePath || "<empty>"}`,
    );
  }

  return candidatePath;
};

const resolveRepoRoot = (cwd: string): string => {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new CheckConfigurationError("Git repository root could not be resolved");
  }
};

export const countPhysicalLines = (contents: Buffer): number => {
  if (contents.length === 0) {
    return 0;
  }

  let lineCount = 0;
  for (const byte of contents) {
    if (byte === 0x0a) {
      lineCount += 1;
    }
  }

  if (contents.at(-1) !== 0x0a) {
    lineCount += 1;
  }

  return lineCount;
};

const validateAllowlistOverlaps = (entries: Map<string, AllowlistEntry>): void => {
  const allEntries = [...entries.values()];
  const directoryEntries = allEntries.filter(({ kind }) => kind === "directory");

  for (const [index, directory] of directoryEntries.entries()) {
    for (const otherDirectory of directoryEntries.slice(index + 1)) {
      if (
        directory.path.startsWith(otherDirectory.path) ||
        otherDirectory.path.startsWith(directory.path)
      ) {
        throw new CheckConfigurationError(
          `${ALLOWLIST_PATH} has overlapping directory exceptions: ${directory.path} and ${otherDirectory.path}`,
        );
      }
    }

    const maybeCoveredFile = allEntries.find(
      (entry) =>
        entry.kind === "file" &&
        entry.checkId === directory.checkId &&
        entry.path.startsWith(directory.path),
    );
    if (maybeCoveredFile) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH} file exception ${maybeCoveredFile.path} is already covered by directory exception ${directory.path}`,
      );
    }
  }
};

const loadAllowlist = (repoRoot: string): Map<string, AllowlistEntry> => {
  const absoluteAllowlistPath = path.join(repoRoot, ALLOWLIST_PATH);
  const entries = new Map<string, AllowlistEntry>();
  if (!fs.existsSync(absoluteAllowlistPath)) {
    return entries;
  }

  const lines = fs.readFileSync(absoluteAllowlistPath, "utf8").split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      continue;
    }

    const fields = line.split("\t");
    if (fields.length !== 3) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} must contain exactly three tab-separated fields`,
      );
    }

    const [maybeCheckId, rawPath, rawReason] = fields;
    if (!supportedCheckIds.has(maybeCheckId)) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} has unknown check ID: ${maybeCheckId}`,
      );
    }

    const relativePath = normalizeRelativePath(rawPath);
    const kind: AllowlistEntryKind = relativePath.endsWith("/") ? "directory" : "file";
    const reason = rawReason.trim();
    if (reason.length === 0) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} must include a non-empty reason`,
      );
    }
    const filesystemRelativePath =
      kind === "directory" ? relativePath.slice(0, -1) : relativePath;
    const absolutePath = path.join(repoRoot, filesystemRelativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} references a stale path: ${relativePath}`,
      );
    }
    const pathStats = fs.statSync(absolutePath);
    if (kind === "directory" && maybeCheckId !== "file-lengths") {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} directory exceptions are supported only for file-lengths`,
      );
    }
    if (kind === "directory" && !pathStats.isDirectory()) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} directory exception does not resolve to a directory: ${relativePath}`,
      );
    }
    if (kind === "file" && pathStats.isDirectory()) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} directory exception paths must end with /: ${relativePath}`,
      );
    }

    const key = `${maybeCheckId}\t${relativePath}`;
    if (entries.has(key)) {
      throw new CheckConfigurationError(
        `${ALLOWLIST_PATH}:${index + 1} duplicates ${maybeCheckId} for ${relativePath}`,
      );
    }
    entries.set(key, {
      checkId: maybeCheckId as CheckId,
      kind,
      path: relativePath,
      reason,
    });
  }

  validateAllowlistOverlaps(entries);
  return entries;
};

const maybeException = (
  allowlist: Map<string, AllowlistEntry>,
  checkId: CheckId,
  relativePath: string,
): AllowlistEntry | undefined => allowlist.get(`${checkId}\t${relativePath}`);

const listTrackedFiles = (repoRoot: string): string[] => {
  try {
    return execFileSync("git", ["-C", repoRoot, "ls-files", "-z"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\0")
      .filter((relativePath) => relativePath.length > 0);
  } catch {
    throw new CheckConfigurationError("tracked files could not be listed with Git");
  }
};

const isApplicableSourcePath = (relativePath: string): boolean => {
  const segments = relativePath.split("/");
  if (segments.some((segment) => excludedPathSegments.has(segment))) {
    return false;
  }

  return sourceExtensions.has(path.posix.extname(relativePath).toLowerCase());
};

export const checkFileLengths = (
  repoRoot: string,
  allowlist: Map<string, AllowlistEntry>,
): CheckResult => {
  const findings: string[] = [];
  const messages: string[] = [];
  let exceptionCount = 0;
  const applicableSourcePaths = listTrackedFiles(repoRoot).filter(isApplicableSourcePath);
  const directoryExceptions = [...allowlist.values()].filter(
    (entry) => entry.checkId === "file-lengths" && entry.kind === "directory",
  );
  const excludedSourcePaths = new Set<string>();
  for (const exception of directoryExceptions) {
    const matchingSourcePaths = applicableSourcePaths.filter((relativePath) =>
      relativePath.startsWith(exception.path),
    );
    for (const relativePath of matchingSourcePaths) {
      excludedSourcePaths.add(relativePath);
    }
    exceptionCount += 1;
    messages.push(
      `EXCEPTION file-lengths ${exception.path}: excluded ${matchingSourcePaths.length} tracked source files; ${exception.reason}`,
    );
  }
  const sourcePaths = applicableSourcePaths.filter(
    (relativePath) => !excludedSourcePaths.has(relativePath),
  );

  for (const relativePath of sourcePaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    const lineCount = countPhysicalLines(fs.readFileSync(absolutePath));
    if (lineCount <= FILE_LINE_LIMIT) {
      continue;
    }

    const exception = maybeException(allowlist, "file-lengths", relativePath);
    if (exception) {
      exceptionCount += 1;
      messages.push(
        `EXCEPTION file-lengths ${relativePath}: ${lineCount} physical lines; ${exception.reason}`,
      );
      continue;
    }

    findings.push(
      `FAIL file-lengths ${relativePath}: ${lineCount} physical lines exceeds ${FILE_LINE_LIMIT}`,
    );
  }

  messages.push(
    `SUMMARY file-lengths scanned=${sourcePaths.length} exceptions=${exceptionCount} findings=${findings.length}`,
  );
  return { findings, messages };
};

const parseLessonBlocks = (
  relativePath: string,
  contents: string,
): { blocks: LessonBlock[]; findings: string[] } => {
  const findings: string[] = [];
  const blocks: LessonBlock[] = [];
  let maybeCurrentBlock: LessonBlock | undefined;

  for (const [index, line] of contents.split(/\r?\n/u).entries()) {
    if (!line.startsWith("## ")) {
      maybeCurrentBlock?.lines.push(line);
      continue;
    }

    const maybeHeading = lessonHeadingPattern.exec(line);
    if (!maybeHeading) {
      findings.push(
        `FAIL lessons ${relativePath}:${index + 1}: invalid lesson heading; expected "## lesson-<id> | <date or timestamp>"`,
      );
      maybeCurrentBlock = undefined;
      continue;
    }

    maybeCurrentBlock = {
      id: maybeHeading[1],
      lineNumber: index + 1,
      lines: [],
    };
    blocks.push(maybeCurrentBlock);
  }

  for (const block of blocks) {
    const fieldCounts = new Map([
      ["Date", 0],
      ["What went wrong", 0],
      ["Preventive rule", 0],
      ["Trigger signal", 0],
    ]);
    for (const line of block.lines) {
      const maybeField = lessonFieldPattern.exec(line);
      if (!maybeField) {
        continue;
      }

      const fieldName = maybeField[1].startsWith("Trigger signal")
        ? "Trigger signal"
        : maybeField[1];
      fieldCounts.set(fieldName, (fieldCounts.get(fieldName) ?? 0) + 1);
      if (maybeField[2].trim().length === 0) {
        findings.push(
          `FAIL lessons ${relativePath}:${block.lineNumber}: ${block.id} has an empty ${fieldName} field`,
        );
      }
    }

    for (const [fieldName, count] of fieldCounts) {
      if (count !== 1) {
        findings.push(
          `FAIL lessons ${relativePath}:${block.lineNumber}: ${block.id} must contain exactly one ${fieldName} field; found ${count}`,
        );
      }
    }
  }

  return { blocks, findings };
};

export const checkLessons = (
  repoRoot: string,
  allowlist: Map<string, AllowlistEntry>,
): CheckResult => {
  const findings: string[] = [];
  const messages: string[] = [];
  const seenLessonIds = new Map<string, string>();
  let totalBytes = 0;
  let estimatedTokens = 0;
  let lessonCount = 0;
  let sourceCount = 0;

  for (const relativePath of lessonPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    sourceCount += 1;
    const contentsBuffer = fs.readFileSync(absolutePath);
    totalBytes += contentsBuffer.byteLength;
    estimatedTokens += Math.ceil(contentsBuffer.byteLength / 3);

    const exception = maybeException(allowlist, "lessons", relativePath);
    if (exception) {
      messages.push(`EXCEPTION lessons ${relativePath}: ${exception.reason}`);
      continue;
    }

    const parsed = parseLessonBlocks(relativePath, contentsBuffer.toString("utf8"));
    findings.push(...parsed.findings);
    lessonCount += parsed.blocks.length;
    for (const block of parsed.blocks) {
      const maybeFirstPath = seenLessonIds.get(block.id);
      if (maybeFirstPath) {
        findings.push(
          `FAIL lessons ${relativePath}:${block.lineNumber}: duplicate ${block.id}; first declared in ${maybeFirstPath}`,
        );
        continue;
      }
      seenLessonIds.set(block.id, `${relativePath}:${block.lineNumber}`);
    }
  }

  if (totalBytes > LESSON_BYTE_BUDGET || estimatedTokens > LESSON_TOKEN_BUDGET) {
    messages.push(
      "NOTICE lessons active set exceeds the startup budget; use bounded whole-block loading and audit the ledger when required",
    );
  } else if (
    totalBytes >= LESSON_BYTE_BUDGET * 0.75 ||
    estimatedTokens >= LESSON_TOKEN_BUDGET * 0.75
  ) {
    messages.push(
      "NOTICE lessons active set is at least 75% of the startup budget; check whether the first-crossing audit trigger applies",
    );
  }

  messages.push(
    `SUMMARY lessons sources=${sourceCount} lessons=${lessonCount} bytes=${totalBytes} estimated_tokens=${estimatedTokens} findings=${findings.length}`,
  );
  return { findings, messages };
};

export const runChecks = (
  command: "all" | CheckId,
  cwd = process.cwd(),
): { exitCode: number; output: string[] } => {
  const repoRoot = resolveRepoRoot(cwd);
  const allowlist = loadAllowlist(repoRoot);
  const results: CheckResult[] = [];
  if (command === "all" || command === "file-lengths") {
    results.push(checkFileLengths(repoRoot, allowlist));
  }
  if (command === "all" || command === "lessons") {
    results.push(checkLessons(repoRoot, allowlist));
  }

  const findings = results.flatMap((result) => result.findings);
  const messages = results.flatMap((result) => result.messages);
  const output = [...findings, ...messages, `SUMMARY all findings=${findings.length}`];
  return { exitCode: findings.length > 0 ? 1 : 0, output };
};

export const runCli = (args: string[], cwd = process.cwd()): number => {
  const [maybeCommand, ...extraArgs] = args;
  if (maybeCommand === "--help" || maybeCommand === "-h") {
    process.stdout.write(usage);
    return 0;
  }
  if (extraArgs.length > 0) {
    process.stderr.write(`${usage}\nerror: too many arguments\n`);
    return 2;
  }

  const command = maybeCommand ?? "all";
  if (command !== "all" && command !== "file-lengths" && command !== "lessons") {
    process.stderr.write(`${usage}\nerror: unknown command: ${command}\n`);
    return 2;
  }

  try {
    const result = runChecks(command, cwd);
    process.stdout.write(`${result.output.join("\n")}\n`);
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    return 2;
  }
};

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  process.exitCode = runCli(process.argv.slice(2));
}
