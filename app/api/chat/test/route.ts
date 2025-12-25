import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    openaiKey: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
    qdrantUrl: process.env.QDRANT_URL ? 'Set' : 'Missing',
    qdrantKey: process.env.QDRANT_API_KEY ? 'Set' : 'Missing (optional)',
  });
}

