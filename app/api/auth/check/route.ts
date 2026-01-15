import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

// Google Sheets API client'ı oluştur
function getSheetsClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA';

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Service Account credentials are missing');
  }

  // Private key formatını düzelt
  // 1. Tırnak işaretlerini kaldır (varsa)
  privateKey = privateKey.replace(/^["']|["']$/g, '');
  
  // 2. \n karakterlerini gerçek newline'a çevir
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // 3. Eğer BEGIN/END kısımları yoksa ekle
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Private key formatı geçersiz: BEGIN PRIVATE KEY bulunamadı');
  }
  
  if (!privateKey.includes('END PRIVATE KEY')) {
    throw new Error('Private key formatı geçersiz: END PRIVATE KEY bulunamadı');
  }

  // 4. BEGIN ve END kısımlarını kontrol et (5 tire olmalı)
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // 4 tire varsa 5'e çevir
    privateKey = privateKey.replace(/^----BEGIN PRIVATE KEY-----/m, '-----BEGIN PRIVATE KEY-----');
  }
  
  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    // 4 tire varsa 5'e çevir
    privateKey = privateKey.replace(/-----END PRIVATE KEY-----$/m, '-----END PRIVATE KEY-----');
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId };
  } catch (error: any) {
    console.error('JWT auth creation error:', error.message);
    throw new Error(`Private key parsing hatası: ${error.message}. Private key formatını kontrol edin.`);
  }
}

async function pickUsersSheetName(sheets: any, spreadsheetId: string): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];

  // Önce "Ad / E-posta" başlığı olan sheet'i bulmaya çalış
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
      // Sheet'e erişilemiyorsa pas geç
    }
  }

  // Bulamazsak ilk sheet
  const firstTitle = sheetList?.[0]?.properties?.title;
  return firstTitle || 'Sheet1';
}

export async function POST(req: Request) {
  try {
    // Environment variable kontrolü
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('Missing Google Service Account credentials');
      return NextResponse.json(
        {
          error: 'Google Sheets API yapılandırması eksik',
          hint: 'GOOGLE_SERVICE_ACCOUNT_EMAIL ve GOOGLE_PRIVATE_KEY environment variable\'larını kontrol edin',
        },
        { status: 500 }
      );
    }

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'E-posta adresi gerekli' },
        { status: 400 }
      );
    }

    let sheets, spreadsheetId;
    try {
      const client = getSheetsClient();
      sheets = client.sheets;
      spreadsheetId = client.spreadsheetId;
    } catch (error: any) {
      console.error('Error creating Sheets client:', error);
      return NextResponse.json(
        {
          error: 'Google Sheets API bağlantısı kurulamadı',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 500 }
      );
    }

    // Önce sheet bilgilerini al
    let sheetMetadata;
    try {
      sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId,
      });
    } catch (error: any) {
      console.error('Error getting sheet metadata:', error);
      return NextResponse.json(
        {
          error: 'Google Sheets dosyasına erişilemedi',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          hint: 'Service account\'un Google Sheets dosyasına erişim yetkisi olduğundan emin olun',
        },
        { status: 500 }
      );
    }

    const sheetName = await pickUsersSheetName(sheets, spreadsheetId);
    console.log('Using sheet name:', sheetName);

    // Sheet'teki tüm verileri oku
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:C`, // Ad, Soyad, E-posta sütunları
      });
    } catch (error: any) {
      console.error('Error reading from Google Sheets:', error);
      return NextResponse.json(
        {
          error: 'Google Sheets\'ten veri okunamadı',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          hint: `Sheet adı: ${sheetName}. Service account'un Google Sheets dosyasına erişim yetkisi olduğundan emin olun`,
        },
        { status: 500 }
      );
    }

    const rows = response.data.values || [];

    // İlk satır başlık olabilir, kontrol et
    const dataRows = rows.length > 0 && rows[0][0]?.toLowerCase().includes('ad') 
      ? rows.slice(1) 
      : rows;

    // E-posta kontrolü (case-insensitive)
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Checking email:', normalizedEmail);
    console.log('Total rows in sheet:', dataRows.length);
    
    const existingRow = dataRows.find((row) => {
      const rowEmail = row[2]?.toString().trim().toLowerCase();
      console.log('Comparing:', rowEmail, 'with', normalizedEmail);
      return rowEmail === normalizedEmail;
    });

    if (existingRow) {
      // E-posta bulundu
      console.log('Email found in sheet');
      const firstName = existingRow[0]?.toString().trim() || '';
      const lastName = existingRow[1]?.toString().trim() || '';
      return NextResponse.json({
        exists: true,
        name: `${firstName} ${lastName}`.trim(),
      });
    }

    console.log('Email not found in sheet');
    return NextResponse.json({
      exists: false,
    });
  } catch (error: any) {
    console.error('Error checking email:', error);
    return NextResponse.json(
      {
        error: 'E-posta kontrolü sırasında bir hata oluştu',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

