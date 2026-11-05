const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }
`

interface BufferResponse {
  errors?: unknown[]
  data?: {
    createPost?: {
      __typename: string
      post?: { id: string }
    }
  }
}

const sendBufferPost = async (text: string, channelId: string): Promise<void> => {
  const apiKey = process.env.BUFFER_API_KEY?.trim()
  if (!apiKey || !channelId) {
    throw new Error('Buffer requires an API key and channel ID')
  }

  let response: Response
  try {
    response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: CREATE_POST,
        variables: {
          input: { channelId, text, schedulingType: 'automatic', mode: 'shareNow' }
        }
      }),
      signal: AbortSignal.timeout(30000)
    })
  } catch {
    // Never log request headers, credentials or the remote response body.
    throw new Error('Buffer request failed or timed out; delivery may be uncertain')
  }
  if (!response.ok) {
    throw new Error(`Buffer HTTP ${response.status}; publication not confirmed`)
  }
  let result: BufferResponse
  try {
    result = await response.json() as BufferResponse
  } catch {
    throw new Error('Buffer returned an invalid response')
  }
  const post = result?.data?.createPost
  if (result?.errors?.length || post?.__typename !== 'PostActionSuccess' || !post.post?.id) {
    throw new Error('Buffer rejected publication; check channel access and posting limits')
  }
  console.info('Buffer accepted post', { channelId, postId: post.post.id })
}

export const sendBufferPosts = async (texts: string[]): Promise<void> => {
  const configured = process.env.BUFFER_CHANNEL_IDS ?? process.env.BUFFER_CHANNEL_ID ?? ''
  const channels = [...new Set(configured.split(',').map(id => id.trim()).filter(Boolean))]
  if (!channels.length) {
    throw new Error('Buffer requires BUFFER_CHANNEL_IDS or BUFFER_CHANNEL_ID')
  }
  const failures: string[] = []
  for (const channelId of channels) {
    for (const text of texts) {
      try {
        await sendBufferPost(text, channelId)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Unknown Buffer failure')
      }
    }
  }
  if (failures.length) {
    throw new Error(`Buffer failed to publish ${failures.length} of ${channels.length * texts.length} posts: ${failures.join('; ')}`)
  }
}
