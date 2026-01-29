// ============================================================
//         DYNAMIC API & MODEL MANAGER v1.0
//         Redis-based + Discord UI
// ============================================================

const Redis = require('ioredis');
const https = require('https');
const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

class DynamicManager {
    constructor(redisUrl, adminIds = []) {
        this.adminIds = adminIds;
        this.redis = null;
        this.connected = false;
        this.cache = { apis: {}, models: {} };
        
        if (redisUrl) {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                lazyConnect: true
            });
            
            this.redis.on('connect', () => {
                console.log('✅ Redis connected');
                this.connected = true;
            });
            
            this.redis.on('error', (err) => {
                console.error('❌ Redis error:', err.message);
                this.connected = false;
            });
            
            this.redis.connect().catch(() => {});
        }
    }

    // ==================== HELPERS ====================
    
    isAdmin(userId) {
        return this.adminIds.includes(userId);
    }
    
    maskKey(key) {
        if (!key || key.length < 10) return '***';
        return key.slice(0, 6) + '...' + key.slice(-4);
    }
    
    async redisGet(key) {
        if (!this.connected) return null;
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Redis GET error:', e.message);
            return null;
        }
    }
    
    async redisSet(key, value) {
        if (!this.connected) return false;
        try {
            await this.redis.set(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Redis SET error:', e.message);
            return false;
        }
    }

    // ==================== API KEY MANAGEMENT ====================
    
    async getApiKeys(provider) {
        const keys = await this.redisGet(`api:${provider}`);
        return keys || [];
    }
    
    async getActiveKey(provider, envFallback = null) {
        const keys = await this.getApiKeys(provider);
        
        // Cari key yang active atau standby
        const now = Date.now();
        for (const keyData of keys) {
            if (keyData.status === 'active') {
                return keyData.key;
            }
            if (keyData.status === 'cooldown' && keyData.cooldownUntil < now) {
                keyData.status = 'active';
                await this.redisSet(`api:${provider}`, keys);
                return keyData.key;
            }
        }
        
        // Cari standby
        const standby = keys.find(k => k.status === 'standby');
        if (standby) {
            standby.status = 'active';
            await this.redisSet(`api:${provider}`, keys);
            return standby.key;
        }
        
        // Fallback ke ENV
        return envFallback;
    }
    
    async addApiKey(provider, key) {
        const keys = await this.getApiKeys(provider);
        
        // Cek duplikat
        if (keys.some(k => k.key === key)) {
            return { success: false, error: 'Key already exists' };
        }
        
        keys.push({
            key: key,
            status: keys.length === 0 ? 'active' : 'standby',
            addedAt: Date.now(),
            usage: 0
        });
        
        await this.redisSet(`api:${provider}`, keys);
        return { success: true, total: keys.length };
    }
    
    async removeApiKey(provider, index) {
        const keys = await this.getApiKeys(provider);
        if (index < 0 || index >= keys.length) {
            return { success: false, error: 'Invalid index' };
        }
        
        keys.splice(index, 1);
        
        // Pastikan ada 1 yang active
        if (keys.length > 0 && !keys.some(k => k.status === 'active')) {
            keys[0].status = 'active';
        }
        
        await this.redisSet(`api:${provider}`, keys);
        return { success: true, total: keys.length };
    }
    
    async rotateKey(provider, cooldownMs = 60000) {
        const keys = await this.getApiKeys(provider);
        if (keys.length < 2) return false;
        
        const activeIdx = keys.findIndex(k => k.status === 'active');
        if (activeIdx === -1) return false;
        
        // Set cooldown pada key saat ini
        keys[activeIdx].status = 'cooldown';
        keys[activeIdx].cooldownUntil = Date.now() + cooldownMs;
        
        // Cari key berikutnya
        for (let i = 1; i < keys.length; i++) {
            const nextIdx = (activeIdx + i) % keys.length;
            if (keys[nextIdx].status === 'standby') {
                keys[nextIdx].status = 'active';
                await this.redisSet(`api:${provider}`, keys);
                console.log(`🔄 Rotated ${provider} key to index ${nextIdx}`);
                return true;
            }
        }
        
        return false;
    }
    
    async getPoolStatus() {
        const providers = ['gemini', 'groq', 'openrouter', 'huggingface', 'elevenlabs', 'pollinations'];
        const status = {};
        
        for (const provider of providers) {
            const keys = await this.getApiKeys(provider);
            status[provider] = {
                total: keys.length,
                active: keys.filter(k => k.status === 'active').length,
                standby: keys.filter(k => k.status === 'standby').length,
                cooldown: keys.filter(k => k.status === 'cooldown').length
            };
        }
        
        return status;
    }

    // ==================== MODEL MANAGEMENT ====================
    
    async getModels(provider) {
        const models = await this.redisGet(`models:${provider}`);
        return models || [];
    }
    
    async addModel(provider, id, name, version = '', category = 'custom') {
        const models = await this.getModels(provider);
        
        if (models.some(m => m.id === id)) {
            return { success: false, error: 'Model already exists' };
        }
        
        models.push({ id, name, version, category, enabled: true, addedAt: Date.now() });
        await this.redisSet(`models:${provider}`, models);
        return { success: true, total: models.length };
    }
    
    async removeModel(provider, id) {
        const models = await this.getModels(provider);
        const idx = models.findIndex(m => m.id === id);
        
        if (idx === -1) {
            return { success: false, error: 'Model not found' };
        }
        
        models.splice(idx, 1);
        await this.redisSet(`models:${provider}`, models);
        return { success: true, total: models.length };
    }
    
    async toggleModel(provider, id) {
        const models = await this.getModels(provider);
        const model = models.find(m => m.id === id);
        
        if (!model) return { success: false, error: 'Model not found' };
        
        model.enabled = !model.enabled;
        await this.redisSet(`models:${provider}`, models);
        return { success: true, enabled: model.enabled };
    }
    
    async syncOpenRouterModels(freeOnly = true) {
        return new Promise((resolve) => {
            https.get('https://openrouter.ai/api/v1/models', (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        const models = json.data
                            .filter(m => !freeOnly || m.id.includes(':free'))
                            .map(m => ({
                                id: m.id,
                                name: m.name || m.id.split('/').pop(),
                                version: 'synced',
                                category: m.id.split('/')[0],
                                enabled: true,
                                addedAt: Date.now()
                            }));
                        
                        await this.redisSet('models:openrouter', models);
                        resolve({ success: true, count: models.length });
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                });
            }).on('error', (e) => resolve({ success: false, error: e.message }));
        });
    }

    // ==================== DISCORD UI ====================
    
    createMainEmbed(poolStatus) {
        let apiInfo = '';
        let totalKeys = 0;
        
        for (const [provider, status] of Object.entries(poolStatus)) {
            if (status.total > 0) {
                const icon = status.active > 0 ? '🟢' : (status.standby > 0 ? '🟡' : '🔴');
                apiInfo += `${icon} **${provider}**: ${status.total} keys (${status.active} active)\n`;
                totalKeys += status.total;
            }
        }
        
        if (!apiInfo) apiInfo = '*No API keys configured*';
        
        return new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📦 API & Model Manager')
            .setDescription('Manage API keys dan AI models tanpa restart bot')
            .addFields(
                { name: '🔑 API Keys', value: apiInfo, inline: false },
                { name: '📊 Total', value: `${totalKeys} keys configured`, inline: true },
                { name: '🔗 Redis', value: this.connected ? '🟢 Connected' : '🔴 Disconnected', inline: true }
            )
            .setFooter({ text: 'v1.0 • Dynamic Manager' })
            .setTimestamp();
    }
    
    createMainButtons() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dm_api').setLabel('🔑 API Keys').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('dm_models').setLabel('🤖 Models').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('dm_sync').setLabel('🔄 Sync').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dm_status').setLabel('📊 Status').setStyle(ButtonStyle.Secondary)
        );
    }
    
    createProviderSelect(type = 'api') {
        const providers = type === 'api' 
            ? ['gemini', 'groq', 'openrouter', 'huggingface', 'elevenlabs', 'pollinations']
            : ['openrouter', 'gemini', 'groq', 'pollinations'];
        
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`dm_select_${type}`)
                .setPlaceholder(`Pilih Provider`)
                .addOptions(providers.map(p => ({
                    label: p.charAt(0).toUpperCase() + p.slice(1),
                    value: p,
                    emoji: '📦'
                })))
        );
    }
    
    async showMainMenu(msg) {
        if (!this.isAdmin(msg.author.id)) {
            return msg.reply('❌ Admin only');
        }
        
        const status = await this.getPoolStatus();
        await msg.reply({
            embeds: [this.createMainEmbed(status)],
            components: [this.createMainButtons()]
        });
    }
    
    async handleInteraction(interaction) {
        if (!this.isAdmin(interaction.user.id)) {
            return interaction.reply({ content: '❌ Admin only', ephemeral: true });
        }
        
        const id = interaction.customId;
        
        // Main menu buttons
        if (id === 'dm_api') {
            await interaction.update({
                content: '**🔑 API Key Manager**\nPilih provider:',
                embeds: [],
                components: [
                    this.createProviderSelect('api'),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_back').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }
        
        else if (id === 'dm_models') {
            await interaction.update({
                content: '**🤖 Model Manager**\nPilih provider:',
                embeds: [],
                components: [
                    this.createProviderSelect('models'),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_back').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }
        
        else if (id === 'dm_sync') {
            await interaction.deferUpdate();
            const result = await this.syncOpenRouterModels(true);
            await interaction.followUp({
                content: result.success 
                    ? `✅ Synced **${result.count}** models from OpenRouter`
                    : `❌ Sync failed: ${result.error}`,
                ephemeral: true
            });
        }
        
        else if (id === 'dm_status') {
            const status = await this.getPoolStatus();
            let text = '**📊 Pool Status**\n\n';
            for (const [provider, s] of Object.entries(status)) {
                if (s.total > 0) {
                    text += `**${provider}**\n`;
                    text += `├ Active: ${s.active}\n`;
                    text += `├ Standby: ${s.standby}\n`;
                    text += `└ Cooldown: ${s.cooldown}\n\n`;
                }
            }
            await interaction.reply({ content: text || 'No keys configured', ephemeral: true });
        }
        
        else if (id === 'dm_back') {
            const status = await this.getPoolStatus();
            await interaction.update({
                content: null,
                embeds: [this.createMainEmbed(status)],
                components: [this.createMainButtons()]
            });
        }
        
        // Provider selected for API
        else if (id === 'dm_select_api') {
            const provider = interaction.values[0];
            const keys = await this.getApiKeys(provider);
            
            let keyList = keys.length > 0
                ? keys.map((k, i) => `${i + 1}. \`${this.maskKey(k.key)}\` - ${k.status}`).join('\n')
                : '*No keys*';
            
            await interaction.update({
                content: `**🔑 ${provider.toUpperCase()} API Keys**\n\n${keyList}\n\n*Kirim API key untuk menambah, atau ketik nomor untuk hapus*`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`dm_addkey_${provider}`).setLabel('➕ Add Key').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`dm_removekey_${provider}`).setLabel('➖ Remove').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('dm_back').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }
        
        // Provider selected for Models
        else if (id === 'dm_select_models') {
            const provider = interaction.values[0];
            const models = await this.getModels(provider);
            
            let modelList = models.length > 0
                ? models.slice(0, 15).map((m, i) => `${m.enabled ? '✅' : '❌'} ${m.name}`).join('\n')
                : '*No models - Use Sync to fetch*';
            
            if (models.length > 15) modelList += `\n... dan ${models.length - 15} lainnya`;
            
            await interaction.update({
                content: `**🤖 ${provider.toUpperCase()} Models** (${models.length})\n\n${modelList}`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`dm_syncprovider_${provider}`).setLabel('🔄 Sync').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`dm_clearmodels_${provider}`).setLabel('🗑️ Clear').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('dm_back').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }
        
        // Add key button - show modal or collect
        else if (id.startsWith('dm_addkey_')) {
            const provider = id.replace('dm_addkey_', '');
            
            await interaction.reply({
                content: `📝 **Kirim API key untuk ${provider}**\n\nKirim key dalam 60 detik. Pesan akan dihapus otomatis.`,
                ephemeral: true
            });
            
            // Collect next message
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
            
            collector.on('collect', async (m) => {
                const key = m.content.trim();
                await m.delete().catch(() => {});
                
                if (key.length < 10) {
                    await interaction.followUp({ content: '❌ Invalid key', ephemeral: true });
                    return;
                }
                
                const result = await this.addApiKey(provider, key);
                await interaction.followUp({
                    content: result.success 
                        ? `✅ Added! Total ${provider} keys: ${result.total}`
                        : `❌ ${result.error}`,
                    ephemeral: true
                });
            });
        }
        
        // Remove key
        else if (id.startsWith('dm_removekey_')) {
            const provider = id.replace('dm_removekey_', '');
            const keys = await this.getApiKeys(provider);
            
            if (keys.length === 0) {
                return interaction.reply({ content: '❌ No keys to remove', ephemeral: true });
            }
            
            await interaction.reply({
                content: `🗑️ **Ketik nomor key yang mau dihapus (1-${keys.length})**`,
                ephemeral: true
            });
            
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
            
            collector.on('collect', async (m) => {
                const idx = parseInt(m.content) - 1;
                await m.delete().catch(() => {});
                
                const result = await this.removeApiKey(provider, idx);
                await interaction.followUp({
                    content: result.success 
                        ? `✅ Removed! Remaining: ${result.total}`
                        : `❌ ${result.error}`,
                    ephemeral: true
                });
            });
        }
        
        // Sync specific provider
        else if (id.startsWith('dm_syncprovider_')) {
            const provider = id.replace('dm_syncprovider_', '');
            
            if (provider === 'openrouter') {
                await interaction.deferUpdate();
                const result = await this.syncOpenRouterModels(true);
                await interaction.followUp({
                    content: result.success 
                        ? `✅ Synced ${result.count} models`
                        : `❌ ${result.error}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `ℹ️ Auto-sync hanya tersedia untuk OpenRouter. Gunakan \`.addmodel\` untuk provider lain.`,
                    ephemeral: true
                });
            }
        }
        
        // Clear models
        else if (id.startsWith('dm_clearmodels_')) {
            const provider = id.replace('dm_clearmodels_', '');
            await this.redisSet(`models:${provider}`, []);
            await interaction.reply({
                content: `✅ Cleared all ${provider} models`,
                ephemeral: true
            });
        }
    }

    // ==================== QUICK COMMANDS ====================
    
    async quickAddApi(msg, args) {
        if (!this.isAdmin(msg.author.id)) return msg.reply('❌ Admin only');
        
        const [provider, ...keyParts] = args;
        const key = keyParts.join(' ');
        
        if (!provider || !key) {
            return msg.reply('❓ Usage: `.addapi <provider> <key>`\nProviders: gemini, groq, openrouter, huggingface, elevenlabs');
        }
        
        await msg.delete().catch(() => {});
        
        const result = await this.addApiKey(provider.toLowerCase(), key);
        const reply = await msg.channel.send(
            result.success 
                ? `✅ Added ${provider} key! Total: ${result.total}`
                : `❌ ${result.error}`
        );
        
        setTimeout(() => reply.delete().catch(() => {}), 5000);
    }
    
    async quickListApi(msg) {
        if (!this.isAdmin(msg.author.id)) return msg.reply('❌ Admin only');
        
        const status = await this.getPoolStatus();
        let text = '**🔑 API Keys**\n\n';
        
        for (const [provider, s] of Object.entries(status)) {
            if (s.total > 0) {
                text += `**${provider}**: ${s.total} keys (${s.active} active)\n`;
            }
        }
        
        await msg.reply(text || 'No keys configured');
    }
    
    async quickAddModel(msg, args) {
        if (!this.isAdmin(msg.author.id)) return msg.reply('❌ Admin only');
        
        const [provider, id, ...nameParts] = args;
        const name = nameParts.join(' ') || id;
        
        if (!provider || !id) {
            return msg.reply('❓ Usage: `.addmodel <provider> <model-id> [name]`');
        }
        
        const result = await this.addModel(provider.toLowerCase(), id, name);
        await msg.reply(
            result.success 
                ? `✅ Added model to ${provider}! Total: ${result.total}`
                : `❌ ${result.error}`
        );
    }
    
    async quickSyncModels(msg, provider) {
        if (!this.isAdmin(msg.author.id)) return msg.reply('❌ Admin only');
        
        if (!provider || provider.toLowerCase() !== 'openrouter') {
            return msg.reply('❓ Usage: `.syncmodels openrouter`');
        }
        
        const status = await msg.reply('🔄 Syncing...');
        const result = await this.syncOpenRouterModels(true);
        
        await status.edit(
            result.success 
                ? `✅ Synced **${result.count}** free models from OpenRouter!`
                : `❌ Sync failed: ${result.error}`
        );
    }

    // ==================== INTEGRATION HELPERS ====================
    
    async getMergedModels(provider, hardcodedModels = []) {
        const dynamicModels = await this.getModels(provider);
        
        if (dynamicModels.length === 0) return hardcodedModels;
        
        // Merge: dynamic + hardcoded (tanpa duplikat)
        const ids = new Set(dynamicModels.map(m => m.id));
        const merged = [...dynamicModels.filter(m => m.enabled)];
        
        for (const model of hardcodedModels) {
            if (!ids.has(model.id)) {
                merged.push(model);
            }
        }
        
        return merged;
    }
}

module.exports = DynamicManager;
