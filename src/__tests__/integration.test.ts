import { processRates, stopCronJob } from '../index'
import { getRSS, parseXml, getMonitoredRates } from '../parse'
import { formatText } from '../format'
import { CurrenciesMap, Rates } from '../types'

// Mock the external dependencies
jest.mock('../parse', () => ({
  getRSS: jest.fn(),
  parseXml: jest.fn(),
  getMonitoredRates: jest.fn()
}))

jest.mock('../format', () => ({
  formatText: jest.fn()
}))

describe('Integration Tests', () => {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    info: console.info
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DEBUG = 'true'
    process.env.NODE_ENV = 'test'
    // Silence console methods
    console.log = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.info = originalConsole.info
  })

  afterAll(() => {
    stopCronJob()
  })

  it('should process rates and generate tweets correctly', async () => {
    // Mock RSS data
    const mockXml = 'mock xml data'
    ;(getRSS as jest.Mock).mockResolvedValue(mockXml)

    // Mock parsed rates
    const mockParsedRates: Rates = [
      {
        title: 'USD',
        description: '450.00',
        change: '1.5',
        pubDate: '2024-03-26',
        quant: '1',
        index: 'USD',
        link: 'http://example.com'
      },
      {
        title: 'EUR',
        description: '480.00',
        change: '2.0',
        pubDate: '2024-03-26',
        quant: '1',
        index: 'EUR',
        link: 'http://example.com'
      },
      {
        title: 'RUB',
        description: '5.00',
        change: '0.0',
        pubDate: '2024-03-26',
        quant: '1',
        index: 'RUB',
        link: 'http://example.com'
      }
    ]
    ;(parseXml as jest.Mock).mockResolvedValue(mockParsedRates)
    ;(getMonitoredRates as jest.Mock).mockReturnValue(mockParsedRates)

    // Mock formatted text
    const mockFormattedText = 'Mock tweet text'
    ;(formatText as jest.Mock).mockReturnValue(mockFormattedText)

    // Process rates
    await processRates()

    // Verify the flow
    expect(getRSS).toHaveBeenCalled()
    expect(parseXml).toHaveBeenCalledWith(mockXml)
    expect(getMonitoredRates).toHaveBeenCalledWith(mockParsedRates)
    expect(formatText).toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    // Mock RSS to throw error
    const error = new Error('RSS Error')
    ;(getRSS as jest.Mock).mockRejectedValue(error)

    // Process rates
    await processRates()

    // Verify error was handled
    expect(parseXml).not.toHaveBeenCalled()
    expect(getMonitoredRates).not.toHaveBeenCalled()
  })

  it('should handle empty rates gracefully', async () => {
    // Mock empty rates
    ;(getRSS as jest.Mock).mockResolvedValue('mock xml')
    ;(parseXml as jest.Mock).mockResolvedValue([])
    ;(getMonitoredRates as jest.Mock).mockReturnValue([])
    ;(formatText as jest.Mock).mockReturnValue('')

    // Process rates
    await processRates()

    // Verify empty rates were handled
    expect(getRSS).toHaveBeenCalled()
    expect(parseXml).toHaveBeenCalled()
    expect(getMonitoredRates).toHaveBeenCalled()
  })
})
