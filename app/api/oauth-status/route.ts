import { NextResponse } from 'next/server'

export async function GET() {
  const refreshTokenExists = !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  const clientIdExists = !!process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecretExists = !!process.env.GOOGLE_OAUTH_CLIENT_SECRET

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth2 Status</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 40px;
            background: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
          }
          h1 {
            color: #333;
          }
          .status-item {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .status-icon {
            font-size: 24px;
            min-width: 30px;
          }
          .status-text {
            flex: 1;
          }
          .status-text p {
            margin: 0;
            color: #666;
          }
          .status-text strong {
            display: block;
            color: #333;
            margin-bottom: 4px;
          }
          .ok {
            border-left: 4px solid #28a745;
          }
          .missing {
            border-left: 4px solid #dc3545;
          }
          .actions {
            margin-top: 30px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #34A853;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            margin-right: 10px;
            margin-bottom: 10px;
            transition: background 0.3s;
          }
          .button:hover {
            background: #2D8E47;
          }
          .button.secondary {
            background: #4285F4;
          }
          .button.secondary:hover {
            background: #3367D6;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>OAuth2 Status Check</h1>

          <div class="status-item ${clientIdExists ? 'ok' : 'missing'}">
            <div class="status-icon">${clientIdExists ? '✅' : '❌'}</div>
            <div class="status-text">
              <strong>Google OAuth Client ID</strong>
              <p>${clientIdExists ? 'Configured' : 'Missing from .env.local'}</p>
            </div>
          </div>

          <div class="status-item ${clientSecretExists ? 'ok' : 'missing'}">
            <div class="status-icon">${clientSecretExists ? '✅' : '❌'}</div>
            <div class="status-text">
              <strong>Google OAuth Client Secret</strong>
              <p>${clientSecretExists ? 'Configured' : 'Missing from .env.local'}</p>
            </div>
          </div>

          <div class="status-item ${refreshTokenExists ? 'ok' : 'missing'}">
            <div class="status-icon">${refreshTokenExists ? '✅' : '⏳'}</div>
            <div class="status-text">
              <strong>Google OAuth Refresh Token</strong>
              <p>${refreshTokenExists ? 'Stored and ready' : 'Not yet authorized'}</p>
            </div>
          </div>

          <div class="actions">
            ${
              refreshTokenExists
                ? `<a href="/api/drive/test" class="button">▶️ Run Drive Test</a>`
                : `<a href="/api/oauth-test" class="button secondary">🔑 Authorize Google</a>`
            }
            <a href="/api/oauth-test" class="button secondary">← Back to Test Page</a>
          </div>

          ${
            !refreshTokenExists
              ? `<div class="warning">
                  <strong>⏳ Authorization Required</strong>
                  <p>The refresh token has not been saved yet. Click "Authorize Google" above to complete the OAuth flow.</p>
                </div>`
              : `<div class="warning" style="background: #d4edda; border-left-color: #28a745;">
                  <strong>✅ Ready to Test</strong>
                  <p>All credentials are configured. You can now run the Drive integration test.</p>
                </div>`
          }
        </div>
      </body>
    </html>
  `

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
