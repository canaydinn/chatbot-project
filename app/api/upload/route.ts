import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import mammoth from 'mammoth';

// Qdrant client'ı oluştur
function getQdrantClient() {
  if (!process.env.QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is required');
  }

  return new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
}

// OpenAI client'ı oluştur
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Metni chunk'lara ayır (basit yaklaşım - satır bazlı)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Overlap için son birkaç satırı koru
      const lastLines = currentChunk.split('\n').slice(-Math.floor(overlap / 50));
      currentChunk = lastLines.join('\n') + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Embedding oluştur
async function createEmbedding(text: string, openaiClient: OpenAI): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

function getHttpStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if (!('status' in err)) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

async function extractTextFromUploadedFile(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';

  if (ext === '.txt') {
    return await file.text();
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === '.pdf') {
    const nodePath = await import('path');
    const { pathToFileURL } = await import('url');
    const { PDFParse } = await import('pdf-parse');
    // require.resolve ile modül sisteminden kesin yolu al; fallback: process.cwd()
    let pdfParseDir: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParseDir = nodePath.dirname(require.resolve('pdf-parse'));
    } catch {
      pdfParseDir = nodePath.join(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/cjs');
    }
    const workerAbsPath = nodePath.join(pdfParseDir, 'pdf.worker.mjs');
    const workerUrl = pathToFileURL(workerAbsPath).href;
    console.log('[PDF] workerUrl:', workerUrl);
    PDFParse.setWorker(workerUrl);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  }

  throw new Error(`Unsupported file format: ${ext || '(no extension)'}. Supported formats: .txt, .pdf, .docx`);
}

export async function POST(req: NextRequest) {
  try {
    // Environment variable kontrolü
    if (!process.env.OPENAI_API_KEY || !process.env.QDRANT_URL) {
      return NextResponse.json(
        { error: 'Environment variables are missing' },
        { status: 500 }
      );
    }

    // Request body'yi al
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const email = formData.get('email') as string;

    if (!file || !email) {
      return NextResponse.json(
        { error: 'File and email are required' },
        { status: 400 }
      );
    }

    // Dosyayı oku (.txt, .pdf, .docx)
    let text = '';
    try {
      text = await extractTextFromUploadedFile(file);
    } catch (e: unknown) {
      return NextResponse.json(
        { error: getErrorMessage(e) || 'Unsupported file type' },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract any text from the uploaded file' },
        { status: 400 }
      );
    }

    console.log(`File uploaded: ${file.name}, extracted text size: ${text.length} characters`);

    // Collection adı (e-posta ID'sine göre)
    const emailHash = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const collectionName = `user_${emailHash}`;

    // Qdrant ve OpenAI client'ları
    const qdrantClient = getQdrantClient();
    const openaiClient = getOpenAIClient();

    // Collection'ı oluştur veya kontrol et
    try {
      await qdrantClient.getCollection(collectionName);
      console.log(`Collection ${collectionName} already exists, will update`);
    } catch (error: unknown) {
      const status = getHttpStatus(error);
      const errMsg = getErrorMessage(error).toLowerCase();
      const isNotFound = status === 404 || errMsg.includes('not found') || errMsg.includes('doesn') || errMsg.includes('404');
      console.log(`[Qdrant] getCollection error | status=${status} | msg=${getErrorMessage(error)} | isNotFound=${isNotFound}`);
      if (isNotFound) {
        try {
          await qdrantClient.createCollection(collectionName, {
            vectors: {
              size: 1536,
              distance: 'Cosine',
            },
          });
          console.log(`Created collection: ${collectionName}`);
        } catch (createErr: unknown) {
          console.error(`[Qdrant] createCollection failed: ${getErrorMessage(createErr)}`);
          throw createErr;
        }
      } else {
        throw error;
      }
    }

    // Metni chunk'lara ayır
    const chunks = chunkText(text, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    // Her chunk için embedding oluştur ve Qdrant'a yükle
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk, openaiClient);
      
      points.push({
        id: i,
        vector: embedding,
        payload: {
          text: chunk,
          fileName: file.name,
          chunkIndex: i,
          totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Batch olarak yükle (her 10 chunk'ta bir)
      if (points.length >= 10 || i === chunks.length - 1) {
        await qdrantClient.upsert(collectionName, {
          wait: true,
          points: points,
        });
        console.log(`Uploaded ${points.length} chunks to Qdrant`);
        points.length = 0; // Array'i temizle
      }
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded and processed successfully',
      collectionName,
      chunksCount: chunks.length,
      fileName: file.name,
    });
  } catch (error: unknown) {
    const detail = getErrorMessage(error);
    console.error('Error uploading file:', detail);
    return NextResponse.json(
      {
        error: `Failed to upload file: ${detail}`,
      },
      { status: 500 }
    );
  }
}

