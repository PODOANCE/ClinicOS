export default function OAuthTestPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', margin: '40px', maxWidth: '600px' }}>
      <h1>OAuth2 + Google Drive Integration Test</h1>

      <div style={{ background: '#f0f0f0', padding: '20px', borderRadius: '4px', margin: '20px 0' }}>
        <h2>Step 1: Authorize</h2>
        <p>Click the button below to authorize ClinicOS to access your Google Drive.</p>
        <a
          href="/api/auth/google/authorize"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#4285F4',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Authorize Google Drive
        </a>
      </div>

      <div style={{ background: '#fffacd', padding: '20px', borderRadius: '4px', margin: '20px 0' }}>
        <h3>⚠️ Important: Save the Refresh Token</h3>
        <p>After authorization, you will see a success page.</p>
        <p>
          <strong>Check your terminal/console logs</strong> for the refresh token and add it to your
          <code>.env.local</code>:
        </p>
        <code style={{ display: 'block', background: '#f5f5f5', padding: '10px', margin: '10px 0' }}>
          GOOGLE_OAUTH_REFRESH_TOKEN=your_refresh_token_here
        </code>
      </div>

      <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '4px', margin: '20px 0' }}>
        <h2>Step 2: Run the Drive Test</h2>
        <p>After saving the refresh token in <code>.env.local</code>, run this test:</p>
        <code style={{ display: 'block', background: '#f5f5f5', padding: '10px', margin: '10px 0' }}>
          curl -X POST http://localhost:3000/api/drive/test
        </code>
        <p>Or use this link:</p>
        <form method="POST" action="/api/drive/test" style={{ marginTop: '10px' }}>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              background: '#34A853',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Run Drive Test
          </button>
        </form>
      </div>

      <div style={{ background: '#f3e5f5', padding: '20px', borderRadius: '4px', margin: '20px 0' }}>
        <h3>Expected Results</h3>
        <ul>
          <li>✅ List FACTURAS/ENTRADA</li>
          <li>✅ Create test folders A and B</li>
          <li>✅ Upload file to folder A</li>
          <li>✅ Read file content</li>
          <li>✅ Move file to folder B</li>
          <li>✅ Verify file_id unchanged</li>
          <li>✅ Clean up (delete folders and file)</li>
        </ul>
      </div>
    </div>
  )
}
