import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

interface DynamicOptions {
  loading?: () => ReactNode;
  ssr?: boolean;
}

/** Browser-only subset of next/dynamic used by the shared digital-twin UI. */
export default function dynamic(
  loader: () => Promise<{ default: ComponentType<any> }>,
  options: DynamicOptions = {},
) {
  const Component = lazy(loader);
  return function StaticDynamicComponent(props: Record<string, unknown>) {
    return (
      <Suspense fallback={options.loading?.() ?? null}>
        <Component {...props} />
      </Suspense>
    );
  };
}
