import { NextResponse } from 'next/server';

const HOLD =
  'Yurt dışı aktarım için ALLOW_CROSS_BORDER_TRANSFER=I_HAVE_LEGAL_APPROVAL tanımlı değil. Betik ağ çağrısı yapmadan durdu.';

export async function POST() {
  if (process.env.ALLOW_CROSS_BORDER_TRANSFER !== 'I_HAVE_LEGAL_APPROVAL') {
    return NextResponse.json({ error: HOLD }, { status: 409 });
  }
  return NextResponse.json(
    { error: 'Aktarım betiği hukuki onaydan sonra tamamlanacak. Bu çağrı veri taşımadı.' },
    { status: 501 }
  );
}
