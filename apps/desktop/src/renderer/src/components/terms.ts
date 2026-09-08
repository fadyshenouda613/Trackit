export const TERMS: { label: string; days: number }[] = [
  { label: 'Net 14', days: 14 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 30', days: 30 },
  { label: 'Due on receipt', days: 0 }
]
export const termsLabel = (days: number): string => (days === 0 ? 'Due on receipt' : `Net ${days}`)
/**
 * `1 invoice`, `2 invoices`. Counted copy is written once here rather than with
 * a ternary at every site, because the ternaries were the thing that got
 * forgotten — `1 clients`, `1 days overdue`, `1 items open`.
 */
export const plural = (n: number, singular: string, pluralForm = `${singular}s`): string =>
  `${n} ${n === 1 ? singular : pluralForm}`
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
