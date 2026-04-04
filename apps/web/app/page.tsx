export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-primary">
      <div className="text-center text-white px-6">
        <h1 className="text-5xl font-bold mb-4 font-sans">Revneu OS</h1>
        <p className="text-xl text-brand-accent font-semibold mb-2">Revenue Growth Platform</p>
        <p className="text-blue-200 text-sm">
          AI-powered growth consulting for Nigerian businesses
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/auth/login"
            className="bg-brand-accent text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
          <a
            href="/auth/register"
            className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white hover:text-brand-primary transition-colors"
          >
            Sign Up
          </a>
        </div>
        <p className="mt-12 text-xs text-blue-300 font-mono">
          Stage 1 — Architecture Foundation ✓
        </p>
      </div>
    </main>
  )
}
