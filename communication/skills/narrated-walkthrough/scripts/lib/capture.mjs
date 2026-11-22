// Real captures for terminal panels. Every command and its output is logged, and build.mjs writes
// the log to captures.txt next to the video, so anyone can check that a panel wasn't made up.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const stripAnsi = (text) =>
  String(text)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\r\n?/g, '\n');

export function createCapture({ cwd = process.cwd(), env = {} } = {}) {
  const log = [];
  const baseEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb', ...env };

  /** Run a program; returns its combined stdout+stderr, ANSI stripped, trailing space trimmed. */
  function run(cmd, args = [], opts = {}) {
    const dir = opts.cwd ? path.resolve(cwd, opts.cwd) : cwd;
    const r = spawnSync(cmd, args, { cwd: dir, env: { ...baseEnv, ...opts.env }, encoding: 'utf8', input: opts.input, maxBuffer: 64 << 20 });
    if (r.error) throw new Error(`capture: ${cmd} failed to start: ${r.error.message}`);
    const out = stripAnsi(`${r.stdout ?? ''}${r.stderr ?? ''}`).trimEnd();
    log.push({ cmd: [cmd, ...args].join(' '), cwd: dir, status: r.status, out });
    if (opts.expectStatus !== undefined && r.status !== opts.expectStatus) {
      throw new Error(`capture: ${cmd} ${args.join(' ')} exited ${r.status}, expected ${opts.expectStatus}\n${out}`);
    }
    return out;
  }

  /** Run a shell command line. */
  const sh = (line, opts = {}) => run('sh', ['-c', line], opts);

  /**
   * A terminal transcript: "$ <shown>" followed by the output.
   * shown is what the viewer reads (e.g. "npm run seed -- --count 3"); actual is
   * [cmd, ...args] to run instead when they differ (e.g. ["node", "scripts/seed.mjs", ...]).
   * With no actual, the shown line is run through sh.
   */
  function shell(shown, actual, opts = {}) {
    const out = actual ? run(actual[0], actual.slice(1), opts) : sh(shown, opts);
    return out ? `$ ${shown}\n${out}` : `$ ${shown}`;
  }

  /** Read a file relative to the capture root. */
  function read(file) {
    const p = path.resolve(cwd, file);
    const text = readFileSync(p, 'utf8').trimEnd();
    log.push({ cmd: `read ${file}`, cwd, status: 0, out: text });
    return text;
  }

  return { run, sh, shell, read, log, cwd };
}

/**
 * Keep only matching lines (regex or predicate), optionally capped. Use it to abridge long output;
 * say so in the panel title ("selected lines") so the abridgement is honest.
 */
export function pick(text, match, { max } = {}) {
  // A /g or /y regex remembers where it last matched, which would skip every other line.
  const re = typeof match === 'function' ? null : new RegExp(match.source, match.flags.replace(/[gy]/g, ''));
  const test = re ? (l) => re.test(l) : match;
  const lines = String(text).split('\n').filter(test);
  return (max ? lines.slice(0, max) : lines).join('\n');
}

/** Cut text to at most n lines, adding "…" when cut. */
export function head(text, n) {
  const lines = String(text).split('\n');
  return lines.length > n ? [...lines.slice(0, n), '…'].join('\n') : String(text);
}

export function formatLog(log) {
  return log
    .map((e) => `### ${e.cmd}\n# cwd: ${e.cwd}  exit: ${e.status}\n${e.out}`)
    .join('\n\n');
}
