import { NextRequest, NextResponse } from 'next/server';
import { createMockTokenResponse } from '@/lib/auth/mock';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Mock the Supabase auth response
    const tokenResponse = createMockTokenResponse(email, password);
    
    return NextResponse.json(tokenResponse);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Mock auth endpoint is running',
    endpoint: '/api/auth/mock',
    usage: 'POST with { email, password } to authenticate'
  });
}