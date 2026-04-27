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
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  process.env.RATE_LIMIT_MAX = '2';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.MAX_UPLOAD_BYTES = '10';
  delete process.env.HUGGINGFACE_API_KEY;
  app = await import('./index').then((module) => module.default);
});

afterAll(async () => {
  delete process.env.AIRSENTINEL_DATA_DIR;
  delete process.env.ENABLE_HF_DATASETS;
  delete process.env.FRONTEND_ORIGIN;
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW_MS;
  delete process.env.MAX_UPLOAD_BYTES;
  await rm(testDir, { recursive: true, force: true });
});

describe('API response shapes', () => {
  it('returns health metadata without dependency readiness checks', async () => {
    const response = await app.fetch(new Request('http://localhost/health'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('AirSentinel AI API');
    expect(json.data.mode).toBe('demo');
    expect(json.data).toHaveProperty('uptime_seconds');
  });

  it('returns structured readiness data', async () => {
    const response = await app.fetch(new Request('http://localhost/ready'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.ready).toBe(true);
    expect(json.data.dependencies).toHaveProperty('persistence');
    expect(json.data.dependencies).toHaveProperty('huggingface_datasets');
    expect(json.data.dependencies).toHaveProperty('opensky');
    expect(json.data.dependencies).toHaveProperty('ai');
  });

  it('allows the configured CORS origin and rejects arbitrary origins', async () => {
    const allowed = await app.fetch(new Request('http://localhost/health', {
      headers: { Origin: 'http://localhost:5173' },
    }));
    const rejected = await app.fetch(new Request('http://localhost/health', {
      headers: { Origin: 'https://example.com' },
    }));

    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

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

  it('blocks public incident submissions by default', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test report',
          description: 'This should not be publicly writable by default.',
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PUBLIC_WRITES_DISABLED');
  });

  it('returns validation errors for invalid route inputs', async () => {
    const response = await app.fetch(new Request('http://localhost/api/flights/area?min_lat=bad'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_PARAMS');
  });

  it('rejects empty optional numeric query values', async () => {
    const response = await app.fetch(new Request('http://localhost/api/flights/radius?lat=40&lon=-73&radius_nm='));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_PARAMS');
  });

  it('rate limits expensive POST routes', async () => {
    const requestBody = JSON.stringify({ texts: ['one'] });
    const makeRequest = (spoofedIp: string) => app.fetch(
      new Request('http://localhost/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': spoofedIp,
        },
        body: requestBody,
      })
    );

    expect((await makeRequest('203.0.113.10')).status).toBe(200);
    expect((await makeRequest('203.0.113.11')).status).toBe(200);

    const limited = await makeRequest('203.0.113.12');
    const json = await limited.json();

    expect(limited.status).toBe(429);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RATE_LIMITED');
  });

  it('rejects oversized upload bodies before multipart parsing', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/images/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '34',
        },
        body: 'this body is larger than ten bytes',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(413);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UPLOAD_TOO_LARGE');
  });

  it('maps chunked oversized multipart uploads to upload limit errors', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob(['this body is larger than ten bytes'], { type: 'text/plain' }),
      'oversized.txt'
    );

    const response = await app.fetch(
      new Request('http://localhost/api/images/analyze', {
        method: 'POST',
        body: formData,
      })
    );
    const json = await response.json();

    expect(response.status).toBe(413);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UPLOAD_TOO_LARGE');
  });
});


