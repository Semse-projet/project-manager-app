import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-role-home-page',
  imports: [CommonModule],
  template: `
    <section class="section-card role-home">
      <span class="page-eyebrow">SEMSE Router</span>
      <h1>Organizando tu entrada al ecosistema.</h1>
      <p>Te estamos llevando al tablero correcto segun tu rol y sesion activa.</p>
    </section>
  `,
  styles: `
    .role-home {
      margin: 48px auto;
      max-width: 720px;
      padding: 40px 32px;
      text-align: center;
    }

    h1 {
      margin: 18px 0 10px;
      font-size: 2rem;
      letter-spacing: -0.05em;
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
  `,
})
export class RoleHomePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit() {
    void this.router.navigateByUrl(this.auth.defaultRoute);
  }
}
