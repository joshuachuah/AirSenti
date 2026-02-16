// ============================================
// AirSentinel AI - Hugging Face Inference Service
// ============================================

import { HfInference } from '@huggingface/inference';
import { env, isDemoMode } from '../config/env';
import type {
  ATCTranscript,
  ProcessedTranscript,
  TranscriptSegment,
  ImageAnalysisResult,
  DetectedObject,
  Incident,
  IncidentBriefing,
  FlightAnomaly,
} from '../../../shared/types';

// Initialize HuggingFace client
const hf = env.HUGGINGFACE_API_KEY ? new HfInference(env.HUGGINGFACE_API_KEY) : null;

// Model configurations
const MODELS = {
  // Audio transcription (ASR)
  ASR: 'openai/whisper-large-v3',
  ASR_FALLBACK: 'openai/whisper-medium',
  
  // Text generation / summarization
  TEXT_GEN: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  SUMMARIZATION: 'facebook/bart-large-cnn',
  
  // Image analysis
  IMAGE_CAPTION: 'Salesforce/blip-image-captioning-large',
  OBJECT_DETECTION: 'facebook/detr-resnet-50',
  VQA: 'dandelin/vilt-b32-finetuned-vqa',
  ZERO_SHOT_IMAGE: 'openai/clip-vit-large-patch14',
  
  // Text classification
  ZERO_SHOT_TEXT: 'facebook/bart-large-mnli',
  SENTIMENT: 'distilbert/distilbert-base-uncased-finetuned-sst-2-english',
  
  // Embeddings for similarity
  EMBEDDINGS: 'sentence-transformers/all-MiniLM-L6-v2',
};

// Rate limiting
let lastInferenceTime = 0;
const minInferenceInterval = env.HF_RATE_LIMIT_MS;

async function rateLimitedInference<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastInferenceTime;
  
  if (timeSinceLastRequest < minInferenceInterval) {
    await new Promise(resolve => setTimeout(resolve, minInferenceInterval - timeSinceLastRequest));
  }
  
  lastInferenceTime = Date.now();
  return fn();
}

// ============================================
// Audio Processing - ATC Transcription
// ============================================

/**
 * Transcribe ATC audio to text
 */
export async function transcribeATCAudio(
  audioData: Blob | ArrayBuffer,
  options?: { language?: string }
): Promise<ProcessedTranscript> {
  const startTime = Date.now();
  
  if (isDemoMode || !hf) {
    return generateMockTranscript();
  }
  
  try {
    // Convert to blob if needed
    const blob = audioData instanceof Blob 
      ? audioData 
      : new Blob([audioData], { type: 'audio/wav' });
    
    // Perform ASR
    const result = await rateLimitedInference(() =>
      hf!.automaticSpeechRecognition({
        model: MODELS.ASR,
        data: blob,
      })
    );
    
    const rawTranscript = result.text;
    
    // Process the transcript
    return await processATCTranscript(rawTranscript);
    
  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Try fallback model
    try {
      const blob = audioData instanceof Blob 
        ? audioData 
        : new Blob([audioData], { type: 'audio/wav' });
      
      const result = await rateLimitedInference(() =>
        hf!.automaticSpeechRecognition({
          model: MODELS.ASR_FALLBACK,
          data: blob,
        })
      );
      
      return await processATCTranscript(result.text);
    } catch (fallbackError) {
      console.error('Fallback ASR also failed:', fallbackError);
      throw error;
    }
  }
}

/**
 * Process raw ATC transcript into structured format
 */
async function processATCTranscript(rawTranscript: string): Promise<ProcessedTranscript> {
  // Detect callsigns (common patterns)
  const callsignPatterns = [
    /\b([A-Z]{3}\d{1,4}[A-Z]?)\b/g,  // DAL1234, UAL567A
    /\b(N\d{1,5}[A-Z]{0,2})\b/g,      // N12345AB (US registrations)
    /\b([A-Z]-[A-Z]{4})\b/g,          // G-ABCD (European)
  ];
  
  const detectedCallsigns = new Set<string>();
  for (const pattern of callsignPatterns) {
    const matches = rawTranscript.match(pattern);
    if (matches) {
      matches.forEach(m => detectedCallsigns.add(m));
    }
  }
  
  // Detect urgency indicators
  const urgencyMarkers = [
    'mayday', 'pan pan', 'emergency', 'declaring emergency',
    'souls on board', 'fuel remaining', 'unable', 'immediately',
    'expedite', 'priority', 'medical emergency', 'engine failure',
    'fire', 'smoke', 'decompression', 'hijack'
  ];
  
  const foundUrgencyMarkers = urgencyMarkers.filter(marker => 
    rawTranscript.toLowerCase().includes(marker)
  );
  
  // Determine urgency level
  let urgencyLevel: ProcessedTranscript['urgency_level'] = 'routine';
  if (foundUrgencyMarkers.some(m => ['mayday', 'hijack', 'fire', 'decompression'].includes(m))) {
    urgencyLevel = 'emergency';
  } else if (foundUrgencyMarkers.some(m => ['pan pan', 'emergency', 'declaring emergency'].includes(m))) {
    urgencyLevel = 'urgent';
  } else if (foundUrgencyMarkers.some(m => ['priority', 'expedite', 'immediately'].includes(m))) {
    urgencyLevel = 'priority';
  }
  
  // Extract key instructions
  const instructionPatterns = [
    /(?:climb|descend)\s+(?:and\s+)?maintain\s+(?:flight\s+level\s+)?(\d+)/gi,
    /(?:turn\s+)?(?:left|right)\s+heading\s+(\d{3})/gi,
    /(?:cleared\s+(?:for\s+)?)?(?:ILS|visual|RNAV)\s+(?:approach\s+)?runway\s+(\d{1,2}[LRC]?)/gi,
    /(?:contact|switch)\s+(?:\w+)\s+(?:on\s+)?(\d{3}\.\d{1,3})/gi,
    /(?:hold\s+short|line\s+up|cleared\s+for\s+takeoff)/gi,
    /(?:go\s+around|missed\s+approach)/gi,
  ];
  
  const keyInstructions: string[] = [];
  for (const pattern of instructionPatterns) {
    const matches = rawTranscript.match(pattern);
    if (matches) {
      keyInstructions.push(...matches.map(m => m.trim()));
    }
  }
  
  // Simple segmentation (in real implementation, use speaker diarization)
  const segments: TranscriptSegment[] = [{
    speaker: 'unknown',
    text: rawTranscript,
    timestamp_offset: 0,
    confidence: 0.85,
  }];
  
  // Generate summary using AI
  let summary = `ATC communication with ${detectedCallsigns.size} aircraft detected.`;
  
  if (!isDemoMode && hf) {
    try {
      const summaryResult = await rateLimitedInference(() =>
        hf!.summarization({
          model: MODELS.SUMMARIZATION,
          inputs: rawTranscript,
          parameters: {
            max_length: 100,
            min_length: 20,
          },
        })
      );
      summary = summaryResult.summary_text;
    } catch (e) {
      console.error('Summary generation failed:', e);
    }
  }
  
  return {
    segments,
    summary,
    urgency_level: urgencyLevel,
    detected_callsigns: Array.from(detectedCallsigns),
    key_instructions: keyInstructions,
    sentiment_analysis: {
      stress_indicators: foundUrgencyMarkers.length > 0 ? foundUrgencyMarkers.length * 20 : 0,
      urgency_markers: foundUrgencyMarkers,
    },
  };
}

// ============================================
// Image Analysis
// ============================================

/**
 * Analyze an aviation-related image
 */
export async function analyzeImage(
  imageData: Blob | string,
  analysisType: 'satellite' | 'airport' | 'aircraft' | 'incident',
  questions?: string[]
): Promise<ImageAnalysisResult> {
  const startTime = Date.now();
  
  if (isDemoMode || !hf) {
    return generateMockImageAnalysis(analysisType, questions);
  }
  
  try {
    // Get image as blob
    let imageBlob: Blob;
    if (typeof imageData === 'string') {
      // Assume base64 or URL
      if (imageData.startsWith('data:')) {
        const base64Data = imageData.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        imageBlob = new Blob([bytes], { type: 'image/jpeg' });
      } else {
        // Fetch from URL
        const response = await fetch(imageData);
        imageBlob = await response.blob();
      }
    } else {
      imageBlob = imageData;
    }
    
    // Run multiple analyses in parallel
    const [captionResult, objectsResult] = await Promise.all([
      // Image captioning
      rateLimitedInference(() =>
        hf!.imageToText({
          model: MODELS.IMAGE_CAPTION,
          data: imageBlob,
        })
      ),
      // Object detection
      rateLimitedInference(() =>
        hf!.objectDetection({
          model: MODELS.OBJECT_DETECTION,
          data: imageBlob,
        })
      ),
    ]);
    
    // Process detected objects
    const detectedObjects: DetectedObject[] = objectsResult.map((obj: any) => ({
      label: obj.label,
      confidence: obj.score,
      bounding_box: obj.box ? {
        x: obj.box.xmin,
        y: obj.box.ymin,
        width: obj.box.xmax - obj.box.xmin,
        height: obj.box.ymax - obj.box.ymin,
      } : undefined,
    }));
    
    // Answer questions if provided
    const answers: { question: string; answer: string; confidence: number }[] = [];
    if (questions && questions.length > 0) {
      for (const question of questions) {
        try {
          const vqaResult = await rateLimitedInference(() =>
            hf!.visualQuestionAnswering({
              model: MODELS.VQA,
              inputs: {
                image: imageBlob,
                question,
              },
            })
          );
          answers.push({
            question,
            answer: vqaResult.answer,
            confidence: vqaResult.score,
          });
        } catch (e) {
          console.error(`VQA failed for question "${question}":`, e);
        }
      }
    }
    
    // Assess risk based on detected objects and context
    const riskFactors: string[] = [];
    let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    
    // Check for concerning objects
    const concerningLabels = ['smoke', 'fire', 'crash', 'debris', 'damage'];
    for (const obj of detectedObjects) {
      if (concerningLabels.some(label => obj.label.toLowerCase().includes(label))) {
        riskFactors.push(`Detected ${obj.label} (${(obj.confidence * 100).toFixed(1)}% confidence)`);
        riskLevel = 'high';
      }
    }
    
    // Check caption for concerning phrases
    const captionText = captionResult.generated_text.toLowerCase();
    if (captionText.includes('smoke') || captionText.includes('fire')) {
      riskFactors.push('Visual indicators of smoke or fire in image');
      riskLevel = 'high';
    }
    
    return {
      id: `IMG-${Date.now()}`,
      analysis_type: analysisType,
      description: captionResult.generated_text,
      detected_objects: detectedObjects,
      answers: answers.length > 0 ? answers : undefined,
      risk_assessment: {
        level: riskLevel,
        factors: riskFactors,
      },
      metadata: {
        model_used: MODELS.IMAGE_CAPTION,
        confidence: 0.85,
        processing_time_ms: Date.now() - startTime,
      },
    };
    
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}

// ============================================
// Incident Analysis & Briefing Generation
// ============================================

/**
 * Generate an incident briefing from multiple sources
 */
export async function generateIncidentBriefing(
  incident: Incident,
  relatedData?: {
    transcripts?: ATCTranscript[];
    anomalies?: FlightAnomaly[];
    newsArticles?: string[];
  }
): Promise<IncidentBriefing> {
  const startTime = Date.now();
  
  if (isDemoMode || !hf) {
    return generateMockBriefing(incident);
  }
  
  try {
    // Compile all available information
    const contextParts: string[] = [
      `Incident: ${incident.title}`,
      `Description: ${incident.description}`,
      `Occurred: ${incident.occurred_at}`,
      `Location: ${incident.location?.airport_icao || incident.location?.region || 'Unknown'}`,
      `Severity: ${incident.severity}`,
    ];
    
    if (relatedData?.transcripts) {
      for (const transcript of relatedData.transcripts) {
        contextParts.push(`ATC Communication: ${transcript.raw_transcript}`);
      }
    }
    
    if (relatedData?.anomalies) {
      for (const anomaly of relatedData.anomalies) {
        contextParts.push(`Anomaly Detected: ${anomaly.type} - ${anomaly.details.description}`);
      }
    }
    
    if (relatedData?.newsArticles) {
      for (const article of relatedData.newsArticles) {
        contextParts.push(`News Report: ${article.substring(0, 500)}`);
      }
    }
    
    const fullContext = contextParts.join('\n\n');
    
    // Generate executive summary
    const summaryPrompt = `You are an aviation safety analyst. Based on the following incident information, provide a clear, factual executive summary in 2-3 sentences:

${fullContext}

Executive Summary:`;

    const summaryResult = await rateLimitedInference(() =>
      hf!.textGeneration({
        model: MODELS.TEXT_GEN,
        inputs: summaryPrompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.3,
          do_sample: true,
        },
      })
    );
    
    // Generate timeline
    const timelinePrompt = `Based on the incident information below, extract a chronological timeline of events. List each event with its time and description:

${fullContext}

Timeline:`;

    const timelineResult = await rateLimitedInference(() =>
      hf!.textGeneration({
        model: MODELS.TEXT_GEN,
        inputs: timelinePrompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.2,
          do_sample: true,
        },
      })
    );
    
    // Parse timeline from generated text (simplified parsing)
    const timelineEvents: { timestamp: string; description: string; significance: 'low' | 'medium' | 'high' }[] = [
      {
        timestamp: incident.occurred_at,
        description: incident.title,
        significance: 'high',
      },
    ];
    
    // Generate key factors
    const factorsPrompt = `As an aviation safety analyst, identify the key factors that may have contributed to this incident:

${fullContext}

Key Contributing Factors (list 3-5 factors):`;

    const factorsResult = await rateLimitedInference(() =>
      hf!.textGeneration({
        model: MODELS.TEXT_GEN,
        inputs: factorsPrompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.3,
          do_sample: true,
        },
      })
    );
    
    // Extract factors from generated text
    const keyFactors = factorsResult.generated_text
      .split('\n')
      .filter(line => line.trim().match(/^[\d\-\*]/))
      .map(line => line.replace(/^[\d\.\-\*\s]+/, '').trim())
      .filter(f => f.length > 0)
      .slice(0, 5);
    
    return {
      incident_id: incident.id,
      generated_at: new Date().toISOString(),
      executive_summary: summaryResult.generated_text.trim(),
      timeline: timelineEvents,
      key_factors: keyFactors.length > 0 ? keyFactors : ['Insufficient data for factor analysis'],
      probable_causes: undefined, // Would require more investigation
      similar_incidents: undefined, // Would require vector similarity search
      recommendations: undefined,
      confidence_score: 0.7,
      sources_used: [
        incident.source,
        ...(relatedData?.transcripts ? ['ATC Transcripts'] : []),
        ...(relatedData?.anomalies ? ['Anomaly Detection'] : []),
        ...(relatedData?.newsArticles ? ['News Reports'] : []),
      ],
    };
    
  } catch (error) {
    console.error('Error generating incident briefing:', error);
    throw error;
  }
}

// ============================================
// Natural Language Query Processing
// ============================================

/**
 * Process a natural language query about flights/incidents
 */
export async function processNaturalLanguageQuery(
  query: string
): Promise<{
  intent: string;
  entities: Record<string, string>;
  sql_hint?: string;
  response_template?: string;
}> {
  if (isDemoMode || !hf) {
    return generateMockQueryParsing(query);
  }
  
  try {
    // Classify the query intent
    const intents = [
      'flight_status',
      'flight_history',
      'incident_search',
      'anomaly_report',
      'airport_activity',
      'aircraft_info',
      'weather_query',
      'general_question',
    ];
    
    const classificationResult = await rateLimitedInference(() =>
      hf!.zeroShotClassification({
        model: MODELS.ZERO_SHOT_TEXT,
        inputs: query,
        parameters: {
          candidate_labels: intents,
          multi_label: false,
        },
      })
    );
    
    const topIntent = classificationResult.labels[0];
    
    // Extract entities using simple pattern matching
    const entities: Record<string, string> = {};
    
    // Flight numbers
    const flightMatch = query.match(/\b([A-Z]{2,3}\d{1,4}[A-Z]?)\b/i);
    if (flightMatch) entities.flight = flightMatch[1].toUpperCase();
    
    // Airport codes
    const airportMatch = query.match(/\b([A-Z]{3,4})\b/gi);
    if (airportMatch) {
      const airports = airportMatch.filter(code => 
        code.length === 3 || code.length === 4
      );
      if (airports.length > 0) entities.airport = airports[0].toUpperCase();
    }
    
    // Time references
    const timePatterns = {
      today: /\btoday\b/i,
      yesterday: /\byesterday\b/i,
      last_hour: /\blast\s+hour\b/i,
      last_24h: /\blast\s+24\s*h/i,
    };
    
    for (const [key, pattern] of Object.entries(timePatterns)) {
      if (pattern.test(query)) {
        entities.time_reference = key;
        break;
      }
    }
    
    return {
      intent: topIntent,
      entities,
    };
    
  } catch (error) {
    console.error('Error processing query:', error);
    throw error;
  }
}

/**
 * Generate text embeddings for similarity search
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (isDemoMode || !hf) {
    // Return random embeddings for demo
    return texts.map(() => Array(384).fill(0).map(() => Math.random()));
  }
  
  try {
    const results = await Promise.all(
      texts.map(text =>
        rateLimitedInference(() =>
          hf!.featureExtraction({
            model: MODELS.EMBEDDINGS,
            inputs: text,
          })
        )
      )
    );
    
    return results as number[][];
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// ============================================
// Mock Data Generators (for demo mode)
// ============================================

function generateMockTranscript(): ProcessedTranscript {
  return {
    segments: [
      {
        speaker: 'atc',
        text: 'Delta 1432, descend and maintain flight level 240, expect vectors for ILS runway 28L.',
        timestamp_offset: 0,
        confidence: 0.92,
        callsign: 'DAL1432',
      },
      {
        speaker: 'pilot',
        text: 'Descending to flight level 240, Delta 1432.',
        timestamp_offset: 4.5,
        confidence: 0.89,
        callsign: 'DAL1432',
      },
      {
        speaker: 'atc',
        text: 'United 789 heavy, turn left heading 270, vectors for traffic.',
        timestamp_offset: 8.2,
        confidence: 0.91,
        callsign: 'UAL789',
      },
    ],
    summary: 'Routine approach communications at major airport. Delta 1432 receiving descent clearance and approach vectors. United 789 receiving traffic avoidance vectors.',
    urgency_level: 'routine',
    detected_callsigns: ['DAL1432', 'UAL789'],
    key_instructions: [
      'descend and maintain flight level 240',
      'vectors for ILS runway 28L',
      'turn left heading 270',
    ],
    sentiment_analysis: {
      stress_indicators: 0,
      urgency_markers: [],
    },
  };
}

function generateMockImageAnalysis(
  analysisType: string,
  questions?: string[]
): ImageAnalysisResult {
  const descriptions: Record<string, string> = {
    satellite: 'Aerial view of airport showing multiple runways, terminal buildings, and aircraft parked at gates. Clear weather conditions visible.',
    airport: 'Airport terminal apron with commercial aircraft, ground support equipment, and active taxiway operations.',
    aircraft: 'Commercial passenger aircraft, twin-engine wide-body configuration, appears to be in normal operational condition.',
    incident: 'Airport scene with emergency response vehicles present near aircraft. Situation appears to be under control.',
  };
  
  return {
    id: `IMG-MOCK-${Date.now()}`,
    analysis_type: analysisType,
    description: descriptions[analysisType] || 'Aviation-related imagery analyzed.',
    detected_objects: [
      { label: 'aircraft', confidence: 0.95 },
      { label: 'runway', confidence: 0.89 },
      { label: 'terminal', confidence: 0.82 },
      { label: 'vehicle', confidence: 0.78 },
    ],
    answers: questions?.map(q => ({
      question: q,
      answer: 'Analysis indicates normal aviation operations.',
      confidence: 0.75,
    })),
    risk_assessment: {
      level: 'none',
      factors: [],
    },
    metadata: {
      model_used: 'mock-model',
      confidence: 0.85,
      processing_time_ms: 150,
    },
  };
}

function generateMockBriefing(incident: Incident): IncidentBriefing {
  return {
    incident_id: incident.id,
    generated_at: new Date().toISOString(),
    executive_summary: `${incident.title}. The incident occurred at ${incident.location?.airport_icao || 'an undisclosed location'} and is currently classified as ${incident.severity}. Initial investigation is ongoing with ${incident.status} status.`,
    timeline: [
      {
        timestamp: incident.occurred_at,
        description: 'Initial incident occurrence',
        significance: 'high',
      },
      {
        timestamp: incident.reported_at,
        description: 'Incident reported to authorities',
        significance: 'medium',
      },
    ],
    key_factors: [
      'Weather conditions at time of incident',
      'Aircraft maintenance history',
      'Pilot experience and training',
      'Air traffic control communications',
      'Airport operational status',
    ],
    probable_causes: undefined,
    similar_incidents: undefined,
    recommendations: [
      'Review standard operating procedures',
      'Enhance crew resource management training',
      'Evaluate maintenance inspection protocols',
    ],
    confidence_score: 0.65,
    sources_used: [incident.source],
  };
}

function generateMockQueryParsing(query: string): {
  intent: string;
  entities: Record<string, string>;
} {
  const lowerQuery = query.toLowerCase();
  
  let intent = 'general_question';
  if (lowerQuery.includes('flight') || lowerQuery.includes('flying')) {
    intent = 'flight_status';
  } else if (lowerQuery.includes('incident') || lowerQuery.includes('accident')) {
    intent = 'incident_search';
  } else if (lowerQuery.includes('anomaly') || lowerQuery.includes('unusual')) {
    intent = 'anomaly_report';
  } else if (lowerQuery.includes('airport')) {
    intent = 'airport_activity';
  }
  
  const entities: Record<string, string> = {};
  const flightMatch = query.match(/\b([A-Z]{2,3}\d{1,4}[A-Z]?)\b/i);
  if (flightMatch) entities.flight = flightMatch[1].toUpperCase();
  
  const airportMatch = query.match(/\b([A-Z]{3,4})\b/gi);
  if (airportMatch) entities.airport = airportMatch[0].toUpperCase();
  
  return { intent, entities };
}

// Export for testing
export const _models = MODELS;
