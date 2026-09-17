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
      <Navigation />
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#f4f7f9' }}>
        {children}
      </main>
    </div>
  )
}
