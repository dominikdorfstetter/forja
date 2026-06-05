import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface FormChangeContextValue {
  isFieldDirty: (name: string) => boolean;
  revertField: (name: string) => void;
}

const FormChangeContext = createContext<FormChangeContextValue | null>(null);

/** Resolves a dotted field path (e.g. "seo.title") against RHF dirtyFields. */
function isPathDirty(dirtyFields: unknown, name: string): boolean {
  let node: unknown = dirtyFields;
  for (const segment of name.split('.')) {
    if (!node || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return Boolean(node);
}

/**
 * Provides per-field dirty state + revert to descendant fields, so a
 * {@link DirtyFieldMarker} (or any consumer of {@link useFieldDirty}) can
 * highlight and revert individual edits. Fed from a form's RHF
 * `formState.dirtyFields` and `resetField`. Wrap a form's body once.
 */
export function FormChangeProvider({
  dirtyFields,
  revertField,
  children,
}: {
  dirtyFields: unknown;
  revertField: (name: string) => void;
  children: ReactNode;
}) {
  const value = useMemo<FormChangeContextValue>(
    () => ({
      isFieldDirty: (name) => isPathDirty(dirtyFields, name),
      revertField,
    }),
    [dirtyFields, revertField],
  );
  return <FormChangeContext.Provider value={value}>{children}</FormChangeContext.Provider>;
}

/**
 * Reads a single field's dirty state and a bound revert callback. Degrades
 * to a never-dirty no-op when used outside a {@link FormChangeProvider}, so
 * markers can sit in shared components without forcing every host to provide.
 */
export function useFieldDirty(name: string): { isDirty: boolean; revert: () => void } {
  const ctx = useContext(FormChangeContext);
  return {
    isDirty: ctx ? ctx.isFieldDirty(name) : false,
    revert: () => ctx?.revertField(name),
  };
}
