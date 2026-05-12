"use client";

import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, options, className = "", id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-400">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={`px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100
          focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500
          transition-colors ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
