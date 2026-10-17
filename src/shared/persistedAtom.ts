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
  { parse, stringify }: Serializer<T> = { parse: JSON.parse, stringify: JSON.stringify },
): Atom<T> {
  const read = (value: string | null) => {
    try {
      return value === null ? initialValue : parse(value);
    } catch {
      return initialValue;
    }
  };

  const atom = createAtom(read(localStorage.getItem(key)));
  atom.subscribe((value) => localStorage.setItem(key, stringify(value)));

  window.addEventListener("storage", (event) => {
    if (event.key === key) atom.set(read(event.newValue));
  });

  return atom;
}
