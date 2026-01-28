// ============================================================
//         DISCORD AI BOT - MULTI PROVIDER v2.3
//         Pollinations Free & API Support
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
const MASTER_SYSTEM_PROMPT = `Kamu adalah Aria, asisten AI yang sangat cerdas, jujur, dan helpful. Kamu memiliki kemampuan seperti Claude AI.

## KARAKTERISTIK:
1. **Jujur & Transparan**: Selalu jujur. Jika tidak tahu, katakan tidak tahu.
2. **Logis & Analitis**: Berpikir step-by-step dengan reasoning yang jelas.
3. **Expert Coding**: Ahli programming, berikan kode clean dan well-documented.
4. **Helpful**: Membantu dengan jawaban akurat dan berguna.
5. **Bahasa Natural**: Berbicara dengan bahasa Indonesia yang natural.

## ATURAN JAWABAN:
- Untuk voice: jawab singkat 2-3 kalimat
- Hindari emoji berlebihan
- Akui keterbatasan jika ada`;

// ==================== AI PROVIDERS & MODELS ====================
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
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', version: '8x7B' }
        ]
    },
    pollinations_free: {
        name: 'Pollinations (Free)',
        requiresKey: false,
        models: [
            { id: 'openai', name: 'OpenAI GPT', version: 'GPT-4.1-nano' },
            { id: 'openai-large', name: 'OpenAI Large', version: 'GPT-4.1-large' },
            { id: 'openai-reasoning', name: 'OpenAI Reasoning', version: 'o3-mini' },
            { id: 'qwen', name: 'Qwen', version: 'Qwen3' },
            { id: 'qwen-coder', name: 'Qwen Coder', version: 'Qwen3-Coder' },
            { id: 'llama', name: 'Llama', version: 'Llama-3.3' },
            { id: 'mistral', name: 'Mistral', version: 'Mistral-Small' },
            { id: 'mistral-large', name: 'Mistral Large', version: 'Mistral-Large' },
            { id: 'deepseek', name: 'DeepSeek', version: 'V3' },
            { id: 'deepseek-r1', name: 'DeepSeek R1', version: 'R1' },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', version: 'R1-Reasoner' },
            { id: 'gemini', name: 'Gemini', version: '2.5-Pro' },
            { id: 'gemini-thinking', name: 'Gemini Thinking', version: '2.5-Flash-Thinking' },
            { id: 'claude-hybridspace', name: 'Claude Hybridspace', version: 'Claude-3.5' },
            { id: 'phi', name: 'Phi', version: 'Phi-4' },
            { id: 'unity', name: 'Unity', version: 'Unity-v1' },
            { id: 'midijourney', name: 'Midijourney', version: 'v1' },
            { id: 'searchgpt', name: 'SearchGPT', version: 'v1' },
            { id: 'evil', name: 'Evil Mode', version: 'uncensored' },
            { id: 'hormoz', name: 'Hormoz', version: 'v1' },
            { id: 'sur', name: 'Sur', version: 'v1' },
            { id: 'llama-scaleway', name: 'Llama Scaleway', version: 'Llama-3.1-70B' },
            { id: 'llamalight', name: 'Llama Light', version: 'Llama-3.3-70B' }
        ]
    },
    pollinations_api: {
        name: 'Pollinations (API)',
        requiresKey: true,
        keyEnv: 'POLLINATIONS_API_KEY',
        models: [
            { id: 'openai', name: 'OpenAI GPT', version: 'GPT-4.1' },
            { id: 'openai-fast', name: 'OpenAI Fast', version: 'GPT-4.1-fast' },
            { id: 'openai-large', name: 'OpenAI Large', version: 'GPT-4.1-large' },
            { id: 'claude', name: 'Claude', version: 'Claude-3.5' },
            { id: 'claude-fast', name: 'Claude Fast', version: 'Claude-3.5-fast' },
            { id: 'gemini', name: 'Gemini', version: '2.5-Pro' },
            { id: 'deepseek', name: 'DeepSeek', version: 'V3' }
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
            { id: 'google/gemma-3-4b:free', name: 'Gemma 3 4B', version: '4B-free' },
            { id: 'google/gemma-3-12b:free', name: 'Gemma 3 12B', version: '12B-free' },
            { id: 'google/gemma-3-27b:free', name: 'Gemma 3 27B', version: '27B-free' },
            { id: 'mistralai/mistral-small-3.1-24b:free', name: 'Mistral Small 24B', version: '24B-free' },
            { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', version: '70B-free' },
            { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', version: '3B-free' },
            { id: 'thudm/glm-4.5-air:free', name: 'GLM 4.5 Air', version: '4.5-free' }
        ]
    },
    huggingface: {
        name: 'HuggingFace',
        requiresKey: true,
        keyEnv: 'HUGGINGFACE_API_KEY',
        models: [
            { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', version: '3.1-8B' },
            { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', version: '7B-v0.3' },
            { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini', version: 'mini-4k' },
            { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', version: '2.5-72B' }
        ]
    }
};

// ==================== TTS PROVIDERS & VOICES ====================
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
            { id: 'ja-JP-NanamiNeural', name: 'Nanami (JP Female)', lang: 'ja' },
            { id: 'ko-KR-SunHiNeural', name: 'SunHi (KR Female)', lang: 'ko' },
            { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (CN Female)', lang: 'zh' }
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
            { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep)', lang: 'multi' },
            { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Warm)', lang: 'multi' }
        ]
    }
};

// ==================== DEFAULT SETTINGS ====================
const DEFAULT_SETTINGS = {
    aiProvider: 'pollinations_free',
    aiModel: 'openai',
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

const guildSettings = new Map();
const conversations = new Map();
const voiceConnections = new Map();
const audioPlayers = new Map();

// ==================== UTILITY: HAPUS EMOJI ====================
function removeEmojisForTTS(text) {
    return text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
        .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '')
        .replace(/[\u{1F100}-\u{1F1FF}]/gu, '')
        .replace(/[\u{1F200}-\u{1F2FF}]/gu, '')
        .replace(/[\u{E000}-\u{F8FF}]/gu, '')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
        .replace(/:[a-zA-Z0-9_]+:/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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
    } catch (e) { console.error('Load settings error:', e.message); }
}

function saveSettings() {
    try {
        const dir = path.dirname(CONFIG.dataPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const data = {};
        guildSettings.forEach((s, id) => data[id] = s);
        fs.writeFileSync(CONFIG.dataPath, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Save settings error:', e.message); }
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
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
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
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        if (body) req.write(body);
        req.end();
    });
}

// ==================== AI PROVIDERS ====================
async function callAI(guildId, userMessage, history = []) {
    const settings = getSettings(guildId);
    const { aiProvider, aiModel, systemPrompt } = settings;
    const startTime = Date.now();
    
    try {
        let response;
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
        const modelInfo = getModelInfo(aiProvider, aiModel);
        
        return {
            text: response,
            provider: AI_PROVIDERS[aiProvider]?.name || aiProvider,
            model: modelInfo.name,
            version: modelInfo.version,
            latency
        };
    } catch (error) {
        console.error(`AI Error (${aiProvider}):`, error.message);
        
        // Fallback ke Pollinations Free
        if (aiProvider !== 'pollinations_free') {
            console.log('Falling back to Pollinations Free...');
            try {
                const fallbackResponse = await callPollinationsFree('openai', userMessage, history, systemPrompt);
                return {
                    text: fallbackResponse,
                    provider: 'Pollinations Free (Fallback)',
                    model: 'OpenAI GPT',
                    version: 'GPT-4.1-nano',
                    latency: Date.now() - startTime
                };
            } catch (e) {
                throw new Error('Semua provider gagal: ' + e.message);
            }
        }
        throw error;
    }
}

// Groq API
async function callGroq(model, message, history, systemPrompt) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY tidak ada');
    
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
    }, JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.7 }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error.message);
    return result.choices[0].message.content;
}

// ========== POLLINATIONS FREE (Tanpa API Key) ==========
async function callPollinationsFree(model, message, history, systemPrompt) {
    // Build prompt
    let prompt = systemPrompt + '\n\n';
    history.slice(-6).forEach(msg => {
        prompt += msg.role === 'user' ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
    });
    prompt += `User: ${message}\nAssistant:`;
    
    const encoded = encodeURIComponent(prompt.slice(0, 3000));
    const seed = Math.floor(Math.random() * 1000000);
    
    return new Promise((resolve, reject) => {
        // ENDPOINT FREE: text.pollinations.ai
        const url = `https://text.pollinations.ai/${encoded}?model=${model}&seed=${seed}`;
        
        https.get(url, { timeout: 60000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim()) {
                    let response = data.trim();
                    if (response.startsWith('Assistant:')) {
                        response = response.slice(10).trim();
                    }
                    resolve(response);
                } else if (res.statusCode === 429) {
                    reject(new Error('Rate limited'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

// ========== POLLINATIONS API (Dengan API Key) ==========
async function callPollinationsAPI(model, message, history, systemPrompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) throw new Error('POLLINATIONS_API_KEY tidak ada. Dapatkan di https://enter.pollinations.ai');
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
    ];
    
    // ENDPOINT API: gen.pollinations.ai
    const { data, statusCode } = await httpRequest({
        hostname: 'gen.pollinations.ai',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.7, stream: false }));
    
    if (statusCode === 401) throw new Error('API Key tidak valid');
    if (statusCode === 402) throw new Error('Saldo Pollen tidak cukup');
    if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error.message || result.error);
    return result.choices[0].message.content;
}

// OpenRouter API
async function callOpenRouter(model, message, history, systemPrompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY tidak ada');
    
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
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({ model, messages, max_tokens: 1000 }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error.message);
    return result.choices[0].message.content;
}

// HuggingFace API
async function callHuggingFace(model, message, history, systemPrompt) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) throw new Error('HUGGINGFACE_API_KEY tidak ada');
    
    const prompt = `${systemPrompt}\n\nUser: ${message}\nAssistant:`;
    
    const { data } = await httpRequest({
        hostname: 'api-inference.huggingface.co',
        path: `/models/${model}`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 500 } }));
    
    const result = JSON.parse(data);
    if (result.error) throw new Error(result.error);
    const text = Array.isArray(result) ? result[0].generated_text : result.generated_text;
    return text.split('Assistant:').pop().trim();
}

// ==================== TTS ====================
async function generateTTS(guildId, text) {
    const settings = getSettings(guildId);
    const { ttsProvider, ttsVoice } = settings;
    
    const cleanText = removeEmojisForTTS(text);
    if (!cleanText || cleanText.length < 2) return null;
    
    if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });
    const outputPath = `./temp/tts_${Date.now()}.mp3`;
    
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
        if (ttsProvider !== 'edge') {
            return await generateEdgeTTS(cleanText, 'id-ID-GadisNeural', outputPath);
        }
        throw error;
    }
}

function generateEdgeTTS(text, voice, outputPath) {
    const safe = text.replace(/"/g, "'").replace(/`/g, "'").replace(/\$/g, '').slice(0, 500);
    return new Promise((resolve, reject) => {
        exec(`edge-tts --voice "${voice}" --text "${safe}" --write-media "${outputPath}"`, 
            { timeout: 30000 }, (err) => err ? reject(err) : resolve(outputPath));
    });
}

function generatePollinationsTTS(text, voice, outputPath) {
    const encoded = encodeURIComponent(text.slice(0, 500));
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(`https://text.pollinations.ai/${encoded}?model=openai-audio&voice=${voice}`, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(outputPath); });
        }).on('error', reject);
    });
}

async function generateElevenLabsTTS(text, voiceId, outputPath) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY tidak ada');
    
    const response = await httpRequestBinary({
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        }
    }, JSON.stringify({ text: text.slice(0, 500), model_id: 'eleven_multilingual_v2' }));
    
    fs.writeFileSync(outputPath, response);
    return outputPath;
}

// ==================== EMBEDS & MENUS ====================
function createSettingsEmbed(guildId) {
    const s = getSettings(guildId);
    const ai = AI_PROVIDERS[s.aiProvider];
    const tts = TTS_PROVIDERS[s.ttsProvider];
    const model = getModelInfo(s.aiProvider, s.aiModel);
    
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Bot Settings')
        .addFields(
            { name: '🧠 AI', value: `**${ai?.name}**\n${model.name} (${model.version})`, inline: true },
            { name: '🔊 TTS', value: `**${tts?.name}**\n${s.ttsVoice}`, inline: true },
            { name: '📝 Mode', value: s.mode === 'voice' ? '🔊 Voice' : '📝 Text', inline: true }
        )
        .setTimestamp();
}

function createResponseEmbed(message, question, response) {
    return new EmbedBuilder()
        .setColor(0x00D166)
        .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
        .addFields(
            { name: '❓ Pertanyaan', value: question.slice(0, 1024) },
            { name: '🤖 Jawaban', value: response.text.slice(0, 1024) }
        )
        .setFooter({ text: `${response.provider} | ${response.model} (${response.version}) | ${response.latency}ms` })
        .setTimestamp();
}

function createAIProviderMenu(guildId) {
    const s = getSettings(guildId);
    const options = Object.entries(AI_PROVIDERS).map(([k, p]) => ({
        label: p.name.slice(0, 25),
        value: k,
        default: k === s.aiProvider,
        emoji: (!p.requiresKey || process.env[p.keyEnv]) ? '🟢' : '🔴'
    }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_ai_provider').setPlaceholder('AI Provider').addOptions(options)
    );
}

function createAIModelMenu(guildId) {
    const s = getSettings(guildId);
    const p = AI_PROVIDERS[s.aiProvider];
    if (!p) return null;
    const options = p.models.slice(0, 25).map(m => ({
        label: m.name.slice(0, 25),
        description: `${m.version}`.slice(0, 50),
        value: m.id,
        default: m.id === s.aiModel
    }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_ai_model').setPlaceholder('Model').addOptions(options)
    );
}

function createTTSProviderMenu(guildId) {
    const s = getSettings(guildId);
    const options = Object.entries(TTS_PROVIDERS).map(([k, p]) => ({
        label: p.name,
        value: k,
        default: k === s.ttsProvider,
        emoji: (!p.requiresKey || process.env[p.keyEnv]) ? '🟢' : '🔴'
    }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_tts_provider').setPlaceholder('TTS Provider').addOptions(options)
    );
}

function createTTSVoiceMenu(guildId) {
    const s = getSettings(guildId);
    const p = TTS_PROVIDERS[s.ttsProvider];
    if (!p) return null;
    const options = p.voices.slice(0, 25).map(v => ({
        label: v.name,
        value: v.id,
        default: v.id === s.ttsVoice
    }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_tts_voice').setPlaceholder('Voice').addOptions(options)
    );
}

function createModeButtons(guildId) {
    const s = getSettings(guildId);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mode_text').setLabel('📝 Text').setStyle(s.mode === 'text' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('mode_voice').setLabel('🔊 Voice').setStyle(s.mode === 'voice' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('refresh').setLabel('🔄').setStyle(ButtonStyle.Secondary)
    );
}

// ==================== COMMANDS ====================
async function handleAsk(message, question) {
    if (!question) return message.reply('❓ Contoh: `!ask Apa itu AI?`');
    
    const guildId = message.guild.id;
    const settings = getSettings(guildId);
    
    await message.channel.sendTyping();
    
    try {
        const historyKey = `${guildId}-${message.author.id}`;
        const history = conversations.get(historyKey) || [];
        
        const response = await callAI(guildId, question, history);
        
        history.push({ role: 'user', content: question }, { role: 'assistant', content: response.text });
        conversations.set(historyKey, history.slice(-20));
        
        await message.reply({ embeds: [createResponseEmbed(message, question, response)] });
        
        if (settings.mode === 'voice' && voiceConnections.has(guildId)) {
            try {
                const audioPath = await generateTTS(guildId, response.text);
                if (audioPath) {
                    const player = audioPlayers.get(guildId);
                    if (player) {
                        const resource = createAudioResource(audioPath);
                        player.play(resource);
                        player.once(AudioPlayerStatus.Idle, () => {
                            try { fs.unlinkSync(audioPath); } catch(e) {}
                        });
                    }
                }
            } catch (e) { console.error('TTS Error:', e.message); }
        }
    } catch (error) {
        await message.reply(`❌ ${error.message}`);
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
    await message.reply({ embeds: [createSettingsEmbed(guildId)], components });
}

async function joinVoice(message) {
    const vc = message.member?.voice.channel;
    if (!vc) return message.reply('❌ Join voice channel dulu!');
    
    try {
        const connection = joinVoiceChannel({
            channelId: vc.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        
        const player = createAudioPlayer();
        connection.subscribe(player);
        
        voiceConnections.set(message.guild.id, connection);
        audioPlayers.set(message.guild.id, player);
        
        await message.reply(`✅ Joined **${vc.name}**!`);
    } catch (e) { await message.reply('❌ Gagal join!'); }
}

async function leaveVoice(message) {
    const conn = voiceConnections.get(message.guild.id);
    if (!conn) return message.reply('❌ Tidak di voice channel!');
    conn.destroy();
    voiceConnections.delete(message.guild.id);
    audioPlayers.delete(message.guild.id);
    await message.reply('👋 Bye!');
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🤖 AI Bot v2.3')
        .addFields(
            { name: '💬 Chat', value: '`!ask <q>` `!join` `!leave` `!clear`' },
            { name: '⚙️ Admin', value: '`!settings` `!status` `!providers`' }
        )
        .setFooter({ text: 'Pollinations Free + API Support' });
    await message.reply({ embeds: [embed] });
}

async function showStatus(message) {
    let status = '**🧠 AI:**\n';
    Object.entries(AI_PROVIDERS).forEach(([k, p]) => {
        const ok = !p.requiresKey || process.env[p.keyEnv];
        status += `${ok ? '🟢' : '🔴'} ${p.name} (${p.models.length})\n`;
    });
    status += '\n**🔊 TTS:**\n';
    Object.entries(TTS_PROVIDERS).forEach(([k, p]) => {
        const ok = !p.requiresKey || process.env[p.keyEnv];
        status += `${ok ? '🟢' : '🔴'} ${p.name} (${p.voices.length})\n`;
    });
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📊 Status').setDescription(status)] });
}

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
    }
    
    const guildId = interaction.guild.id;
    
    try {
        if (interaction.customId === 'select_ai_provider') {
            const p = AI_PROVIDERS[interaction.values[0]];
            if (p.requiresKey && !process.env[p.keyEnv]) {
                return interaction.reply({ content: '❌ No API Key!', ephemeral: true });
            }
            updateSettings(guildId, 'aiProvider', interaction.values[0]);
            updateSettings(guildId, 'aiModel', p.models[0].id);
        }
        else if (interaction.customId === 'select_ai_model') {
            updateSettings(guildId, 'aiModel', interaction.values[0]);
        }
        else if (interaction.customId === 'select_tts_provider') {
            const p = TTS_PROVIDERS[interaction.values[0]];
            if (p.requiresKey && !process.env[p.keyEnv]) {
                return interaction.reply({ content: '❌ No API Key!', ephemeral: true });
            }
            updateSettings(guildId, 'ttsProvider', interaction.values[0]);
            updateSettings(guildId, 'ttsVoice', p.voices[0].id);
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
        
        const components = [
            createAIProviderMenu(guildId),
            createAIModelMenu(guildId),
            createTTSProviderMenu(guildId),
            createTTSVoiceMenu(guildId),
            createModeButtons(guildId)
        ].filter(Boolean);
        
        await interaction.update({ embeds: [createSettingsEmbed(guildId)], components });
    } catch (e) { console.error(e); }
});

// ==================== MESSAGE HANDLER ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(CONFIG.prefix)) return;
    
    const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    
    try {
        switch (cmd) {
            case 'ask': case 'a': await handleAsk(message, args.join(' ')); break;
            case 'settings': case 'config': 
                if (!isAdmin(message.author.id)) return message.reply('❌ Admin only!');
                await showSettings(message); break;
            case 'join': await joinVoice(message); break;
            case 'leave': case 'dc': await leaveVoice(message); break;
            case 'status': await showStatus(message); break;
            case 'providers': await showStatus(message); break;
            case 'help': case 'h': await showHelp(message); break;
            case 'clear':
                conversations.delete(`${message.guild.id}-${message.author.id}`);
                await message.reply('🗑️ History cleared!'); break;
        }
    } catch (e) { console.error(e); }
});

// ==================== BOT READY ====================
client.once('ready', () => {
    console.log(`\n🤖 ${client.user.tag} | ${client.guilds.cache.size} servers\n`);
    
    Object.entries(AI_PROVIDERS).forEach(([k, p]) => {
        const ok = !p.requiresKey || process.env[p.keyEnv];
        console.log(`${ok ? '🟢' : '🔴'} ${p.name} (${p.models.length} models)`);
    });
    
    client.user.setActivity(`${CONFIG.prefix}help`, { type: ActivityType.Listening });
    loadSettings();
});

// ==================== HEALTH CHECK ====================
createServer((req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', bot: client.user?.tag, version: '2.3' }));
}).listen(process.env.PORT || 3000, () => console.log('🌐 Health check ready'));

// ==================== START ====================
if (!CONFIG.token) { console.error('❌ No DISCORD_TOKEN!'); process.exit(1); }
client.login(CONFIG.token);
