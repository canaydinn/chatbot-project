import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

type SectionLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const SECTION_TO_COLUMN: Record<SectionLetter, string> = {
  A: 'E', // GENEL BİLGİLER
  B: 'F', // PAZAR ANALİZİ
  C: 'G', // TEKNİK ANALİZ
  D: 'H', // ORGANİZASYONEL ANALİZ
  E: 'I', // FİNANSAL ANALİZ
  F: 'J', // SONUÇ
};

function getSheetsClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA';

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Service Account credentials are missing');
  }

  privateKey = privateKey.replace(/^["']|["']$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    throw new Error('Private key formatı geçersiz');
  }

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = privateKey.replace(/^----BEGIN PRIVATE KEY-----/m, '-----BEGIN PRIVATE KEY-----');
  }
  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    privateKey = privateKey.replace(/-----END PRIVATE KEY-----$/m, '-----END PRIVATE KEY-----');
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId };
}

function isSectionLetter(x: unknown): x is SectionLetter {
  return x === 'A' || x === 'B' || x === 'C' || x === 'D' || x === 'E' || x === 'F';
}

async function pickUsersSheetName(sheets: any, spreadsheetId: string): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];

  for (const s of sheetList) {
    const title = s.properties?.title;
    if (!title) continue;
    try {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${title}!A1:D1`,
      });
      const headerRow = (headerRes.data.values?.[0] || []).map((v: any) =>
        String(v || '').trim().toLowerCase()
      );
      const looksLikeUsers =
        headerRow.some((v: string) => v.includes('ad')) && headerRow.some((v: string) => v.includes('e-posta') || v.includes('eposta'));
      if (looksLikeUsers) return title;
    } catch {
      // ignore
    }
  }

  const firstTitle = sheetList?.[0]?.properties?.title;
  return firstTitle || 'Sheet1';
}

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Google Sheets API yapılandırması eksik' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email : '';
    const sectionLetterRaw = typeof body?.sectionLetter === 'string' ? body.sectionLetter : '';
    const scoreRaw = body?.score;

    const normalizedEmail = email.trim().toLowerCase();
    const sectionLetter = sectionLetterRaw.trim().toUpperCase();
    const score = typeof scoreRaw === 'number' ? scoreRaw : Number.parseInt(String(scoreRaw), 10);

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email gerekli' }, { status: 400 });
    }
    if (!isSectionLetter(sectionLetter)) {
      return NextResponse.json({ error: 'Geçersiz sectionLetter' }, { status: 400 });
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'Geçersiz score (0-100)' }, { status: 400 });
    }

    const { sheets, spreadsheetId } = getSheetsClient();

    const sheetName = await pickUsersSheetName(sheets, spreadsheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:C`,
    });

    const rows = response.data.values || [];
    const hasHeader =
      rows.length > 0 && rows[0]?.[0]?.toString().trim().toLowerCase().includes('ad');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let rowIndex = dataRows.findIndex((row) => {
      const rowEmail = row?.[2]?.toString().trim().toLowerCase();
      return rowEmail === normalizedEmail;
    });

    if (rowIndex === -1) {
      // Kullanıcı yoksa satır oluştur (score yazımı için)
      const timestamp = new Date().toISOString();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:D`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [['', '', normalizedEmail, timestamp]],
        },
      });

      // Tekrar oku ve rowIndex bul
      const responseAfterAppend = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:C`,
      });
      const rowsAfterAppend = responseAfterAppend.data.values || [];
      const hasHeaderAfterAppend =
        rowsAfterAppend.length > 0 && rowsAfterAppend[0]?.[0]?.toString().trim().toLowerCase().includes('ad');
      const dataRowsAfterAppend = hasHeaderAfterAppend ? rowsAfterAppend.slice(1) : rowsAfterAppend;
      rowIndex = dataRowsAfterAppend.findIndex((row) => {
        const rowEmail = row?.[2]?.toString().trim().toLowerCase();
        return rowEmail === normalizedEmail;
      });

      if (rowIndex === -1) {
        return NextResponse.json(
          { error: 'Kullanıcı oluşturuldu ama bulunamadı' },
          { status: 500 }
        );
      }
    }

    const sheetRowNumber = (hasHeader ? 2 : 1) + rowIndex; // 1-indexed
    const column = SECTION_TO_COLUMN[sectionLetter];

    // Başlık satırı varsa, skor sütun başlıklarını bir kere yaz (boşsa)
    if (hasHeader) {
      const headerCheck = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!E1:J1`,
      });
      const headerValues = headerCheck.data.values?.[0] || [];
      const isEmptyHeader = headerValues.length === 0 || headerValues.every((v) => !String(v || '').trim());

      if (isEmptyHeader) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!E1:J1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['PUAN_A', 'PUAN_B', 'PUAN_C', 'PUAN_D', 'PUAN_E', 'PUAN_F']],
          },
        });
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${column}${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[score]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving score:', error);
    return NextResponse.json(
      {
        error: 'Skor kaydı sırasında hata oluştu',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

