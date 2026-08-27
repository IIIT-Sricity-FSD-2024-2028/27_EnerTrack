import * as fs from "fs";
import * as path from "path";

/**
 * Buffered, interval-flushed log writer.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The brief requires log and error information to be stored in files **at
 * regular intervals**. Every custom logger in this codebase previously called
 * fs.appendFileSync once per event, which stores logs in files but on no
 * interval at all — and does blocking disk I/O on the request path, so a slow
 * disk slows down every API response.
 *
 * This writer collects entries in memory and flushes them to disk on a timer.
 * One timer serves every log file in the application.
 *
 * THE CRASH TRADEOFF
 * ──────────────────
 * Buffering means an abrupt crash could lose whatever has not been flushed
 * yet. That is bounded deliberately:
 *
 *   • Server errors (5xx) are written with { immediate: true } and bypass the
 *     buffer entirely — the record of a crash is never itself lost to the
 *     crash.
 *   • The buffer flushes early once it reaches MAX_BUFFERED entries, so a
 *     burst of traffic cannot grow memory without bound.
 *   • SIGINT, SIGTERM and beforeExit all flush, so an ordinary shutdown
 *     (including Ctrl+C in dev) loses nothing.
 *
 * RETENTION
 * ─────────
 * The same timer sweeps old files. Retention previously lived in
 * LoggerMiddleware and only matched `custom-debug-*`, so the error, security,
 * upload-audit and invoice-access logs grew forever. Every managed prefix is
 * covered here instead.
 */

/** How often buffered entries are written to disk. */
const FLUSH_INTERVAL_MS = 5_000;

/** How often the retention sweep runs. */
const RETENTION_SWEEP_MS = 60 * 60 * 1000; // hourly

/** Dated log files older than this are deleted by the sweep. */
const MAX_LOG_AGE_DAYS = 7;

/** Flush early rather than let the buffer grow past this many entries. */
const MAX_BUFFERED = 500;

/**
 * Filename prefixes this writer owns. Retention only ever deletes files
 * matching one of these, so an unrelated .log file dropped into the folder is
 * left alone.
 */
export const MANAGED_PREFIXES = [
  "custom-debug-",
  "error-",
  "security-threats-",
  "upload-audit-",
  "invoice-access-",
] as const;

export interface WriteOptions {
  /** Skip the buffer and write to disk now. Use for 5xx and other events that must survive a crash. */
  immediate?: boolean;
}

class LogWriter {
  private readonly logDir = path.join(process.cwd(), "logs");

  /** Pending entries, keyed by the file they belong to. */
  private buffers = new Map<string, string[]>();

  private flushTimer?: NodeJS.Timeout;
  private retentionTimer?: NodeJS.Timeout;
  private started = false;

  constructor() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.start();
  }

  /** Absolute path for a dated log file, e.g. logs/error-2026-08-27.log */
  fileFor(prefix: string): string {
    const today = new Date().toISOString().split("T")[0];
    return path.join(this.logDir, `${prefix}${today}.log`);
  }

  /**
   * Queue a log entry.
   *
   * The filename is resolved at flush time, not here, so entries buffered at
   * 23:59:59 and flushed at 00:00:02 land in the new day's file. That keeps
   * daily rotation working without a scheduler.
   */
  write(prefix: string, entry: string, options: WriteOptions = {}): void {
    if (options.immediate) {
      this.appendNow(this.fileFor(prefix), entry);
      return;
    }

    const pending = this.buffers.get(prefix) ?? [];
    pending.push(entry);
    this.buffers.set(prefix, pending);

    if (this.totalBuffered() >= MAX_BUFFERED) {
      this.flushAll();
    }
  }

  /** Write every buffered entry to disk and empty the buffers. */
  flushAll(): void {
    if (this.buffers.size === 0) return;

    for (const [prefix, entries] of this.buffers) {
      if (entries.length === 0) continue;
      this.appendNow(this.fileFor(prefix), entries.join(""));
    }
    this.buffers.clear();
  }

  /** Delete managed log files older than MAX_LOG_AGE_DAYS. */
  sweepOldLogs(): string[] {
    const deleted: string[] = [];
    try {
      const maxAgeMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
      const now = Date.now();

      for (const file of fs.readdirSync(this.logDir)) {
        if (!file.endsWith(".log")) continue;
        if (!MANAGED_PREFIXES.some((p) => file.startsWith(p))) continue;

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deleted.push(file);
        }
      }
    } catch {
      // A retention failure must never take the application down.
    }
    return deleted;
  }

  /** Interval in ms between flushes — exposed so tests and docs agree with the code. */
  get flushIntervalMs(): number {
    return FLUSH_INTERVAL_MS;
  }

  // ─── internals ──────────────────────────────────────────────────────

  private totalBuffered(): number {
    let total = 0;
    for (const entries of this.buffers.values()) total += entries.length;
    return total;
  }

  private appendNow(file: string, text: string): void {
    try {
      fs.appendFileSync(file, text, "utf8");
    } catch {
      // The most common cause is the logs/ directory having been removed
      // while the server is running — which is exactly what someone does when
      // they clear the logs to demonstrate them filling up from scratch.
      // Recreate it and retry once, rather than silently logging nothing for
      // the rest of the process lifetime.
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
        fs.appendFileSync(file, text, "utf8");
      } catch {
        // Disk full, permissions, read-only mount — a logging failure must
        // never break the request being logged. Swallowed deliberately.
      }
    }
  }

  private start(): void {
    if (this.started) return;
    this.started = true;

    this.flushTimer = setInterval(() => this.flushAll(), FLUSH_INTERVAL_MS);
    this.retentionTimer = setInterval(
      () => this.sweepOldLogs(),
      RETENTION_SWEEP_MS,
    );

    // unref() lets Node exit when nothing else is pending. Without it these
    // timers would keep the process alive forever, which breaks `jest` runs
    // and any script that expects the app to terminate.
    this.flushTimer.unref?.();
    this.retentionTimer.unref?.();

    // Sweep once at startup so a server that was down over the weekend tidies
    // up immediately rather than waiting an hour.
    this.sweepOldLogs();

    const flushAndForget = () => this.flushAll();
    process.on("beforeExit", flushAndForget);
    process.on("SIGINT", flushAndForget);
    process.on("SIGTERM", flushAndForget);
  }

  /** Stops the timers. Used by tests; not needed in normal operation. */
  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    this.started = false;
  }
}

/** Shared instance — one set of timers for the whole application. */
export const logWriter = new LogWriter();
