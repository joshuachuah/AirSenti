import { FlightMap } from './FlightMap';
import { useFlights } from '../api/hooks';

export function RadarMap() {
  const { data: flightsData } = useFlights({ limit: 200 });
  const aircraft = flightsData?.aircraft || [];

  return (
    <FlightMap
      aircraft={aircraft}
      className="w-full h-full min-h-[480px]"
    />
  );
}