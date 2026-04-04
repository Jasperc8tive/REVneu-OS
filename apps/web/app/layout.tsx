import type { Metadata } from 'next'
import { AuthProvider } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Revneu OS — Revenue Growth Platform',
  description: 'AI-powered revenue growth platform for Nigerian businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
