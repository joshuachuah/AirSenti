// ============================================
// AirSentinel AI - Utility Functions
// ============================================

import { clsx, type ClassValue } from 'clsx';

// Classname helper
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format numbers
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Format altitude
export function formatAltitude(meters: number | null): string {
  if (meters === null) return 'N/A';
  const feet = Math.round(meters * 3.281);
  return `FL${Math.round(feet / 100).toString().padStart(3, '0')}`;
}

export function formatAltitudeFeet(meters: number | null): string {
  if (meters === null) return 'N/A';
  const feet = Math.round(meters * 3.281);
  return `${formatNumber(feet)} ft`;
}

// Format speed
export function formatSpeed(mps: number | null): string {
  if (mps === null) return 'N/A';
  const knots = Math.round(mps * 1.944);
  return `${knots} kts`;
}

// Format heading
export function formatHeading(degrees: number | null): string {
  if (degrees === null) return 'N/A';
  return `${Math.round(degrees).toString().padStart(3, '0')}°`;
}

// Format vertical rate
export function formatVerticalRate(mps: number | null): string {
  if (mps === null) return 'N/A';
  const fpm = Math.round(mps * 196.85);
  const sign = fpm > 0 ? '+' : '';
  return `${sign}${formatNumber(fpm)} fpm`;
}

// Format coordinates
export function formatCoordinates(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return 'N/A';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

// Format time
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateTime(d);
}

// Squawk code helpers
export const EMERGENCY_SQUAWKS: Record<string, { name: string; color: string }> = {
  '7500': { name: 'Hijacking', color: 'red' },
  '7600': { name: 'Radio Failure', color: 'orange' },
  '7700': { name: 'Emergency', color: 'red' },
};

export function isEmergencySquawk(squawk: string | null): boolean {
  return squawk !== null && squawk in EMERGENCY_SQUAWKS;
}

export function getSquawkInfo(squawk: string | null): { name: string; color: string } | null {
  if (!squawk || !(squawk in EMERGENCY_SQUAWKS)) return null;
  return EMERGENCY_SQUAWKS[squawk];
}

// Severity helpers
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

export function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 border-red-500/50';
    case 'high': return 'bg-orange-500/20 border-orange-500/50';
    case 'medium': return 'bg-yellow-500/20 border-yellow-500/50';
    case 'low': return 'bg-blue-500/20 border-blue-500/50';
    default: return 'bg-gray-500/20 border-gray-500/50';
  }
}

// Anomaly type display
export function getAnomalyLabel(type: string): string {
  const labels: Record<string, string> = {
    altitude_drop: 'Altitude Drop',
    holding_pattern: 'Holding Pattern',
    emergency_squawk: 'Emergency Squawk',
    route_deviation: 'Route Deviation',
    rapid_descent: 'Rapid Descent',
    unusual_speed: 'Unusual Speed',
    go_around: 'Go-Around',
    diversion: 'Diversion',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Aircraft icon rotation
export function getAircraftRotation(track: number | null): number {
  return track ?? 0;
}

// Distance calculation (Haversine)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Local storage helpers
export function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStoredValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}
