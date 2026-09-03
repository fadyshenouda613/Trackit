import { describe, expect, it } from 'vitest'
import { currencyCodeSchema } from '../schemas/primitives'
import { currencies, symbolOf } from './currency'

describe('currencies', () => {
  it('lists every code the schema allows, once each', () => {
    expect(currencies.map((entry) => entry.code)).toEqual(currencyCodeSchema.options)
  })

  it('prints the symbol a client is billed in', () => {
    expect(symbolOf('USD')).toBe('$')
    expect(symbolOf('GBP')).toBe('£')
    expect(symbolOf('EUR')).toBe('€')
  })
})
