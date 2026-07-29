import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { RateHistory } from '../history'
import { LocaleText, RateSnapshot, Rates } from '../types'

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

const createTemporaryDatabasePath = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kzt-course-'))
  return {
    directory,
    database: join(directory, 'rates.sqlite')
  }
}

const fullTwitterCredentials = {
  KZT_TWITTER_CONSUMER_KEY: 'consumer-key',
  KZT_TWITTER_CONSUMER_SECRET: 'consumer-secret',
  KZT_TWITTER_ACCESS_TOKEN: 'access-token',
  KZT_TWITTER_ACCESS_TOKEN_SECRET: 'access-token-secret'
}

const priorSnapshot: RateSnapshot = {
  rateDate: '2026-07-27',
  rates: {
    USD: { amount: '448.50', rssChange: '-1' },
    EUR: { amount: '482.25', rssChange: '-1' },
    RUB: { amount: '5.10', rssChange: '-1' }
  }
}

const currentSnapshot: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.00', rssChange: '9' },
    EUR: { amount: '480.00', rssChange: '9' },
    RUB: { amount: '5.00', rssChange: '9' }
  }
}

const currentRates: Rates = [
  {
    title: 'USD',
    pubDate: '28.07.2026',
    description: '450.00',
    quant: '1',
    index: 'UP',
    change: '9',
    link: ''
  },
  {
    title: 'EUR',
    pubDate: '28.07.2026',
    description: '480.00',
    quant: '1',
    index: 'DOWN',
    change: '9',
    link: ''
  },
  {
    title: 'RUB',
    pubDate: '28.07.2026',
    description: '5.00',
    quant: '1',
    index: 'DOWN',
    change: '9',
    link: ''
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
  let testDatabase: ReturnType<typeof createTemporaryDatabasePath>

  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    info: console.info,
    warn: console.warn
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockTweet.mockReset()
    testDatabase = createTemporaryDatabasePath()
    process.env = { ...originalEnv }
    // Silence console methods
    console.log = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
    rmSync(testDatabase.directory, { recursive: true, force: true })
    process.env = originalEnv
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.info = originalConsole.info
    console.warn = originalConsole.warn
  })

  it('should not process rates when importing the module', async () => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DEBUG: 'true',
      KZT_RATES_DB_FILE: testDatabase.database
    }

    const parse = await import('../parse')
    ;(parse.getRSS as jest.Mock).mockResolvedValue('mock xml')

    await import('../index')
    await Promise.resolve()

    expect(parse.getRSS).not.toHaveBeenCalled()
  })

  it('uses RSS changes and stores history on the first date', async () => {
    const { directory, database } = createTemporaryDatabasePath()
    try {
      const {
        processRates,
        getRSS,
        parseXml,
        getMonitoredRates,
        formatText
      } = await loadModules({ KZT_RATES_DB_FILE: database })
      getRSS.mockResolvedValue('mock xml')
      parseXml.mockResolvedValue(currentRates)
      getMonitoredRates.mockReturnValue(currentRates)
      formatText.mockReturnValue('Mock tweet text')

      await processRates()

      expect(formatText).toHaveBeenCalledWith(expect.anything(), {
        USD: { amount: '450.00', change: '9' },
        EUR: { amount: '480.00', change: '9' },
        RUB: { amount: '5.00', change: '9' }
      })

      const history = new RateHistory(database)
      try {
        expect(history.findPreviousSnapshot('2026-07-29')).toEqual(
          currentSnapshot
        )
      } finally {
        history.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('calculates changes from the prior complete date', async () => {
    const { directory, database } = createTemporaryDatabasePath()
    const seedHistory = new RateHistory(database)
    seedHistory.saveSnapshot(priorSnapshot)
    seedHistory.close()

    try {
      const {
        processRates,
        getRSS,
        parseXml,
        getMonitoredRates,
        formatText
      } = await loadModules({ KZT_RATES_DB_FILE: database })
      getRSS.mockResolvedValue('mock xml')
      parseXml.mockResolvedValue(currentRates)
      getMonitoredRates.mockReturnValue(currentRates)
      formatText.mockReturnValue('Mock tweet text')

      await processRates()

      expect(formatText).toHaveBeenCalledWith(expect.anything(), {
        USD: { amount: '450.00', change: '1.5' },
        EUR: { amount: '480.00', change: '-2.25' },
        RUB: { amount: '5.00', change: '-0.1' }
      })
      expect(console.warn).toHaveBeenCalledTimes(3)
      expect(console.warn).toHaveBeenNthCalledWith(
        1,
        'RSS change differs from calculated history',
        {
          date: '2026-07-28',
          currency: 'USD',
          calculated: '1.5',
          rss: '9'
        }
      )
      expect(console.warn).toHaveBeenNthCalledWith(
        2,
        'RSS change differs from calculated history',
        {
          date: '2026-07-28',
          currency: 'EUR',
          calculated: '-2.25',
          rss: '9'
        }
      )
      expect(console.warn).toHaveBeenNthCalledWith(
        3,
        'RSS change differs from calculated history',
        {
          date: '2026-07-28',
          currency: 'RUB',
          calculated: '-0.1',
          rss: '9'
        }
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('reprocessing one date still compares with the earlier date', async () => {
    const { directory, database } = createTemporaryDatabasePath()
    const seedHistory = new RateHistory(database)
    seedHistory.saveSnapshot(priorSnapshot)
    seedHistory.saveSnapshot(currentSnapshot)
    seedHistory.close()

    try {
      const {
        processRates,
        getRSS,
        parseXml,
        getMonitoredRates,
        formatText
      } = await loadModules({ KZT_RATES_DB_FILE: database })
      getRSS.mockResolvedValue('mock xml')
      parseXml.mockResolvedValue(currentRates)
      getMonitoredRates.mockReturnValue(currentRates)
      formatText.mockReturnValue('Mock tweet text')

      await processRates()

      expect(formatText).toHaveBeenCalledWith(expect.anything(), {
        USD: { amount: '450.00', change: '1.5' },
        EUR: { amount: '480.00', change: '-2.25' },
        RUB: { amount: '5.00', change: '-0.1' }
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('should handle errors gracefully', async () => {
    const { processRates, getRSS, parseXml, getMonitoredRates } =
      await loadModules({ KZT_RATES_DB_FILE: testDatabase.database })
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
      await loadModules({ KZT_RATES_DB_FILE: testDatabase.database })
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
    [currentRates.slice(0, 1)],
    [currentRates.slice(0, 2)]
  ])('should not format tweets when monitored rates are partial', async (partialRates: Rates) => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({ KZT_RATES_DB_FILE: testDatabase.database })
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
      KZT_RATES_DB_FILE: testDatabase.database,
      KZT_TWITTER_CONSUMER_KEY: fullTwitterCredentials.KZT_TWITTER_CONSUMER_KEY,
      KZT_TWITTER_CONSUMER_SECRET:
        fullTwitterCredentials.KZT_TWITTER_CONSUMER_SECRET,
      KZT_TWITTER_ACCESS_TOKEN: '',
      KZT_TWITTER_ACCESS_TOKEN_SECRET: ''
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
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

  it('publishes distinct Kazakh and Russian tweets in that order', async () => {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({
      NODE_ENV: 'production',
      DEBUG: 'false',
      KZT_RATES_DB_FILE: testDatabase.database,
      ...fullTwitterCredentials
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockImplementation((text: LocaleText['text']) => {
      if (text.up.includes('Курс өсуде!')) {
        return 'Қазақша форматталған твит'
      }
      if (text.up.includes('Курс растет!')) {
        return 'Отформатированный русский твит'
      }
      throw new Error('Unexpected locale text')
    })
    mockTweet.mockResolvedValue(undefined)

    await processRates()

    expect(mockTweet).toHaveBeenCalledTimes(2)
    expect(mockTweet).toHaveBeenNthCalledWith(1, 'Қазақша форматталған твит')
    expect(mockTweet).toHaveBeenNthCalledWith(
      2,
      'Отформатированный русский твит'
    )
  })

  it('rejects a SQLite open failure before publishing in production', async () => {
    mkdirSync(testDatabase.database)
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({
      NODE_ENV: 'production',
      DEBUG: 'false',
      KZT_RATES_DB_FILE: testDatabase.database,
      ...fullTwitterCredentials
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')

    await expect(processRates()).rejects.toThrow()

    expect(formatText).not.toHaveBeenCalled()
    expect(mockTweet).not.toHaveBeenCalled()
  })

  it('stores history before a Twitter publication failure', async () => {
    const { directory, database } = createTemporaryDatabasePath()

    try {
      const { processRates, getRSS, parseXml, getMonitoredRates, formatText } =
        await loadModules({
          NODE_ENV: 'production',
          DEBUG: 'false',
          KZT_RATES_DB_FILE: database,
          ...fullTwitterCredentials
        })
      getRSS.mockResolvedValue('mock xml')
      parseXml.mockResolvedValue(currentRates)
      getMonitoredRates.mockReturnValue(currentRates)
      formatText.mockReturnValue('Mock tweet text')
      mockTweet.mockRejectedValue(new Error('twitter unavailable'))

      await expect(processRates()).rejects.toThrow('twitter unavailable')

      const history = new RateHistory(database)
      try {
        expect(history.findPreviousSnapshot('2026-07-29')).toEqual(
          currentSnapshot
        )
      } finally {
        history.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
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
      KZT_RATES_DB_FILE: testDatabase.database,
      ...fullTwitterCredentials
    })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(mockTweet).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalledWith('Composed tweet', 'Mock tweet text')
  })
})
