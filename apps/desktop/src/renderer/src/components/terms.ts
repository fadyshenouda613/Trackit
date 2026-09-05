export const TERMS: { label: string; days: number }[] = [
  { label: 'Net 14', days: 14 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 30', days: 30 },
  { label: 'Due on receipt', days: 0 }
]
export const termsLabel = (days: number): string => (days === 0 ? 'Due on receipt' : `Net ${days}`)
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
