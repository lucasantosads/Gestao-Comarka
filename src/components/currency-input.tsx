"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}

function formatBRL(cents: number): string {
  if (cents === 0) return "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const formatted = reais.toLocaleString("pt-BR") + "," + String(centavos).padStart(2, "0");
  return cents < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

function parseCentsFromDisplay(display: string): number {
  const digits = display.replace(/\D/g, "");
  return parseInt(digits) || 0;
}

export function CurrencyInput({ value, onChange, className, min, placeholder, disabled }: CurrencyInputProps) {
  const cents = Math.round(value * 100);
  const [display, setDisplay] = useState(formatBRL(cents));
  const [touched, setTouched] = useState(value !== 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      if (value === 0 && !touched) {
        setDisplay("");
      } else {
        setDisplay(formatBRL(Math.round(value * 100)));
      }
    }
  }, [value, touched]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const newCents = parseCentsFromDisplay(raw);

    if (!touched && newCents > 0) setTouched(true);

    if (min !== undefined && newCents / 100 < min) {
      setDisplay(formatBRL(newCents));
      return;
    }

    setDisplay(formatBRL(newCents));
    onChange(newCents / 100);
  };

  const handleFocus = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
      }
    }, 0);
  };

  const handleBlur = () => {
    const c = Math.round(value * 100);
    if (c === 0 && !touched) {
      setDisplay("");
    } else {
      setDisplay(formatBRL(c));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || "R$ 0,00"}
      disabled={disabled}
      className={cn("w-full bg-transparent border rounded-lg px-3 py-2 text-center", className)}
    />
  );
}
