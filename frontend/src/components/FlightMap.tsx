import { useRef, useCallback, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn, isEmergencySquawk } from '../utils';
import type { EnrichedAircraft } from '../api/hooks';

// Dark basemap style — free, no key needed
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface FlightMapProps {
  aircraft: EnrichedAircraft[];
  selectedIcao24?: string | null;
  onSelect?: (icao24: string) => void;
  className?: string;
}

export function FlightMap({ aircraft, selectedIcao24, onSelect, className }: FlightMapProps) {
  const mapRef = useRef<MapRef>(null);

  const geojson = {
    type: 'FeatureCollection' as const,
    features: aircraft
      .filter((ac) => ac.latitude != null && ac.longitude != null)
      .map((ac) => ({
        type: 'Feature' as const,
        properties: {
          icao24: ac.icao24,
          callsign: ac.callsign || '',
          label: ac.callsign || ac.icao24.toUpperCase(),
          on_ground: ac.on_ground,
          is_emergency: isEmergencySquawk(ac.squawk),
          altitude_ft: ac.baro_altitude ? Math.round(ac.baro_altitude * 3.281) : null,
          speed_kts: ac.velocity ? Math.round(ac.velocity * 1.944) : null,
          heading: ac.true_track != null ? Math.round(ac.true_track) : null,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [ac.longitude, ac.latitude] as [number, number],
        },
      })),
  };

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (feature && onSelect) {
        const icao24 = feature.properties?.icao24 as string | undefined;
        if (icao24) onSelect(icao24);
      }
    },
    [onSelect],
  );

  // Fly to selected aircraft when selection changes
  useEffect(() => {
    if (!selectedIcao24 || !mapRef.current) return;
    const ac = aircraft.find((a) => a.icao24 === selectedIcao24);
    if (ac && ac.latitude != null && ac.longitude != null) {
      mapRef.current.flyTo({
        center: [ac.longitude, ac.latitude],
        zoom: 8,
        duration: 1000,
      });
    }
  }, [selectedIcao24, aircraft]);

  const selectedAc = selectedIcao24 ? aircraft.find((a) => a.icao24 === selectedIcao24) : null;

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -98,
          latitude: 38,
          zoom: 4,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        interactiveLayerIds={['aircraft-points']}
        attributionControl={false}
      >
        <Source id="aircraft" type="geojson" data={geojson}>
          {/* Emergency halo */}
          <Layer
            id="aircraft-emergency-halo"
            type="circle"
            filter={['==', ['get', 'is_emergency'], true]}
            paint={{
              'circle-radius': 12,
              'circle-color': '#ef4444',
              'circle-opacity': 0.08,
            }}
          />
          {/* Aircraft dots */}
          <Layer
            id="aircraft-points"
            type="circle"
            paint={{
              'circle-radius': [
                'case',
                ['boolean', ['get', 'is_emergency'], false], 6,
                ['case', ['boolean', ['get', 'on_ground'], false], 3.5, 4],
              ],
              'circle-color': [
                'case',
                ['boolean', ['get', 'is_emergency'], false], '#ef4444',
                ['case', ['boolean', ['get', 'on_ground'], false], '#4b5563', '#00ffc8'],
              ],
              'circle-opacity': 0.9,
              'circle-stroke-width': 1,
              'circle-stroke-color': [
                'case',
                ['boolean', ['get', 'is_emergency'], false], '#fca5a5',
                '#00ffc8',
              ],
              'circle-stroke-opacity': 0.4,
            }}
          />
          {/* Callsign labels */}
          <Layer
            id="aircraft-labels"
            type="symbol"
            layout={{
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-offset': [0, 1.4],
              'text-anchor': 'top',
              'text-optional': true,
              'text-max-width': 8,
            }}
            paint={{
              'text-color': '#9ca3af',
              'text-halo-color': '#0a0f1a',
              'text-halo-width': 1,
            }}
          />
        </Source>

        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-right" />

        {/* Selected aircraft highlight ring */}
        {selectedAc && selectedAc.latitude != null && selectedAc.longitude != null && (
          <Source id="selected" type="geojson" data={{
            type: 'FeatureCollection' as const,
            features: [{
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'Point' as const,
                coordinates: [selectedAc.longitude, selectedAc.latitude] as [number, number],
              },
            }],
          }}>
            <Layer
              id="selected-ring"
              type="circle"
              paint={{
                'circle-radius': 16,
                'circle-color': '#00ffc8',
                'circle-opacity': 0.12,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#00ffc8',
                'circle-stroke-opacity': 0.6,
              }}
            />
          </Source>
        )}
      </Map>

      {/* Overlay: Legend */}
      <div className="absolute bottom-3 left-3 p-3 rounded-lg bg-void-900/90 border border-hud-border text-[10px] space-y-1.5 z-10">
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-radar-400 rounded-full shadow-glow" />
          <span className="text-gray-500 font-mono">AIRBORNE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-gray-600 rounded-full" />
          <span className="text-gray-500 font-mono">GROUND</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-red-500 rounded-full animate-pulse" />
          <span className="text-gray-500 font-mono">EMERGENCY</span>
        </div>
      </div>

      {/* Overlay: Count */}
      <div className="absolute top-3 right-12 p-3 rounded-lg bg-void-900/90 border border-hud-border text-right z-10">
        <div className="data-label text-[9px] mb-0.5">TRACKING</div>
        <div className="text-xl font-display font-bold text-radar-300 text-glow tabular-nums">
          {aircraft.length}
        </div>
        <div className="text-[9px] font-mono text-gray-600">AIRCRAFT</div>
      </div>
    </div>
  );
}