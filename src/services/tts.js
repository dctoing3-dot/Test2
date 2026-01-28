const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { generateTempPath, cleanupFile } = require('../utils/audioUtils');

const execAsync = promisify(exec);

/**
 * Convert text to speech using Edge TTS
 * @param {string} text - Text to convert
 * @param {string} voice - Voice ID (optional)
 * @returns {Promise<string>} Path to generated audio file
 */
async function textToSpeech(text, voice = config.ttsVoice) {
    const outputPath = generateTempPath('speech', 'mp3');
    
    try {
        // Sanitize text untuk command line
        // Remove karakter yang bisa menyebabkan masalah
        const sanitizedText = text
            .replace(/"/g, '\\"')
            .replace(/`/g, "'")
            .replace(/\$/g, '')
            .replace(/\n/g, ' ')
            .slice(0, 500); // Limit panjang text
        
        const command = `edge-tts --voice "${voice}" --text "${sanitizedText}" --write-media "${outputPath}"`;
        
        logger.debug('TTS Command:', command);
        
        await execAsync(command, { timeout: 30000 }); // 30 second timeout
        
        // Verify file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Audio file was not created');
        }
        
        logger.debug('TTS generated:', outputPath);
        
        return outputPath;
        
    } catch (error) {
        logger.error('TTS Error:', error);
        cleanupFile(outputPath);
        throw error;
    }
}

/**
 * Get available Indonesian voices
 */
const VOICES = {
    female: 'id-ID-GadisNeural',
    male: 'id-ID-ArdiNeural'
};

/**
 * List available voices (for debugging)
 */
async function listVoices() {
    try {
        const { stdout } = await execAsync('edge-tts --list-voices');
        const indonesianVoices = stdout.split('\n').filter(line => line.includes('id-ID'));
        return indonesianVoices;
    } catch (error) {
        logger.error('Error listing voices:', error);
        return [];
    }
}

module.exports = {
    textToSpeech,
    VOICES,
    listVoices
};
