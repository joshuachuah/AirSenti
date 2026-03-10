import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let testDir = '';
let app: any;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'airsentinel-api-'));
  process.env.AIRSENTINEL_DATA_DIR = testDir;
  process.env.ENABLE_HF_DATASETS = 'false';
  delete process.env.HUGGINGFACE_API_KEY;
  app = await import('./index').then((module) => module.default);
});

afterAll(async () => {
  delete process.env.AIRSENTINEL_DATA_DIR;
  delete process.env.ENABLE_HF_DATASETS;
  await rm(testDir, { recursive: true, force: true });
});

describe('API response shapes', () => {
  it('returns a successful incidents payload', async () => {
    const response = await app.fetch(new Request('http://localhost/api/incidents'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty('title');
  });

  it('returns a structured natural-query payload in demo mode', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Show all emergency flights' }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('query_id');
    expect(json.data).toHaveProperty('response');
    expect(Array.isArray(json.data.suggested_followups)).toBe(true);
  });
});


