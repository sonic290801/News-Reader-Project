type Color = "blue" | "orange" | "red" | "gray" | "green" | "yellow";

const colors: Record<Color, string> = {
  blue:   "bg-blue-900/40 text-blue-300 border border-blue-800/50",
  orange: "bg-orange-900/40 text-orange-300 border border-orange-800/50",
  red:    "bg-red-900/40 text-red-300 border border-red-800/50",
  gray:   "bg-slate-800 text-slate-400 border border-slate-700",
  green:  "bg-green-900/40 text-green-300 border border-green-800/50",
  yellow: "bg-yellow-900/40 text-yellow-300 border border-yellow-800/50",
};

interface BadgeProps {
  children: React.ReactNode;
  color?: Color;
  className?: string;
}

export function Badge({ children, color = "gray", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

export const SOURCE_TYPE_COLORS: Record<string, Color> = {
  RSS:     "blue",
  REDDIT:  "orange",
  YOUTUBE: "red",
  WEB:     "gray",
};
