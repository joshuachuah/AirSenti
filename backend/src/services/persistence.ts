import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FlightAnomaly, Incident } from '../../../shared/types';

function getDataDir(): string {
  return process.env.AIRSENTINEL_DATA_DIR || join(process.cwd(), 'data');
}

function getIncidentsFile(): string {
  return join(getDataDir(), 'incidents.json');
}

function getAnomaliesFile(): string {
  return join(getDataDir(), 'anomalies.json');
}

async function ensureDataDir(): Promise<void> {
  await mkdir(getDataDir(), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    await ensureDataDir();
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error(`Error reading persisted data from ${filePath}:`, error);
    }
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function loadPersistedIncidents(seedIncidents: Incident[]): Promise<Incident[]> {
  const incidents = await readJsonFile<Incident[]>(getIncidentsFile(), seedIncidents);
  if (incidents.length === 0 && seedIncidents.length > 0) {
    await saveIncidents(seedIncidents);
    return seedIncidents;
  }
  return incidents;
}

export async function loadPersistedAnomalies(): Promise<FlightAnomaly[]> {
  return readJsonFile<FlightAnomaly[]>(getAnomaliesFile(), []);
}

export async function saveIncidents(incidents: Incident[]): Promise<void> {
  try {
    await writeJsonFile(getIncidentsFile(), incidents);
  } catch (error) {
    console.error('Error persisting incidents:', error);
  }
}

export async function saveAnomalies(anomalies: FlightAnomaly[]): Promise<void> {
  try {
    await writeJsonFile(getAnomaliesFile(), anomalies);
  } catch (error) {
    console.error('Error persisting anomalies:', error);
  }
}
