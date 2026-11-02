import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Kapalı.' }, { status: 404 });
}