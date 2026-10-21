import { createAtom, type Atom } from "@tanstack/react-store";

interface Serializer<T> {
  parse: (value: string) => T;
  stringify: (value: T) => string;
}

/** Stores strings as-is (rather than as JSON), which is how some older settings were stored. */
export const RAW_STRING: Serializer<string> = { parse: String, stringify: String };

/** An atom whose value is persisted to localStorage (and kept in sync across tabs). */
export function persistedAtom<T>(
  key: string,
  initialValue: T,
  { parse = JSON.parse, stringify = JSON.stringify }: Partial<Serializer<T>> = {},
): Atom<T> {
  const read = () => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? initialValue : parse(value);
    } catch {
      return initialValue;
    }
  };

  const atom = createAtom(typeof window === "undefined" ? initialValue : read());
  if (typeof window === "undefined") return atom;
  atom.subscribe((value) => {
    try {
      localStorage.setItem(key, stringify(value));
    } catch {
      // Keep the in-memory setting usable when storage is unavailable or full.
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) atom.set(read());
  });

  return atom;
}
