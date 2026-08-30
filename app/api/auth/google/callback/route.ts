import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, setCredentials } from '@/lib/oauth/google-auth'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

async function saveRefreshTokenToEnv(refreshToken: string): Promise<void> {
  const envFilePath = join(process.cwd(), '.env.local')

  try {
    // Read existing .env.local
    let envContent = ''
    try {
      envContent = readFileSync(envFilePath, 'utf-8')
    } catch {
      // File doesn't exist yet, start with empty content
      envContent = ''
    }

    // Check if GOOGLE_OAUTH_REFRESH_TOKEN already exists
    const tokenLineRegex = /^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m

    if (tokenLineRegex.test(envContent)) {
      // Replace existing token line
      envContent = envContent.replace(tokenLineRegex, `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`)
    } else {
      // Append new token line
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n'
      }
      envContent += `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}\n`
    }

    // Write back to .env.local
    writeFileSync(envFilePath, envContent, 'utf-8')
  } catch (error) {
    // If file write fails, throw error (but don't expose details)
    throw new Error('Failed to save refresh token')
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.json(
      { error: 'Google authorization error' },
      { status: 400 }
    )
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    setCredentials(tokens)

    // Save refresh_token to .env.local (never log or expose it)
    if (tokens.refresh_token) {
      await saveRefreshTokenToEnv(tokens.refresh_token)
    }

    // Redirect to success page (don't show tokens)
    return NextResponse.redirect(new URL('/api/oauth-success', request.url))
  } catch (error) {
    // Don't expose error details that might contain tokens
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    )
  }
}
