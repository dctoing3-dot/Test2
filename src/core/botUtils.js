// src/core/botUtils.js

// ============================================================
//         UTILITY FUNCTIONS & HELPERS
// ============================================================

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const FormData = require('form-data');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const { BOT_CONFIG, EDGE_TTS_VOICES, ELEVENLABS_VOICES } = require('./botConfig');

// ============================================================
//         STORAGE MAPS
// ============================================================

const guildSettings = new Map();
const voiceConnections = new Map();
const audioPlayers = new Map();
const ttsQueues = new Map();
const conversations = new Map();
const voiceRecordings = new Map();
const voiceAISessions = new Map();
const processingUsers = new Set();
const rateLimits = new Map();

// ============================================================
//         DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
    aiProvider: 'groq',
    aiModel: 'llama-3.3-70b-versatile',
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
    ttsVoiceElevenlabs: 'id-ID-ArdiNeural',
    searchEnabled: true,
    searchProvider: 'auto',
    geminiGrounding: true
};

// ============================================================
//         SUPPORTED FILE TYPES
// ============================================================

const SUPPORTED_FILE_EXTENSIONS = [
    // Text & Code
    '.txt', '.md', '.markdown', '.rst',
    '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.py', '.pyw', '.pyi',
    '.java', '.kt', '.kts', '.scala',
    '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
    '.cs', '.fs', '.vb',
    '.go', '.rs', '.swift', '.m', '.mm',
    '.rb', '.php', '.pl', '.pm',
    '.r', '.R', '.rmd',
    '.sql', '.prisma',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.lua', '.vim', '.el',
    '.asm', '.s',
    // Config & Data
    '.json', '.jsonc', '.json5',
    '.yaml', '.yml',
    '.xml', '.xsl', '.xsd',
    '.toml', '.ini', '.cfg', '.conf',
    '.env', '.env.local', '.env.example',
    '.properties',
    '.csv', '.tsv',
    // Web
    '.html', '.htm', '.xhtml',
    '.css', '.scss', '.sass', '.less', '.styl',
    '.vue', '.svelte', '.astro',
    // Documents
    '.pdf',
    '.docx', '.doc',
    '.xlsx', '.xls',
    '.pptx', '.ppt',
    '.odt', '.ods', '.odp',
    '.rtf',
    // Other
    '.log', '.diff', '.patch',
    '.dockerfile', '.containerfile',
    '.gitignore', '.gitattributes',
    '.editorconfig', '.prettierrc', '.eslintrc',
    'makefile', 'cmakelists.txt', '.cmake',
    '.gradle', '.sbt', 'pom.xml', 'build.xml'
];

// ============================================================
//         SEARCH TRIGGERS
// ============================================================

const SEARCH_TRIGGERS = [
    'berita', 'news', 'kabar', 'terbaru', 'hari ini', 'sekarang',
    'latest', 'current', 'today', 'recent', 'update', 'breaking',
    'terkini', 'baru saja', 'barusan', 'kemarin', 'minggu ini',
    '2024', '2025', '2026', '2027', '2028', '2029', '2030',
    'tahun ini', 'tahun lalu', 'tahun depan', 'kapan', 'jadwal',
    'harga', 'price', 'kurs', 'nilai tukar', 'saham', 'stock',
    'crypto', 'bitcoin', 'dollar', 'rupiah', 'biaya', 'tarif',
    'gaji', 'harga emas', 'ihsg',
    'cuaca', 'weather', 'hujan', 'gempa', 'banjir', 'suhu',
    'prakiraan', 'forecast',
    'siapa', 'who is', 'siapa presiden', 'siapa menteri',
    'profil', 'biodata', 'umur', 'meninggal',
    'trending', 'viral', 'populer', 'hits', 'fyp', 'gosip',
    'heboh', 'ramai', 'hot topic',
    'skor', 'score', 'hasil pertandingan', 'klasemen',
    'liga', 'piala dunia', 'final', 'motogp', 'f1',
    'rilis', 'release', 'launching', 'spesifikasi', 'spec',
    'review', 'fitur terbaru', 'update software'
];

// ============================================================
//         BASIC UTILITY FUNCTIONS
// ============================================================

function ensureTempDir() {
    if (!fs.existsSync(BOT_CONFIG.tempPath)) {
        fs.mkdirSync(BOT_CONFIG.tempPath, { recursive: true });
    }
}

function cleanupFile(filepath) {
    try {
        if (filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch (e) {
        console.error('Cleanup error:', e.message);
    }
}

function splitMessage(text, maxLength = 1900) {
    if (text.length <= maxLength) return [text];
    
    const parts = [];
    let remaining = text;
    
    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            parts.push(remaining);
            break;
        }
        
        let idx = remaining.lastIndexOf('\n', maxLength);
        if (idx === -1 || idx < maxLength / 2) {
            idx = remaining.lastIndexOf('. ', maxLength);
        }
        if (idx === -1 || idx < maxLength / 2) {
            idx = remaining.lastIndexOf(' ', maxLength);
        }
        if (idx === -1) idx = maxLength;
        
        parts.push(remaining.slice(0, idx + 1));
        remaining = remaining.slice(idx + 1);
    }
    
    return parts;
}

function isAdmin(userId) {
    return BOT_CONFIG.adminIds.includes(String(userId));
}

// ============================================================
//         RATE LIMITER
// ============================================================

function checkRateLimit(userId) {
    const now = Date.now();
    const userLimit = rateLimits.get(userId);
    
    if (!userLimit || now > userLimit.resetAt) {
        rateLimits.set(userId, { 
            count: 1, 
            resetAt: now + BOT_CONFIG.rateLimitWindow 
        });
        return { allowed: true, remaining: BOT_CONFIG.rateLimitMax - 1 };
    }
    
    if (userLimit.count >= BOT_CONFIG.rateLimitMax) {
        return { 
            allowed: false, 
            waitTime: Math.ceil((userLimit.resetAt - now) / 1000) 
        };
    }
    
    userLimit.count++;
    return { allowed: true, remaining: BOT_CONFIG.rateLimitMax - userLimit.count };
}

// ============================================================
//         SETTINGS MANAGEMENT
// ============================================================

function getSettings(guildId) {
    if (!guildSettings.has(guildId)) {
        guildSettings.set(guildId, { ...DEFAULT_SETTINGS });
    }
    return guildSettings.get(guildId);
}

function updateSettings(guildId, key, value) {
    const s = getSettings(guildId);
    s[key] = value;
}

// ============================================================
//         CONVERSATION MEMORY
// ============================================================

function getConversation(guildId, userId) {
    const key = `${guildId}-${userId}`;
    
    if (!conversations.has(key)) {
        conversations.set(key, { 
            messages: [], 
            createdAt: Date.now(), 
            lastActivity: Date.now() 
        });
    }
    
    const conv = conversations.get(key);
    conv.lastActivity = Date.now();
    return conv;
}

function addToConversation(guildId, userId, role, content) {
    const conv = getConversation(guildId, userId);
    conv.messages.push({ role, content, timestamp: Date.now() });
    
    if (conv.messages.length > BOT_CONFIG.maxConversationMessages) {
        conv.messages = conv.messages.slice(-BOT_CONFIG.maxConversationMessages);
    }
}

function clearConversation(guildId, userId) {
    conversations.delete(`${guildId}-${userId}`);
}

function cleanupOldConversations() {
    const now = Date.now();
    for (const [key, conv] of conversations) {
        if (now - conv.lastActivity > BOT_CONFIG.maxConversationAge) {
            conversations.delete(key);
        }
    }
}

// ============================================================
//         HTTP HELPER
// ============================================================

function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ data, statusCode: res.statusCode }));
        });
        
        req.on('error', reject);
        req.setTimeout(60000, () => { 
            req.destroy(); 
            reject(new Error('Timeout')); 
        });
        
        if (body) req.write(body);
        req.end();
    });
}

// ============================================================
//         URL & FILE DETECTION
// ============================================================

function detectURLs(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex) || [];
    
    return urls.filter(url => {
        const lower = url.toLowerCase();
        
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
            return false;
        }
        if (lower.match(/\.(jpg|jpeg|png|gif|mp4|mp3|zip|exe)$/i)) {
            return false;
        }
        if (lower.match(/bit\.ly|tinyurl|t\.co/)) {
            return false;
        }
        return true;
    });
}

function shouldAutoFetch(url) {
    const domain = new URL(url).hostname;
    const autoFetchDomains = [
        'github.com', 'stackoverflow.com', 'medium.com', 'dev.to',
        'docs.google.com', 'ai.google.dev', 'openai.com',
        'discord.js.org', 'npmjs.com', 'wikipedia.org',
        'youtube.com', 'youtu.be'
    ];
    return autoFetchDomains.some(d => domain.includes(d));
}

function isMediaFile(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return false;
    return /\.(jpg|jpeg|png|gif|mp4|mp3|avi|mov|zip|rar)$/i.test(url);
}

function isShortener(url) {
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'short.link'];
    return shorteners.some(s => url.includes(s));
}

function shouldSearch(message) {
    const lower = message.toLowerCase();
    return SEARCH_TRIGGERS.some(trigger => lower.includes(trigger));
}

// ============================================================
//         TTS UTILITIES
// ============================================================

function cleanTextForTTS(text) {
    return text
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/www\.[^\s]+/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/:[a-zA-Z0-9_]+:/g, '')
        .replace(/```[\w]*\n?([\s\S]*?)```/g, ' kode ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim();
}

function getTTSVoices(provider) {
    return provider === 'elevenlabs' ? ELEVENLABS_VOICES : EDGE_TTS_VOICES;
}

function getDefaultVoice(provider) {
    return provider === 'elevenlabs' 
        ? 'id-ID-ArdiNeural'
        : 'id-ID-GadisNeural';
}

function isElevenlabsVoice(voiceId) {
    if (!voiceId) return false;
    return ELEVENLABS_VOICES.some(v => v.id === voiceId) || 
           (voiceId.length === 20 && /^[a-zA-Z0-9]+$/.test(voiceId));
}

function isEdgeTTSVoice(voiceId) {
    if (!voiceId) return false;
    if (voiceId.includes('Neural')) return true;
    return EDGE_TTS_VOICES.some(v => v.id === voiceId) || 
           ELEVENLABS_VOICES.some(v => v.id === voiceId);
}

// ============================================================
//         TTS GENERATION
// ============================================================

async function generatePuterTTS(text, options = {}) {
    let apiUrl = BOT_CONFIG.puterTTS?.apiUrl || 'https://puter-tts-api.onrender.com';
    if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

    const voiceId = options.voiceId || BOT_CONFIG.puterTTS?.voiceId || 'gmnazjXOFoOcWA59sd5m';
    
    console.log(`🎤 Puter.js TTS: Requesting to ${apiUrl}/tts`);

    try {
        const response = await fetch(`${apiUrl}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.slice(0, 2500),
                model: 'eleven_multilingual_v2',
                voice_id: voiceId
            }),
            timeout: 60000
        });

        if (!response.ok) throw new Error(`API Error ${response.status}`);
        const result = await response.json();
        
        if (!result.success || !result.audioUrl) {
            throw new Error(result.error || 'No audio URL');
        }

        const audioUrl = result.audioUrl;

        if (audioUrl.startsWith('data:')) {
            console.log('📥 Decoding Base64 Audio...');
            const base64Data = audioUrl.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        }

        let downloadUrl = audioUrl;
        if (downloadUrl.startsWith('//')) {
            downloadUrl = `https:${downloadUrl}`;
        }
        
        console.log(`📥 Downloading: ${downloadUrl}`);
        const audioRes = await fetch(downloadUrl);
        if (!audioRes.ok) throw new Error('Failed to download audio file');
        
        const arrayBuffer = await audioRes.arrayBuffer();
        return Buffer.from(arrayBuffer);

    } catch (error) {
        console.error('❌ Puter.js TTS Failed:', error.message);
        throw error;
    }
}

function generateEdgeTTS(text, voice, outputPath) {
    return new Promise((resolve, reject) => {
        const safeText = text.replace(/"/g, "'").replace(/`/g, "'");
        const rate = "+20%";
        const cmd = `edge-tts --voice "${voice}" --rate="${rate}" --text "${safeText}" --write-media "${outputPath}"`;
        
        console.log(`🔊 Edge-TTS: Generating with rate ${rate}`);
        
        exec(cmd, { timeout: 30000 }, (err) => {
            if (err) reject(err);
            else resolve(outputPath);
        });
    });
}

async function generateTTS(text, voice, userId = null) {
    ensureTempDir();
    const outputPath = path.join(BOT_CONFIG.tempPath, `tts_${Date.now()}.mp3`);
    const safeText = cleanTextForTTS(text).slice(0, 2900);

    if (!safeText || safeText.length < 2) {
        throw new Error('Text too short');
    }

    const usePuter = BOT_CONFIG.puterTTS?.enabled;
    const userIsAdmin = userId ? isAdmin(String(userId)) : false;
    const isElevenLabs = voice && (voice.length > 20 || voice.startsWith('gmn'));

    console.log(`🔊 TTS Request: Voice=${voice} Admin=${userIsAdmin} Puter=${usePuter}`);

    if (usePuter && userIsAdmin && isElevenLabs) {
        try {
            console.log(`🎤 Puter.js Generating: ${voice}`);
            const audioBuffer = await generatePuterTTS(safeText, { voiceId: voice });
            fs.writeFileSync(outputPath, audioBuffer);
            console.log(`✅ Puter.js Success`);
            return outputPath;
        } catch (error) {
            console.warn(`⚠️ Puter.js Failed, fallback to Edge-TTS: ${error.message}`);
        }
    }

    let edgeVoice = voice;
    if (!edgeVoice || edgeVoice.length > 30 || !edgeVoice.includes('Neural')) {
        edgeVoice = 'id-ID-GadisNeural';
    }

    console.log(`🔊 Generating Edge-TTS: ${edgeVoice}`);
    await generateEdgeTTS(safeText, edgeVoice, outputPath);
    console.log(`✅ Edge-TTS Success`);
    
    return outputPath;
}

// ============================================================
//         FILE READING UTILITIES
// ============================================================

async function readTextFile(buffer) {
    let text = buffer.toString('utf-8');
    
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    
    if (text.includes('�')) {
        try {
            text = buffer.toString('latin1');
        } catch {
            // Keep UTF-8 result
        }
    }
    
    return text;
}

async function readPDFFile(buffer) {
    try {
        const data = await pdfParse(buffer);
        
        if (!data.text || data.text.trim().length === 0) {
            throw new Error('PDF tidak memiliki teks yang bisa diekstrak');
        }
        
        let text = data.text
            .replace(/\f/g, '\n\n--- Page Break ---\n\n')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/\n{4,}/g, '\n\n\n')
            .trim();
        
        const meta = [];
        if (data.info?.Title) meta.push(`Title: ${data.info.Title}`);
        if (data.info?.Author) meta.push(`Author: ${data.info.Author}`);
        if (data.numpages) meta.push(`Pages: ${data.numpages}`);
        
        if (meta.length > 0) {
            text = `[PDF Metadata]\n${meta.join('\n')}\n\n[Content]\n${text}`;
        }
        
        return text;
        
    } catch (error) {
        throw new Error(`Gagal membaca PDF: ${error.message}`);
    }
}

async function readDOCXFile(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        
        if (!result.value || result.value.trim().length === 0) {
            throw new Error('Dokumen Word kosong');
        }
        
        let text = result.value;
        
        if (result.messages && result.messages.length > 0) {
            const warnings = result.messages
                .filter(m => m.type === 'warning')
                .map(m => m.message)
                .slice(0, 3);
            if (warnings.length > 0) {
                text = `[Catatan: ${warnings.join('; ')}]\n\n${text}`;
            }
        }
        
        return text;
        
    } catch (error) {
        throw new Error(`Gagal membaca DOCX: ${error.message}`);
    }
}

async function readExcelFile(buffer, ext) {
    try {
        const workbook = xlsx.read(buffer, { 
            type: 'buffer',
            cellDates: true,
            cellNF: true
        });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('File spreadsheet kosong');
        }
        
        let output = [];
        
        workbook.SheetNames.forEach((sheetName, idx) => {
            const sheet = workbook.Sheets[sheetName];
            const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');
            const rowCount = range.e.r - range.s.r + 1;
            const colCount = range.e.c - range.s.c + 1;
            
            output.push(`\nSheet ${idx + 1}: "${sheetName}" (${rowCount} rows x ${colCount} columns)`);
            output.push('-'.repeat(50));
            
            const data = xlsx.utils.sheet_to_json(sheet, { 
                header: 1, 
                defval: '',
                blankrows: false 
            });
            
            if (data.length === 0) {
                output.push('(Sheet kosong)');
                return;
            }
            
            data.slice(0, 100).forEach((row, rowIdx) => {
                if (Array.isArray(row)) {
                    const formattedRow = row.map(cell => {
                        if (cell === null || cell === undefined) return '';
                        if (cell instanceof Date) return cell.toLocaleDateString('id-ID');
                        return String(cell).slice(0, 50);
                    }).join(' | ');
                    
                    output.push(`Row ${rowIdx + 1}: ${formattedRow}`);
                    
                    if (rowIdx === 0) {
                        output.push('-'.repeat(50));
                    }
                }
            });
            
            if (data.length > 100) {
                output.push(`\n... dan ${data.length - 100} baris lainnya`);
            }
        });
        
        return output.join('\n');
        
    } catch (error) {
        throw new Error(`Gagal membaca spreadsheet: ${error.message}`);
    }
}

function isTextBasedExtension(ext) {
    const textExts = [
        '.txt', '.md', '.markdown', '.rst', '.log', '.diff', '.patch',
        '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.py', '.pyw', '.pyi', '.rb', '.php', '.pl', '.pm',
        '.java', '.kt', '.kts', '.scala', '.groovy',
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
        '.cs', '.fs', '.vb',
        '.go', '.rs', '.swift', '.m', '.mm',
        '.r', '.R', '.rmd', '.jl',
        '.sql', '.prisma', '.graphql', '.gql',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.lua', '.vim', '.el', '.clj', '.cljs', '.edn',
        '.asm', '.s', '.wasm', '.wat',
        '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties',
        '.xml', '.xsl', '.xsd', '.svg', '.html', '.htm', '.xhtml',
        '.css', '.scss', '.sass', '.less', '.styl',
        '.vue', '.svelte', '.astro', '.ejs', '.pug', '.hbs',
        '.env', '.gitignore', '.gitattributes', '.editorconfig',
        '.dockerfile', '.containerfile',
        '.tf', '.tfvars', '.hcl',
        '.makefile', '.cmake', '.gradle', '.sbt'
    ];
    return textExts.includes(ext.toLowerCase()) || ext === '';
}

function isLikelyText(buffer) {
    const sample = buffer.slice(0, Math.min(1000, buffer.length));
    let nullCount = 0;
    let controlCount = 0;
    
    for (const byte of sample) {
        if (byte === 0) nullCount++;
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) controlCount++;
    }
    
    return nullCount < sample.length * 0.1 && controlCount < sample.length * 0.1;
}

async function readFile(attachment) {
    const response = await fetch(attachment.url, { timeout: 30000 });
    
    if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
    }
    
    const buffer = await response.buffer();
    const ext = path.extname(attachment.name || '').toLowerCase();
    const filename = attachment.name || 'unknown';
    
    console.log(`📄 Reading file: ${filename} (${ext}, ${buffer.length} bytes)`);
    
    switch (ext) {
        case '.pdf':
            return await readPDFFile(buffer);
        case '.docx':
            return await readDOCXFile(buffer);
        case '.xlsx':
        case '.xls':
        case '.csv':
        case '.ods':
            return await readExcelFile(buffer, ext);
        case '.json':
        case '.jsonc':
        case '.json5':
            try {
                const cleaned = buffer.toString('utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
                const parsed = JSON.parse(cleaned);
                return JSON.stringify(parsed, null, 2);
            } catch {
                return buffer.toString('utf-8');
            }
        default:
            if (isTextBasedExtension(ext)) {
                return await readTextFile(buffer);
            }
            if (isLikelyText(buffer)) {
                return await readTextFile(buffer);
            }
            throw new Error(`Tipe file tidak didukung: ${ext}`);
    }
}

// ============================================================
//         WEB SCRAPING UTILITIES
// ============================================================

async function fetchURLClean(url, options = {}) {
    const { maxLength = 10000, timeout = 20000 } = options;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: controller.signal,
            redirect: 'follow',
            follow: 5
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            const json = await response.json();
            return { type: 'json', content: JSON.stringify(json, null, 2).slice(0, maxLength) };
        }
        
        if (contentType.includes('text/plain')) {
            const text = await response.text();
            return { type: 'text', content: text.slice(0, maxLength) };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const metadata = {
            title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '',
            description: $('meta[name="description"]').attr('content') || '',
            author: $('meta[name="author"]').attr('content') || ''
        };
        
        $('script, style, noscript, iframe, svg, nav, header, footer, aside, .ad, .ads, .sidebar, .comments, .share, #ad, #ads').remove();
        
        let mainContent = '';
        const selectors = ['article', 'main', '.post-content', '.entry-content', '.article-body', '#content', '.content'];
        
        for (const sel of selectors) {
            const el = $(sel).first();
            if (el.length && el.text().trim().length > 200) {
                mainContent = el.text();
                break;
            }
        }
        
        if (!mainContent || mainContent.length < 200) {
            mainContent = $('body').text();
        }
        
        mainContent = mainContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
        
        let output = metadata.title ? `${metadata.title}\n\n` : '';
        output += mainContent;
        
        return { type: 'html', title: metadata.title, content: output.slice(0, maxLength) };
        
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Timeout');
        throw error;
    }
}

async function readGitHubFile(url) {
    try {
        const rawUrl = url
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error('File not found');
        return await response.text();
    } catch (error) {
        throw new Error('Failed to read GitHub file');
    }
}

// ============================================================
//         SEARCH FUNCTIONS
// ============================================================

async function searchSerper(query) {
    if (!BOT_CONFIG.serperApiKey) return null;
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({ q: query, gl: 'id', hl: 'id', num: 5 });
        
        const req = https.request({
            hostname: 'google.serper.dev',
            path: '/search',
            method: 'POST',
            headers: { 
                'X-API-KEY': BOT_CONFIG.serperApiKey, 
                'Content-Type': 'application/json' 
            },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { 
                    if (res.statusCode === 200) {
                        const result = JSON.parse(data);
                        const urls = result.organic?.slice(0, 3).map(r => r.link).filter(Boolean) || [];
                        resolve({ ...result, urls });
                    } else {
                        resolve(null);
                    }
                } catch { resolve(null); }
            });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

async function searchTavily(query) {
    if (!BOT_CONFIG.tavilyApiKey) return null;
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({ 
            api_key: BOT_CONFIG.tavilyApiKey, 
            query, 
            include_answer: true, 
            max_results: 5 
        });
        
        const req = https.request({
            hostname: 'api.tavily.com',
            path: '/search',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { 
                    if (res.statusCode === 200) {
                        const result = JSON.parse(data);
                        const urls = result.results?.slice(0, 3).map(r => r.url).filter(Boolean) || [];
                        resolve({ ...result, urls });
                    } else {
                        resolve(null);
                    }
                } catch { resolve(null); }
            });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

async function performSearch(query, provider = 'auto') {
    const now = new Date().toLocaleDateString('id-ID', { 
        dateStyle: 'full', 
        timeZone: 'Asia/Jakarta' 
    });
    
    let result = { timestamp: now, answer: null, facts: [], urls: [], source: null };
    
    if (provider === 'serper' || provider === 'auto') {
        const serper = await searchSerper(query);
        if (serper) {
            result.source = 'serper';
            result.urls = serper.urls || [];
            if (serper.answerBox) {
                result.answer = serper.answerBox.answer || serper.answerBox.snippet;
            }
            if (serper.organic) {
                result.facts = serper.organic.slice(0, 3).map(o => o.snippet).filter(Boolean);
            }
            if (result.answer || result.facts.length || result.urls.length) {
                return result;
            }
        }
    }
    
    if (provider === 'tavily' || provider === 'auto') {
        const tavily = await searchTavily(query);
        if (tavily) {
            result.source = 'tavily';
            result.urls = tavily.urls || [];
            if (tavily.answer) result.answer = tavily.answer;
            if (tavily.results) {
                result.facts = tavily.results.slice(0, 3).map(r => r.content?.slice(0, 200)).filter(Boolean);
            }
            if (result.answer || result.facts.length || result.urls.length) {
                return result;
            }
        }
    }
    
    return null;
}

// ============================================================
//         REASONING UTILITIES
// ============================================================

function parseThinkingResponse(text) {
    let thinking = '';
    let answer = text;
    
    const thinkingMatch = text.match(/\[THINKING\]([\s\S]*?)\[\/THINKING\]/i);
    if (thinkingMatch) {
        thinking = thinkingMatch[1].trim();
        answer = text.replace(thinkingMatch[0], '').trim();
    }
    
    const answerMatch = answer.match(/\[ANSWER\]([\s\S]*?)\[\/ANSWER\]/i);
    if (answerMatch) {
        answer = answerMatch[1].trim();
    }
    
    answer = answer
        .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '')
        .replace(/\[ANSWER\]/gi, '')
        .replace(/\[\/ANSWER\]/gi, '')
        .replace(/<reasoning process.*?>/gi, '')
        .replace(/<jawaban.*?>/gi, '')
        .replace(/<.*?step.*?>/gi, '')
        .replace(/\[ANALYSIS TASK\][\s\S]*?(?=\n\n|\[)/gi, '')
        .replace(/\[TASK\][\s\S]*?(?=\n\n|\[)/gi, '')
        .replace(/\[REASONING PROCESS.*?\][\s\S]*?(?=\n\n\[|\[SOURCE)/gi, '')
        .replace(/\[USER REQUEST\][\s\S]*?(?=\n\n|\[)/gi, '')
        .replace(/\[CURRENT DATE:.*?\]/gi, '')
        .replace(/\[SOURCES.*?\][\s\S]*?(?=\n\n\n|\[ANSWER)/gi, '')
        .replace(/\[ANALYSIS GUIDELINES\][\s\S]*/gi, '')
        .replace(/━+/g, '')
        .replace(/─+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    if (!answer || answer.length < 50 || (answer.includes('<') && answer.includes('>'))) {
        answer = text
            .replace(/\[[\s\S]*?\]/g, '')
            .replace(/<[\s\S]*?>/g, '')
            .replace(/━+/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    
    return { thinking, answer };
}

function buildContextPrompt(query, contents, isThinking = true) {
    const timestamp = new Date().toLocaleDateString('id-ID', { 
        dateStyle: 'full', 
        timeZone: 'Asia/Jakarta' 
    });
    
    let prompt = `[CURRENT DATE: ${timestamp}]

[INSTRUCTION]
You will receive content from multiple sources. Analyze them carefully and answer the user's question in Bahasa Indonesia.
`;

    if (isThinking) {
        prompt += `
THINK STEP BY STEP:
1. Identify key information from each source
2. Cross-reference facts across sources
3. Determine most reliable information
4. Formulate comprehensive answer

Format your response as:
[THINKING]
Your step-by-step reasoning here...
[/THINKING]

[ANSWER]
Your final answer here...
[/ANSWER]
`;
    }

    prompt += '\n[SOURCES]\n';
    
    contents.forEach((c, i) => {
        prompt += `\n--- Source ${i + 1}: ${c.url || c.name || 'Unknown'} ---\n${c.content || c.text}\n`;
    });
    
    prompt += `\n[USER QUESTION]\n${query}`;
    
    return prompt;
}

// ============================================================
//         WAV HEADER UTILITY
// ============================================================

function createWavHeader(dataLength, sampleRate, numChannels, bitsPerSample) {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);
    
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    
    return buffer;
}

// ============================================================
//         EXPORTS
// ============================================================

module.exports = {
    // Storage Maps
    guildSettings,
    voiceConnections,
    audioPlayers,
    ttsQueues,
    conversations,
    voiceRecordings,
    voiceAISessions,
    processingUsers,
    rateLimits,
    
    // Constants
    DEFAULT_SETTINGS,
    SUPPORTED_FILE_EXTENSIONS,
    SEARCH_TRIGGERS,
    
    // Basic Utilities
    ensureTempDir,
    cleanupFile,
    splitMessage,
    isAdmin,
    checkRateLimit,
    httpRequest,
    
    // Settings Management
    getSettings,
    updateSettings,
    
    // Conversation Memory
    getConversation,
    addToConversation,
    clearConversation,
    cleanupOldConversations,
    
    // URL & File Detection
    detectURLs,
    shouldAutoFetch,
    isMediaFile,
    isShortener,
    shouldSearch,
    
    // TTS Utilities
    cleanTextForTTS,
    getTTSVoices,
    getDefaultVoice,
    isElevenlabsVoice,
    isEdgeTTSVoice,
    generateTTS,
    generateEdgeTTS,
    generatePuterTTS,
    
    // File Reading
    readFile,
    readTextFile,
    readPDFFile,
    readDOCXFile,
    readExcelFile,
    isTextBasedExtension,
    isLikelyText,
    
    // Web Scraping
    fetchURLClean,
    readGitHubFile,
    
    // Search Functions
    searchSerper,
    searchTavily,
    performSearch,
    
    // Reasoning Utilities
    parseThinkingResponse,
    buildContextPrompt,
    
    // Audio Utilities
    createWavHeader
};
