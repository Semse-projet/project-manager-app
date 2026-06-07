import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './auth.models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

function hasAllowedRole(requiredRoles: UserRole[] | undefined, currentRole: UserRole) {
  if (!requiredRoles?.length) {
    return true;
  }
  return requiredRoles.includes(currentRole);
}

export const roleGuard: CanActivateChildFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const requiredRoles = route.data['roles'] as UserRole[] | undefined;
  if (hasAllowedRole(requiredRoles, auth.role)) {
    return true;
  }

  return router.createUrlTree([auth.defaultRoute]);
};
