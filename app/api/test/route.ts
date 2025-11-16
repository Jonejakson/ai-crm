import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Test successful',
      yourMessage: body.message 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid request' 
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    openaiKey: process.env.OPENAI_API_KEY ? 'exists' : 'missing'
  });
}