import {
  formatSignedChange,
  normalizeDecimal,
  subtractDecimals
} from '../decimal'

describe('decimal helpers', () => {
  it.each([
    ['450.00', '448.50', '1.5'],
    ['480.00', '482.25', '-2.25'],
    ['5.00', '5.10', '-0.1'],
    ['473.40', '473.40', '0']
  ])('subtracts %s minus %s exactly', (current, previous, expected) => {
    expect(subtractDecimals(current, previous)).toBe(expected)
  })

  it.each([
    ['+01.500', '1.5'],
    ['-0.010', '-0.01'],
    ['0.00', '0']
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeDecimal(value)).toBe(expected)
  })

  it.each([
    ['1.5', '+1.5'],
    ['-2.25', '-2.25'],
    ['0.01', '+0.01'],
    ['1.236', '+1.24'],
    ['0', '0']
  ])('formats %s as signed %s', (value, expected) => {
    expect(formatSignedChange(value)).toBe(expected)
  })

  it('rejects a non-decimal value', () => {
    expect(() => normalizeDecimal('invalid')).toThrow('Invalid decimal')
  })
})
