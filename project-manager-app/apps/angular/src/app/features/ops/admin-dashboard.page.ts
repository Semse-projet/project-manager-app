import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-admin-dashboard-page',
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Control Tower</span>
          <h1 class="page-title">Angular ya puede ser la nueva cara del ecosistema.</h1>
          <p class="page-copy">
            El backend operativo sigue en NestJS y esta capa ahora tiene login, shell, dashboard cliente,
            leads y constructor conversacional de proyectos.
          </p>
        </div>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <span class="pill">Frontend base</span>
          <div class="metric-value">Lista</div>
          <p>Arquitectura standalone con rutas protegidas, interceptores y panel flotante de asistente.</p>
        </article>
        <article class="metric-card">
          <span class="pill">Backbone</span>
          <div class="metric-value">Nest + Angular</div>
          <p>El siguiente paso es extender modulos del cliente, profesional y operaciones sin tocar el core del API.</p>
        </article>
      </section>
    </div>
  `,
})
export class AdminDashboardPageComponent {}
