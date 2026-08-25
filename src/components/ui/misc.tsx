"use client";

import Image from "next/image";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = 28,
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? ""}
        width={size}
        height={size}
        unoptimized
        className={cn("rounded-full object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-brand-soft text-brand font-semibold shrink-0",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-black/[0.06]", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fade-up">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-14 text-center", className)}>
      {icon && <div className="mb-3 text-muted/50 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  className,
  color = "bg-brand",
}: {
  value: number;
  max: number;
  className?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: React.ReactNode; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-line overflow-x-auto", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap cursor-pointer",
            active === t.key ? "text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-muted">
              {t.count}
            </span>
          )}
          {active === t.key && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
          )}
        </button>
      ))}
    </div>
  );
}
