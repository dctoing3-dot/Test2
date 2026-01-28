const { 
    joinVoiceChannel, 
    VoiceConnectionStatus,
    entersState 
} = require('@discordjs/voice');
const { setupVoiceHandler } = require('../handlers/voiceHandler');
const logger = require('../utils/logger');

async function joinCommand(client, message, args) {
    // Check if user is in voice channel
    const voiceChannel = message.member?.voice.channel;
    
    if (!voiceChannel) {
        return message.reply('❌ Kamu harus masuk voice channel dulu!');
    }
    
    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply('❌ Aku tidak punya izin untuk join voice channel!');
    }
    
    try {
        // Join voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false, // Bot can hear
            selfMute: false  // Bot can speak
        });
        
        // Wait for connection to be ready
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        
        // Store connection
        client.voiceConnections.set(message.guild.id, connection);
        
        // Setup voice handler
        setupVoiceHandler(client, connection, message.guild.id);
        
        logger.info(`Joined voice channel: ${voiceChannel.name} in ${message.guild.name}`);
        
        await message.reply(`✅ Joined **${voiceChannel.name}**! Aku siap mendengarkan dan berbicara 🎤`);
        
    } catch (error) {
        logger.error('Error joining voice channel:', error);
        await message.reply('❌ Gagal join voice channel!');
    }
}

module.exports = { joinCommand };
