import type { NextAuthOptions, Session, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { JWT } from 'next-auth/jwt'
import { resolveApiBaseUrl } from '@/lib/api-base-url'

type AuthUser = User & {
  organizationId: string
  role: string
  accessToken: string
  refreshToken: string
}

type AuthToken = JWT & {
  id?: string
  organizationId?: string
  role?: string
  accessToken?: string
  refreshToken?: string
}

type AppSession = Session & {
  user?: Session['user'] & {
    id?: string
    organizationId?: string
    role?: string
    accessToken?: string
    refreshToken?: string
  }
}

export const authConfig: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const apiBaseUrl = resolveApiBaseUrl()
          const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!res.ok) {
            return null
          }

          const data = await res.json()
          return {
            id: data.data.user.id,
            email: data.data.user.email,
            name: data.data.user.name,
            organizationId: data.data.user.organizationId,
            role: data.data.user.role,
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          } as AuthUser
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: AuthToken; user?: User | AuthUser }) {
      if (user) {
        const authUser = user as AuthUser
        token.id = authUser.id
        token.organizationId = authUser.organizationId
        token.role = authUser.role
        token.accessToken = authUser.accessToken
        token.refreshToken = authUser.refreshToken
      }
      return token
    },
    async session({ session, token }: { session: AppSession; token: AuthToken }) {
      if (session.user) {
        session.user.id = token.id
        session.user.organizationId = token.organizationId
        session.user.role = token.role
        session.user.accessToken = token.accessToken
        session.user.refreshToken = token.refreshToken
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

