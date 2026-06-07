import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="login">
      <section class="login__hero">
        <span class="page-eyebrow">SEMSE Angular Frontline</span>
        <h1>El ecosistema ahora entra por una interfaz conversacional.</h1>
        <p>
          Angular toma la capa visual, NestJS sostiene la operación y Prometeo convierte
          conversación natural en proyectos estructurados, leads, presupuesto y publicación.
        </p>

        <div class="login__signals">
          <article>
            <strong>Leads → estimado → PDF</strong>
            <span>Flujo de dinero para contractor</span>
          </article>
          <article>
            <strong>Draft conversacional</strong>
            <span>Proyecto vivo antes del formulario</span>
          </article>
          <article>
            <strong>Publicación guiada</strong>
            <span>Presupuesto y handoff desde IA</span>
          </article>
        </div>
      </section>

      <section class="login__card section-card">
        <div class="login__card-header">
          <span class="pill">Demo access</span>
          <h2>Entrar a SEMSE OS</h2>
          <p>Usa uno de los perfiles demo o tus credenciales reales cuando el backend de auth crezca.</p>
        </div>

        <div class="login__presets">
          @for (preset of presets; track preset.email) {
            <button type="button" class="btn-secondary login__preset" (click)="usePreset(preset.email)">
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.email }}</span>
            </button>
          }
        </div>

        <label class="login__label">
          Email
          <input class="field" [ngModel]="email" (ngModelChange)="email = $event" />
        </label>

        <label class="login__label">
          Password
          <input class="field" type="password" [ngModel]="password" (ngModelChange)="password = $event" />
        </label>

        @if (error) {
          <div class="login__error">{{ error }}</div>
        }

        <button type="button" class="btn-primary login__submit" [disabled]="loading" (click)="submit()">
          {{ loading ? 'Entrando...' : 'Abrir plataforma' }}
        </button>

        <div class="login__hint">
          Password demo: <strong>demo1234</strong>
        </div>
      </section>
    </main>
  `,
  styles: `
    .login {
      min-height: 100dvh;
      padding: 24px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: stretch;
    }

    .login__hero,
    .login__card {
      padding: 32px;
      border-radius: 32px;
    }

    .login__hero {
      background:
        linear-gradient(160deg, rgba(12, 16, 23, 0.94), rgba(17, 24, 39, 0.92)),
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 34%),
        radial-gradient(circle at bottom right, rgba(255, 106, 0, 0.14), transparent 30%);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      display: grid;
      align-content: center;
      gap: 18px;
    }

    .login__hero h1 {
      margin: 0;
      font-size: clamp(2.6rem, 5vw, 5.2rem);
      line-height: 0.92;
      letter-spacing: -0.08em;
      max-width: 10ch;
    }

    .login__hero p {
      margin: 0;
      max-width: 58ch;
      line-height: 1.7;
      color: var(--muted);
      font-size: 1rem;
    }

    .login__signals {
      display: grid;
      gap: 14px;
      margin-top: 12px;
    }

    .login__signals article {
      padding: 16px 18px;
      border-radius: 20px;
      background: rgba(26, 35, 51, 0.84);
      border: 1px solid var(--border);
    }

    .login__signals strong,
    .login__signals span {
      display: block;
    }

    .login__signals span {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }

    .login__card {
      display: grid;
      align-content: center;
      gap: 16px;
      max-width: 520px;
      width: 100%;
      justify-self: end;
    }

    .login__card-header h2 {
      margin: 14px 0 8px;
      font-size: 2rem;
      letter-spacing: -0.06em;
    }

    .login__card-header p,
    .login__hint {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 14px;
    }

    .login__presets {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .login__preset {
      min-height: 86px;
      padding: 14px;
      border-radius: 18px;
      flex-direction: column;
      align-items: flex-start;
    }

    .login__preset span {
      color: var(--muted);
      font-size: 12px;
      word-break: break-word;
    }

    .login__label {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-weight: 700;
      font-size: 14px;
    }

    .login__error {
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid rgba(239, 68, 68, 0.18);
      background: rgba(239, 68, 68, 0.08);
      color: var(--danger);
      font-size: 13px;
    }

    .login__submit {
      width: 100%;
    }

    @media (max-width: 960px) {
      .login {
        grid-template-columns: 1fr;
      }

      .login__card {
        justify-self: stretch;
        max-width: none;
      }
    }

    @media (max-width: 640px) {
      .login {
        padding: 14px;
      }

      .login__hero,
      .login__card {
        padding: 24px;
      }

      .login__presets {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class LoginPageComponent implements OnInit {
  protected email = 'client@demo.semse';
  protected password = 'demo1234';
  protected loading = false;
  protected error: string | null = null;

  protected readonly presets = [
    { label: 'Cliente', email: 'client@demo.semse' },
    { label: 'Profesional', email: 'worker@demo.semse' },
    { label: 'Admin', email: 'admin@demo.semse' },
  ];

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.auth.defaultRoute);
    }
  }

  usePreset(email: string) {
    this.email = email;
    this.password = 'demo1234';
  }

  submit() {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.auth
      .login({ email: this.email, password: this.password })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(this.auth.defaultRoute),
        error: () => {
          this.error = 'No pudimos abrir la sesion. Revisa las credenciales demo o el estado del API.';
        },
      });
  }
}
