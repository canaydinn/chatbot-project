import { NextResponse } from 'next/server';

export async function GET() {
  const envCheck = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    QDRANT_URL: process.env.QDRANT_URL ? '✅ Set' : '❌ Missing',
    QDRANT_API_KEY: process.env.QDRANT_API_KEY ? '✅ Set (optional)' : '⚠️ Not set (optional)',
  };

  return NextResponse.json({
    environment: envCheck,
    timestamp: new Date().toISOString(),
  });
}

