import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreview } from './generate-og';

test('concurrent OG previews serve their own build and release their assigned ports', async () => {
  const fixtures = ['first-project', 'second-project'].map((marker) => {
    const root = mkdtempSync(join(tmpdir(), 'mental-models-og-'));
    mkdirSync(join(root, 'dist'));
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'dist', 'index.html'), `<h1>${marker}</h1>`);
    return { root, marker };
  });
  const servers: Awaited<ReturnType<typeof startPreview>>[] = [];
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    for (const fixture of fixtures) servers.push(await startPreview(fixture.root));
    expect(servers[0].base).not.toBe(servers[1].base);
    for (const [index, server] of servers.entries()) {
      expect(new URL(server.base).port).not.toBe('4321');
      const response = await fetch(server.base);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(`<h1>${fixtures[index].marker}</h1>`);
    }
    for (const server of servers) await server.stop();
    for (const server of servers) {
      await expect(fetch(server.base, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
    }
  } finally {
    for (const server of servers) await server.stop();
    for (const fixture of fixtures) rmSync(fixture.root, { recursive: true, force: true });
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}, 15_000);
