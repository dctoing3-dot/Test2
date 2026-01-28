const { EmbedBuilder } = require('discord.js');
const { joinCommand } = require('../commands/join');
const { leaveCommand } = require('../commands/leave');
const { askCommand } = require('../commands/ask');
const config = require('../utils/config');
const logger = require('../utils/logger');

const commands = {
    'join': joinCommand,
    'leave': leaveCommand,
    'ask': askCommand,
    'tanya': askCommand, // Alias bahasa Indonesia
};

async function handleMessage(client, message) {
    // Ignore bots
    if (message.author.bot) return;
    
    // Check prefix
    if (!message.content.startsWith(config.prefix)) return;
    
    // Parse command
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Get command
    const command = commands[commandName];
    
    if (!command) {
        // Check if it's help command
        if (commandName === 'help') {
            return sendHelp(message);
        }
        return;
    }
    
    try {
        logger.info(`Command: ${commandName} by ${message.author.tag} in ${message.guild?.name}`);
        await command(client, message, args);
    } catch (error) {
        logger.error(`Error executing command ${commandName}:`, error);
        await message.reply('❌ Terjadi error saat menjalankan command!');
    }
}

async function sendHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🤖 ${config.botName} - Voice AI Bot`)
        .setDescription('Aku adalah bot AI yang bisa ngobrol pakai suara!')
        .addFields(
            { 
                name: '🎤 Voice Commands', 
                value: `\`${config.prefix}join\` - Masuk ke voice channel\n\`${config.prefix}leave\` - Keluar dari voice channel`,
                inline: false 
            },
            { 
                name: '💬 Chat Commands', 
                value: `\`${config.prefix}ask <pertanyaan>\` - Tanya apa saja!\n\`${config.prefix}tanya <pertanyaan>\` - Sama seperti ask`,
                inline: false 
            },
            { 
                name: '📝 Contoh', 
                value: `\`${config.prefix}ask Apa itu AI?\`\n\`${config.prefix}tanya Ceritakan tentang Indonesia\``,
                inline: false 
            }
        )
        .setFooter({ text: 'Powered by Groq AI & Edge TTS' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

module.exports = { handleMessage };
