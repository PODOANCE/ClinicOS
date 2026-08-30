import { NextResponse } from 'next/server'

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth2 + Google Drive Integration Test</title>
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
            text-align: center;
          }
          .step {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .step h2 {
            margin-top: 0;
            color: #1f2937;
          }
          .step p {
            color: #666;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #4285F4;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
          }
          .button:hover {
            background: #3367D6;
          }
          .button-green {
            background: #34A853;
          }
          .button-green:hover {
            background: #2D8E47;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .success {
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier', monospace;
          }
          .code-block {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 10px 0;
          }
          .code-block code {
            background: none;
            padding: 0;
            color: inherit;
          }
          .status {
            margin-top: 20px;
            padding: 15px;
            background: #e3f2fd;
            border-radius: 4px;
            border-left: 4px solid #2196F3;
          }
          ul {
            line-height: 2;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 OAuth2 + Google Drive Integration Test</h1>

          <div class="step">
            <h2>Step 1: Authorize Google Drive Access</h2>
            <p>Click the button below to authorize ClinicOS to access your Google Drive (info@podologiarivas.com).</p>
            <a href="/api/auth/google/authorize" class="button">
              🔑 Authorize Google Drive
            </a>
            <div class="warning">
              <strong>⚠️ What happens next:</strong>
              <ul>
                <li>You will be redirected to Google's login page</li>
                <li>You will need to authorize ClinicOS to access your Drive</li>
                <li>After authorization, you will see a success page with instructions</li>
              </ul>
            </div>
          </div>

          <div class="step">
            <h2>Step 2: Refresh Token Saved Automatically</h2>
            <p>After authorization succeeds, the refresh token is <strong>automatically saved</strong> to your <code>.env.local</code> file.</p>
            <p><strong>No manual action needed</strong> — you won't see the token displayed anywhere for security reasons.</p>
            <p>After the success page appears, restart your development server:</p>
            <div class="code-block">
              <code>npm run dev</code>
            </div>
          </div>

          <div class="step">
            <h2>Step 3: Run the Drive Integration Test</h2>
            <p>Once you have saved the refresh token and restarted the server, click below to run the full test:</p>
            <form method="POST" action="/api/drive/test" style="margin: 20px 0;">
              <button type="submit" class="button button-green">
                ✅ Run Drive Integration Test
              </button>
            </form>
            <div class="success">
              <strong>✅ This test will:</strong>
              <ul>
                <li>✅ List files in FACTURAS/ENTRADA</li>
                <li>✅ Create test folder A</li>
                <li>✅ Create test folder B</li>
                <li>✅ Upload a test file to folder A</li>
                <li>✅ Read the file content</li>
                <li>✅ Move the file from A to B</li>
                <li>✅ Verify file_id remains unchanged</li>
                <li>✅ Clean up (delete all test files and folders)</li>
              </ul>
            </div>
          </div>

          <div class="step">
            <h2>Expected Result</h2>
            <div class="success">
              <p><strong>All steps should return status: "ok"</strong></p>
              <p>This confirms that OAuth2 and Google Drive integration are working correctly.</p>
            </div>
          </div>

          <div class="step" style="border-left: 4px solid #9c27b0;">
            <h2>Troubleshooting</h2>
            <p><strong>If Step 1 fails:</strong> Check that your OAuth credentials in Google Cloud Console are correct.</p>
            <p><strong>If Step 3 fails:</strong> Make sure the refresh token is saved in <code>.env.local</code> and the server was restarted.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
