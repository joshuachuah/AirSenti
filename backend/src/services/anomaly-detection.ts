// ============================================
// AirSentinel AI - Anomaly Detection Service
// ============================================

import type { Aircraft, FlightAnomaly, AnomalyType, FlightTrack } from '../../../shared/types';
import { EMERGENCY_SQUAWKS } from '../../../shared/types';

// Configuration for anomaly detection thresholds
const ANOMALY_THRESHOLDS = {
  // Altitude anomalies
  RAPID_ALTITUDE_DROP_FT_PER_MIN: -3000, // Sudden descent
  RAPID_CLIMB_FT_PER_MIN: 5000, // Unusually rapid climb
  LOW_ALTITUDE_WARNING_FT: 500, // Too low when not near airport
  
  // Speed anomalies
  UNUSUALLY_SLOW_KTS: 80, // Suspiciously slow for jet
  UNUSUALLY_FAST_KTS: 600, // Exceeding typical cruise
  
  // Pattern detection
  HOLDING_PATTERN_TURNS: 2, // Number of turns to detect holding
  HOLDING_PATTERN_RADIUS_NM: 5,
  
  // Route deviation
  ROUTE_DEVIATION_NM: 20, // Miles off expected route
  
  // Vertical rate
  CRITICAL_VERTICAL_RATE_FPM: -4000,
};

// Store recent aircraft states for pattern detection
const aircraftHistory: Map<string, Aircraft[]> = new Map();
const HISTORY_MAX_SIZE = 100;
const HISTORY_RETENTION_MS = 30 * 60 * 1000; // 30 minutes

function addToHistory(aircraft: Aircraft): void {
  const history = aircraftHistory.get(aircraft.icao24) || [];
  history.push({ ...aircraft, last_contact: Date.now() / 1000 });
  
  // Trim old entries
  const cutoffTime = Date.now() / 1000 - HISTORY_RETENTION_MS / 1000;
  const filtered = history.filter(a => a.last_contact > cutoffTime);
  
  // Keep max size
  if (filtered.length > HISTORY_MAX_SIZE) {
    filtered.splice(0, filtered.length - HISTORY_MAX_SIZE);
  }
  
  aircraftHistory.set(aircraft.icao24, filtered);
}

function getHistory(icao24: string): Aircraft[] {
  return aircraftHistory.get(icao24) || [];
}

function generateAnomalyId(): string {
  return `ANO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Detect emergency squawk codes
 */
function detectEmergencySquawk(aircraft: Aircraft): FlightAnomaly | null {
  if (!aircraft.squawk) return null;
  
  const emergencyType = EMERGENCY_SQUAWKS[aircraft.squawk as keyof typeof EMERGENCY_SQUAWKS];
  
  if (emergencyType) {
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'emergency_squawk',
      severity: 'critical',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Emergency squawk ${aircraft.squawk}: ${emergencyType}`,
        metrics: {
          squawk_code: parseInt(aircraft.squawk),
        },
      },
    };
  }
  
  return null;
}

/**
 * Detect rapid altitude changes
 */
function detectAltitudeAnomaly(aircraft: Aircraft): FlightAnomaly | null {
  if (aircraft.on_ground || aircraft.vertical_rate === null) return null;
  
  const verticalRateFpm = aircraft.vertical_rate * 196.85; // m/s to ft/min
  
  // Rapid descent
  if (verticalRateFpm < ANOMALY_THRESHOLDS.CRITICAL_VERTICAL_RATE_FPM) {
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'rapid_descent',
      severity: 'high',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Rapid descent detected: ${Math.round(verticalRateFpm)} ft/min`,
        metrics: {
          vertical_rate_fpm: verticalRateFpm,
          current_altitude_ft: aircraft.baro_altitude ? aircraft.baro_altitude * 3.281 : 0,
        },
        current_value: verticalRateFpm,
      },
    };
  }
  
  // Check for sudden altitude drop using history
  const history = getHistory(aircraft.icao24);
  if (history.length >= 2 && aircraft.baro_altitude !== null) {
    const previousState = history[history.length - 2];
    if (previousState.baro_altitude !== null) {
      const altitudeChange = (aircraft.baro_altitude - previousState.baro_altitude) * 3.281; // meters to feet
      const timeChange = (aircraft.last_contact - previousState.last_contact) / 60; // seconds to minutes
      
      if (timeChange > 0) {
        const rateOfChange = altitudeChange / timeChange;
        
        if (rateOfChange < ANOMALY_THRESHOLDS.RAPID_ALTITUDE_DROP_FT_PER_MIN) {
          return {
            id: generateAnomalyId(),
            flight_icao24: aircraft.icao24,
            callsign: aircraft.callsign,
            type: 'altitude_drop',
            severity: 'high',
            detected_at: new Date().toISOString(),
            location: {
              latitude: aircraft.latitude || 0,
              longitude: aircraft.longitude || 0,
            },
            details: {
              description: `Sudden altitude drop: ${Math.round(altitudeChange)} ft in ${timeChange.toFixed(1)} minutes`,
              metrics: {
                altitude_change_ft: altitudeChange,
                rate_of_change_fpm: rateOfChange,
              },
              previous_value: previousState.baro_altitude * 3.281,
              current_value: aircraft.baro_altitude * 3.281,
            },
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect holding patterns
 */
function detectHoldingPattern(aircraft: Aircraft): FlightAnomaly | null {
  const history = getHistory(aircraft.icao24);
  
  if (history.length < 20) return null;
  if (aircraft.on_ground) return null;
  
  // Look for circular/racetrack patterns in recent history
  const recentHistory = history.slice(-30);
  let turnCount = 0;
  let lastHeading = recentHistory[0].true_track;
  let totalHeadingChange = 0;
  
  for (let i = 1; i < recentHistory.length; i++) {
    const currentHeading = recentHistory[i].true_track;
    if (lastHeading !== null && currentHeading !== null) {
      let headingChange = currentHeading - lastHeading;
      
      // Normalize heading change to -180 to 180
      if (headingChange > 180) headingChange -= 360;
      if (headingChange < -180) headingChange += 360;
      
      totalHeadingChange += headingChange;
      
      // Count significant turns
      if (Math.abs(headingChange) > 30) {
        turnCount++;
      }
    }
    lastHeading = currentHeading;
  }
  
  // Detect if aircraft has made multiple full circles
  const fullCircles = Math.abs(totalHeadingChange) / 360;
  
  if (fullCircles >= ANOMALY_THRESHOLDS.HOLDING_PATTERN_TURNS) {
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'holding_pattern',
      severity: 'medium',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Aircraft appears to be in holding pattern (${fullCircles.toFixed(1)} orbits detected)`,
        metrics: {
          orbits_detected: fullCircles,
          turn_count: turnCount,
          total_heading_change: totalHeadingChange,
        },
      },
    };
  }
  
  return null;
}

/**
 * Detect unusual speed
 */
function detectSpeedAnomaly(aircraft: Aircraft): FlightAnomaly | null {
  if (aircraft.on_ground || aircraft.velocity === null) return null;
  
  const speedKts = aircraft.velocity * 1.944; // m/s to knots
  
  // Check for unusually fast
  if (speedKts > ANOMALY_THRESHOLDS.UNUSUALLY_FAST_KTS) {
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'unusual_speed',
      severity: 'medium',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Unusually high ground speed: ${Math.round(speedKts)} knots`,
        metrics: {
          ground_speed_kts: speedKts,
        },
        current_value: speedKts,
      },
    };
  }
  
  // Check for suspiciously slow (for jets at altitude)
  if (speedKts < ANOMALY_THRESHOLDS.UNUSUALLY_SLOW_KTS && aircraft.baro_altitude && aircraft.baro_altitude > 3000) {
    // This might be a turboprop or helicopter, so lower severity
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'unusual_speed',
      severity: 'low',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Unusually low ground speed at altitude: ${Math.round(speedKts)} knots at ${Math.round(aircraft.baro_altitude * 3.281)} ft`,
        metrics: {
          ground_speed_kts: speedKts,
          altitude_ft: aircraft.baro_altitude * 3.281,
        },
        current_value: speedKts,
      },
    };
  }
  
  return null;
}

/**
 * Detect go-around patterns
 */
function detectGoAround(aircraft: Aircraft): FlightAnomaly | null {
  const history = getHistory(aircraft.icao24);
  
  if (history.length < 10) return null;
  
  // Look for: descending -> low altitude -> climbing pattern
  const recent = history.slice(-15);
  
  let wasDescending = false;
  let reachedLowAltitude = false;
  let isNowClimbing = false;
  let lowestAltitude = Infinity;
  
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    
    if (prev.baro_altitude !== null && curr.baro_altitude !== null) {
      const altFt = curr.baro_altitude * 3.281;
      lowestAltitude = Math.min(lowestAltitude, altFt);
      
      if (curr.baro_altitude < prev.baro_altitude) {
        wasDescending = true;
      }
      
      if (altFt < 1500 && wasDescending) {
        reachedLowAltitude = true;
      }
      
      if (curr.baro_altitude > prev.baro_altitude && reachedLowAltitude) {
        isNowClimbing = true;
      }
    }
  }
  
  if (wasDescending && reachedLowAltitude && isNowClimbing && aircraft.vertical_rate && aircraft.vertical_rate > 2) {
    return {
      id: generateAnomalyId(),
      flight_icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      type: 'go_around',
      severity: 'medium',
      detected_at: new Date().toISOString(),
      location: {
        latitude: aircraft.latitude || 0,
        longitude: aircraft.longitude || 0,
      },
      details: {
        description: `Possible go-around detected. Lowest altitude: ${Math.round(lowestAltitude)} ft`,
        metrics: {
          lowest_altitude_ft: lowestAltitude,
          current_vertical_rate_fpm: (aircraft.vertical_rate || 0) * 196.85,
        },
      },
    };
  }
  
  return null;
}

/**
 * Main anomaly detection function - analyzes a single aircraft
 */
export function detectAnomalies(aircraft: Aircraft): FlightAnomaly[] {
  const anomalies: FlightAnomaly[] = [];
  
  // Skip aircraft without valid position
  if (aircraft.latitude === null || aircraft.longitude === null) {
    return anomalies;
  }
  
  // Add to history for pattern detection
  addToHistory(aircraft);
  
  // Run all detection algorithms
  const detectors = [
    detectEmergencySquawk,
    detectAltitudeAnomaly,
    detectHoldingPattern,
    detectSpeedAnomaly,
    detectGoAround,
  ];
  
  for (const detector of detectors) {
    try {
      const anomaly = detector(aircraft);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    } catch (error) {
      console.error(`Error in anomaly detector:`, error);
    }
  }
  
  return anomalies;
}

/**
 * Batch anomaly detection for multiple aircraft
 */
export function detectAnomaliesBatch(aircraft: Aircraft[]): FlightAnomaly[] {
  const allAnomalies: FlightAnomaly[] = [];
  
  for (const ac of aircraft) {
    const anomalies = detectAnomalies(ac);
    allAnomalies.push(...anomalies);
  }
  
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allAnomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return allAnomalies;
}

/**
 * Analyze a complete flight track for anomalies
 */
export function analyzeFlightTrack(track: FlightTrack): FlightAnomaly[] {
  const anomalies: FlightAnomaly[] = [];
  
  // Convert track points to aircraft states for analysis
  for (const point of track.path) {
    if (point.latitude !== null && point.longitude !== null) {
      const pseudoAircraft: Aircraft = {
        icao24: track.icao24,
        callsign: track.callsign,
        origin_country: '',
        longitude: point.longitude,
        latitude: point.latitude,
        baro_altitude: point.baro_altitude,
        geo_altitude: null,
        velocity: null,
        true_track: point.true_track,
        vertical_rate: null,
        on_ground: point.on_ground,
        squawk: null,
        spi: false,
        position_source: 0,
        last_contact: point.time,
        time_position: point.time,
        category: null,
      };
      
      const detected = detectAnomalies(pseudoAircraft);
      anomalies.push(...detected);
    }
  }
  
  return anomalies;
}

/**
 * Get summary statistics for detected anomalies
 */
export function getAnomalyStats(anomalies: FlightAnomaly[]): Record<string, number> {
  const stats: Record<string, number> = {
    total: anomalies.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  const byType: Record<string, number> = {};
  
  for (const anomaly of anomalies) {
    stats[anomaly.severity]++;
    byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
  }
  
  return { ...stats, ...byType };
}

// Export history management for testing
export const _internal = {
  addToHistory,
  getHistory,
  clearHistory: () => aircraftHistory.clear(),
};
