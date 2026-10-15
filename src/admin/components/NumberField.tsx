import { useEffect, useState } from 'react';

const parse = (raw: string): number | null => {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

const format = (value: number | null) => (value == null ? '' : String(value));

interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Number input that accepts a decimal comma ("0,039") and keeps what is being typed
export function NumberField({ value, onChange, placeholder, className, disabled }: NumberFieldProps) {
  const [raw, setRaw] = useState(format(value));

  // Follow changes made from outside (e.g. quantity recalculated from pieces per unit)
  useEffect(() => {
    if (parse(raw) !== value) setRaw(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parse(e.target.value));
      }}
      className={className ?? 'w-full border rounded px-2 py-1 text-sm'}
    />
  );
}
