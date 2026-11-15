export function ProgressRing({ done, total, size = 120 }: { done: number; total: number; size?: number }) {
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}
      role="img" aria-label={`${done} of ${total} tasks done`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-secondary-container" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} className="stroke-primary" />
      </svg>
      <span className="absolute text-xl font-medium tabular-nums text-on-surface">{done}/{total}</span>
    </div>
  )
}
