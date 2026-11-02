import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'E-posta ile doğrudan kayıt kapatıldı. Tek kullanımlık kod kullanın.' },
    { status: 410 }
  );
}
