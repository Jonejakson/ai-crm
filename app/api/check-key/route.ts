import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length,
    keyPrefix: key ? key.substring(0, 8) + '...' : null,
    nodeEnv: process.env.NODE_ENV
  });
}