import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/oauth/google-auth'

export async function GET(request: NextRequest) {
  try {
    const authUrl = getAuthorizationUrl()
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error in /api/auth/google/authorize:', error)
    return NextResponse.json({ error: 'Authorization failed' }, { status: 500 })
  }
}
