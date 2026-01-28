// ============================================================
//         DISCORD AI BOT - MULTI PROVIDER v2.2
//         Full Version dengan Semua Fitur
// ============================================================

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActivityType 
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const { exec } = require('child_process');
const { createServer } = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURASI ====================
const CONFIG = {
    token: process.env.DISCORD_TOKEN,
    prefix: '!',
    adminIds: (process.env.ADMIN_IDS || '').split(',').filter(Boolean),
    dataPath: './data/settings.json'
};

// ==================== SYSTEM PROMPT (SEPERTI CLAUDE) ====================
const MASTER_SYSTEM_PROMPT = `Kamu adalah Aria, asisten AI yang sangat cerdas, jujur, dan helpful. Kamu memiliki kemampuan seperti Claude AI dari Anthropic.

## KARAKTERISTIK UTAMA:
1. **Jujur & Transparan**: Selalu jujur. Jika tidak tahu, katakan tidak tahu. Jangan mengarang fakta.
2. **Logis & Analitis**: Berpikir step-by-step. Jelaskan reasoning dengan jelas.
3. **Expert Coding**: Sangat ahli dalam programming. Berikan kode yang clean, efficient, dan well-documented.
4. **Helpful**: Berusaha membantu sebaik mungkin dengan jawaban yang akurat dan berguna.
5. **Bahasa Natural**: Berbicara dengan bahasa Indonesia yang natural dan friendly.

## ATURAN CODING:
- Selalu berikan kode yang bisa langsung dijalankan
- Sertakan komentar penjelasan
- Gunakan best practices
- Jika ada error dalam kode user, jelaskan dengan detail

## ATURAN JAWABAN:
- Untuk voice: jawab singkat 2-3 kalimat, langsung ke poin
- Untuk text: bisa lebih detail jika diperlukan
- JANGAN gunakan emoji berlebihan dalam respons
- Hindari kata-kata yang tidak perlu

## KEJUJURAN:
- Akui keterbatasan jika ada
- Jangan berpura-pura bisa melakukan hal yang tidak bisa
- Berikan disclaimer jika informasi mungkin outdated`;

// ==================== AI PROVIDERS & MODELS (LENGKAP) ====================
const AI_PROVIDERS = {
    groq: {
        name: 'Groq',
        requiresKey: true,
        keyEnv: 'GROQ_API_KEY',
        models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', version: 'v3.3' },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', version: 'v3.1' },
            { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', version: 'v3.2' },
            { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision', version: 'v3.2' },
            { id: 'gemma2-9b-it', name: 'Gemma2 9B', version: 'v2' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', version: '8x7B' },
            { id: 'whisper-large-v3', name: 'Whisper Large V3 (STT)', version: 'v3' },
            { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo', version: 'v3-turbo' }
        ]
    },
    pollinations_free: {
        name: 'Pollinations (Free)',
        requiresKey: false,
        models: [
            { id: 'openai', name: 'OpenAI GPT', version: 'GPT-4.1' },
            { id: 'openai-large', name: 'OpenAI Large', version: 'GPT-4.1-large' },
            { id: 'openai-reasoning', name: 'OpenAI Reasoning', version: 'o3-mini' },
            { id: 'qwen', name: 'Qwen', version: 'Qwen3' },
            { id: 'qwen-coder', name: 'Qwen Coder', version: 'Qwen3-Coder' },
            { id: 'llama', name: 'Llama', version: 'Llama-3.3' },
            { id: 'mistral', name: 'Mistral', version: 'Mistral-Small' },
            { id: 'mistral-large', name: 'Mistral Large', version: 'Mistral-Large' },
            { id: 'unity', name: 'Unity', version: 'Unity-v1' },
            { id: 'midijourney', name: 'Midijourney', version: 'v1' },
            { id: 'rtist', name: 'Rtist', version: 'v1' },
            { id: 'searchgpt', name: 'SearchGPT', version: 'v1' },
            { id: 'evil', name: 'Evil Mode', version: 'uncensored' },
            { id: 'deepseek', name: 'DeepSeek', version: 'V3' },
            { id: 'deepseek-r1', name: 'DeepSeek R1', version: 'R1' },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', version: 'R1-Reasoner' },
            { id: 'claude-hybridspace', name: 'Claude Hybridspace', version: 'Claude-3.5' },
            { id: 'gemini', name: 'Gemini', version: '2.5-Pro' },
            { id: 'gemini-thinking', name: 'Gemini Thinking', version: '2.5-Flash-Thinking' },
            { id: 'hormoz', name: 'Hormoz', version: 'v1' },
            { id: 'hypnosis-tracy', name: 'Hypnosis Tracy', version: 'v1' },
            { id: 'sur', name: 'Sur', version: 'v1' },
            { id: 'llama-scaleway', name: 'Llama Scaleway', version: 'Llama-3.1-70B' }
        ]
    },
    pollinations_api: {
        name: 'Pollinations (API)',
        requiresKey: true,
        keyEnv: 'POLLINATIONS_API_KEY',
        models: [
            { id: 'openai', name: 'OpenAI GPT (API)', version: 'GPT-4.1' },
            { id: 'openai-large', name: 'OpenAI Large (API)', version: 'GPT-4.1-large' },
            { id: 'claude', name: 'Claude (API)', version: 'Claude-3.5' },
            { id: 'gemini', name: 'Gemini (API)', version: '2.5-Pro' }
        ]
    },
    openrouter: {
        name: 'OpenRouter',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        models: [
            { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B', version: '4B-free' },
            { id: 'qwen/qwen3-14b:free', name: 'Qwen3 14B', version: '14B-free' },
            { id: 'qwen/qwen3-32b:free', name: 'Qwen3 32B', version: '32B-free' },
            { id: 'deepseek/deepseek-r1t-chimera:free', name: 'DeepSeek R1T Chimera', version: 'R1T-free' },
            { id: 'deepseek/deepseek-r1t2-chimera:free', name: 'DeepSeek R1T2 Chimera', version: 'R1T2-free' },
            { id: 'google/gemma-3-4b:free', name: 'Gemma 3 4B', version: '4B-free' },
            { id: 'google/gemma-3-12b:free', name: 'Gemma 3 12B', version: '12B-free' },
            { id: 'google/gemma-3-27b:free', name: 'Gemma 3 27B', version: '27B-free' },
            { id: 'google/gemma-3n-2b:free', name: 'Gemma 3n 2B', version: '2B-free' },
            { id: 'mistralai/mistral-small-3.1-24b:free', name: 'Mistral Small 3.1 24B', version: '24B-free' },
            { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', version: '70B-free' },
            { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B V2', version: '9B-free' },
            { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', version: '3B-free' },
            { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Llama 3.2 1B', version: '1B-free' },
            { id: 'thudm/glm-4.5-air:free', name: 'GLM 4.5 Air', version: '4.5-free' },
            { id: 'thudm/glm-z1-32b:free', name: 'GLM Z1 32B', version: '32B-free' },
            { id: 'featherless/trinity-mini:free', name: 'Trinity Mini', version: 'mini-free' },
            { id: 'featherless/trinity-large-preview:free', name: 'Trinity Large', version: 'large-free' },
            { id: 'upstage/solar-pro-3:free', name: 'Solar Pro 3', version: 'pro3-free' },
            { id: 'liquid/lfm2.5-1.2b-thinking:free', name: 'LFM 1.2B Thinking', version: '1.2B-free' },
            { id: 'liquid/lfm2.5-1.2b-instruct:free', name: 'LFM 1.2B Instruct', version: '1.2B-free' },
            { id: 'allenai/molmo2-8b:free', name: 'Molmo2 8B', version: '8B-free' },
            { id: 'moonshotai/kimi-vl-a3b-thinking:free', name: 'Kimi VL A3B', version: 'A3B-free' }
        ]
    },
    huggingface: {
        name: 'HuggingFace',
        requiresKey: true,
        keyEnv: 'HUGGINGFACE_API_KEY',
        models: [
            { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', version: '3.1-8B' },
            { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B', version: '3.2-3B' },
            { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', version: '7B-v0.3' },
            { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini', version: 'mini-4k' },
            { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', version: '2.5-72B' },
            { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', version: '2-9B' }
        ]
    }
};

// ==================== TTS PROVIDERS & VOICES (LENGKAP) ====================
const TTS_PROVIDERS = {
    edge: {
        name: 'Edge TTS',
        requiresKey: false,
        voices: [
            { id: 'id-ID-GadisNeural', name: 'Gadis (ID Female)', lang: 'id' },
            { id: 'id-ID-ArdiNeural', name: 'Ardi (ID Male)', lang: 'id' },
            { id: 'en-US-JennyNeural', name: 'Jenny (EN Female)', lang: 'en' },
            { id: 'en-US-GuyNeural', name: 'Guy (EN Male)', lang: 'en' },
            { id: 'en-US-AriaNeural', name: 'Aria (EN Female)', lang: 'en' },
            { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female)', lang: 'en' },
            { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male)', lang: 'en' },
            { id: 'en-AU-NatashaNeural', name: 'Natasha (AU Female)', lang: 'en' },
            { id: 'ja-JP-NanamiNeural', name: 'Nanami (JP Female)', lang: 'ja' },
            { id: 'ja-JP-KeitaNeural', name: 'Keita (JP Male)', lang: 'ja' },
            { id: 'ko-KR-SunHiNeural', name: 'SunHi (KR Female)', lang: 'ko' },
            { id: 'ko-KR-InJoonNeural', name: 'InJoon (KR Male)', lang: 'ko' },
            { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (CN Female)', lang: 'zh' },
            { id: 'zh-CN-YunxiNeural', name: 'Yunxi (CN Male)', lang: 'zh' },
            { id: 'de-DE-KatjaNeural', name: 'Katja (DE Female)', lang: 'de' },
            { id: 'fr-FR-DeniseNeural', name: 'Denise (FR Female)', lang: 'fr' },
            { id: 'es-ES-ElviraNeural', name: 'Elvira (ES Female)', lang: 'es' },
            { id: 'pt-BR-FranciscaNeural', name: 'Francisca (BR Female)', lang: 'pt' }
        ]
    },
    pollinations: {
        name: 'Pollinations TTS',
        requiresKey: false,
        voices: [
            { id: 'alloy', name: 'Alloy (Neutral)', lang: 'multi' },
            { id: 'echo', name: 'Echo (Male)', lang: 'multi' },
            { id: 'fable', name: 'Fable (British)', lang: 'multi' },
            { id: 'onyx', name: 'Onyx (Deep Male)', lang: 'multi' },
            { id: 'nova', name: 'Nova (Female)', lang: 'multi' },
            { id: 'shimmer', name: 'Shimmer (Soft Female)', lang: 'multi' }
        ]
    },
    elevenlabs: {
        name: 'ElevenLabs',
        requiresKey: true,
        keyEnv: 'ELEVENLABS_API_KEY',
        voices: [
            { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm)', lang: 'multi' },
            { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Soft)', lang: 'multi' },
            { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Friendly)', lang: 'multi' },
            { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep)', lang: 'multi' },
            { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Warm)', lang: 'multi' },
            { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Young)', lang: 'multi' },
            { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Strong)', lang: 'multi' },
            { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Raspy)', lang: 'multi' }
        ]
    }
};

// ==================== DEFAULT SETTINGS ====================
const DEFAULT_SETTINGS = {
    aiProvider: 'groq',
    aiModel: 'llama-3.3-70b-versatile',
    ttsProvider: 'edge',
    ttsVoice: 'id-ID-GadisNeural',
    mode: 'voice',
    systemPrompt: MASTER_SYSTEM_PROMPT
};

// ==================== DISCORD CLIENT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Storage
const guildSettings = new Map();
const conversations = new Map();
const voiceConnections = new Map();
const audioPlayers = new Map();

// ==================== UTILITY: HAPUS EMOJI UNTUK TTS ====================
function removeEmojisForTTS(text) {
    // Hapus semua emoji unicode
    let cleaned = text.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport
    cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
    cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, ''); // Variation Selectors
    cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental
    cleaned = cleaned.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ''); // Chess
    cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols
    cleaned = cleaned.replace(/[\u{231A}-\u{231B}]/gu, ''); // Watch
    cleaned = cleaned.replace(/[\u{23E9}-\u{23F3}]/gu, ''); // Media
    cleaned = cleaned.replace(/[\u{23F8}-\u{23FA}]/gu, ''); // Media
    cleaned = cleaned.replace(/[\u{25AA}-\u{25AB}]/gu, ''); // Squares
    cleaned = cleaned.replace(/[\u{25B6}]/gu, ''); // Play
    cleaned = cleaned.replace(/[\u{25C0}]/gu, ''); // Reverse
    cleaned = cleaned.replace(/[\u{25FB}-\u{25FE}]/gu, ''); // Squares
    cleaned = cleaned.replace(/[\u{2614}-\u{2615}]/gu, ''); // Umbrella, Coffee
    cleaned = cleaned.replace(/[\u{2648}-\u{2653}]/gu, ''); // Zodiac
    cleaned = cleaned.replace(/[\u{267F}]/gu, ''); // Wheelchair
    cleaned = cleaned.replace(/[\u{2693}]/gu, ''); // Anchor
    cleaned = cleaned.replace(/[\u{26A1}]/gu, ''); // Lightning
    cleaned = cleaned.replace(/[\u{26AA}-\u{26AB}]/gu, ''); // Circles
    cleaned = cleaned.replace(/[\u{26BD}-\u{26BE}]/gu, ''); // Sports
    cleaned = cleaned.replace(/[\u{26C4}-\u{26C5}]/gu, ''); // Weather
    cleaned = cleaned.replace(/[\u{26CE}]/gu, ''); // Ophiuchus
    cleaned = cleaned.replace(/[\u{26D4}]/gu, ''); // No entry
    cleaned = cleaned.replace(/[\u{26EA}]/gu, ''); // Church
    cleaned = cleaned.replace(/[\u{26F2}-\u{26F3}]/gu, ''); // Fountain, Golf
    cleaned = cleaned.replace(/[\u{26F5}]/gu, ''); // Sailboat
    cleaned = cleaned.replace(/[\u{26FA}]/gu, ''); // Tent
    cleaned = cleaned.replace(/[\u{26FD}]/gu, ''); // Fuel pump
    cleaned = cleaned.replace(/[\u{2702}]/gu, ''); // Scissors
    cleaned = cleaned.replace(/[\u{2705}]/gu, ''); // Check
    cleaned = cleaned.replace(/[\u{2708}-\u{270D}]/gu, ''); // Airplane to Writing
    cleaned = cleaned.replace(/[\u{270F}]/gu, ''); // Pencil
    cleaned = cleaned.replace(/[\u{2712}]/gu, ''); // Black nib
    cleaned = cleaned.replace(/[\u{2714}]/gu, ''); // Check mark
    cleaned = cleaned.replace(/[\u{2716}]/gu, ''); // X mark
    cleaned = cleaned.replace(/[\u{271D}]/gu, ''); // Cross
    cleaned = cleaned.replace(/[\u{2721}]/gu, ''); // Star of David
    cleaned = cleaned.replace(/[\u{2728}]/gu, ''); // Sparkles
    cleaned = cleaned.replace(/[\u{2733}-\u{2734}]/gu, ''); // Eight spoked
    cleaned = cleaned.replace(/[\u{2744}]/gu, ''); // Snowflake
    cleaned = cleaned.replace(/[\u{2747}]/gu, ''); // Sparkle
    cleaned = cleaned.replace(/[\u{274C}]/gu, ''); // Cross mark
    cleaned = cleaned.replace(/[\u{274E}]/gu, ''); // Cross mark
    cleaned = cleaned.replace(/[\u{2753}-\u{2755}]/gu, ''); // Question marks
    cleaned = cleaned.replace(/[\u{2757}]/gu, ''); // Exclamation
    cleaned = cleaned.replace(/[\u{2763}-\u{2764}]/gu, ''); // Heart
    cleaned = cleaned.replace(/[\u{2795}-\u{2797}]/gu, ''); // Math
    cleaned = cleaned.replace(/[\u{27A1}]/gu, ''); // Arrow
    cleaned = cleaned.replace(/[\u{27B0}]/gu, ''); // Curly loop
    cleaned = cleaned.replace(/[\u{27BF}]/gu, ''); // Double curly
    cleaned = cleaned.replace(/[\u{2934}-\u{2935}]/gu, ''); // Arrows
    cleaned = cleaned.replace(/[\u{2B05}-\u{2B07}]/gu, ''); // Arrows
    cleaned = cleaned.replace(/[\u{2B1B}-\u{2B1C}]/gu, ''); // Squares
    cleaned = cleaned.replace(/[\u{2B50}]/gu, ''); // Star
    cleaned = cleaned.replace(/[\u{2B55}]/gu, ''); // Circle
    cleaned = cleaned.replace(/[\u{3030}]/gu, ''); // Wavy dash
    cleaned = cleaned.replace(/[\u{303D}]/gu, ''); // Part alternation
    cleaned = cleaned.replace(/[\u{3297}]/gu, ''); // Circled Ideograph
    cleaned = cleaned.replace(/[\u{3299}]/gu, ''); // Circled Ideograph
    
    // Hapus text emoji seperti :emoji_name:
    cleaned = cleaned.replace(/:[a-zA-Z0-9_]+:/g, '');
    
    // Hapus multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// ==================== SETTINGS MANAGEMENT ====================
function loadSettings() {
    try {
        if (fs.existsSync(CONFIG.dataPath)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.dataPath, 'utf8'));
            Object.entries(data).forEach(([guildId, settings]) => {
                guildSettings.set(guildId, { ...DEFAULT_SETTINGS, ...settings });
            });
            console.log(`📂 Loaded settings for ${guildSettings.size} guilds`);
        }
    } catch (e) {
        console.error('Failed to load settings:', e.message);
    }
}

function saveSettings() {
    try {
        const dir = path.dirname(CONFIG.dataPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const data = {};
        guildSettings.forEach((settings, guildId) => {
            data[guildId] = settings;
        });
        fs.writeFileSync(CONFIG.dataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save settings:', e.message);
    }
}

function getSettings(guildId) {
    if (!guildSettings.has(guildId)) {
        guildSettings.set(guildId, { ...DEFAULT_SETTINGS });
    }
    return guildSettings.get(guildId);
}

function updateSettings(guildId, key, value) {
    const settings = getSettings(guildId);
    settings[key] = value;
    guildSettings.set(guildId, settings);
    saveSettings();
}

function isAdmin(userId) {
    return CONFIG.adminIds.includes(userId);
}

// ==================== GET MODEL INFO ====================
function getModelInfo(provider, modelId) {
    const p = AI_PROVIDERS[provider];
    if (!p) return { name: modelId, version: 'unknown' };
    
    const model = p.models.find(m => m.id === modelId);
    return model || { name: modelId, version: 'unknown' };
}

// ==================== HTTP HELPERS ====================
function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ data, statusCode: res.statusCode }));
        });
        req.on('error', reject);
        req.setTimeout(60000, () => reject(new Error('Request timeout')));
        if (body) req.write(body);
        req.end();
    });
}

function httpRequestBinary(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(30000, () => reject(new Error('Request timeout')));
        if (body) req.write(body);
        req.end();
    });
}

// ==================== AI PROVIDERS IMPLEMENTATION ====================
async function callAI(guildId, userMessage, history = []) {
    const settings = getSettings(guildId);
    const { aiProvider, aiModel, systemPrompt } = settings;
    
    const startTime = Date.now();
    let response, modelInfo;
    
    try {
        switch (aiProvider) {
            case 'groq':
                response = await callGroq(aiModel, userMessage, history, systemPrompt);
                break;
            case 'pollinations_free':
                response = await callPollinationsFree(aiModel, userMessage, history, systemPrompt);
                break;
            case 'pollinations_api':
                response = await callPollinationsAPI(aiModel, userMessage, history, systemPrompt);
                break;
            case 'openrouter':
                response = await callOpenRouter(aiModel, userMessage, history, systemPrompt);
                break;
            case 'huggingface':
                response = await callHuggingFace(aiModel, userMessage, history, systemPrompt);
                break;
            default:
                response = await callPollinationsFree('openai', userMessage, history, systemPrompt);
        }
        
        const latency = Date.now() - startTime;
        modelInfo = getModelInfo(aiProvider, aiModel);
        
        return {
            text: response,
            provider: AI_PROVIDERS[aiProvider]?.name || aiProvider,
            model: modelInfo.name,
            version: modelInfo.version,
            latency: latency
        };
        
    } catch (error) {
        console.error(`AI Error (${aiProvider}):`, error.message);
        
        // Auto-fallback ke Pollinations Free
        if (aiProvider !== 'pollinations_free') {
            console.log('Falling back to Pollinations Free...');
            try {
                const fallbackResponse = await callPollinationsFree('openai', userMessage, history, systemPrompt);
                const latency = Date.now() - startTime;
                return {
                    text: fallbackResponse,
                    provider: 'Pollinations (Fallback)',
                    model: 'OpenAI GPT',
                    version: 'GPT-4.1',
                    latency: latency
                };
            } catch (e) {
                throw new Error('Semua AI provider gagal: ' + e.message);
            }
        }
        throw error;
    }
}

// Groq API
async function callGroq(model, message, history, systemPrompt) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY tidak ditemukan');
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
    ];
    
    const { data, statusCode } = await httpRequest({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
    }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error.message);
    return result.choices[0].message.content;
}

// Pollinations Free API (Tanpa API Key!)
async function callPollinationsFree(model, message, history, systemPrompt) {
    // Build prompt
    let prompt = systemPrompt + '\n\n';
    history.slice(-6).forEach(msg => {
        prompt += msg.role === 'user' ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
    });
    prompt += `User: ${message}\nAssistant:`;
    
    const encoded = encodeURIComponent(prompt.slice(0, 4000));
    const seed = Math.floor(Math.random() * 1000000);
    
    return new Promise((resolve, reject) => {
        const url = `https://text.pollinations.ai/${encoded}?model=${model}&seed=${seed}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim()) {
                    resolve(data.trim());
                } else {
                    reject(new Error(`Pollinations Free error: ${res.statusCode} - ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

// Pollinations API (Dengan API Key)
async function callPollinationsAPI(model, message, history, systemPrompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) throw new Error('POLLINATIONS_API_KEY tidak ditemukan');
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
    ];
    
    const { data, statusCode } = await httpRequest({
        hostname: 'text.pollinations.ai',
        path: '/openai',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000
    }));
    
    if (statusCode !== 200) throw new Error(`Pollinations API error: ${statusCode}`);
    const result = JSON.parse(data);
    return result.choices[0].message.content;
}

// OpenRouter API
async function callOpenRouter(model, message, history, systemPrompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY tidak ditemukan');
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
    ];
    
    const { data, statusCode } = await httpRequest({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://discord.com',
            'X-Title': 'Discord AI Bot'
        }
    }, JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000
    }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error.message);
    return result.choices[0].message.content;
}

// HuggingFace API
async function callHuggingFace(model, message, history, systemPrompt) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) throw new Error('HUGGINGFACE_API_KEY tidak ditemukan');
    
    const prompt = `${systemPrompt}\n\nUser: ${message}\nAssistant:`;
    
    const { data, statusCode } = await httpRequest({
        hostname: 'api-inference.huggingface.co',
        path: `/models/${model}`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 500, temperature: 0.7 }
    }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error);
    const text = Array.isArray(result) ? result[0].generated_text : result.generated_text;
    return text.split('Assistant:').pop().trim();
}

// ==================== TTS IMPLEMENTATION ====================
async function generateTTS(guildId, text) {
    const settings = getSettings(guildId);
    const { ttsProvider, ttsVoice } = settings;
    
    // HAPUS EMOJI sebelum TTS
    const cleanText = removeEmojisForTTS(text);
    
    if (!cleanText || cleanText.length < 2) {
        throw new Error('Text too short after removing emojis');
    }
    
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, `tts_${Date.now()}.mp3`);
    
    try {
        switch (ttsProvider) {
            case 'edge':
                return await generateEdgeTTS(cleanText, ttsVoice, outputPath);
            case 'pollinations':
                return await generatePollinationsTTS(cleanText, ttsVoice, outputPath);
            case 'elevenlabs':
                return await generateElevenLabsTTS(cleanText, ttsVoice, outputPath);
            default:
                return await generateEdgeTTS(cleanText, 'id-ID-GadisNeural', outputPath);
        }
    } catch (error) {
        console.error(`TTS Error (${ttsProvider}):`, error.message);
        
        // Fallback ke Edge TTS
        if (ttsProvider !== 'edge') {
            console.log('Falling back to Edge TTS...');
            return await generateEdgeTTS(cleanText, 'id-ID-GadisNeural', outputPath);
        }
        throw error;
    }
}

// Edge TTS
async function generateEdgeTTS(text, voice, outputPath) {
    const sanitized = text
        .replace(/"/g, "'")
        .replace(/`/g, "'")
        .replace(/\$/g, '')
        .replace(/\\/g, '')
        .slice(0, 500);
    
    const cmd = `edge-tts --voice "${voice}" --text "${sanitized}" --write-media "${outputPath}"`;
    
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 30000 }, (error) => {
            if (error) reject(error);
            else if (fs.existsSync(outputPath)) resolve(outputPath);
            else reject(new Error('TTS file not created'));
        });
    });
}

// Pollinations TTS
async function generatePollinationsTTS(text, voice, outputPath) {
    const encoded = encodeURIComponent(text.slice(0, 500));
    const url = `https://text.pollinations.ai/${encoded}?model=openai-audio&voice=${voice}`;
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Pollinations TTS error: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(outputPath);
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
}

// ElevenLabs TTS
async function generateElevenLabsTTS(text, voiceId, outputPath) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY tidak ditemukan');
    
    const response = await httpRequestBinary({
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        }
    }, JSON.stringify({
        text: text.slice(0, 500),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
        }
    }));
    
    fs.writeFileSync(outputPath, response);
    return outputPath;
}

// ==================== EMBED BUILDERS ====================
function createSettingsEmbed(guildId) {
    const settings = getSettings(guildId);
    const aiProvider = AI_PROVIDERS[settings.aiProvider];
    const ttsProvider = TTS_PROVIDERS[settings.ttsProvider];
    const modelInfo = getModelInfo(settings.aiProvider, settings.aiModel);
    
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Bot Settings')
        .setDescription('Konfigurasi AI Bot saat ini')
        .addFields(
            { 
                name: '🧠 AI Provider', 
                value: `**${aiProvider?.name || settings.aiProvider}**\nModel: \`${modelInfo.name}\`\nVersion: \`${modelInfo.version}\``, 
                inline: true 
            },
            { 
                name: '🔊 TTS Provider', 
                value: `**${ttsProvider?.name || settings.ttsProvider}**\nVoice: \`${settings.ttsVoice}\``, 
                inline: true 
            },
            { 
                name: '📝 Mode', 
                value: settings.mode === 'voice' ? '🔊 Text + Voice' : '📝 Text Only', 
                inline: true 
            }
        )
        .setFooter({ text: 'Gunakan menu di bawah untuk mengubah settings' })
        .setTimestamp();
}

function createProvidersEmbed() {
    let aiList = '';
    Object.entries(AI_PROVIDERS).forEach(([key, provider]) => {
        const status = provider.requiresKey ? (process.env[provider.keyEnv] ? '🟢' : '🔴') : '🟢';
        aiList += `${status} **${provider.name}** (${provider.models.length} models)\n`;
    });
    
    let ttsList = '';
    Object.entries(TTS_PROVIDERS).forEach(([key, provider]) => {
        const status = provider.requiresKey ? (process.env[provider.keyEnv] ? '🟢' : '🔴') : '🟢';
        ttsList += `${status} **${provider.name}** (${provider.voices.length} voices)\n`;
    });
    
    return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📋 Available Providers')
        .addFields(
            { name: '🧠 AI Providers', value: aiList, inline: true },
            { name: '🔊 TTS Providers', value: ttsList, inline: true }
        )
        .setFooter({ text: '🟢 = Tersedia, 🔴 = API Key tidak ditemukan' });
}

function createResponseEmbed(message, question, response) {
    return new EmbedBuilder()
        .setColor(0x00D166)
        .setAuthor({ 
            name: message.author.displayName, 
            iconURL: message.author.displayAvatarURL() 
        })
        .addFields(
            { name: '❓ Pertanyaan', value: question.slice(0, 1024), inline: false },
            { name: '🤖 Jawaban', value: response.text.slice(0, 1024), inline: false }
        )
        .setFooter({ 
            text: `${response.provider} | ${response.model} (${response.version}) | ${response.latency}ms` 
        })
        .setTimestamp();
}

// ==================== MENU BUILDERS ====================
function createAIProviderMenu(guildId) {
    const settings = getSettings(guildId);
    
    const options = Object.entries(AI_PROVIDERS).map(([key, provider]) => {
        const available = !provider.requiresKey || process.env[provider.keyEnv];
        return {
            label: provider.name.slice(0, 25),
            description: `${provider.models.length} models${!available ? ' (No API Key)' : ''}`.slice(0, 50),
            value: key,
            default: key === settings.aiProvider,
            emoji: available ? '🟢' : '🔴'
        };
    });
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_ai_provider')
            .setPlaceholder('Pilih AI Provider')
            .addOptions(options)
    );
}

function createAIModelMenu(guildId) {
    const settings = getSettings(guildId);
    const provider = AI_PROVIDERS[settings.aiProvider];
    
    if (!provider) return null;
    
    const options = provider.models.slice(0, 25).map(model => ({
        label: model.name.slice(0, 25),
        description: `${model.id.slice(0, 45)} (${model.version})`,
        value: model.id,
        default: model.id === settings.aiModel
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_ai_model')
            .setPlaceholder(`Pilih Model (${provider.name})`)
            .addOptions(options)
    );
}

function createTTSProviderMenu(guildId) {
    const settings = getSettings(guildId);
    
    const options = Object.entries(TTS_PROVIDERS).map(([key, provider]) => {
        const available = !provider.requiresKey || process.env[provider.keyEnv];
        return {
            label: provider.name,
            description: `${provider.voices.length} voices${!available ? ' (No API Key)' : ''}`,
            value: key,
            default: key === settings.ttsProvider,
            emoji: available ? '🟢' : '🔴'
        };
    });
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_tts_provider')
            .setPlaceholder('Pilih TTS Provider')
            .addOptions(options)
    );
}

function createTTSVoiceMenu(guildId) {
    const settings = getSettings(guildId);
    const provider = TTS_PROVIDERS[settings.ttsProvider];
    
    if (!provider) return null;
    
    const options = provider.voices.slice(0, 25).map(voice => ({
        label: voice.name,
        description: `${voice.id} (${voice.lang})`,
        value: voice.id,
        default: voice.id === settings.ttsVoice
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_tts_voice')
            .setPlaceholder(`Pilih Voice (${provider.name})`)
            .addOptions(options)
    );
}

function createModeButtons(guildId) {
    const settings = getSettings(guildId);
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mode_text')
            .setLabel('📝 Text Only')
            .setStyle(settings.mode === 'text' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('mode_voice')
            .setLabel('🔊 Text + Voice')
            .setStyle(settings.mode === 'voice' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('refresh_settings')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary)
    );
}

// ==================== COMMANDS ====================
async function handleCommand(message, command, args) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    
    switch (command) {
        case 'ask':
        case 'a':
            await handleAsk(message, args.join(' '));
            break;
            
        case 'settings':
        case 'config':
            if (!isAdmin(userId)) {
                return message.reply('❌ Hanya admin yang bisa mengubah settings!');
            }
            await showSettings(message);
            break;
            
        case 'providers':
        case 'models':
            await message.reply({ embeds: [createProvidersEmbed()] });
            break;
            
        case 'setai':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            await setAIProvider(message, args[0]);
            break;
            
        case 'setmodel':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            await setAIModel(message, args.join(' '));
            break;
            
        case 'settts':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            await setTTSProvider(message, args[0]);
            break;
            
        case 'setvoice':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            await setTTSVoice(message, args[0]);
            break;
            
        case 'setmode':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            await setMode(message, args[0]);
            break;
            
        case 'join':
            await joinVoice(message);
            break;
            
        case 'leave':
        case 'dc':
            await leaveVoice(message);
            break;
            
        case 'status':
            await showStatus(message);
            break;
            
        case 'help':
        case 'h':
            await showHelp(message);
            break;
            
        case 'clear':
            if (!isAdmin(userId)) return message.reply('❌ Admin only!');
            conversations.delete(`${guildId}-${userId}`);
            await message.reply('🗑️ Conversation history cleared!');
            break;
    }
}

async function handleAsk(message, question) {
    if (!question) {
        return message.reply('❓ Mau tanya apa? Contoh: `!ask Apa itu AI?`');
    }
    
    const guildId = message.guild.id;
    const userId = message.author.id;
    const settings = getSettings(guildId);
    
    await message.channel.sendTyping();
    
    try {
        // Get conversation history
        const historyKey = `${guildId}-${userId}`;
        const history = conversations.get(historyKey) || [];
        
        // Call AI
        const response = await callAI(guildId, question, history);
        
        // Update history
        history.push({ role: 'user', content: question });
        history.push({ role: 'assistant', content: response.text });
        conversations.set(historyKey, history.slice(-20));
        
        // Create embed with full model info
        const embed = createResponseEmbed(message, question, response);
        
        await message.reply({ embeds: [embed] });
        
        // Generate voice if mode is voice and user in voice channel
        if (settings.mode === 'voice') {
            const voiceChannel = message.member?.voice.channel;
            const connection = voiceConnections.get(guildId);
            
            if (voiceChannel && connection) {
                try {
                    const audioPath = await generateTTS(guildId, response.text);
                    await playAudio(guildId, audioPath);
                } catch (e) {
                    console.error('TTS Error:', e.message);
                }
            }
        }
        
    } catch (error) {
        console.error('Ask error:', error);
        await message.reply(`❌ Error: ${error.message}`);
    }
}

async function showSettings(message) {
    const guildId = message.guild.id;
    
    const components = [
        createAIProviderMenu(guildId),
        createAIModelMenu(guildId),
        createTTSProviderMenu(guildId),
        createTTSVoiceMenu(guildId),
        createModeButtons(guildId)
    ].filter(Boolean);
    
    await message.reply({
        embeds: [createSettingsEmbed(guildId)],
        components: components
    });
}

async function setAIProvider(message, provider) {
    if (!provider || !AI_PROVIDERS[provider]) {
        const list = Object.keys(AI_PROVIDERS).join(', ');
        return message.reply(`❌ Provider tidak valid! Pilih: ${list}`);
    }
    
    const providerInfo = AI_PROVIDERS[provider];
    if (providerInfo.requiresKey && !process.env[providerInfo.keyEnv]) {
        return message.reply(`❌ ${providerInfo.name} membutuhkan API Key (${providerInfo.keyEnv})`);
    }
    
    updateSettings(message.guild.id, 'aiProvider', provider);
    updateSettings(message.guild.id, 'aiModel', providerInfo.models[0].id);
    
    const modelInfo = providerInfo.models[0];
    await message.reply(`✅ AI Provider diubah ke **${providerInfo.name}**\nModel: \`${modelInfo.name}\` (${modelInfo.version})`);
}

async function setAIModel(message, modelId) {
    const guildId = message.guild.id;
    const settings = getSettings(guildId);
    const provider = AI_PROVIDERS[settings.aiProvider];
    
    if (!modelId) {
        const models = provider.models.map(m => `\`${m.id}\` - ${m.name} (${m.version})`).join('\n');
        return message.reply(`📋 Model tersedia untuk ${provider.name}:\n${models}`);
    }
    
    const model = provider.models.find(m => m.id === modelId || m.id.includes(modelId) || m.name.toLowerCase().includes(modelId.toLowerCase()));
    if (!model) {
        return message.reply(`❌ Model tidak ditemukan! Gunakan \`!setmodel\` untuk melihat daftar.`);
    }
    
    updateSettings(guildId, 'aiModel', model.id);
    await message.reply(`✅ Model diubah ke **${model.name}** (${model.version})\nID: \`${model.id}\``);
}

async function setTTSProvider(message, provider) {
    if (!provider || !TTS_PROVIDERS[provider]) {
        const list = Object.keys(TTS_PROVIDERS).join(', ');
        return message.reply(`❌ Provider tidak valid! Pilih: ${list}`);
    }
    
    const providerInfo = TTS_PROVIDERS[provider];
    if (providerInfo.requiresKey && !process.env[providerInfo.keyEnv]) {
        return message.reply(`❌ ${providerInfo.name} membutuhkan API Key (${providerInfo.keyEnv})`);
    }
    
    updateSettings(message.guild.id, 'ttsProvider', provider);
    updateSettings(message.guild.id, 'ttsVoice', providerInfo.voices[0].id);
    
    await message.reply(`✅ TTS Provider diubah ke **${providerInfo.name}**\nVoice: \`${providerInfo.voices[0].name}\``);
}

async function setTTSVoice(message, voiceId) {
    const guildId = message.guild.id;
    const settings = getSettings(guildId);
    const provider = TTS_PROVIDERS[settings.ttsProvider];
    
    if (!voiceId) {
        const voices = provider.voices.map(v => `\`${v.id}\` - ${v.name} (${v.lang})`).join('\n');
        return message.reply(`📋 Voices tersedia untuk ${provider.name}:\n${voices}`);
    }
    
    const voice = provider.voices.find(v => v.id === voiceId || v.id.includes(voiceId) || v.name.toLowerCase().includes(voiceId.toLowerCase()));
    if (!voice) {
        return message.reply(`❌ Voice tidak ditemukan! Gunakan \`!setvoice\` untuk melihat daftar.`);
    }
    
    updateSettings(guildId, 'ttsVoice', voice.id);
    await message.reply(`✅ Voice diubah ke **${voice.name}** (${voice.lang})\nID: \`${voice.id}\``);
}

async function setMode(message, mode) {
    if (!['text', 'voice'].includes(mode)) {
        return message.reply('❌ Mode tidak valid! Pilih: `text` atau `voice`');
    }
    
    updateSettings(message.guild.id, 'mode', mode);
    await message.reply(`✅ Mode diubah ke **${mode === 'voice' ? '🔊 Text + Voice' : '📝 Text Only'}**`);
}

async function joinVoice(message) {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply('❌ Kamu harus masuk voice channel dulu!');
    }
    
    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false
        });
        
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        
        const player = createAudioPlayer();
        connection.subscribe(player);
        
        voiceConnections.set(message.guild.id, connection);
        audioPlayers.set(message.guild.id, player);
        
        await message.reply(`✅ Joined **${voiceChannel.name}**! Sekarang aku bisa berbicara.`);
    } catch (error) {
        console.error('Join error:', error);
        await message.reply('❌ Gagal join voice channel!');
    }
}

async function leaveVoice(message) {
    const connection = voiceConnections.get(message.guild.id);
    if (!connection) {
        return message.reply('❌ Aku tidak sedang di voice channel!');
    }
    
    connection.destroy();
    voiceConnections.delete(message.guild.id);
    audioPlayers.delete(message.guild.id);
    
    await message.reply('👋 Bye bye!');
}

async function playAudio(guildId, audioPath) {
    const player = audioPlayers.get(guildId);
    if (!player) return;
    
    try {
        const resource = createAudioResource(audioPath);
        player.play(resource);
        
        player.once(AudioPlayerStatus.Idle, () => {
            try { fs.unlinkSync(audioPath); } catch (e) {}
        });
        
        player.once('error', (error) => {
            console.error('Player error:', error);
            try { fs.unlinkSync(audioPath); } catch (e) {}
        });
    } catch (error) {
        console.error('Play audio error:', error);
    }
}

async function showStatus(message) {
    const guildId = message.guild.id;
    const settings = getSettings(guildId);
    
    let aiStatus = '**🧠 AI Providers:**\n';
    for (const [key, provider] of Object.entries(AI_PROVIDERS)) {
        const available = !provider.requiresKey || process.env[provider.keyEnv];
        const active = key === settings.aiProvider ? ' ⬅️ Active' : '';
        aiStatus += `${available ? '🟢' : '🔴'} **${provider.name}** (${provider.models.length} models)${active}\n`;
    }
    
    let ttsStatus = '\n**🔊 TTS Providers:**\n';
    for (const [key, provider] of Object.entries(TTS_PROVIDERS)) {
        const available = !provider.requiresKey || process.env[provider.keyEnv];
        const active = key === settings.ttsProvider ? ' ⬅️ Active' : '';
        ttsStatus += `${available ? '🟢' : '🔴'} **${provider.name}** (${provider.voices.length} voices)${active}\n`;
    }
    
    const modelInfo = getModelInfo(settings.aiProvider, settings.aiModel);
    let currentConfig = `\n**⚙️ Current Config:**\n`;
    currentConfig += `AI: ${AI_PROVIDERS[settings.aiProvider]?.name} - ${modelInfo.name} (${modelInfo.version})\n`;
    currentConfig += `TTS: ${TTS_PROVIDERS[settings.ttsProvider]?.name} - ${settings.ttsVoice}\n`;
    currentConfig += `Mode: ${settings.mode === 'voice' ? '🔊 Voice' : '📝 Text'}`;
    
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 System Status')
        .setDescription(aiStatus + ttsStatus + currentConfig)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🤖 AI Bot - Help')
        .setDescription('Bot AI dengan multi-provider support')
        .addFields(
            {
                name: '💬 Chat',
                value: '`!ask <pertanyaan>` - Tanya AI\n`!join` - Join voice channel\n`!leave` - Leave voice channel\n`!clear` - Clear conversation',
                inline: false
            },
            {
                name: '⚙️ Settings (Admin)',
                value: '`!settings` - Menu settings (UI)\n`!setai <provider>` - Ganti AI provider\n`!setmodel <model>` - Ganti model\n`!settts <provider>` - Ganti TTS\n`!setvoice <voice>` - Ganti voice\n`!setmode <text/voice>` - Ganti mode',
                inline: false
            },
            {
                name: '📋 Info',
                value: '`!providers` - List providers\n`!status` - Cek status\n`!help` - Bantuan',
                inline: false
            },
            {
                name: '🧠 AI Providers',
                value: 'Groq, Pollinations (Free), Pollinations (API), OpenRouter, HuggingFace',
                inline: false
            }
        )
        .setFooter({ text: 'Multi-Provider AI Bot v2.2' });
    
    await message.reply({ embeds: [embed] });
}

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '❌ Hanya admin!', ephemeral: true });
    }
    
    const guildId = interaction.guild.id;
    
    try {
        if (interaction.customId === 'select_ai_provider') {
            const provider = interaction.values[0];
            const providerInfo = AI_PROVIDERS[provider];
            
            if (providerInfo.requiresKey && !process.env[providerInfo.keyEnv]) {
                return interaction.reply({ content: `❌ ${providerInfo.name} membutuhkan API Key!`, ephemeral: true });
            }
            
            updateSettings(guildId, 'aiProvider', provider);
            updateSettings(guildId, 'aiModel', providerInfo.models[0].id);
        }
        else if (interaction.customId === 'select_ai_model') {
            updateSettings(guildId, 'aiModel', interaction.values[0]);
        }
        else if (interaction.customId === 'select_tts_provider') {
            const provider = interaction.values[0];
            const providerInfo = TTS_PROVIDERS[provider];
            
            if (providerInfo.requiresKey && !process.env[providerInfo.keyEnv]) {
                return interaction.reply({ content: `❌ ${providerInfo.name} membutuhkan API Key!`, ephemeral: true });
            }
            
            updateSettings(guildId, 'ttsProvider', provider);
            updateSettings(guildId, 'ttsVoice', providerInfo.voices[0].id);
        }
        else if (interaction.customId === 'select_tts_voice') {
            updateSettings(guildId, 'ttsVoice', interaction.values[0]);
        }
        else if (interaction.customId === 'mode_text') {
            updateSettings(guildId, 'mode', 'text');
        }
        else if (interaction.customId === 'mode_voice') {
            updateSettings(guildId, 'mode', 'voice');
        }
        else if (interaction.customId === 'refresh_settings') {
            // Just refresh
        }
        
        // Refresh settings display
        const components = [
            createAIProviderMenu(guildId),
            createAIModelMenu(guildId),
            createTTSProviderMenu(guildId),
            createTTSVoiceMenu(guildId),
            createModeButtons(guildId)
        ].filter(Boolean);
        
        await interaction.update({
            embeds: [createSettingsEmbed(guildId)],
            components: components
        });
        
    } catch (error) {
        console.error('Interaction error:', error);
        await interaction.reply({ content: '❌ Error!', ephemeral: true }).catch(() => {});
    }
});

// ==================== MESSAGE HANDLER ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(CONFIG.prefix)) return;
    
    const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        await handleCommand(message, command, args);
    } catch (error) {
        console.error('Command error:', error);
        await message.reply('❌ Terjadi error!');
    }
});

// ==================== BOT READY ====================
client.once('ready', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║        🤖 DISCORD AI BOT v2.2 🤖           ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  Bot: ${client.user.tag.padEnd(35)}║`);
    console.log(`║  Servers: ${String(client.guilds.cache.size).padEnd(32)}║`);
    console.log(`║  Prefix: ${CONFIG.prefix.padEnd(33)}║`);
    console.log(`║  Admins: ${String(CONFIG.adminIds.length).padEnd(33)}║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    
    // Show available providers
    console.log('📋 AI Providers:');
    Object.entries(AI_PROVIDERS).forEach(([key, p]) => {
        const status = p.requiresKey ? (process.env[p.keyEnv] ? '🟢' : '🔴') : '🟢';
        console.log(`   ${status} ${p.name} (${p.models.length} models)`);
    });
    
    console.log('');
    console.log('🔊 TTS Providers:');
    Object.entries(TTS_PROVIDERS).forEach(([key, p]) => {
        const status = p.requiresKey ? (process.env[p.keyEnv] ? '🟢' : '🔴') : '🟢';
        console.log(`   ${status} ${p.name} (${p.voices.length} voices)`);
    });
    console.log('');
    
    client.user.setActivity(`${CONFIG.prefix}help | AI Bot v2.2`, { type: ActivityType.Listening });
    loadSettings();
});

// ==================== HEALTH CHECK SERVER ====================
const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        bot: client.user?.tag,
        version: '2.2',
        guilds: client.guilds?.cache.size,
        uptime: process.uptime()
    }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 Health check on port ${PORT}`));

// ==================== START BOT ====================
if (!CONFIG.token) {
    console.error('❌ DISCORD_TOKEN tidak ditemukan!');
    process.exit(1);
}

client.login(CONFIG.token);
