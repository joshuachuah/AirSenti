import { DatasetStatus } from '../components/DatasetStatus';
import { HistoricalPanel } from '../components/HistoricalPanel';
import { ATCDatasetPanel } from '../components/ATCDatasetPanel';

export function Datasets() {
  return (
    <div className="space-y-5">
      <div className="opacity-0 animate-slide-up stagger-1">
        <DatasetStatus />
      </div>
      <div className="opacity-0 animate-slide-up stagger-3">
        <HistoricalPanel />
      </div>
      <div className="opacity-0 animate-slide-up stagger-5">
        <ATCDatasetPanel />
      </div>
    </div>
  );
}
