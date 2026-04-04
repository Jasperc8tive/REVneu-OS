export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <div className="text-center mb-8">
        <a href="/" className="text-2xl font-bold text-brand-primary font-sans">
          Revneu OS
        </a>
      </div>
      {children}
    </div>
  )
}
