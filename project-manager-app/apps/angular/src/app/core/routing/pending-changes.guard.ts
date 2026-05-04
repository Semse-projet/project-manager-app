import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

export type PendingChangesAware = {
  canDeactivate?: () => boolean;
};

export const pendingChangesGuard: CanDeactivateFn<PendingChangesAware> = (component) => {
  if (!component?.canDeactivate) {
    return true;
  }

  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  return component.canDeactivate();
};
