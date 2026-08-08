import { Header } from '@/components/Header'
import { Navigation } from '@/components/Navigation'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Navigation />
        <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
