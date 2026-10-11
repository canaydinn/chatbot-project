import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import dotenv from "dotenv";

export type LegacySheetRow = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rawRow: {
    first_name: string;
    last_name: string;
    email: string;
    registered_at: string;
    puan_a: string;
    puan_b: string;
    puan_c: string;
    puan_d: string;
    puan_e: string;
    puan_f: string;
  };
};

function cell(row: unknown[], index: number): string {
  const value = row[index];
  return value == null ? "" : String(value);
}

export function mapSheetRow(row: unknown[]): LegacySheetRow {
  const email = cell(row, 2).trim().toLowerCase();
  return {
    firstName: cell(row, 0).trim() || null,
    lastName: cell(row, 1).trim() || null,
    email: email || null,
    rawRow: {
      first_name: cell(row, 0),
      last_name: cell(row, 1),
      email: cell(row, 2),
      registered_at: cell(row, 3),
      puan_a: cell(row, 4),
      puan_b: cell(row, 5),
      puan_c: cell(row, 6),
      puan_d: cell(row, 7),
      puan_e: cell(row, 8),
      puan_f: cell(row, 9),
    },
  };
}

function isHeader(row: unknown[]): boolean {
  return cell(row, 0).trim().toLowerCase().includes("ad");
}

async function pickUsersSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  for (const sheet of sheetList) {
    const title = sheet.properties?.title;
    if (!title) continue;
    try {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${title}!A1:D1`,
      });
      const headerRow = (headerRes.data.values?.[0] || []).map((value) =>
        String(value || "").trim().toLowerCase(),
      );
      const looksLikeUsers =
        headerRow.some((value) => value.includes("ad")) &&
        headerRow.some((value) => value.includes("e-posta") || value.includes("eposta"));
      if (looksLikeUsers) return title;
    } catch {
      continue;
    }
  }
  const firstTitle = sheetList[0]?.properties?.title;
  if (!firstTitle) throw new Error("Google Sheets sayfası bulunamadı.");
  return firstTitle;
}

async function main(): Promise<void> {
  dotenv.config({ path: ".env.local" });
  if (process.env.ALLOW_CROSS_BORDER_TRANSFER !== "I_HAVE_LEGAL_APPROVAL") {
    throw new Error(
      "Yurt dışı aktarım için ALLOW_CROSS_BORDER_TRANSFER=I_HAVE_LEGAL_APPROVAL tanımlı değil. Betik ağ çağrısı yapmadan durdu.",
    );
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!serviceAccountEmail || !privateKey || !spreadsheetId || !supabaseUrl || !secret) {
    throw new Error("Sheets veya Supabase sunucu ayarı eksik.");
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = await pickUsersSheet(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:J`,
  });
  const rows = response.data.values || [];
  const dataRows = rows.length > 0 && isHeader(rows[0]) ? rows.slice(1) : rows;
  const payload = dataRows
    .map((row) => mapSheetRow(row))
    .filter((row) => row.email)
    .map((row) => ({
      email: row.email,
      first_name: row.firstName,
      last_name: row.lastName,
      raw_row: row.rawRow,
      source_spreadsheet_id: spreadsheetId,
    }));

  const supabase = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("legacy_sheet_import").insert(payload);
  if (error) throw new Error(error.message);
  console.log(`Aktarılan satır: ${payload.length}. Puan tablosuna yazılmadı.`);
}

const entry = process.argv[1]?.replace(/\\/g, "/");
if (entry?.endsWith("scripts/import-legacy-sheets.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
