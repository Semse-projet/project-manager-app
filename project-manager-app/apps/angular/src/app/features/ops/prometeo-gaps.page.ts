import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AssistantStore } from '../../core/assistant/assistant.store';

type RadarItem = { label: string; pct: number; color: string; present: boolean };
type GapAction = string;
type Gap = {
  urgencyLabel: string;
  urgencyBg: string;
  urgencyColor: string;
  accentColor: string;
  title: string;
  why: string;
  connects: string;
  actions: GapAction[];
  prompt: string;
};

@Component({
  standalone: true,
  selector: 'app-prometeo-gaps-page',
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Análisis Estratégico</span>
          <h1 class="page-title">Brechas detectadas en Prometeo</h1>
          <p class="page-copy">
            Cobertura actual del ecosistema vs. los pilares que necesita para escalar.
            Tres áreas críticas requieren atención antes del lanzamiento de SEMSE OS.
          </p>
        </div>
      </section>

      <!-- Summary metrics -->
      <div class="summary-grid">
        <div class="metric-card">
          <div class="metric-label">Temas presentes</div>
          <div class="metric-value" style="color: var(--success)">6</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Brechas críticas</div>
          <div class="metric-value" style="color: var(--danger)">3</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cobertura estimada</div>
          <div class="metric-value">67%</div>
        </div>
      </div>

      <!-- Radar coverage -->
      <section class="section-card radar-card">
        <div class="card-head">
          <span class="section-label">Cobertura actual vs. ecosistema completo</span>
        </div>
        <div class="radar-body">
          @for (item of radar; track item.label) {
            <div class="radar-row">
              <div class="radar-name" [class.present]="item.present" [class.absent]="!item.present">
                {{ item.present ? '✓' : '✗' }} {{ item.label }}
              </div>
              <div class="radar-bar-bg">
                <div class="radar-bar" [style.width.%]="item.pct" [style.background]="item.color"></div>
              </div>
              <div class="radar-pct">{{ item.pct }}%</div>
            </div>
          }
        </div>
      </section>

      <!-- Gap cards -->
      <div class="section-label gaps-label">Brechas detectadas — haz clic para expandir</div>

      @for (gap of gaps; track gap.title; let i = $index) {
        <div
          class="gap-card"
          [class.is-open]="open()[i]"
          [style.border-left-color]="gap.accentColor"
          (click)="toggle(i)"
        >
          <div class="gap-header">
            <span
              class="urgency-badge"
              [style.background]="gap.urgencyBg"
              [style.color]="gap.urgencyColor"
            >{{ gap.urgencyLabel }}</span>
            <span class="gap-title">{{ gap.title }}</span>
            <span class="chevron" [class.is-open]="open()[i]">▶</span>
          </div>

          @if (open()[i]) {
            <div class="gap-body">
              <p class="gap-why">{{ gap.why }}</p>
              <p class="gap-connects">
                <span class="connects-label">Se conecta con:</span> {{ gap.connects }}
              </p>
              <div class="section-label" style="margin-bottom: 6px">Acciones concretas</div>
              <div class="action-list">
                @for (action of gap.actions; track action) {
                  <div class="action-item">
                    <span class="action-dot" [style.background]="gap.accentColor"></span>
                    <span>{{ action }}</span>
                  </div>
                }
              </div>
              <div class="gap-footer">
                <button
                  class="btn-ghost ask-btn"
                  (click)="$event.stopPropagation(); sendPrompt(gap.prompt)"
                >Pedir ayuda al asistente ↗</button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Global action buttons -->
      <div class="quick-actions">
        <button class="btn-secondary ask-btn" (click)="sendPrompt(gaps[0].prompt)">
          Crear modelo de negocio para Prometeo ↗
        </button>
        <button class="btn-secondary ask-btn" (click)="sendPrompt(gaps[1].prompt)">
          Estructura del equipo ↗
        </button>
        <button class="btn-secondary ask-btn" (click)="sendPrompt(gaps[2].prompt)">
          Risk Matrix F1–F5 ↗
        </button>
      </div>
    </div>
  `,
  styles: [`
    .summary-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .metric-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .radar-card {
      padding: 22px 26px;
    }

    .card-head {
      margin-bottom: 18px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .gaps-label {
      margin-top: 4px;
    }

    .radar-body {
      display: grid;
      gap: 10px;
    }

    .radar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .radar-name {
      font-size: 12px;
      width: 220px;
      flex-shrink: 0;
    }

    .radar-name.present { color: var(--success); }
    .radar-name.absent  { color: var(--danger); }

    .radar-bar-bg {
      flex: 1;
      height: 6px;
      background: var(--surface-muted);
      border-radius: 3px;
      overflow: hidden;
    }

    .radar-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }

    .radar-pct {
      font-size: 11px;
      color: var(--muted);
      width: 32px;
      text-align: right;
    }

    /* Gap cards */
    .gap-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left-width: 3px;
      border-radius: var(--radius-lg);
      padding: 18px 20px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .gap-card:hover {
      box-shadow: var(--shadow-md);
    }

    .gap-card.is-open {
      background:
        linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(12, 16, 23, 0.95));
    }

    .gap-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .urgency-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .gap-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink);
      flex: 1;
    }

    .chevron {
      font-size: 11px;
      color: var(--muted);
      transition: transform 0.2s;
    }

    .chevron.is-open {
      transform: rotate(90deg);
    }

    .gap-body {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }

    .gap-why {
      font-size: 13px;
      color: var(--ink);
      line-height: 1.7;
      margin-bottom: 12px;
    }

    .gap-connects {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 14px;
    }

    .connects-label {
      font-weight: 600;
      color: var(--ink);
    }

    .action-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .action-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.55;
    }

    .action-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 5px;
    }

    .gap-footer {
      margin-top: 4px;
    }

    .ask-btn {
      font-size: 12px;
      min-height: 36px;
      padding: 0 14px;
    }

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    @media (max-width: 720px) {
      .radar-name { width: 150px; font-size: 11px; }
    }
  `],
})
export class PrometeoGapsPageComponent {
  private readonly assistant = inject(AssistantStore);

  protected readonly open = signal<boolean[]>([false, false, false]);

  protected toggle(i: number): void {
    this.open.update((states) => states.map((s, idx) => (idx === i ? !s : s)));
  }

  protected sendPrompt(text: string): void {
    this.assistant.send(text, '/admin/prometeo');
  }

  protected readonly radar: RadarItem[] = [
    { label: 'Aprendizaje por fases',        pct: 95, color: '#378ADD', present: true },
    { label: 'Arquitectura de sistemas',      pct: 90, color: '#7F77DD', present: true },
    { label: 'Tecnologías convergentes',      pct: 88, color: '#1D9E75', present: true },
    { label: 'IA aplicada',                   pct: 85, color: '#D85A30', present: true },
    { label: 'Producto comercial',            pct: 78, color: '#BA7517', present: true },
    { label: 'Identidad del desarrollador',   pct: 70, color: '#D4537E', present: true },
    { label: 'Gestión de comunidad y red',    pct: 15, color: '#ef4444', present: false },
    { label: 'Modelo de negocio y sostenibilidad', pct: 20, color: '#ef4444', present: false },
    { label: 'Resiliencia y gestión de riesgos',   pct: 25, color: '#ef4444', present: false },
  ];

  protected readonly gaps: Gap[] = [
    {
      urgencyLabel: 'Urgente para lanzamiento',
      urgencyBg: 'rgba(239,68,68,0.12)',
      urgencyColor: '#f87171',
      accentColor: '#ef4444',
      title: 'Modelo de negocio y sostenibilidad financiera',
      why: 'Tienes arquitectura técnica de primer nivel, pero los documentos no muestran un modelo de negocio explícito y documentado. ¿Cómo escala el revenue más allá de SEMSE OS? ¿Qué margen tiene el marketplace? ¿Cómo se financia F2–F5? El Stripe Connect está como "blocker técnico", pero la estrategia de monetización es el blocker de negocio.',
      connects: 'Producto comercial (directamente), Arquitectura (decisiones técnicas dependen del modelo), IA aplicada (freemium vs. enterprise cambia todo).',
      actions: [
        'Documenta el unit economics de SEMSE OS: CAC, LTV, comisión por transacción, precio del SaaS B2B.',
        'Define el modelo de cada fase futura: ¿F2 (AI Multimodal) es suscripción? ¿F4 (XR) es licencia?',
        'Crea un runway financial document: inversión necesaria vs. revenue proyectado por fase.',
      ],
      prompt: 'Ayúdame a crear un modelo de negocio documentado para Proyecto Prometeo y SEMSE OS',
    },
    {
      urgencyLabel: 'Importante para escalar',
      urgencyBg: 'rgba(245,158,11,0.12)',
      urgencyColor: '#fbbf24',
      accentColor: '#f59e0b',
      title: 'Gestión de comunidad, red y ecosistema humano',
      why: 'Prometeo es un ecosistema — pero los documentos se enfocan casi exclusivamente en la arquitectura técnica y en ti como arquitecto. Falta la dimensión humana: ¿quiénes son los otros 7 miembros del equipo y cómo se documenta su rol? ¿Cómo se construye la comunidad de constructores y contratistas en SEMSE OS? Un ecosistema sin comunidad activa es solo software.',
      connects: 'Producto comercial (el marketplace necesita masa crítica de usuarios), Identidad del desarrollador (liderazgo de equipo), Tecnologías (Web3 implica gobernanza descentralizada).',
      actions: [
        'Crea un Community Playbook: estrategia de adquisición de constructores y contratistas para SEMSE OS.',
        'Documenta roles del equipo de 8 personas con ownership explícito por módulo.',
        'Define el modelo de gobernanza para cuando Prometeo incorpore Web3 / DAOs en fases posteriores.',
      ],
      prompt: '¿Cómo debería estructurar la gestión del equipo de 8 personas en Proyecto Prometeo?',
    },
    {
      urgencyLabel: 'Estratégico a mediano plazo',
      urgencyBg: 'rgba(139,92,246,0.12)',
      urgencyColor: '#a78bfa',
      accentColor: '#8b5cf6',
      title: 'Resiliencia, gestión de riesgos y continuidad',
      why: 'Hay una paradoja interesante: construiste un Business Continuity Plan con War Room y simulación de incidentes para SEMSE OS — pero eso es resiliencia técnica. Lo que falta es resiliencia estratégica: ¿qué pasa si una tecnología clave (Web3, Quantum) no madura a tiempo? ¿Cuál es el Plan B para cada fase? Los ecosistemas ambiciosos mueren más por falta de Plan B que por falta de visión.',
      connects: 'Todas las fases F0–F5, Modelo de negocio, Aprendizaje por fases (los pivots deben estar documentados).',
      actions: [
        'Crea una Risk Matrix por fase: probabilidad × impacto de que cada tecnología clave falle o se retrase.',
        'Define criterios de pivot: ¿en qué condición se repriorizan fases o se descarta una tecnología?',
        'Documenta las dependencias externas críticas (proveedores, APIs, regulaciones) con alternativas.',
      ],
      prompt: 'Crea una Risk Matrix para las fases F1 a F5 de Proyecto Prometeo',
    },
  ];
}
