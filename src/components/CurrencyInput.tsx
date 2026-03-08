import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export const formatCurrency = (value: number): string =>
  Number(value).toLocaleString("en-US");

export const parseCurrency = (str: string): number =>
  Number(str.replace(/,/g, "")) || 0;

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
}

export const CurrencyInput = ({ value, onChange, className, min = 0 }: CurrencyInputProps) => {
  const [display, setDisplay] = useState(formatCurrency(value));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally (not while focused)
  useEffect(() => {
    if (!focused) {
      setDisplay(formatCurrency(value));
    }
  }, [value, focused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      const num = Math.max(min, Number(raw) || 0);
      setDisplay(raw ? formatCurrency(num) : "");
      onChange(num);
    },
    [onChange, min]
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    // Select all on focus for easy replacement
    setTimeout(() => ref.current?.select(), 0);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    setDisplay(formatCurrency(value));
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};
