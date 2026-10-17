import { useState } from "react";

/** State that reverts to its initial value after a delay (e.g. to briefly show that something was copied). */
export function useTransientState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);

  const setTransientValue = (value: T) => {
    setValue(value);
    setTimeout(() => setValue(initialValue), 2000);
  };

  return [value, setTransientValue] as const;
}
