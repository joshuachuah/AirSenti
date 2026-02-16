# AirSentinel AI

## Multimodal Aviation Intelligence & Incident Analysis Platform

![AirSentinel AI](https://img.shields.io/badge/AirSentinel-AI-00ffc8?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge)
![Bun](https://img.shields.io/badge/Bun-1.1-f472b6?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge)

> "Bloomberg Terminal meets aviation safety, powered by multimodal AI."

AirSentinel AI is a **real-time aviation intelligence platform** that monitors aircraft activity, pilot/ATC communications, satellite imagery, and public incident reports to detect anomalous flight behavior, analyze incidents, and provide natural language querying capabilities.

---

## 🚀 Features

### Core Capabilities

| Feature | Description | HuggingFace Tasks |
|---------|-------------|-------------------|
| **Live Flight Monitoring** | Track aircraft in real-time with anomaly detection | - |
| **ATC Audio Intelligence** | Transcribe and analyze pilot/ATC communications | Audio-Text-to-Text, ASR |
| **Incident Auto-Briefings** | Generate AI-powered incident analysis reports | Summarization, QA |
| **Visual Context Analysis** | Analyze satellite/airport imagery | Image-Text-to-Text, VQA, Object Detection |
| **Natural Language Queries** | Ask questions about aviation data | Zero-Shot Classification, Text Generation |

### Anomaly Detection

- 🔴 **Emergency Squawks** (7500, 7600, 7700)
- 📉 **Rapid Altitude Changes**
- 🔄 **Holding Patterns**
- ⚡ **Unusual Speeds**
- ✈️ **Go-Arounds**
- 🛣️ **Route Deviations**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AirSentinel AI                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ├── Real-time Dashboard                                    │
│  ├── Interactive Map Visualization                          │
│  ├── Anomaly Alerts                                         │
│  └── Natural Language Query Interface                       │
├─────────────────────────────────────────────────────────────┤
│  Backend (Bun + Hono)                                       │
│  ├── REST API                                               │
│  ├── OpenSky Network Integration                            │
│  ├── Anomaly Detection Engine                               │
│  └── HuggingFace AI Inference                               │
├─────────────────────────────────────────────────────────────┤
│  AI/ML Services (HuggingFace)                               │
│  ├── Whisper (ASR)                                          │
│  ├── BLIP (Image Captioning)                                │
│  ├── DETR (Object Detection)                                │
│  ├── ViLT (VQA)                                             │
│  ├── BART (Summarization, Zero-Shot)                        │
│  └── Sentence Transformers (Embeddings)                     │
├─────────────────────────────────────────────────────────────┤
│  External Data Sources                                      │
│  ├── OpenSky Network (Live Flight Data)                     │
│  ├── FAA/NTSB (Incident Reports)                            │
│  └── LiveATC (Audio Streams)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- Node.js 18+ (optional, for npm compatibility)
- HuggingFace API Key (optional, for AI features)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/airsentinel-ai.git
cd airsentinel-ai

# Install backend dependencies
cd backend
bun install

# Install frontend dependencies
cd ../frontend
bun install

# Start the backend (from backend directory)
cd ../backend
bun run dev

# Start the frontend (from frontend directory, in new terminal)
cd ../frontend
bun run dev
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server
PORT=3000
NODE_ENV=development

# External APIs (optional - runs in demo mode without these)
HUGGINGFACE_API_KEY=hf_your_api_key_here
OPENSKY_USERNAME=your_username
OPENSKY_PASSWORD=your_password

# Feature Flags
ENABLE_LIVE_TRACKING=true
ENABLE_ATC_PROCESSING=true
ENABLE_IMAGE_ANALYSIS=true
```

---

## 📡 API Reference

### Flights

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/flights` | GET | Get all tracked flights |
| `/api/flights/area` | GET | Get flights in bounding box |
| `/api/flights/radius` | GET | Get flights within radius |
| `/api/flights/:icao24` | GET | Get specific flight |
| `/api/flights/:icao24/track` | GET | Get flight track history |

### Anomalies

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/anomalies` | GET | Get detected anomalies |
| `/api/anomalies/:id` | GET | Get anomaly details |
| `/api/anomalies/:id/analyze` | POST | AI analysis of anomaly |

### Incidents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/incidents` | GET | Get aviation incidents |
| `/api/incidents/:id` | GET | Get incident details |
| `/api/incidents/:id/briefing` | POST | Generate AI briefing |
| `/api/incidents` | POST | Report new incident |

### ATC

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/atc/transcribe` | POST | Transcribe ATC audio |
| `/api/atc/live` | GET | Get live ATC feed |

### AI Query

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Natural language query |

### Images

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/images/analyze` | POST | Analyze uploaded image |
| `/api/images/analyze-url` | POST | Analyze image from URL |

---

## 🤖 HuggingFace Models Used

| Task | Model | Purpose |
|------|-------|---------|
| ASR | `openai/whisper-large-v3` | ATC audio transcription |
| Image Captioning | `Salesforce/blip-image-captioning-large` | Aviation image description |
| Object Detection | `facebook/detr-resnet-50` | Aircraft/runway detection |
| VQA | `dandelin/vilt-b32-finetuned-vqa` | Visual question answering |
| Summarization | `facebook/bart-large-cnn` | Incident summarization |
| Text Generation | `mistralai/Mixtral-8x7B-Instruct-v0.1` | Briefing generation |
| Zero-Shot | `facebook/bart-large-mnli` | Query classification |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` | Similarity search |

---

## 📊 Data Sources

- **[OpenSky Network](https://opensky-network.org/)** - Live flight telemetry (ADS-B)
- **[FAA](https://www.faa.gov/)** / **[NTSB](https://www.ntsb.gov/)** - Incident reports
- **[LiveATC](https://www.liveatc.net/)** - ATC audio streams
- **[NOAA](https://www.noaa.gov/)** - Weather data

---

## 🎨 Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Language**: TypeScript
- **AI**: HuggingFace Inference API

### Frontend
- **Framework**: React 18
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: TanStack Query
- **Charts**: Recharts

---

## 🔧 Development

### Project Structure

```
airsentinel/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── services/        # Business logic
│   │   │   ├── opensky.ts   # Flight data client
│   │   │   ├── anomaly-detection.ts
│   │   │   └── ai-inference.ts
│   │   └── index.ts         # Main server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # API hooks
│   │   ├── components/      # React components
│   │   ├── utils/           # Utilities
│   │   └── App.tsx          # Main application
│   └── package.json
└── shared/
    └── types.ts             # Shared TypeScript types
```

### Running Tests

```bash
# Backend tests
cd backend
bun test

# Frontend tests
cd frontend
bun test
```

---

## 🚢 Deployment

### Docker

```bash
docker-compose up -d
```

### Manual Deployment

1. Build frontend: `cd frontend && bun run build`
2. Start backend: `cd backend && bun run start`
3. Serve frontend build from backend or CDN

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

---

## 📞 Support

- 📧 Email: support@airsentinel.ai
- 💬 Discord: [Join our server](https://discord.gg/airsentinel)
- 🐦 Twitter: [@AirSentinelAI](https://twitter.com/airsentinelai)

---

<div align="center">
  <br />
  <p>
    <strong>AirSentinel AI</strong> - Making aviation intelligence accessible
  </p>
  <p>
    Built with ❤️ using HuggingFace, OpenSky Network, and modern web technologies
  </p>
</div>
