import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Google Sheets API test endpoint
export async function GET() {
  try {
    // Environment variable kontrolü
    const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA';

    const envStatus = {
      GOOGLE_SERVICE_ACCOUNT_EMAIL: hasEmail ? 'Set' : 'Missing',
      GOOGLE_PRIVATE_KEY: hasKey ? 'Set' : 'Missing',
      GOOGLE_SPREADSHEET_ID: spreadsheetId,
    };

    if (!hasEmail || !hasKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Environment variables are missing',
        envStatus,
      });
    }

    // Google Sheets API bağlantısını test et
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY!;
      
      // Private key analizi
      const originalLength = privateKey.length;
      const hasQuotes = privateKey.startsWith('"') || privateKey.startsWith("'");
      const hasNewlines = privateKey.includes('\\n') || privateKey.includes('\n');
      
      // Private key formatını düzelt
      privateKey = privateKey.replace(/^["']|["']$/g, ''); // Tırnakları kaldır
      privateKey = privateKey.replace(/\\n/g, '\n'); // \n'leri newline'a çevir
      
      // BEGIN/END kontrolü
      const hasBegin = privateKey.includes('BEGIN PRIVATE KEY');
      const hasEnd = privateKey.includes('END PRIVATE KEY');
      const beginCount = (privateKey.match(/BEGIN PRIVATE KEY/g) || []).length;
      const endCount = (privateKey.match(/END PRIVATE KEY/g) || []).length;
      
      if (!hasBegin || !hasEnd) {
        return NextResponse.json({
          status: 'error',
          message: 'Private key formatı geçersiz',
          diagnostics: {
            hasBegin,
            hasEnd,
            beginCount,
            endCount,
            originalLength,
            hasQuotes,
            hasNewlines,
            firstChars: privateKey.substring(0, 50),
            lastChars: privateKey.substring(Math.max(0, privateKey.length - 50)),
          },
          hint: 'Private key -----BEGIN PRIVATE KEY----- ve -----END PRIVATE KEY----- içermeli. JSON dosyasından "private_key" değerini TAMAMEN kopyalayın.',
        });
      }
      
      // 4 tire'yi 5'e çevir
      privateKey = privateKey.replace(/^----BEGIN PRIVATE KEY-----/m, '-----BEGIN PRIVATE KEY-----');
      privateKey = privateKey.replace(/-----END PRIVATE KEY-----$/m, '-----END PRIVATE KEY-----');
      
      // Private key uzunluğu kontrolü (genellikle 2000+ karakter olmalı)
      if (privateKey.length < 1000) {
        return NextResponse.json({
          status: 'error',
          message: 'Private key çok kısa görünüyor',
          diagnostics: {
            length: privateKey.length,
            expectedMinLength: 1000,
            firstChars: privateKey.substring(0, 100),
            hint: 'Private key genellikle 2000+ karakter uzunluğunda olmalı. JSON dosyasından TAMAMEN kopyaladığınızdan emin olun.',
          },
        });
      }

      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Önce sheet bilgilerini al
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      // İlk sheet'i kullan
      const firstSheet = sheetMetadata.data.sheets?.[0];
      if (!firstSheet) {
        return NextResponse.json({
          status: 'error',
          message: 'Google Sheets dosyasında sheet bulunamadı',
          envStatus,
        });
      }

      const sheetName = firstSheet.properties?.title || 'Sheet1';

      // Sheet'i okuyarak bağlantıyı test et
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:D1`, // Sadece ilk satırı oku
      });

      return NextResponse.json({
        status: 'success',
        message: 'Google Sheets API bağlantısı başarılı',
        envStatus,
        sheetInfo: {
          sheetName,
          sheetId: firstSheet.properties?.sheetId,
        },
        sheetData: {
          hasData: !!response.data.values,
          firstRow: response.data.values?.[0] || [],
        },
      });
    } catch (error: any) {
      return NextResponse.json({
        status: 'error',
        message: 'Google Sheets API bağlantı hatası',
        envStatus,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Test sırasında bir hata oluştu',
      error: error.message,
    });
  }
}

