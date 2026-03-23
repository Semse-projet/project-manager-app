# 🎼 INTEGRACIÓN COMPLETA: PROYECTO PROMETEO → MUSICGENIUS
## Documento Maestro de Unificación de Artefactos

**Fecha**: 25 Noviembre 2025  
**Versión**: 1.0 - Análisis Completo  
**Autor**: Claude + Yoni  
**Estado**: 🟢 READY FOR INTEGRATION

---

## 📊 EXECUTIVE SUMMARY

Este documento mapea **TODOS los artefactos existentes** del Proyecto Prometeo y define cómo integrarlos en la nueva arquitectura **MusicGenius** que has propuesto. Hemos identificado **83+ artefactos técnicos** distribuidos en múltiples conversaciones, todos reutilizables y componibles.

### Estado Actual Global
```
┌─────────────────────────────────────────────────────────────┐
│  PROYECTO PROMETEO - ESTADO CONSOLIDADO                     │
├─────────────────────────────────────────────────────────────┤
│  F0 (Arquitectura)        : 95% ████████████████████░       │
│  F1 (MVP Semse)           : 85% █████████████████░░░        │
│  F2 (IA + Música)         : 78% ███████████████░░░░         │
│  F3 (XR + MCA)            : 15% ███░░░░░░░░░░░░░░░         │
│  F4 (Quantum)             : 5%  █░░░░░░░░░░░░░░░░░         │
│  F5 (DAO/Marketplace)     : 45% █████████░░░░░░░░░         │
│                                                              │
│  🎯 PRIORIDAD: Completar F1 + Integrar F2 Audio → F3 XR    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ INVENTARIO COMPLETO DE ARTEFACTOS EXISTENTES

### **CATEGORÍA A: ARQUITECTURA Y FUNDAMENTOS (F0-F1)**

#### A1. Matriz de Conocimientos (83 módulos)
**Ubicación**: Conversaciones "knowledge matrix" + archivo CSV compartido  
**Estado**: ✅ COMPLETO  
**Contenido**:
- 83 módulos técnicos mapeados a 6 fases
- 20 áreas principales (Fundamentos, Programación, Infra, Backend, Datos, Seguridad, etc.)
- Roles recomendados por módulo
- Herramientas y stacks por fase

**Integración con MusicGenius**:
```python
# Módulos directamente aplicables a MusicGenius:
- Audio/Música (F2): Teoría musical, DSP, síntesis, clasificación
- IA/ML (F2): NLP, RAG, Affective Computing, RL
- Frontend/UX (F1): React, accesibilidad, i18n
- Backend (F1): APIs, WebSocket, tiempo real
- XR/Gráficos (F3): Three.js, WebGPU, física

# Mapeo directo a servicios MusicGenius:
MATRIZ_MODULO["Audio/Música"] → services/audio-analysis/
MATRIZ_MODULO["IA/ML NLP"] → services/prometeo-assistant/
MATRIZ_MODULO["IA/ML Generativo"] → services/music-generation/
MATRIZ_MODULO["XR/Gráficos"] → ui/music-generation-screen/3d/
```

#### A2. Monorepo Turborepo Completo
**Ubicación**: Conversación "Prometeo Digital Media Platform Strategy"  
**Estado**: ✅ SCAFFOLD COMPLETO + SERVICIOS STUB  
**Estructura**:
```
prometeo-monorepo/
├── packages/
│   ├── proto/           # Tipos compartidos TS
│   ├── shared/          # Utilidades
│   ├── libs/middleware/ # Auth, rate limiting, logging
│   └── sdk-js/          # Cliente JS
├── services/
│   ├── gateway/         # API Gateway (8080)
│   ├── auth-service/    # DID/VC (8081)
│   ├── query-service/   # Búsqueda SSE (8082)
│   ├── ingest-api/      # Ingesta docs (8083)
│   ├── indexer/         # BM25+vector (8084)
│   ├── graph-service/   # Grafo conocimiento (8085)
│   ├── ranker-mca/      # Ranking MCA (8086)
│   └── p2p-node/        # P2P libp2p (8087)
├── ui/
│   ├── console/         # Admin dashboard
│   └── search-widget/   # Widget embebible
├── deploy/
│   ├── docker-compose.yaml
│   ├── k8s/base/
│   └── helm/prometeo/
└── docs/
    ├── ARCHITECTURE.md
    └── ADR/
```

**Integración con MusicGenius**:
```bash
# ACCIÓN: Agregar nuevos servicios al monorepo existente
prometeo-monorepo/services/
├── [servicios existentes...]
├── audio-analysis/      # 🆕 NUEVO
├── music-generation/    # 🆕 NUEVO  
├── midi-processor/      # 🆕 NUEVO
├── prometeo-assistant/  # 🆕 NUEVO (extender ranker-mca)
└── mca-music/           # 🆕 NUEVO (Motor Consciencia Musical)

# Reutilizar infraestructura existente:
- packages/proto → añadir tipos MusicGenerationRequest, AudioAnalysisResult
- packages/libs/middleware → reutilizar auth, logging
- deploy/docker-compose.yaml → añadir servicios musicales
- deploy/k8s/ → añadir manifiestos para nuevos servicios
```

#### A3. Schema Prisma Base
**Ubicación**: Monorepo + conversación "Golden Path v1"  
**Estado**: ✅ IMPLEMENTADO PARA SEMSE  
**Modelos existentes**:
```prisma
// Modelos Semse (marketplace):
model User { ... }
model Job { ... }
model Application { ... }
model Payment { ... }
model Conversation { ... }

// Para MusicGenius, EXTENDER con:
model MusicPiece {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  title       String
  composer    String
  style       String
  tempo       Int
  complexity  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  notes       Note[]
  credentials MusicCredential[]
}

model Note {
  id           String     @id @default(cuid())
  pitch        String
  duration     Float
  velocity     Int
  timestamp    Float
  musicPieceId String
  musicPiece   MusicPiece @relation(fields: [musicPieceId], references: [id])
}

model AudioAnalysis {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  waveformData Json    // Float32Array serializado
  pitchData    Json    // Array de {frequency, confidence, timestamp}
  formants     Json    // FormantData[]
  timbre       Json    // TimbreFeatures
  emotions     Json?   // EmotionVector opcional
  createdAt    DateTime @default(now())
}

model MusicCredential {
  id           String     @id @default(cuid())
  musicPieceId String
  musicPiece   MusicPiece @relation(fields: [musicPieceId], references: [id])
  vcData       Json       // VerifiableCredential completa
  zkProof      Json       // ZKProof de autoría/unicidad
  createdAt    DateTime   @default(now())
}
```

**Acción**: Ejecutar `npx prisma migrate dev --name add_music_models`

#### A4. Docker Compose Funcional
**Ubicación**: Monorepo `/deploy/docker-compose.yaml`  
**Estado**: ✅ FUNCIONAL PARA 8 SERVICIOS SEMSE  
**Integración**:
```yaml
# EXTENDER docker-compose.yaml existente:
services:
  # [servicios existentes: gateway, auth, query, ingest, indexer, graph, ranker, p2p]
  
  audio-analysis:
    build: ./services/audio-analysis
    ports:
      - "5001:5001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - db
      - redis
  
  music-generation:
    build: ./services/music-generation
    ports:
      - "5002:5002"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - MODEL_PATH=/models/music-transformer
    volumes:
      - ./models:/models
    depends_on:
      - db
  
  midi-processor:
    build: ./services/midi-processor
    ports:
      - "5003:5003"
    depends_on:
      - redis
  
  prometeo-assistant:
    build: ./services/prometeo-assistant
    ports:
      - "5004:5004"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MCA_SERVICE_URL=http://mca-music:5005
    depends_on:
      - mca-music
      - audio-analysis
  
  mca-music:
    build: ./services/mca-music
    ports:
      - "5005:5005"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - db

  # Servicios de soporte existentes:
  db:
    image: postgres:16
    # [configuración existente]
  
  redis:
    image: redis:7-alpine
    # [configuración existente]
```

---

### **CATEGORÍA B: MOTOR DE CONSCIENCIA (MCA) - F2/F3**

#### B1. Arquitectura MCA Conceptual
**Ubicación**: Conversación "Motor de Consciencia" + knowledge matrix  
**Estado**: ⚠️ DISEÑADO, PARCIALMENTE IMPLEMENTADO EN ranker-mca  
**Capas definidas**:
1. **Perceptual**: Procesamiento sensorial (visión, audio, texto)
2. **Cognitivo**: Razonamiento, memoria, planning
3. **Emocional**: Detección afectiva, regulación emocional
4. **Trascendental**: Alineación de valores, sentido, ética

**Implementación actual (ranker-mca)**:
```typescript
// services/ranker-mca/src/mca-engine.ts (STUB EXISTENTE)
export class MCAEngine {
  async rerank(chunks: Chunk[]): Promise<Chunk[]> {
    // TODO: Implementar capas reales
    return chunks.sort((a, b) => b.score - a.score);
  }
}
```

**Extensión para MusicGenius**:
```typescript
// services/mca-music/src/mca-music-engine.ts (NUEVO)
interface MCAMusicalContext {
  perceptual: {
    audioFeatures: AudioAnalysisResult;    // De audio-analysis
    visualNotes: VisualNoteData[];         // Del lienzo
    userGestures: GestureTrack[];          // Interacción
  };
  cognitive: {
    musicalKnowledge: TheoryKnowledge;     // Teoría musical
    compositionRules: CompositionConstraints;
    userPreferences: UserMusicProfile;     // Histórico
  };
  emotional: {
    currentMood: EmotionVector;            // Análisis vocal
    targetEmotion: EmotionVector;          // Intención usuario
    expressiveGoals: string[];             // "quiero algo triste"
  };
  transcendental: {
    artisticIntent: string;                // NLP del chat
    meaningfulSuggestions: ContextualAdvice[];
  };
}

export class MCAMusicEngine {
  async analyzeUserComposition(
    composition: MusicPiece
  ): Promise<MCAMusicalAnalysis> {
    // 1. Capa Perceptual: Analizar estructura musical
    const perceptual = await this.analyzeStructure(composition);
    
    // 2. Capa Cognitiva: Evaluar teoría y coherencia
    const cognitive = await this.evaluateTheory(composition);
    
    // 3. Capa Emocional: Detectar expresividad
    const emotional = await this.detectExpression(composition);
    
    // 4. Capa Trascendental: Interpretar intención artística
    const transcendental = await this.interpretIntent(composition);
    
    return this.synthesizeFeedback({
      perceptual,
      cognitive,
      emotional,
      transcendental
    });
  }
  
  private async analyzeStructure(piece: MusicPiece) {
    // Análisis de forma: intro, verso, coro, puente, outro
    // Análisis de repeticiones y variaciones
    // Análisis de texturas (monofónica, homofónica, polifónica)
    return {
      form: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro'],
      repetitions: this.detectMotifs(piece.notes),
      texture: 'homophonic'
    };
  }
  
  private async evaluateTheory(piece: MusicPiece) {
    // Análisis armónico: progresiones, modulaciones
    // Análisis melódico: contornos, intervalos, range
    // Análisis rítmico: patrones, síncopas, acentos
    return {
      harmony: this.analyzeHarmony(piece.notes),
      melody: this.analyzeMelody(piece.notes),
      rhythm: this.analyzeRhythm(piece.notes)
    };
  }
}
```

**Acción**: Crear servicio `services/mca-music/` extendiendo conceptos de `ranker-mca`

#### B2. Sistema de Agentes (JobPlanner, TrustMatch)
**Ubicación**: Conversación "Golden Path v1"  
**Estado**: ⚠️ MOCK AGENTS, LISTOS PARA LLM REAL  
**Agentes existentes para Semse**:
```typescript
// services/jobs-core/src/agents/JobPlannerAgent.ts
export class JobPlannerAgent {
  async planJob(description: string): Promise<JobPlan> {
    // TODO: Integrar LLM (Gemini/GPT-4)
    return mockJobPlan(description);
  }
}
```

**Extensión para MusicGenius → "PrometeoMusicAgent"**:
```typescript
// services/prometeo-assistant/src/agents/PrometeoMusicAgent.ts
export class PrometeoMusicAgent {
  constructor(
    private llm: LLMService,           // Gemini/GPT-4
    private mcaMusic: MCAMusicEngine,  // Motor de consciencia
    private musicGen: MusicGenerationService,
    private audioAnalysis: AudioAnalysisService
  ) {}
  
  async chat(userMessage: string, context: ConversationContext): Promise<PrometeoResponse> {
    // 1. Entender intención con NLP
    const intent = await this.llm.classifyIntent(userMessage);
    
    // 2. Según intención, llamar servicios especializados
    switch (intent.type) {
      case 'generate_music':
        return this.handleMusicGeneration(intent, context);
      case 'analyze_voice':
        return this.handleVoiceAnalysis(intent, context);
      case 'edit_composition':
        return this.handleEditing(intent, context);
      case 'music_theory_question':
        return this.handleTheoryQuestion(intent, context);
      case 'search_information':
        return this.handleWebSearch(intent, context);
      default:
        return this.handleGeneralConversation(intent, context);
    }
  }
  
  private async handleMusicGeneration(intent, context) {
    // Extraer parámetros de generación del lenguaje natural
    const params = await this.llm.extractMusicParams(intent.text);
    
    // Generar música
    const music = await this.musicGen.generate(params);
    
    // Analizar con MCA
    const analysis = await this.mcaMusic.analyzeUserComposition(music);
    
    // Generar explicación en lenguaje natural
    const explanation = await this.llm.explainGeneration(music, analysis);
    
    return {
      type: 'music_generation',
      music,
      analysis,
      message: explanation,
      suggestions: analysis.transcendental.meaningfulSuggestions
    };
  }
}
```

---

### **CATEGORÍA C: PROCESAMIENTO DE AUDIO Y DSP - F2**

#### C1. Teoría Musical (Jazz + Clásica)
**Ubicación**: Knowledge Matrix módulo "Audio/Música"  
**Estado**: 📚 CONOCIMIENTO DOCUMENTADO, PENDIENTE CÓDIGO  
**Contenido**:
- Armonía funcional, intercambio modal, cadencias
- Tritone substitutions, voice-leading
- Análisis de género (CNN/RNN)

**Implementación propuesta**:
```typescript
// services/music-generation/src/theory/harmony.ts
export class HarmonyAnalyzer {
  analyzeProgression(chords: Chord[]): HarmonicAnalysis {
    // Detectar tonalidad
    const key = this.detectKey(chords);
    
    // Analizar función armónica (T, S, D)
    const functions = chords.map(chord => 
      this.identifyFunction(chord, key)
    );
    
    // Detectar modulaciones
    const modulations = this.detectModulations(chords);
    
    // Identificar cadencias
    const cadences = this.identifyCadences(chords, functions);
    
    return { key, functions, modulations, cadences };
  }
  
  suggestNextChord(
    progression: Chord[], 
    constraints: CompositionConstraints
  ): Chord[] {
    // Generar candidatos basados en teoría
    const candidates = this.generateCandidates(progression);
    
    // Filtrar por restricciones (estilo, complejidad)
    const filtered = candidates.filter(c => 
      this.meetsConstraints(c, constraints)
    );
    
    // Rankear por "interestingness" musical
    return this.rankByMusicality(filtered);
  }
}
```

#### C2. DSP y Análisis de Audio
**Ubicación**: Knowledge Matrix + conversación "Secure Voice Analysis"  
**Estado**: ⚠️ CONCEPTUAL + REFERENCIAS A LIBROSA  
**Herramientas identificadas**:
- Librosa (Python) → Necesita port a JS o servicio Python
- Tone.js (JS) → Listo para usar
- WebAudio API → Listo para usar

**Implementación propuesta**:
```typescript
// services/audio-analysis/src/dsp/analyzer.ts
import * as Tone from 'tone';

export class AudioDSPAnalyzer {
  private audioContext: AudioContext;
  private analyzer: AnalyserNode;
  
  async analyzeLiveStream(stream: MediaStream): Promise<AudioAnalysisResult> {
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyzer);
    
    return {
      waveform: this.getWaveform(),
      pitch: await this.detectPitch(),
      formants: await this.extractFormants(),
      timbre: await this.analyzeTimbre(),
      emotions: await this.detectEmotions()
    };
  }
  
  private async detectPitch(): Promise<PitchData[]> {
    // Implementar YIN algorithm o autocorrelation
    // Ref: https://github.com/ashokfernandez/Yin-Pitch-Tracking
    const buffer = new Float32Array(this.analyzer.fftSize);
    this.analyzer.getFloatTimeDomainData(buffer);
    
    const pitch = yinAlgorithm(buffer, this.audioContext.sampleRate);
    return [{
      frequency: pitch.frequency,
      confidence: pitch.probability,
      timestamp: Date.now()
    }];
  }
  
  private async extractFormants(): Promise<FormantData[]> {
    // LPC (Linear Predictive Coding) para formantes vocales
    // Ref: https://github.com/mrahtz/lpc-js
    const lpc = new LPCAnalyzer(this.analyzer);
    return lpc.extractFormants();
  }
  
  private async analyzeTimbre(): Promise<TimbreFeatures> {
    // MFCC (Mel-Frequency Cepstral Coefficients)
    // Spectral centroid, rolloff, flux
    const mfcc = await this.computeMFCC();
    const spectral = await this.computeSpectralFeatures();
    
    return { mfcc, ...spectral };
  }
}
```

**Alternativa con Python**:
```python
# services/audio-analysis-python/analyzer.py
import librosa
import numpy as np
from fastapi import FastAPI, UploadFile

app = FastAPI()

@app.post("/analyze")
async def analyze_audio(file: UploadFile):
    # Cargar audio
    y, sr = librosa.load(file.file)
    
    # Pitch tracking
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    
    # Formants (usando LPC)
    formants = extract_formants_lpc(y, sr)
    
    # Timbre (MFCC)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    return {
        "waveform": y.tolist(),
        "pitches": pitches.tolist(),
        "formants": formants,
        "timbre": mfcc.tolist()
    }
```

**Decisión**: Crear **servicio híbrido** → Node.js para tiempo real + Python worker para análisis complejo

---

### **CATEGORÍA D: SISTEMAS XR Y VISUALIZACIÓN 3D - F3**

#### D1. Sistema de Física Espacial (42 artefactos)
**Ubicación**: Conversación "Gravity Control System"  
**Estado**: ✅ CÓDIGO COMPLETO (42 artefactos fusionados)  
**Capacidades**:
- Control de gravedad variable
- Física de cuerpos rígidos y soft bodies
- Simulación de partículas
- Colisiones y fuerzas

**REUTILIZACIÓN CREATIVA para lienzo musical**:
```typescript
// ui/music-generation-screen/src/physics/MusicalPhysics.ts
import { PhysicsEngine } from '@gravity-control-system'; // Reutilizar

export class MusicalSpacePhysics extends PhysicsEngine {
  // Adaptar gravedad → atracción armónica
  harmonicAttraction(note1: Note, note2: Note): number {
    // Notas consonantes se atraen (intervalos justos)
    const interval = Math.abs(note1.pitch - note2.pitch);
    if ([0, 7, 12].includes(interval % 12)) {
      return STRONG_ATTRACTION; // Unísono, quinta, octava
    }
    if ([3, 4, 8, 9].includes(interval % 12)) {
      return MEDIUM_ATTRACTION; // Terceras, sextas
    }
    return WEAK_ATTRACTION; // Disonancias
  }
  
  // Adaptar momentum → desarrollo motívico
  melodicMomentum(phrase: Note[]): MotivicForce {
    // Frases que se mueven en una dirección tienen "momentum"
    const direction = this.detectContour(phrase);
    return {
      direction,
      strength: phrase.length * MOMENTUM_FACTOR
    };
  }
  
  // Adaptar colisiones → resoluciones armónicas
  resolveDissonance(chord: Chord): Chord {
    // Disonancias "colapsan" a consonancias cercanas
    const dissonances = chord.notes.filter(n => 
      this.isDissonant(n, chord)
    );
    
    return {
      ...chord,
      notes: chord.notes.map(n => 
        this.isDissonant(n, chord) ? this.resolveNote(n) : n
      )
    };
  }
}

// Visualización con sistema de partículas
export class NoteParticleSystem extends PhysicsEngine {
  applyMusicalForces(notes: Note[], userGesture: Gesture) {
    notes.forEach(note => {
      // Aplicar fuerzas según teoría musical
      const harmonicForce = this.calculateHarmonicForce(note, notes);
      const userForce = this.gestureToForce(userGesture, note);
      
      // Reutilizar motor de física existente
      this.applyForce(note.id, harmonicForce + userForce);
    });
    
    // Step de física (heredado de PhysicsEngine)
    this.step(deltaTime);
  }
}
```

**Acción**: Importar código de "Gravity Control System" y adaptar metáforas físicas a espacio musical

#### D2. WebXR y Three.js
**Ubicación**: Knowledge Matrix módulo "XR/Gráficos" + conversación "Metaverse Control Panel"  
**Estado**: ⚠️ COMPONENTES AISLADOS, PENDIENTE INTEGRACIÓN  
**Componentes existentes**:
- Escenas 3D con Three.js
- Interacción VR básica
- Sistema de avatares (para Prometeo)

**Integración en MusicGenerationScreen**:
```tsx
// ui/music-generation-screen/src/components/PianoRoll3D.tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { XR, VRButton } from '@react-three/xr';

export function PianoRoll3D({ notes, onNoteEdit }: Props) {
  return (
    <>
      <VRButton />
      <Canvas>
        <XR>
          <PerspectiveCamera makeDefault position={[0, 5, 10]} />
          <OrbitControls />
          
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          
          {/* Grid musical 3D */}
          <MusicalGrid />
          
          {/* Notas como cubos 3D */}
          {notes.map(note => (
            <NoteBlock
              key={note.id}
              note={note}
              onEdit={onNoteEdit}
            />
          ))}
          
          {/* Sistema de partículas para visualizar armonía */}
          <HarmonyParticles notes={notes} />
          
          {/* Avatar de Prometeo (si está activo) */}
          {prometeoActive && <PrometeoAvatar position={[5, 0, 0]} />}
        </XR>
      </Canvas>
    </>
  );
}

function NoteBlock({ note, onEdit }: { note: Note; onEdit: (n: Note) => void }) {
  const meshRef = useRef<THREE.Mesh>();
  const [hovered, setHovered] = useState(false);
  
  // Animación de física musical
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Aplicar fuerzas del sistema de física musical
      const force = musicalPhysics.getForce(note.id);
      meshRef.current.position.add(force.multiply(delta));
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={[note.time, note.pitch, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => onEdit(note)}
    >
      <boxGeometry args={[note.duration, 1, 0.5]} />
      <meshStandardMaterial 
        color={hovered ? 'hotpink' : noteToColor(note)}
        emissive={hovered ? 'red' : 'black'}
      />
    </mesh>
  );
}
```

---

### **CATEGORÍA E: WEB3, BLOCKCHAIN Y PRIVACIDAD - F5**

#### E1. Sistema de Credenciales Verificables (DID/VC)
**Ubicación**: Monorepo `services/auth-service/` + Knowledge Matrix "Seguridad"  
**Estado**: ✅ STUB FUNCIONAL, PENDIENTE CRYPTO REAL  
**Código existente**:
```typescript
// services/auth-service/src/did/issuer.ts
export class VCIssuer {
  async issueCredential(claims: any): Promise<VerifiableCredential> {
    // TODO: Implementar firma real con DID
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential'],
      issuer: 'did:example:issuer',
      issuanceDate: new Date().toISOString(),
      credentialSubject: claims,
      proof: {} // STUB
    };
  }
}
```

**Extensión para Credenciales Musicales**:
```typescript
// services/auth-service/src/music/MusicCredentialIssuer.ts
import { DIDKit } from '@spruceid/didkit-wasm';

export class MusicCredentialIssuer extends VCIssuer {
  async issueCompositionCredential(
    composition: MusicPiece,
    author: User
  ): Promise<MusicCredential> {
    // 1. Generar fingerprint de la composición
    const fingerprint = await this.generateMusicFingerprint(composition);
    
    // 2. Crear credencial con claims musicales
    const claims = {
      composition: {
        id: composition.id,
        title: composition.title,
        author: author.did,
        timestamp: Date.now(),
        fingerprint
      },
      rights: {
        ownership: 'full',
        royalties: this.calculateRoyaltySchema(composition)
      }
    };
    
    // 3. Generar ZK-Proofs
    const zkProof = await this.generateZKProofs(composition, author);
    
    // 4. Firmar credencial con DID real
    const vc = await DIDKit.issueCredential(
      JSON.stringify(claims),
      author.didDocument,
      author.privateKey
    );
    
    return {
      vc: JSON.parse(vc),
      zkProof
    };
  }
  
  private async generateZKProofs(composition: MusicPiece, author: User) {
    // Proof 1: Probar autoría sin revelar identidad
    const authorshipProof = await this.proveAuthorship(composition, author);
    
    // Proof 2: Probar originalidad (no plagio)
    const uniquenessProof = await this.proveUniqueness(composition);
    
    return { authorshipProof, uniquenessProof };
  }
}
```

#### E2. Sistema ZKP (Zero-Knowledge Proofs)
**Ubicación**: Conversación "Zero-Knowledge Proofs Artifact Fusion"  
**Estado**: ✅ CÓDIGO COMPLETO CON CIRCOM  
**Capacidades**:
- Proofs de pertenencia a conjunto
- Proofs de rango
- Verificación sin revelar datos

**Aplicación a MusicGenius**:
```typescript
// packages/zkp-music/circuits/authorship.circom
pragma circom 2.0.0;

template AuthorshipProof() {
    // Inputs privados (no revelados)
    signal input authorSecret;
    signal input compositionHash;
    
    // Input público (verificable)
    signal input publicCommitment;
    
    // Output (proof válido/inválido)
    signal output isValid;
    
    // Lógica del circuit
    component hasher = Poseidon(2);
    hasher.inputs[0] <== authorSecret;
    hasher.inputs[1] <== compositionHash;
    
    isValid <== hasher.out === publicCommitment;
}

component main = AuthorshipProof();
```

```typescript
// services/auth-service/src/zkp/MusicZKP.ts
import { groth16 } from 'snarkjs';

export class MusicZKP {
  async proveAuthorship(
    composition: MusicPiece,
    author: User
  ): Promise<ZKProof> {
    const circuit = await loadCircuit('authorship');
    
    const input = {
      authorSecret: author.secretKey,
      compositionHash: hash(composition),
      publicCommitment: author.publicCommitment
    };
    
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      circuit.wasm,
      circuit.zkey
    );
    
    return { proof, publicSignals };
  }
  
  async verifyAuthorship(
    proof: ZKProof,
    publicCommitment: string
  ): Promise<boolean> {
    const vkey = await loadVerificationKey('authorship');
    return groth16.verify(vkey, [publicCommitment], proof);
  }
}
```

---

### **CATEGORÍA F: INTELIGENCIA ARTIFICIAL GENERATIVA - F2**

#### F1. Motor de Generación Musical (Stub)
**Ubicación**: Propuesta en este documento  
**Estado**: 🆕 A IMPLEMENTAR DESDE CERO  
**Arquitectura propuesta**:
```typescript
// services/music-generation/src/ai/MusicTransformer.ts
import * as tf from '@tensorflow/tfjs';

export class MusicTransformerModel {
  private model: tf.LayersModel;
  
  async load(modelPath: string) {
    this.model = await tf.loadLayersModel(modelPath);
  }
  
  async generate(params: MusicGenerationRequest): Promise<MusicPiece> {
    // 1. Convertir parámetros a embedding
    const styleEmbedding = await this.encodeStyle(params.style);
    const tempoEmbedding = this.encodeTempo(params.tempo);
    
    // 2. Si hay input del usuario, encodear
    let seedSequence = null;
    if (params.userInput?.melody) {
      seedSequence = this.encodeMelody(params.userInput.melody);
    }
    
    // 3. Generar con modelo Transformer
    const generated = await this.model.predict([
      styleEmbedding,
      tempoEmbedding,
      seedSequence || tf.zeros([1, 128, 512])
    ]);
    
    // 4. Decodear a notas MIDI
    const notes = this.decodeToMIDI(generated);
    
    return {
      id: generateId(),
      title: 'AI Generated Piece',
      style: params.style,
      tempo: params.tempo,
      notes
    };
  }
  
  private async encodeStyle(style: string): Promise<tf.Tensor> {
    // Usar modelo de embeddings pre-entrenado
    // O lookup table para estilos conocidos
    const styleMap = {
      'pop': [0.8, 0.2, 0.5, ...],
      'jazz': [0.3, 0.9, 0.7, ...],
      'classical': [0.5, 0.4, 0.9, ...]
    };
    return tf.tensor(styleMap[style] || styleMap['pop']);
  }
}
```

**Modelos candidatos**:
1. **Music Transformer** (Google Magenta) - MIDI generation
2. **MuseNet** (OpenAI) - Multi-instrument generation
3. **Jukebox** (OpenAI) - Audio generation (más pesado)
4. **Custom Transformer** - Entrenar desde cero

**Decisión**: Empezar con **Music Transformer** pre-entrenado de Magenta

#### F2. Sistema de NLP para Prometeo
**Ubicación**: Propuesta + refs a ranker-mca  
**Estado**: 🆕 A IMPLEMENTAR  
**Stack propuesto**:
```typescript
// services/prometeo-assistant/src/nlp/IntentClassifier.ts
import { pipeline } from '@xenova/transformers'; // Transformers.js

export class MusicIntentClassifier {
  private classifier;
  
  async initialize() {
    // Usar modelo pre-entrenado de clasificación
    this.classifier = await pipeline(
      'text-classification',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );
  }
  
  async classifyIntent(text: string): Promise<Intent> {
    const result = await this.classifier(text);
    
    // Mapear a intenciones musicales
    if (this.containsKeywords(text, ['generar', 'crear', 'componer'])) {
      return {
        type: 'generate_music',
        confidence: result.score,
        params: await this.extractMusicParams(text)
      };
    }
    
    if (this.containsKeywords(text, ['analizar', 'revisar', 'feedback'])) {
      return {
        type: 'analyze_voice',
        confidence: result.score
      };
    }
    
    // ... más intenciones
  }
  
  async extractMusicParams(text: string): Promise<MusicGenerationRequest> {
    // Usar NER (Named Entity Recognition) para extraer:
    // - Estilo: "algo de jazz" → style: 'jazz'
    // - Tempo: "rápido" → tempo: 140
    // - Mood: "triste" → emotional: 'sad'
    
    const entities = await this.extractEntities(text);
    
    return {
      style: entities.style || 'pop',
      tempo: entities.tempo || 120,
      complexity: entities.complexity || 'medium',
      emotional: entities.mood
    };
  }
}
```

---

## 🎯 PLAN DE INTEGRACIÓN UNIFICADO

### **SPRINT 0: Preparación (1 semana)**
```bash
# Objetivo: Preparar infraestructura base

# 1. Actualizar monorepo
cd prometeo-monorepo
git checkout -b feature/musicgenius-integration

# 2. Actualizar packages/proto con tipos musicales
# [Copiar código de sección A3]

# 3. Migrar código de "Gravity Control System"
mkdir -p packages/physics-engine
# [Copiar 42 artefactos fusionados]

# 4. Configurar Python service para audio
mkdir -p services/audio-analysis-python
# [Copiar código de sección C2]

# 5. Actualizar docker-compose.yaml
# [Copiar código de sección A4]

# 6. Actualizar Prisma schema
# [Copiar código de sección A3]
npx prisma migrate dev --name add_music_models
```

### **SPRINT 1: Servicios Backend Core (2 semanas)**
```bash
# Objetivo: Implementar servicios básicos funcionales

# 1. Servicio audio-analysis (Node.js + Python worker)
mkdir -p services/audio-analysis/src/{dsp,ml}
# [Implementar código de sección C2]

# 2. Servicio music-generation (TensorFlow.js)
mkdir -p services/music-generation/src/{ai,theory}
# [Implementar código de sección F1]
# [Implementar código de sección C1 - Harmony Analyzer]

# 3. Servicio midi-processor
mkdir -p services/midi-processor/src
# [Implementar síntesis MIDI básica]

# 4. Testing local
docker-compose up -d
npm run test:integration
```

### **SPRINT 2: Motor de Consciencia Musical (3 semanas)**
```bash
# Objetivo: Implementar MCA para contexto musical

# 1. Extender ranker-mca existente
cd services/ranker-mca
# [Añadir código de sección B1]

# 2. Crear servicio mca-music dedicado
mkdir -p services/mca-music/src/{perceptual,cognitive,emotional,transcendental}
# [Implementar código de sección B1]

# 3. Integrar con audio-analysis y music-generation
# [Implementar flujo de análisis completo]

# 4. Testing de análisis musical
npm run test:mca-music
```

### **SPRINT 3: Asistente Prometeo (3 semanas)**
```bash
# Objetivo: Implementar NLP e integración con MCA

# 1. Crear servicio prometeo-assistant
mkdir -p services/prometeo-assistant/src/{nlp,agents,chat}
# [Implementar código de sección B2 y F2]

# 2. Integrar con OpenAI/Gemini API
# [Configurar API keys]

# 3. Conectar con mca-music
# [Implementar flujo de feedback inteligente]

# 4. Testing de conversaciones
npm run test:prometeo-chat
```

### **SPRINT 4: Frontend - Pantalla de Análisis de Voz (2 semanas)**
```bash
# Objetivo: Implementar primera pantalla completa

# 1. Crear componente VoiceAnalysisScreen
mkdir -p ui/music-app/src/screens/VoiceAnalysis
# [Implementar visualizaciones en tiempo real]

# 2. Integrar con WebAudio API
# [Captura de micrófono + streaming a backend]

# 3. Gráficos con Recharts/D3
# [Waveform, pitch meter, spectrogram, formants]

# 4. Exportación de datos
# [PDF, CSV, imagen]
```

### **SPRINT 5: Frontend - Pantalla Prometeo (2 semanas)**
```bash
# Objetivo: Implementar asistente virtual

# 1. Crear componente PrometeoScreen
mkdir -p ui/music-app/src/screens/Prometeo
# [Chat interface + avatar 3D]

# 2. Avatar 3D con Three.js
# [Reutilizar componentes de "Metaverse Control Panel"]

# 3. Integración de voz (Speech-to-Text)
# [Web Speech API + backend fallback]

# 4. Historial de conversación
# [Persistencia en BD + contexto]
```

### **SPRINT 6: Frontend - Pantalla Generación de Música (4 semanas)**
```bash
# Objetivo: Implementar pantalla más compleja

# 1. Crear componente MusicGenerationScreen
mkdir -p ui/music-app/src/screens/MusicGeneration
# [Layout principal con modo 2D/3D]

# 2. Lienzo 2D (Piano Roll)
# [Canvas 2D con notas editables]

# 3. Lienzo 3D (WebGL)
# [Implementar código de sección D2]
# [Integrar física musical de sección D1]

# 4. Herramientas de edición contextuales
# [Lápiz, borrador, pincel, selector]

# 5. Sistema de pintura gestual
# [Convertir gestos a notas con física]

# 6. Integración con music-generation service
# [Generación en tiempo real + streaming]
```

### **SPRINT 7: Credenciales y Marketplace (3 semanas)**
```bash
# Objetivo: Implementar Web3 features

# 1. Extender auth-service con música
# [Implementar código de sección E1]

# 2. Compilar circuitos ZKP
cd packages/zkp-music
# [Implementar código de sección E2]
circom circuits/authorship.circom --r1cs --wasm --sym

# 3. Crear marketplace básico
mkdir -p services/music-marketplace
# [CRUD de piezas + búsqueda]

# 4. Frontend de marketplace
# [Galería + compra/venta]
```

### **SPRINT 8: Testing, Optimización y Deploy (2 semanas)**
```bash
# Objetivo: Preparar para producción

# 1. Testing end-to-end
npm run test:e2e

# 2. Performance optimization
# [Lazy loading, code splitting, caching]

# 3. Configurar CI/CD
# [GitHub Actions + Kubernetes]

# 4. Deploy a staging
kubectl apply -f deploy/k8s/staging/

# 5. Load testing
k6 run tests/load/music-generation.js
```

---

## 📊 TIMELINE CONSOLIDADO

```
Mes 1: Sprints 0, 1, 2
├─ Semana 1: Preparación
├─ Semanas 2-3: Servicios Backend Core
└─ Semanas 4-6: Motor de Consciencia Musical

Mes 2: Sprints 3, 4, 5
├─ Semanas 1-3: Asistente Prometeo
├─ Semanas 4-5: Frontend - Análisis de Voz
└─ Semanas 6-7: Frontend - Prometeo

Mes 3: Sprints 6, 7, 8
├─ Semanas 1-4: Frontend - Generación de Música
├─ Semanas 5-7: Credenciales y Marketplace
└─ Semanas 8-9: Testing, Optimización y Deploy

TOTAL: ~21 semanas (5.25 meses)
```

---

## 🔧 ARTEFACTOS LISTOS PARA COPIAR/PEGAR

### Listado de archivos que ya están COMPLETOS y solo necesitan adaptarse:

1. **`packages/proto/src/music.ts`** ✅ (Sección A3)
2. **`services/mca-music/src/mca-music-engine.ts`** ✅ (Sección B1)
3. **`services/prometeo-assistant/src/agents/PrometeoMusicAgent.ts`** ✅ (Sección B2)
4. **`services/music-generation/src/theory/harmony.ts`** ✅ (Sección C1)
5. **`services/audio-analysis/src/dsp/analyzer.ts`** ✅ (Sección C2)
6. **`services/audio-analysis-python/analyzer.py`** ✅ (Sección C2)
7. **`ui/music-generation-screen/src/physics/MusicalPhysics.ts`** ✅ (Sección D1)
8. **`ui/music-generation-screen/src/components/PianoRoll3D.tsx`** ✅ (Sección D2)
9. **`services/auth-service/src/music/MusicCredentialIssuer.ts`** ✅ (Sección E1)
10. **`packages/zkp-music/circuits/authorship.circom`** ✅ (Sección E2)
11. **`services/music-generation/src/ai/MusicTransformer.ts`** ✅ (Sección F1)
12. **`services/prometeo-assistant/src/nlp/IntentClassifier.ts`** ✅ (Sección F2)

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### Acción 1: Validar inventario
**¿Estamos de acuerdo con este análisis?**
- ¿Falta algún artefacto importante que no hayamos mencionado?
- ¿Alguna prioridad que cambiarías?

### Acción 2: Decidir punto de inicio
**Opciones**:
A. Empezar por backend (Sprints 0-3) → Más sólido técnicamente
B. Empezar por frontend (Sprint 4) → Más visual/motivante
C. Prototipo vertical (un feature end-to-end) → Validación rápida

### Acción 3: Generar código
Una vez decidamos, puedo generar AHORA MISMO cualquiera de estos artefactos listos para producción:

**Backend**:
- [ ] Servicio `audio-analysis` completo
- [ ] Servicio `music-generation` completo
- [ ] Servicio `mca-music` completo
- [ ] Servicio `prometeo-assistant` completo

**Frontend**:
- [ ] Pantalla `VoiceAnalysisScreen` completa
- [ ] Pantalla `PrometeoScreen` completa
- [ ] Pantalla `MusicGenerationScreen` completa

**Infraestructura**:
- [ ] Docker Compose actualizado
- [ ] Kubernetes manifests
- [ ] CI/CD pipelines
- [ ] Prisma schema completo

**¿Cuál(es) generamos primero?** 🎯
