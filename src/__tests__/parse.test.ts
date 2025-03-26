import { getMonitoredRates, parseXml } from '../parse'
import { Rates } from '../types'

describe('parse.ts', () => {
  describe('parseXml', () => {
    it('should parse valid XML data', async () => {
      const mockXml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>USD</title>
              <description>450.00</description>
              <change>1.5</change>
            </item>
            <item>
              <title>EUR</title>
              <description>480.00</description>
              <change>2.0</change>
            </item>
            <item>
              <title>RUB</title>
              <description>5.00</description>
              <change>0.0</change>
            </item>
          </channel>
        </rss>
      `

      const result = await parseXml(mockXml)
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        title: 'USD',
        description: '450.00',
        change: '1.5'
      })
    })

    it('should handle empty XML', async () => {
      const mockXml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
          </channel>
        </rss>
      `

      const result = await parseXml(mockXml)
      expect(result).toEqual([])
    })

    it('should handle malformed XML', async () => {
      const mockXml = 'invalid xml'
      const result = await parseXml(mockXml)
      expect(result).toEqual([])
    })
  })

  describe('getMonitoredRates', () => {
    it('should filter and return only monitored currencies', () => {
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
        },
        {
          title: 'GBP',
          description: '550.00',
          change: '1.0',
          pubDate: '2024-03-26',
          quant: '1',
          index: 'GBP',
          link: 'http://example.com'
        }
      ]

      const result = getMonitoredRates(mockRates)
      expect(result).toHaveLength(3)
      expect(result.map(rate => rate.title)).toEqual(['USD', 'EUR', 'RUB'])
    })

    it('should handle empty rates array', () => {
      const result = getMonitoredRates([])
      expect(result).toHaveLength(0)
    })
  })
})
