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
    expect(json.data[0].source).toBe('asrs');
    expect(json.data[0].occurred_at).toBe('2018-10-01T00:00:00.000Z');
  });

  it('paginates incidents after ASRS date normalization and sorting', async () => {
    const firstPage = await app.fetch(new Request('http://localhost/api/incidents?limit=1&offset=0'));
    const secondPage = await app.fetch(new Request('http://localhost/api/incidents?limit=1&offset=1'));

    const firstJson = await firstPage.json();
    const secondJson = await secondPage.json();

    expect(firstJson.data[0].id).toBe('asrs-2');
    expect(secondJson.data[0].id).toBe('asrs-1');
    expect(firstJson.meta).toMatchObject({ total: 3, offset: 0, hasMore: true });
    expect(secondJson.meta).toMatchObject({ total: 3, offset: 1, hasMore: true });
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

  it('returns archive-aware ATC payload metadata', async () => {
    const response = await app.fetch(new Request('http://localhost/api/atc/live?limit=2'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.is_live).toBe(false);
    expect(json.data.source).toBe('demo');
    expect(json.data.total_available).toBeGreaterThan(0);
    expect(json.data.recent_transmissions).toHaveLength(2);
    expect(json.data.recent_transmissions[0]).not.toHaveProperty('timestamp');
  });
});


