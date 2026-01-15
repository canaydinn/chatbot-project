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

    const { firstName, lastName, email } = await req.json();

    // Validasyon
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Ad, Soyad ve E-posta alanları zorunludur' },
        { status: 400 }
      );
    }

    // E-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Geçersiz e-posta formatı' },
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

    let sheetName = 'Sheet1';
    try {
      sheetName = await pickUsersSheetName(sheets, spreadsheetId);
    } catch (error: any) {
      console.error('Error selecting sheet name:', error);
      return NextResponse.json(
        {
          error: 'Google Sheets dosyasına erişilemedi',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          hint: 'Service account\'un Google Sheets dosyasına erişim yetkisi olduğundan emin olun',
        },
        { status: 500 }
      );
    }
    console.log('Using sheet name:', sheetName);

    // Önce e-posta kontrolü yap
    let checkResponse;
    try {
      checkResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:C`,
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

    const rows = checkResponse.data.values || [];
    const dataRows = rows.length > 0 && rows[0][0]?.toLowerCase().includes('ad') 
      ? rows.slice(1) 
      : rows;

    const normalizedEmail = email.trim().toLowerCase();
    const existingRow = dataRows.find((row) => {
      const rowEmail = row[2]?.toString().trim().toLowerCase();
      return rowEmail === normalizedEmail;
    });

    if (existingRow) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlı' },
        { status: 409 }
      );
    }

    // Yeni kayıt ekle
    const timestamp = new Date().toISOString();
    const newRow = [
      firstName.trim(),
      lastName.trim(),
      email.trim().toLowerCase(),
      timestamp, // Kayıt tarihi
    ];

    // Sheet'e yeni satır ekle
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:D`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow],
        },
      });
    } catch (error: any) {
      console.error('Error writing to Google Sheets:', error);
      return NextResponse.json(
        {
          error: 'Google Sheets\'e veri yazılamadı',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          hint: `Sheet adı: ${sheetName}. Service account'un Google Sheets dosyasına yazma yetkisi olduğundan emin olun`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kayıt başarıyla oluşturuldu',
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      {
        error: 'Kayıt sırasında bir hata oluştu',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

