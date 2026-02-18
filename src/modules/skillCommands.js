// src/commands/skillCommands.js

const { EmbedBuilder } = require('discord.js');
const path = require('path');

class SkillCommands {
    constructor(modules) {
        this.weather = modules.weather;
        this.codeExecutor = modules.codeExecutor;
        this.youtube = modules.youtube;
        this.alarm = modules.alarm;
        this.db = modules.db;
        this.socialDownloader = modules.socialDownloader;
        this.puppeteer = modules.puppeteer;
    }

    // ==================== WEATHER ====================
    async handleWeather(msg, args) {
        if (!args.length) {
            return msg.reply('Usage: .weather <city>\n\nExample:\n- .weather Jakarta\n- .weather Tokyo\n- .weather New York');
        }

        const city = args.join(' ');
        const statusMsg = await msg.reply(`Fetching weather for ${city}...`);

        try {
            const weather = await this.weather.getCurrentWeather(city);
            const emoji = this.weather.getWeatherEmoji(weather.weather_main);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${emoji} Weather in ${weather.city}, ${weather.country}`)
                .addFields(
                    { name: 'Temperature', value: `${weather.temp}°C (feels like ${weather.feels_like}°C)`, inline: true },
                    { name: 'Conditions', value: weather.weather, inline: true },
                    { name: 'Humidity', value: `${weather.humidity}%`, inline: true },
                    { name: 'Wind', value: `${weather.wind_speed} m/s ${this.weather.getWindDirection(weather.wind_deg)}`, inline: true },
                    { name: 'Pressure', value: `${weather.pressure} hPa`, inline: true },
                    { name: 'Clouds', value: `${weather.clouds}%`, inline: true },
                    { name: 'Sunrise', value: this.weather.formatTime(weather.sunrise), inline: true },
                    { name: 'Sunset', value: this.weather.formatTime(weather.sunset), inline: true }
                )
                .setTimestamp();

            await statusMsg.edit({ content: null, embeds: [embed] });

        } catch (error) {
            await statusMsg.edit(`Error: ${error.message}`);
        }
    }

    async handleForecast(msg, args) {
        if (!args.length) {
            return msg.reply('Usage: .forecast <city>');
        }

        const city = args.join(' ');
        const statusMsg = await msg.reply(`Fetching forecast for ${city}...`);

        try {
            const forecast = await this.weather.getForecast(city, 5);

            let forecastText = `**5-Day Forecast for ${forecast.city}, ${forecast.country}**\n\n`;

            forecast.forecasts.forEach((day, i) => {
                const emoji = this.weather.getWeatherEmoji(day.weather);
                forecastText += `**${day.date}** ${emoji}\n`;
                forecastText += `Temp: ${day.temp_min}°C - ${day.temp_max}°C (avg ${day.temp_avg}°C)\n`;
                forecastText += `${day.weather} | Humidity: ${day.humidity}%\n\n`;
            });

            await statusMsg.edit(forecastText);

        } catch (error) {
            await statusMsg.edit(`Error: ${error.message}`);
        }
    }

    // ==================== CODE EXECUTOR ====================
    async handleRun(msg, args) {
        const codeBlock = this.codeExecutor.extractCodeBlock(msg.content);

        if (!codeBlock) {
            return msg.reply('Usage: .run <language>\n```language\ncode here\n```\n\nExample:\n.run python\n```python\nprint("Hello World")\n```');
        }

        const statusMsg = await msg.reply(`Executing ${codeBlock.language}...`);

        try {
            const result = await this.codeExecutor.executeCode(codeBlock.language, codeBlock.code);

            const icon = this.codeExecutor.getLanguageIcon(codeBlock.language);
            const output = this.codeExecutor.formatOutput(result.output || result.stdout);

            let response = `${icon} **${codeBlock.language} ${result.version}**\n\`\`\`\n${output}\n\`\`\``;

            if (result.stderr) {
                response += `\n**Error:**\n\`\`\`\n${result.stderr.slice(0, 500)}\n\`\`\``;
            }

            response += `\n-# ${result.success ? 'Success' : 'Failed'} - Exit code: ${result.code}`;

            await statusMsg.edit(response);

        } catch (error) {
            await statusMsg.edit(`Execution error: ${error.message}`);
        }
    }

    async handleLanguages(msg) {
        const languages = await this.codeExecutor.getLanguages();

        const grouped = languages.reduce((acc, lang) => {
            const firstLetter = lang.language[0].toUpperCase();
            if (!acc[firstLetter]) acc[firstLetter] = [];
            acc[firstLetter].push(lang.language);
            return acc;
        }, {});

        let response = `**Supported Languages (${languages.length}):**\n\n`;

        Object.keys(grouped).sort().forEach(letter => {
            response += `**${letter}:** ${grouped[letter].join(', ')}\n`;
        });

        response += `\n**Usage:** \`.run <language>\`\n\`\`\`language\ncode here\n\`\`\``;

        await msg.reply(response);
    }

    // ==================== YOUTUBE ====================
    async handleYouTube(msg, url, query = '') {
        const videoId = this.youtube.extractVideoId(url);
        if (!videoId) {
            return msg.reply('Invalid YouTube URL');
        }

        const statusMsg = await msg.reply('Analyzing YouTube video...');

        try {
            const videoInfo = await this.youtube.getVideoInfo(videoId);

            let response = `**${videoInfo.title}**\n\n`;
            response += `Channel: ${videoInfo.author}\n`;
            response += `Duration: ${this.youtube.formatDuration(videoInfo.lengthSeconds)}\n`;
            response += `Views: ${this.youtube.formatViewCount(videoInfo.viewCount)}\n\n`;

            if (videoInfo.transcript) {
                await statusMsg.edit('Fetching transcript...');

                const transcript = await this.youtube.getTranscript(videoInfo.transcript.url);

                if (transcript) {
                    const timestamps = this.youtube.generateTimestamps(transcript, 300);

                    response += `**Key Timestamps:**\n`;
                    timestamps.slice(0, 5).forEach(ts => {
                        response += `${ts.startFormatted} - ${ts.text.slice(0, 80)}...\n`;
                    });

                    response += `\n**Summary:**\n${this.youtube.summarizeTranscript(transcript, 1500)}`;
                } else {
                    response += 'Transcript not available';
                }
            } else {
                response += `**Description:**\n${videoInfo.description.slice(0, 500)}...`;
            }

            response += `\n\n-# YouTube Analysis`;

            await statusMsg.edit(response);

        } catch (error) {
            await statusMsg.edit(`Error: ${error.message}`);
        }
    }

    // ==================== ALARM ====================
    async handleAlarm(msg, args) {
        const subCmd = args[0]?.toLowerCase();

        if (!subCmd) {
            return msg.reply(`**Alarm Commands:**

.alarm set <time> <message> - Set alarm
.alarm list - List your alarms
.alarm delete <id> - Delete alarm

**Time Format:**
- "setiap hari jam 4 pagi"
- "senin-jumat jam 7"
- "04:30 sahur"
- "3:30 AM wake up"

**Examples:**
.alarm set "setiap hari jam 3:30 pagi" "Sahur time!"
.alarm set "senin-jumat jam 6" "Bangun kerja"`);
        }

        if (subCmd === 'set') {
            const timeMatch = msg.content.match(/"([^"]+)"\s+"([^"]+)"/);
            if (!timeMatch) {
                return msg.reply('Format: .alarm set "time" "message"\n\nExample:\n.alarm set "setiap hari jam 4 pagi" "Sahur!"');
            }

            const timeExpression = timeMatch[1];
            const message = timeMatch[2];

            const cronExpression = this.alarm.parseTimeExpression(timeExpression);
            if (!cronExpression) {
                return msg.reply('Invalid time format');
            }

            const voiceChannel = msg.member?.voice?.channel?.id;

            const alarm = this.alarm.createAlarm(
                msg.author.id,
                msg.guild.id,
                msg.channel.id,
                cronExpression,
                message,
                voiceChannel,
                { repeat: true, tts: true }
            );

            await msg.reply(`Alarm set!\n\nID: ${alarm.id}\nSchedule: ${cronExpression}\nMessage: "${message}"\nVoice Alert: ${voiceChannel ? 'Yes' : 'No'}`);
        }

        else if (subCmd === 'list') {
            const alarms = this.alarm.getUserAlarms(msg.author.id);

            if (alarms.length === 0) {
                return msg.reply('You have no active alarms');
            }

            let response = `**Your Alarms (${alarms.length}):**\n\n`;

            alarms.forEach(alarm => {
                const emoji = this.alarm.getAlarmEmoji(alarm.message);
                response += `${emoji} **ID:** ${alarm.id}\n`;
                response += `Schedule: ${alarm.cronExpression}\n`;
                response += `Message: "${alarm.message}"\n`;
                response += `Triggered: ${alarm.triggerCount} times\n\n`;
            });

            await msg.reply(response);
        }

        else if (subCmd === 'delete') {
            const alarmId = args[1];
            if (!alarmId) {
                return msg.reply('Usage: .alarm delete <id>');
            }

            this.alarm.deleteAlarm(alarmId);
            await msg.reply(`Alarm ${alarmId} deleted`);
        }
    }

    // ==================== SOCIAL DOWNLOADER ====================
    async handleDownload(msg, url) {
        if (!url || !url.startsWith('http')) {
            return msg.reply('Usage: .download <url>\n\nSupported:\n- TikTok\n- Instagram\n- Twitter/X\n- Facebook');
        }

        const platform = this.socialDownloader.detectPlatform(url);
        if (!platform) {
            return msg.reply('Platform not supported. Supported: TikTok, Instagram, Twitter/X, Facebook');
        }

        const statusMsg = await msg.reply(`Downloading from ${platform}...`);

        try {
            const result = await this.socialDownloader.download(url);

            if (!result.success) {
                return statusMsg.edit(`Download failed: ${result.error || 'Unknown error'}`);
            }

            const platformEmoji = {
                'tiktok': '🎵',
                'instagram': '📸',
                'twitter': '🐦',
                'facebook': '📘'
            };

            let caption = `${platformEmoji[platform]} **${platform.toUpperCase()}**\n\n`;

            if (result.title) caption += `${result.title}\n`;
            if (result.author) caption += `By: ${result.author}\n`;
            if (result.stats) {
                caption += `\nLikes: ${result.stats.likes || 0} | `;
                caption += `Comments: ${result.stats.comments || 0}`;
            }

            caption += `\n\n-# No watermark`;

            await msg.reply({
                content: caption,
                files: [result.filepath]
            });

            // Cleanup after send
            setTimeout(() => {
                this.socialDownloader.cleanupFile(result.filepath);
            }, 5000);

        } catch (error) {
            await statusMsg.edit(`Download error: ${error.message}`);
        }
    }

    // ==================== DATABASE ====================
    async handleRemember(msg, args) {
        if (!this.db || !this.db.initialized) {
            return msg.reply('Database not available');
        }

        if (!args.length) {
            return msg.reply('Usage: .remember <key> <value>\n\nExample:\n.remember language TypeScript');
        }

        const key = args[0];
        const value = args.slice(1).join(' ');

        const success = await this.db.setUserPreference(msg.author.id, msg.guild.id, key, value);

        if (success) {
            await msg.reply(`Saved! I'll remember that you prefer ${key}: ${value}`);
        } else {
            await msg.reply('Failed to save preference');
        }
    }

    async handleRecall(msg, args) {
        if (!this.db || !this.db.initialized) {
            return msg.reply('Database not available');
        }

        const preferences = await this.db.getUserPreferences(msg.author.id, msg.guild.id);

        if (Object.keys(preferences).length === 0) {
            return msg.reply('I don\'t have any saved preferences for you');
        }

        let response = '**Your Preferences:**\n\n';
        for (const [key, value] of Object.entries(preferences)) {
            response += `**${key}:** ${value}\n`;
        }

        await msg.reply(response);
    }
}

module.exports = SkillCommands;
