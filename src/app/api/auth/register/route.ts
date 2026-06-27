// Registration API — creates a new user with email/password
import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/db/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const user = await registerUser(email, password, name);

    return NextResponse.json({
      success: true,
      user: { userId: user.userId, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }
    console.error('[API] Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 },
    );
  }
}
