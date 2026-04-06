export function formatNaira(value: number, compact = false): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value)
}
