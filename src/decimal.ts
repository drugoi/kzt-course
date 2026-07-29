interface ParsedDecimal {
  coefficient: bigint
  scale: number
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/

const parseDecimal = (value: string): ParsedDecimal => {
  const match = DECIMAL_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Invalid decimal: ${value}`)
  }

  const [, sign, integer, fraction = ''] = match
  const magnitude = BigInt(`${integer}${fraction}`)

  return {
    coefficient: sign === '-' ? -magnitude : magnitude,
    scale: fraction.length
  }
}

const renderDecimal = ({ coefficient, scale }: ParsedDecimal): string => {
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, '0')
  const integer = scale === 0 ? digits : digits.slice(0, -scale)
  const fraction = scale === 0 ? '' : digits.slice(-scale).replace(/0+$/, '')
  const unsigned = fraction ? `${integer}.${fraction}` : integer

  return coefficient === 0n ? '0' : `${negative ? '-' : ''}${unsigned}`
}

export const normalizeDecimal = (value: string): string =>
  renderDecimal(parseDecimal(value))

export const subtractDecimals = (
  currentValue: string,
  previousValue: string
): string => {
  const current = parseDecimal(currentValue)
  const previous = parseDecimal(previousValue)
  const scale = Math.max(current.scale, previous.scale)
  const currentCoefficient =
    current.coefficient * 10n ** BigInt(scale - current.scale)
  const previousCoefficient =
    previous.coefficient * 10n ** BigInt(scale - previous.scale)

  return renderDecimal({
    coefficient: currentCoefficient - previousCoefficient,
    scale
  })
}

const roundToScale = (
  value: ParsedDecimal,
  maximumScale: number
): ParsedDecimal => {
  if (value.scale <= maximumScale) {
    return value
  }

  const factor = 10n ** BigInt(value.scale - maximumScale)
  const negative = value.coefficient < 0n
  const magnitude = negative ? -value.coefficient : value.coefficient
  const quotient = magnitude / factor
  const remainder = magnitude % factor
  const rounded = quotient + (remainder * 2n >= factor ? 1n : 0n)

  return {
    coefficient: negative ? -rounded : rounded,
    scale: maximumScale
  }
}

export const formatSignedChange = (value: string): string => {
  const normalized = renderDecimal(roundToScale(parseDecimal(value), 2))
  return normalized === '0' || normalized.startsWith('-')
    ? normalized
    : `+${normalized}`
}
