import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { error: 'İstemciden puan yazımı kapatıldı. Puanlar sunucuda yapılandırılmış değerlendirmeden üretilir.' },
    { status: 403 }
  );
}
