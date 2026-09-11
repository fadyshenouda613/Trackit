/*
 * Pure functions over the shared shapes: money, durations, dates, rates,
 * budgets, invoice arithmetic, invoice numbering and fractional ordering.
 *
 * Nothing here touches a database, a window or a clock it was not handed.
 * The desktop renderer and the server both call these, so a figure the app
 * shows and a figure the server computes can never disagree.
 */
export * from './money'
export * from './duration'
export * from './dates'
export * from './rate'
export * from './invoice-math'
export * from './invoice-number'
export * from './invoice-paper'
export * from './sort-order'
export * from './currency'
