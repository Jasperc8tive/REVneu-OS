import { InternalAgentGuard } from './internal-agent.guard'

describe('InternalAgentGuard', () => {
  const guard = new InternalAgentGuard()

  const createContext = (apiKey?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'x-agent-api-key': apiKey,
        },
      }),
    }),
  })

  it('allows request with matching strong key', () => {
    process.env.AGENT_API_KEY = 'strong-agent-key-1234567890'
    const context = createContext('strong-agent-key-1234567890')

    expect(guard.canActivate(context as never)).toBe(true)
  })

  it('rejects insecure default key', () => {
    process.env.AGENT_API_KEY = 'change-me-internal-agent-api-key'
    const context = createContext('change-me-internal-agent-api-key')

    expect(() => guard.canActivate(context as never)).toThrow('insecure')
  })

  it('rejects missing or mismatched key', () => {
    process.env.AGENT_API_KEY = 'strong-agent-key-1234567890'
    const context = createContext('wrong-key')

    expect(() => guard.canActivate(context as never)).toThrow('Invalid internal agent API key')
  })
})
