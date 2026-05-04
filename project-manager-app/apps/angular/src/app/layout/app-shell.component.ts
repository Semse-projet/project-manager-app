import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { RouteContextService } from '../core/routing/route-context.service';
import { AssistantDockComponent } from './assistant-dock.component';

type NavItem = {
  label: string;
  href: string;
  caption: string;
};

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, AssistantDockComponent],
  template: `
    <div class="shell">
      <div class="shell__scrim" [class.is-open]="navOpen()" (click)="navOpen.set(false)"></div>

      <aside class="shell__rail" [class.is-open]="navOpen()">
        <div class="shell__brand">
          <div class="shell__brand-badge">SE</div>
          <div>
            <strong>SEMSE OS</strong>
            <span>Ecosistema operativo</span>
          </div>
        </div>

        <nav class="shell__nav">
          @for (item of navItems(); track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="is-active"
              class="shell__nav-link"
              (click)="navOpen.set(false)"
            >
              <strong>{{ item.label }}</strong>
              <span>{{ item.caption }}</span>
            </a>
          }
        </nav>

        <div class="shell__footer">
          <p>{{ auth.currentUser()?.email || 'Sesion activa' }}</p>
          <button type="button" class="btn-secondary" (click)="logout()">Cerrar sesion</button>
        </div>
      </aside>

      <main class="shell__main">
        <header class="shell__topbar">
          <button type="button" class="shell__menu" (click)="navOpen.update((value) => !value)">Menu</button>
          <div class="shell__topbar-copy">
            <span>{{ roleLabel() }}</span>
            <strong>{{ currentHeading() }}</strong>
          </div>
          <div class="shell__account">
            <span class="shell__account-dot"></span>
            {{ auth.currentUser()?.email || 'usuario@semse' }}
          </div>
        </header>

        <section class="shell__content">
          <router-outlet />
        </section>
      </main>

      @defer (when showAssistant()) {
        <app-assistant-dock />
      }
    </div>
  `,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly routeContext = inject(RouteContextService);
  protected readonly navOpen = signal(false);

  protected readonly navItems = computed<NavItem[]>(() => {
    switch (this.auth.role) {
      case 'CLIENT':
        return [
          { label: 'Dashboard', href: '/client/dashboard', caption: 'Vista general y actividad' },
          { label: 'Leads', href: '/client/leads', caption: 'CRM y oportunidades' },
          { label: 'Trabajos', href: '/client/jobs', caption: 'Pipeline publicado' },
          { label: 'Nuevo proyecto', href: '/client/jobs/new', caption: 'Builder conversacional' },
        ];
      case 'PRO':
        return [{ label: 'Dashboard pro', href: '/worker/dashboard', caption: 'Operacion del profesional' }];
      default:
        return [{ label: 'Control tower', href: '/admin/dashboard', caption: 'Estado de plataforma' }];
    }
  });

  protected readonly currentHeading = computed(() => this.routeContext.title());
  protected readonly roleLabel = computed(() => this.routeContext.section());
  protected readonly showAssistant = computed(() =>
    (this.auth.role === 'CLIENT' || this.auth.role === 'OPS_ADMIN') && this.routeContext.assistant().enabled,
  );

  logout() {
    this.auth.logout();
  }
}
