// ============================================
// AirSentinel AI - OpenSky Network API Client
// ============================================

import { env } from '../config/env';
import type { Aircraft, FlightTrack, BoundingBox, GeoCircle } from '../../../shared/types';

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';

interface OpenSkyStateVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: number | null;
}

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

interface OpenSkyTrackResponse {
  icao24: string;
  callsign: string;
  startTime: number;
  endTime: number;
  path: (number | boolean | null)[][];
}

// Rate limiting
let lastRequestTime = 0;
const minRequestInterval = env.OPENSKY_RATE_LIMIT_MS;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < minRequestInterval) {
    await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  // Add auth if credentials available
  if (env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD) {
    const auth = Buffer.from(`${env.OPENSKY_USERNAME}:${env.OPENSKY_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  return fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
}

function parseStateVector(state: (string | number | boolean | null)[]): Aircraft {
  return {
    icao24: state[0] as string,
    callsign: state[1] ? (state[1] as string).trim() : null,
    origin_country: state[2] as string,
    time_position: state[3] as number | null,
    last_contact: state[4] as number,
    longitude: state[5] as number | null,
    latitude: state[6] as number | null,
    baro_altitude: state[7] as number | null,
    on_ground: state[8] as boolean,
    velocity: state[9] as number | null,
    true_track: state[10] as number | null,
    vertical_rate: state[11] as number | null,
    geo_altitude: state[13] as number | null,
    squawk: state[14] as string | null,
    spi: state[15] as boolean,
    position_source: state[16] as number,
    category: state[17] as number | null,
  };
}

export class OpenSkyClient {
  /**
   * Get all aircraft states worldwide (limited without auth)
   */
  async getAllStates(): Promise<Aircraft[]> {
    try {
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/states/all`);
      
      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenSkyResponse = await response.json();
      
      if (!data.states) {
        return [];
      }
      
      return data.states.map(parseStateVector);
    } catch (error) {
      console.error('Error fetching all states:', error);
      throw error;
    }
  }
  
  /**
   * Get aircraft states within a bounding box
   */
  async getStatesByBoundingBox(bbox: BoundingBox): Promise<Aircraft[]> {
    try {
      const params = new URLSearchParams({
        lamin: bbox.min_lat.toString(),
        lamax: bbox.max_lat.toString(),
        lomin: bbox.min_lon.toString(),
        lomax: bbox.max_lon.toString(),
      });
      
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/states/all?${params}`);
      
      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenSkyResponse = await response.json();
      
      if (!data.states) {
        return [];
      }
      
      return data.states.map(parseStateVector);
    } catch (error) {
      console.error('Error fetching states by bounding box:', error);
      throw error;
    }
  }
  
  /**
   * Get aircraft states within a radius of a point
   */
  async getStatesByRadius(center: GeoCircle): Promise<Aircraft[]> {
    // Convert radius (nautical miles) to approximate bounding box
    const nmToDegLat = 1 / 60; // 1 nm ≈ 1/60 degree latitude
    const nmToDegLon = 1 / (60 * Math.cos(center.latitude * Math.PI / 180));
    
    const bbox: BoundingBox = {
      min_lat: center.latitude - (center.radius_nm * nmToDegLat),
      max_lat: center.latitude + (center.radius_nm * nmToDegLat),
      min_lon: center.longitude - (center.radius_nm * nmToDegLon),
      max_lon: center.longitude + (center.radius_nm * nmToDegLon),
    };
    
    const states = await this.getStatesByBoundingBox(bbox);
    
    // Filter to actual circular radius
    return states.filter(aircraft => {
      if (aircraft.latitude === null || aircraft.longitude === null) return false;
      
      const distance = this.calculateDistanceNm(
        center.latitude,
        center.longitude,
        aircraft.latitude,
        aircraft.longitude
      );
      
      return distance <= center.radius_nm;
    });
  }
  
  /**
   * Get states for specific aircraft by ICAO24 addresses
   */
  async getStatesByIcao24(icao24List: string[]): Promise<Aircraft[]> {
    try {
      const params = new URLSearchParams();
      icao24List.forEach(icao => params.append('icao24', icao.toLowerCase()));
      
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/states/all?${params}`);
      
      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenSkyResponse = await response.json();
      
      if (!data.states) {
        return [];
      }
      
      return data.states.map(parseStateVector);
    } catch (error) {
      console.error('Error fetching states by ICAO24:', error);
      throw error;
    }
  }
  
  /**
   * Get flight track for a specific aircraft
   */
  async getFlightTrack(icao24: string, time?: number): Promise<FlightTrack | null> {
    try {
      const params = new URLSearchParams({ icao24: icao24.toLowerCase() });
      if (time) {
        params.append('time', time.toString());
      }
      
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/tracks/all?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenSkyTrackResponse = await response.json();
      
      return {
        icao24: data.icao24,
        callsign: data.callsign,
        startTime: data.startTime,
        endTime: data.endTime,
        path: data.path.map(point => ({
          time: point[0] as number,
          latitude: point[1] as number | null,
          longitude: point[2] as number | null,
          baro_altitude: point[3] as number | null,
          true_track: point[4] as number | null,
          on_ground: point[5] as boolean,
        })),
      };
    } catch (error) {
      console.error('Error fetching flight track:', error);
      throw error;
    }
  }
  
  /**
   * Get arrivals at an airport
   */
  async getArrivals(airportIcao: string, begin: number, end: number): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        airport: airportIcao,
        begin: begin.toString(),
        end: end.toString(),
      });
      
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/flights/arrival?${params}`);
      
      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching arrivals:', error);
      throw error;
    }
  }
  
  /**
   * Get departures from an airport
   */
  async getDepartures(airportIcao: string, begin: number, end: number): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        airport: airportIcao,
        begin: begin.toString(),
        end: end.toString(),
      });
      
      const response = await rateLimitedFetch(`${OPENSKY_BASE_URL}/flights/departure?${params}`);
      
      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching departures:', error);
      throw error;
    }
  }
  
  /**
   * Calculate distance between two points in nautical miles
   */
  private calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const openSkyClient = new OpenSkyClient();
