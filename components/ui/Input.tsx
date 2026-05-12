"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-400">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`px-3 py-2 bg-slate-800 border rounded-lg text-slate-100
          placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors
          ${error ? "border-red-600 focus:border-red-500 focus:ring-red-500" : "border-slate-700 focus:border-slate-500 focus:ring-slate-500"}
          ${className}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
