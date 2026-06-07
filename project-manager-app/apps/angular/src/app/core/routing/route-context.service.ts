import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';

export type AssistantRouteConfig = {
  enabled?: boolean;
  label?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  quickPrompts?: string[];
};

export type AppRouteContext = {
  section?: string;
  assistant?: AssistantRouteConfig;
};

const DEFAULT_ASSISTANT: Required<AssistantRouteConfig> = {
  enabled: false,
  label: 'Prometeo',
  title: 'Convierte una idea en trabajo publicado.',
  subtitle: 'Cuéntame el proyecto en lenguaje natural y lo convierto en un borrador estructurado.',
  placeholder: 'Ejemplo: quiero publicar un trabajo de electricidad en Miami, la casa tiene 4 cuartos y 2 baños.',
  quickPrompts: [
    'Quiero publicar un trabajo de electricidad residencial.',
    'Necesito remodelar un bano principal en Miami.',
    'Tengo fotos y quiero recibir propuestas de profesionales.',
  ],
};

@Injectable({ providedIn: 'root' })
export class RouteContextService {
  private readonly router = inject(Router);

  private readonly navigationUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly rootSnapshot = computed(() => {
    this.navigationUrl();
    return this.router.routerState.snapshot.root;
  });

  private readonly activeSnapshot = computed(() => this.findLeaf(this.rootSnapshot()));

  readonly title = computed(() => this.activeSnapshot().title ?? 'SEMSE OS');
  readonly section = computed(() => ((this.activeSnapshot().data ?? {}) as AppRouteContext).section ?? 'SEMSE');
  readonly routeKey = computed(() => this.collectRoutePath(this.rootSnapshot()) || this.router.url || '/');
  readonly assistant = computed<Required<AssistantRouteConfig>>(() => {
    const data = (this.activeSnapshot().data ?? {}) as AppRouteContext;
    return {
      ...DEFAULT_ASSISTANT,
      ...(data.assistant ?? {}),
    };
  });

  private findLeaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private collectRoutePath(snapshot: ActivatedRouteSnapshot): string {
    const parts: string[] = [];
    let current: ActivatedRouteSnapshot | null = snapshot;

    while (current) {
      const path = current.routeConfig?.path?.trim();
      if (path) {
        parts.push(path);
      }
      current = current.firstChild;
    }

    return parts.length ? `/${parts.join('/')}` : '';
  }
}
