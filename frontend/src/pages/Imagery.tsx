import { useMemo, useState } from 'react';
import { ImagePlus, Link2, Radar, Search, Sparkles } from 'lucide-react';
import { useAnalyzeImage, useAnalyzeImageUrl } from '../api/hooks';

type AnalysisType = 'satellite' | 'airport' | 'aircraft' | 'incident';
type InputMode = 'upload' | 'url';

const questionPresets = [
  'What safety risks are visible?',
  'Is there evidence of damage or smoke?',
  'What operational context stands out?',
];

export function Imagery() {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('airport');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [questionInput, setQuestionInput] = useState(questionPresets.join('\n'));

  const analyzeFile = useAnalyzeImage();
  const analyzeUrl = useAnalyzeImageUrl();

  const questions = useMemo(
    () => questionInput.split('\n').map((line) => line.trim()).filter(Boolean),
    [questionInput]
  );

  const result = inputMode === 'upload' ? analyzeFile.data : analyzeUrl.data;
  const isPending = inputMode === 'upload' ? analyzeFile.isPending : analyzeUrl.isPending;

  return (
    <div className="space-y-5">
      <div className="hud-panel p-6">
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2 flex items-center gap-2 text-radar-400">
              <Radar className="h-4 w-4" />
              <span className="text-[11px] font-display uppercase tracking-[0.18em]">Imagery Workbench</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-100">Visual incident and airport analysis</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              This exposes the existing backend image-analysis endpoints through a dedicated investigation surface.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn-ghost ${inputMode === 'upload' ? 'bg-radar-400/10 text-radar-400' : ''}`}
              onClick={() => setInputMode('upload')}
            >
              <ImagePlus className="h-4 w-4" /> Upload
            </button>
            <button
              className={`btn-ghost ${inputMode === 'url' ? 'bg-radar-400/10 text-radar-400' : ''}`}
              onClick={() => setInputMode('url')}
            >
              <Link2 className="h-4 w-4" /> URL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="data-label">Analysis mode</span>
                <select
                  className="input-field"
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
                >
                  <option value="airport">Airport</option>
                  <option value="aircraft">Aircraft</option>
                  <option value="incident">Incident</option>
                  <option value="satellite">Satellite</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="data-label">Image input</span>
                {inputMode === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-radar-400/15 file:px-3 file:py-2 file:text-xs file:font-display file:text-radar-300"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                ) : (
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input-field"
                    placeholder="https://example.com/airport-image.jpg"
                  />
                )}
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="data-label">Questions for the model</span>
              <textarea
                className="input-field min-h-36"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="One question per line"
              />
            </label>

            <button
              className="btn-primary text-xs py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPending || (inputMode === 'upload' ? !file : !url.trim())}
              onClick={() => {
                if (inputMode === 'upload') {
                  if (!file) return;
                  analyzeFile.mutate({ file, type: analysisType, questions });
                  return;
                }

                analyzeUrl.mutate({ url: url.trim(), type: analysisType, questions });
              }}
            >
              <Search className="h-3.5 w-3.5" />
              {isPending ? 'Analyzing imagery' : 'Run visual analysis'}
            </button>
          </div>

          <div className="hud-panel p-5 min-h-[420px]">
            {result ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-radar-400">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[11px] font-display uppercase tracking-[0.18em]">Analysis Summary</span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-300">{result.description}</p>
                </div>

                {result.risk_assessment && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
                    <div className="mb-1 text-[10px] font-display uppercase tracking-[0.18em] text-amber-300">
                      Risk level: {result.risk_assessment.level}
                    </div>
                    {result.risk_assessment.factors.length > 0 ? (
                      <ul className="space-y-1 text-sm text-gray-300">
                        {result.risk_assessment.factors.map((factor) => (
                          <li key={factor}>- {factor}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No elevated visual risk markers were reported.</p>
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-[10px] font-display uppercase tracking-[0.18em] text-blue-300">Detected objects</div>
                  <div className="flex flex-wrap gap-2">
                    {result.detected_objects.map((object) => (
                      <span key={`${object.label}-${object.confidence}`} className="badge badge-info">
                        {object.label} {(object.confidence * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>

                {result.answers && result.answers.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-display uppercase tracking-[0.18em] text-gray-500">Question answers</div>
                    {result.answers.map((answer) => (
                      <div key={answer.question} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="mb-1 text-sm text-gray-200">{answer.question}</div>
                        <div className="text-sm text-gray-400">{answer.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-gray-600">
                Run an upload or URL analysis to inspect objects, risk markers, and answer custom visual questions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
