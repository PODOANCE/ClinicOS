import { NextResponse } from 'next/server'

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Authorization Complete</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 40px;
            background: #f5f5f5;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
          }
          .success-box {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #155724;
            margin: 0 0 20px 0;
            font-size: 28px;
          }
          .status-list {
            text-align: left;
            background: white;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            list-style: none;
          }
          .status-list li {
            padding: 10px 0;
            color: #155724;
            font-weight: 500;
            border-bottom: 1px solid #e0e0e0;
          }
          .status-list li:last-child {
            border-bottom: none;
          }
          .next-step {
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 20px;
            border-radius: 4px;
            margin-top: 20px;
          }
          .next-step h3 {
            margin: 0 0 10px 0;
            color: #1976D2;
          }
          .next-step p {
            margin: 8px 0;
            color: #424242;
          }
          .code {
            background: #f5f5f5;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier', monospace;
            font-size: 13px;
          }
          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #28a745;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            transition: background 0.3s;
          }
          a:hover {
            background: #218838;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-box">
            <div class="success-icon">✅</div>
            <h1>Google OAuth Authorized</h1>

            <ul class="status-list">
              <li>✅ Google OAuth authorized</li>
              <li>✅ Refresh token stored securely</li>
              <li>✅ Ready to test Google Drive</li>
            </ul>

            <div class="next-step">
              <h3>🚀 Next Step</h3>
              <p>Restart your development server to load the new refresh token:</p>
              <div class="code">npm run dev</div>
              <p style="margin-top: 15px;">Then proceed to test Google Drive integration.</p>
            </div>

            <a href="/api/oauth-test">← Back to Test Page</a>
          </div>
        </div>
      </body>
    </html>
  `

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
