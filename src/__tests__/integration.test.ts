import { Rates } from '../types'

const mockTweet = jest.fn()
const mockTwitterApi = jest.fn(() => ({
  v2: {
    tweet: mockTweet
  }
}))

// Mock the external dependencies
jest.mock('../parse', () => ({
  getRSS: jest.fn(),
  parseXml: jest.fn(),
  getMonitoredRates: jest.fn()
}))

jest.mock('../format', () => ({
  formatText: jest.fn()
}))

jest.mock('twitter-api-v2', () => ({
  TwitterApi: mockTwitterApi
}))

const originalEnv = process.env
type TestEnv = Record<string, string | undefined>

const fullTwitterCredentials = {
  KZT_TWITTER_CONSUMER_KEY: 'consumer-key',
  KZT_TWITTER_CONSUMER_SECRET: 'consumer-secret',
  KZT_TWITTER_ACCESS_TOKEN: 'access-token',
  KZT_TWITTER_ACCESS_TOKEN_SECRET: 'access-token-secret'
}

const mockRates: Rates = [
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

const loadModules = async (env: TestEnv = {}) => {
  jest.resetModules()
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DEBUG: 'true',
    ...env
  }

  const parse = await import('../parse')
  const format = await import('../format')
  ;(parse.getRSS as jest.Mock).mockRejectedValue(new Error('Import-time noop'))

  const index = await import('../index')
  await Promise.resolve()
  jest.clearAllMocks()

  return {
    ...index,
    getRSS: parse.getRSS as jest.Mock,
    parseXml: parse.parseXml as jest.Mock,
    getMonitoredRates: parse.getMonitoredRates as jest.Mock,
    formatText: format.formatText as jest.Mock
  }
}

describe('Integration Tests', () => {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    info: console.info
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    // Silence console methods
    console.log = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
    process.env = originalEnv
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.info = originalConsole.info
  })

  it('should not process rates when importing the module', async () => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DEBUG: 'true'
    }

    const parse = await import('../parse')
    ;(parse.getRSS as jest.Mock).mockResolvedValue('mock xml')

    await import('../index')
    await Promise.resolve()

    expect(parse.getRSS).not.toHaveBeenCalled()
  })

  it('should process rates and generate tweets correctly', async () => {
    const { processRates, getRSS, parseXml, getMonitoredRates, formatText } =
      await loadModules()
    // Mock RSS data
    const mockXml = 'mock xml data'
    getRSS.mockResolvedValue(mockXml)
    parseXml.mockResolvedValue(mockRates)
    getMonitoredRates.mockReturnValue(mockRates)

    // Mock formatted text
    const mockFormattedText = 'Mock tweet text'
    formatText.mockReturnValue(mockFormattedText)

    // Process rates
    await processRates()

    // Verify the flow
    expect(getRSS).toHaveBeenCalled()
    expect(parseXml).toHaveBeenCalledWith(mockXml)
    expect(getMonitoredRates).toHaveBeenCalledWith(mockRates)
    expect(formatText).toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const { processRates, getRSS, parseXml, getMonitoredRates } =
      await loadModules()
    // Mock RSS to throw error
    const error = new Error('RSS Error')
    getRSS.mockRejectedValue(error)

    // Process rates
    await processRates()

    // Verify error was handled
    expect(parseXml).not.toHaveBeenCalled()
    expect(getMonitoredRates).not.toHaveBeenCalled()
  })

  it('should handle empty rates gracefully', async () => {
    const { processRates, getRSS, parseXml, getMonitoredRates, formatText } =
      await loadModules()
    // Mock empty rates
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue([])
    getMonitoredRates.mockReturnValue([])
    formatText.mockReturnValue('')

    // Process rates
    await processRates()

    // Verify empty rates were handled
    expect(getRSS).toHaveBeenCalled()
    expect(parseXml).toHaveBeenCalled()
    expect(getMonitoredRates).toHaveBeenCalled()
    expect(formatText).not.toHaveBeenCalled()
  })

  it.each([
    [
      [
        {
          title: 'USD',
          description: '450.00',
          change: '1.5',
          pubDate: '2024-03-26',
          quant: '1',
          index: 'USD',
          link: 'http://example.com'
        }
      ]
    ],
    [
      [
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
        }
      ]
    ]
  ])('should not format tweets when monitored rates are partial', async (partialRates: Rates) => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules()
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(partialRates)
    getMonitoredRates.mockReturnValue(partialRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(getRSS).toHaveBeenCalled()
    expect(parseXml).toHaveBeenCalled()
    expect(getMonitoredRates).toHaveBeenCalled()
    expect(formatText).not.toHaveBeenCalled()
  })

  it('should reject in production when twitter credentials are missing without leaking configured values', async () => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({
      NODE_ENV: 'production',
      DEBUG: 'false',
      KZT_TWITTER_CONSUMER_KEY: fullTwitterCredentials.KZT_TWITTER_CONSUMER_KEY,
      KZT_TWITTER_CONSUMER_SECRET:
        fullTwitterCredentials.KZT_TWITTER_CONSUMER_SECRET,
      KZT_TWITTER_ACCESS_TOKEN: '',
      KZT_TWITTER_ACCESS_TOKEN_SECRET: ''
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(mockRates)
    getMonitoredRates.mockReturnValue(mockRates)
    formatText.mockReturnValue('Mock tweet text')

    await expect(processRates()).rejects.toThrow(
      /KZT_TWITTER_ACCESS_TOKEN, KZT_TWITTER_ACCESS_TOKEN_SECRET/
    )

    const errorMessage = (console.error as jest.Mock).mock.calls
      .flat()
      .join(' ')
    expect(errorMessage).toContain('KZT_TWITTER_ACCESS_TOKEN')
    expect(errorMessage).not.toContain(
      fullTwitterCredentials.KZT_TWITTER_CONSUMER_KEY
    )
    expect(errorMessage).not.toContain(
      fullTwitterCredentials.KZT_TWITTER_CONSUMER_SECRET
    )
    expect(errorMessage).not.toContain('access-token')
    expect(errorMessage).not.toContain('access-token-secret')
    expect(mockTweet).not.toHaveBeenCalled()
  })

  it('should reject in production when twitter tweet creation fails', async () => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({
      NODE_ENV: 'production',
      DEBUG: 'false',
      ...fullTwitterCredentials
    })
    const twitterError = new Error('twitter unavailable')
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(mockRates)
    getMonitoredRates.mockReturnValue(mockRates)
    formatText.mockReturnValue('Mock tweet text')
    mockTweet.mockRejectedValue(twitterError)

    await expect(processRates()).rejects.toThrow(twitterError)

    expect(mockTweet).toHaveBeenCalledWith('Mock tweet text')
  })

  it('should log composed tweets instead of posting in debug mode outside test', async () => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({
      NODE_ENV: 'development',
      DEBUG: 'true',
      FORCE_UPDATE: 'true',
      ...fullTwitterCredentials
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(mockRates)
    getMonitoredRates.mockReturnValue(mockRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(mockTweet).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalledWith('Composed tweet', 'Mock tweet text')
  })
})
