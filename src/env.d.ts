declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined
      KZT_TWITTER_CONSUMER_KEY: string
      KZT_TWITTER_CONSUMER_SECRET: string
      KZT_TWITTER_ACCESS_TOKEN: string
      KZT_TWITTER_ACCESS_TOKEN_SECRET: string
    }
  }
}
