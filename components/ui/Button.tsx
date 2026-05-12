"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  primary:
    "bg-slate-600 hover:bg-slate-500 text-white",
  secondary:
    "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
  ghost:
    "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200",
  destructive:
    "bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 border border-red-800/50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500
        disabled:opacity-40 disabled:cursor-not-allowed
        ${sizeClass} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
