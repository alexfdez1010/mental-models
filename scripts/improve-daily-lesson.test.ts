// Contract tests for the continuous-improvement cron wrapper.
//
// These are intentionally hermetic and fast: they syntax-check the script and
// assert the safety invariants are present in source. They do NOT execute a
// real run (which would invoke Claude / touch git) -- that surface is exercised
// by `scripts/improve-daily-lesson.sh --dry-run`, kept side-effect free for the
// same reason. Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'improve-daily-lesson.sh');
const src = readFileSync(SCRIPT, 'utf8');
const INSTALLER = join(here, 'install-cron.sh');
const installSrc = readFileSync(INSTALLER, 'utf8');

describe('improve-daily-lesson.sh', () => {
  test('passes `bash -n` syntax check', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    expect(r.stderr || '').toBe('');
    expect(r.status).toBe(0);
  });

  test('--help prints usage and exits 0 without side effects', () => {
    const r = spawnSync('bash', [SCRIPT, '--help'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('improve-daily-lesson.sh');
    expect(r.stdout).toContain('--dry-run');
  });

  test('install-cron.sh wraps BOTH jobs in the SAME flock lock (no overlap)', () => {
    // The lock path is derived once per repo and shared by the builder and the
    // improver crontab lines, so a non-blocking `flock -n` makes them mutually
    // exclusive. The path is no longer hard-coded in this script.
    expect(installSrc).toMatch(/LOCK="\/tmp\/\$\{NAME\}-daily-lesson\.lock"/);
    expect(installSrc).toMatch(/builder_line\(\)[\s\S]*\$\{FLOCK\} -n \$\{LOCK\}/);
    expect(installSrc).toMatch(/improver_line\(\)[\s\S]*\$\{FLOCK\} -n \$\{LOCK\}/);
  });

  test('is strict bash', () => {
    expect(src).toMatch(/set -euo pipefail/);
  });

  test('constrains changes to the scripts/ + docs/ allowlist', () => {
    expect(src).toMatch(/ALLOW_RE='\^\(scripts\/\|docs\/\)'/);
    // Out-of-scope changes must abort without committing.
    expect(src).toContain('refusing to commit out-of-scope changes');
  });

  test('never commits red code (validation gates the commit)', () => {
    expect(src).toContain('refusing to publish');
    // The commit must come after a passing validation loop, not before.
    const commitIdx = src.indexOf('git commit -q');
    const validateIdx = src.indexOf('run_scoped_validation');
    expect(validateIdx).toBeGreaterThan(-1);
    expect(commitIdx).toBeGreaterThan(validateIdx);
  });

  test('runs every Claude/validation step under timeout + its own process group', () => {
    expect(src).toContain('setsid --wait timeout');
    expect(src).toMatch(/CLAUDE_TIMEOUT/);
    expect(src).toMatch(/CHECK_TIMEOUT/);
  });

  test('invokes Claude Code headlessly', () => {
    expect(src).toMatch(/claude -p .*--dangerously-skip-permissions/);
  });

  test('allows making no change when evidence is insufficient', () => {
    expect(src).toContain('no-op success');
    expect(src).toContain('made no changes');
  });

  test('only triggers `bun run check` for TS/Astro/MDX, never a full OG/content rebuild', () => {
    // The actual validation INVOCATION is the lightweight `bun run check`.
    expect(src).toContain('"check" bun run check');
    // The heavy content/OG pipeline is never INVOKED here (mentions in the
    // prompt prose telling Claude NOT to run them are fine).
    expect(src).not.toMatch(/run_in_group[^\n]*pre-commit/);
    expect(src).not.toMatch(/run_in_group[^\n]*og:/);
  });

  test('supports a dry-run / analyze-only mode', () => {
    expect(src).toMatch(/--dry-run\|--analyze-only\|-n/);
    expect(src).toContain('No Claude invoked');
  });
});
