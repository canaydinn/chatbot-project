import mammoth from 'mammoth';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Environment variables'ları yükle
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Tip tanımlamaları
interface Chunk {
  sectionCode: string; // A.1.1, B.2.1 gibi
  title: string;
  purpose: string;
  searchedElements: string;
  scoringLogic: string;
  originalText: string;
}

// Hiyerarşik başlık regex'i (A.1.1, B.2.1, A.1.2.3 gibi)
const SECTION_REGEX = /^([A-Z])\.(\d+(?:\.\d+)*)\.\s+(.+)$/;

// Amaç, Aranan unsurlar, Puanlama mantığı için regex'ler
// Amaç bölümü "Amaç:" veya "Amaç" ile başlayabilir, sonraki bölüm başlığına veya "Aranan unsurlar"a kadar
const PURPOSE_REGEX = /Amaç[:\s]*\n(.*?)(?=\d+\.\d+\.\d+\.|Aranan unsurlar|!Puanlama|Puanlama Mantığı|$)/is;
// Aranan unsurlar bölümü, puanlama mantığına kadar
const SEARCHED_ELEMENTS_REGEX = /Aranan unsurlar[:\s]*\n(.*?)(?=!Puanlama|Puanlama Mantığı|$)/is;
// Puanlama mantığı bölümü, bir sonraki ana bölüm başlığına kadar
const SCORING_LOGIC_REGEX = /!?Puanlama Mantığı[:\s]*\n(.*?)(?=[A-Z]\.\d+\.|$)/is;

/**
 * Word veya text dosyasını oku ve metne çevir
 */
async function readFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.txt') {
    // Text dosyasını direkt oku
    return fs.readFileSync(filePath, 'utf-8');
  } else if (ext === '.docx') {
    // Word dosyasını mammoth ile oku
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error(`Unsupported file format: ${ext}. Supported formats: .txt, .docx`);
  }
}

/**
 * Metni satırlara ayır ve hiyerarşik bölümlere göre parse et
 */
function parseDocument(text: string): Chunk[] {
  // Metni satırlara ayır, boş satırları koru (bölümler arası ayrım için)
  const lines = text.split('\n');
  const chunks: Chunk[] = [];
  
  let currentSection: Partial<Chunk> | null = null;
  let currentSectionText: string[] = [];
  let currentSectionCode = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sectionMatch = line.match(SECTION_REGEX);
    
    // Yeni bir ana bölüm başlığı bulundu (A.1.1, B.2.1 gibi)
    if (sectionMatch) {
      // Önceki bölümü kaydet
      if (currentSection && currentSectionText.length > 0) {
        const fullText = currentSectionText.join('\n');
        const chunk = extractChunkData(currentSectionCode, fullText, currentSection.title || '');
        if (chunk) {
          chunks.push(chunk);
        }
      }
      
      // Yeni bölüm başlat
      currentSectionCode = `${sectionMatch[1]}.${sectionMatch[2]}`;
      const title = sectionMatch[3];
      currentSection = {
        sectionCode: currentSectionCode,
        title: title,
      };
      currentSectionText = [lines[i]]; // Orijinal satırı koru (boşluklar için)
    } else if (currentSection) {
      // Mevcut bölüme devam et
      currentSectionText.push(lines[i]);
    }
  }
  
  // Son bölümü kaydet
  if (currentSection && currentSectionText.length > 0) {
    const fullText = currentSectionText.join('\n');
    const chunk = extractChunkData(currentSectionCode, fullText, currentSection.title || '');
    if (chunk) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

/**
 * Bölüm metninden başlık, amaç, aranan unsurlar ve puanlama mantığını çıkar
 */
function extractChunkData(sectionCode: string, text: string, title: string): Chunk | null {
  // Amaç bölümünü bul - "Amaç:" veya "Amaç" ile başlayan kısım
  let purpose = '';
  const purposeMatch = text.match(PURPOSE_REGEX);
  if (purposeMatch) {
    purpose = purposeMatch[1].trim();
    // Eğer amaç çok uzunsa, ilk paragrafı al
    const purposeLines = purpose.split('\n');
    if (purposeLines.length > 5) {
      purpose = purposeLines.slice(0, 5).join('\n');
    }
  }
  
  // Aranan unsurlar bölümünü bul
  let searchedElements = '';
  const searchedMatch = text.match(SEARCHED_ELEMENTS_REGEX);
  if (searchedMatch) {
    searchedElements = searchedMatch[1].trim();
  }
  
  // Puanlama mantığı bölümünü bul
  let scoringLogic = '';
  const scoringMatch = text.match(SCORING_LOGIC_REGEX);
  if (scoringMatch) {
    scoringLogic = scoringMatch[1].trim();
  }
  
  // Eğer hiçbir bilgi yoksa, chunk'ı atla
  if (!purpose && !searchedElements && !scoringLogic) {
    return null;
  }
  
  return {
    sectionCode,
    title: title || sectionCode,
    purpose: purpose || '',
    searchedElements: searchedElements || '',
    scoringLogic: scoringLogic || '',
    originalText: text,
  };
}

/**
 * OpenAI ile embedding oluştur
 */
async function createEmbedding(text: string, openai: OpenAI): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  return response.data[0].embedding;
}

/**
 * Chunk'ları Qdrant'a yükle
 */
async function uploadToQdrant(chunks: Chunk[], qdrantClient: QdrantClient, collectionName: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  // Collection'ı oluştur veya kontrol et
  try {
    await qdrantClient.getCollection(collectionName);
    console.log(`Collection '${collectionName}' already exists`);
  } catch (error) {
    // Collection yoksa oluştur
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: 1536, // text-embedding-3-small boyutu
        distance: 'Cosine',
      },
    });
    console.log(`Collection '${collectionName}' created`);
  }
  
  // Her chunk için embedding oluştur ve yükle
  const points = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.sectionCode}`);
    
    // Embedding için metin oluştur (tüm bilgileri birleştir)
    const embeddingText = [
      `Bölüm: ${chunk.sectionCode} - ${chunk.title}`,
      chunk.purpose && `Amaç: ${chunk.purpose}`,
      chunk.searchedElements && `Aranan Unsurlar: ${chunk.searchedElements}`,
      chunk.scoringLogic && `Puanlama Mantığı: ${chunk.scoringLogic}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    
    // Embedding oluştur
    const embedding = await createEmbedding(embeddingText, openai);
    
    // Point'i hazırla (ID olarak index kullan - Qdrant sadece integer veya UUID kabul eder)
    // Index'i ID olarak kullanıyoruz
    const pointId = i;
    
    points.push({
      id: pointId,
      vector: embedding,
      payload: {
        sectionCode: chunk.sectionCode,
        title: chunk.title,
        purpose: chunk.purpose,
        searchedElements: chunk.searchedElements,
        scoringLogic: chunk.scoringLogic,
        originalText: chunk.originalText,
      },
    });
    
    console.log(`✓ Prepared chunk ${chunk.sectionCode}`);
    
    // Rate limiting için kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Tüm point'leri batch olarak yükle
  console.log(`\nUploading ${points.length} points to Qdrant...`);
  await qdrantClient.upsert(collectionName, {
    wait: true,
    points: points,
  });
  
  console.log(`✓ Successfully uploaded all chunks`);
  
}

/**
 * Ana fonksiyon
 */
async function main() {
  // Environment variables kontrolü
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  if (!process.env.QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is required');
  }
  
  // Qdrant client oluştur
  const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY, // Opsiyonel
  });
  
  // Dosyayı oku - komut satırı argümanı veya varsayılan yol
  const filePath = process.argv[2] || path.join(process.cwd(), 'YÖNERGE.docx');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at: ${filePath}\nUsage: npm run process-yonerge [path/to/file.txt or file.docx]`);
  }
  
  console.log(`Reading file: ${filePath}...`);
  const text = await readFile(filePath);
  
  console.log('Parsing document into chunks...');
  const chunks = parseDocument(text);
  
  console.log(`Found ${chunks.length} chunks`);
  
  // Qdrant'a yükle
  const collectionName = 'is_plani_rehberi';
  await uploadToQdrant(chunks, qdrantClient, collectionName);
  
  console.log('\n✓ Process completed successfully!');
}

// Script'i çalıştır
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

