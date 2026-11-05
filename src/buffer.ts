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

export const sendBufferPost = async (text: string): Promise<void> => {
  const apiKey = process.env.BUFFER_API_KEY?.trim()
  const channelId = process.env.BUFFER_CHANNEL_ID?.trim()
  if (!apiKey || !channelId) {
    throw new Error('Buffer requires BUFFER_API_KEY and BUFFER_CHANNEL_ID')
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
  console.info('Buffer accepted post', post.post.id)
}
