// ============================================================
//         RENDER COMMANDS HANDLER
// ============================================================

const { EmbedBuilder } = require('discord.js');

async function handle(msg, args, renderAPI) {
    const subCmd = args[0]?.toLowerCase();

    switch (subCmd) {
        case 'list':
        case 'ls':
            await listServices(msg, renderAPI);
            break;
            
        case 'status':
        case 'info':
            await showServiceStatus(msg, args[1], renderAPI);
            break;
            
        case 'deploy':
            await deployService(msg, args[1], renderAPI);
            break;
            
        case 'logs':
            await showLogs(msg, args[1], renderAPI, args.slice(2));
            break;
            
        case 'suspend':
            await suspendService(msg, args[1], renderAPI);
            break;
            
        case 'resume':
            await resumeService(msg, args[1], renderAPI);
            break;
            
        case 'env':
            await manageEnvVars(msg, args.slice(1), renderAPI);
            break;
            
        case 'create':
            await createService(msg, args.slice(1), renderAPI);
            break;
            
        default:
            await showHelp(msg);
    }
}

async function listServices(msg, renderAPI) {
    const status = await msg.reply('🔄 Fetching services...');
    
    try {
        const services = await renderAPI.listServices();
        
        if (!services || services.length === 0) {
            return status.edit('❌ No services found');
        }
        
        const active = services.filter(s => s.service.suspended === 'not_suspended');
        const suspended = services.filter(s => s.service.suspended === 'suspended');
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('📋 Render Services')
            .setDescription(`Total: **${services.length}** | Active: **${active.length}** | Suspended: **${suspended.length}**`)
            .setTimestamp();
        
        // Add active services
        if (active.length > 0) {
            const activeList = active.slice(0, 10).map(s => {
                const svc = s.service;
                return `🟢 **${svc.name}**\n└─ \`${svc.id}\` • ${svc.region}`;
            }).join('\n\n');
            
            embed.addFields({ name: '✅ Active Services', value: activeList });
        }
        
        // Add suspended services
        if (suspended.length > 0) {
            const suspendedList = suspended.slice(0, 5).map(s => {
                const svc = s.service;
                return `🔴 **${svc.name}**\n└─ \`${svc.id}\``;
            }).join('\n\n');
            
            embed.addFields({ name: '⏸️ Suspended Services', value: suspendedList });
        }
        
        embed.setFooter({ text: 'Use .render status <id> for details' });
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function showServiceStatus(msg, serviceId, renderAPI) {
    if (!serviceId) {
        return msg.reply('❓ Usage: `.render status <service-id>`');
    }
    
    const status = await msg.reply('🔄 Fetching service info...');
    
    try {
        const service = await renderAPI.getService(serviceId);
        const deploys = await renderAPI.listDeploys(serviceId, 3);
        
        const isActive = service.suspended === 'not_suspended';
        
        const embed = new EmbedBuilder()
            .setColor(isActive ? 0x46E7A8 : 0xFFA500)
            .setTitle(`${isActive ? '🟢' : '🔴'} ${service.name}`)
            .setDescription(`\`${service.id}\``)
            .addFields(
                { name: 'Type', value: service.type, inline: true },
                { name: 'Region', value: service.region, inline: true },
                { name: 'Plan', value: service.plan || 'free', inline: true },
                { name: 'Branch', value: service.branch || 'N/A', inline: true },
                { name: 'Status', value: isActive ? '✅ Active' : '⏸️ Suspended', inline: true },
                { name: 'Auto Deploy', value: service.autoDeploy || 'N/A', inline: true }
            )
            .setTimestamp();
        
        if (service.serviceDetails?.url) {
            embed.addFields({ name: '🌐 URL', value: service.serviceDetails.url });
        }
        
        // Recent deploys
        if (deploys && deploys.length > 0) {
            const deployList = deploys.map(d => {
                const dep = d.deploy || d;
                const statusEmoji = {
                    'live': '✅',
                    'build_in_progress': '🔨',
                    'build_failed': '❌',
                    'canceled': '🚫'
                }[dep.status] || '❓';
                
                return `${statusEmoji} \`${dep.id.slice(0, 12)}\` - ${dep.status}`;
            }).join('\n');
            
            embed.addFields({ name: '📦 Recent Deploys', value: deployList });
        }
        
        embed.setFooter({ text: 'Render.com' });
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function deployService(msg, serviceId, renderAPI) {
    if (!serviceId) {
        return msg.reply('❓ Usage: `.render deploy <service-id> [clear-cache]`');
    }
    
    const status = await msg.reply('🚀 Triggering deploy...');
    
    try {
        const clearCache = msg.content.toLowerCase().includes('clear');
        const result = await renderAPI.deploy(serviceId, clearCache);
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('🚀 Deploy Triggered')
            .addFields(
                { name: 'Deploy ID', value: `\`${result.id}\``, inline: true },
                { name: 'Status', value: result.status || 'created', inline: true },
                { name: 'Clear Cache', value: clearCache ? '✅ Yes' : '❌ No', inline: true }
            )
            .setTimestamp();
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Deploy failed: ${error.message}`);
    }
}

async function showLogs(msg, serviceId, renderAPI, options) {
    if (!serviceId) {
        return msg.reply('❓ Usage: `.render logs <service-id> [limit] [level]`');
    }
    
    const status = await msg.reply('📜 Fetching logs...');
    
    try {
        const limit = parseInt(options[0]) || 50;
        const level = options[1]?.toLowerCase();
        
        const logsData = await renderAPI.getLogs(serviceId, { limit, level });
        
        if (!logsData.logs || logsData.logs.length === 0) {
            return status.edit('📜 No logs found in the last hour');
        }
        
        let logText = '';
        logsData.logs.slice(0, 30).forEach(log => {
            const levelEmoji = {
                'info': 'ℹ️',
                'warn': '⚠️',
                'error': '❌',
                'debug': '🔍'
            }[log.level] || '📝';
            
            const time = log.timestamp?.slice(11, 19) || '';
            const message = log.message?.slice(0, 100) || '';
            logText += `\`${time}\` ${levelEmoji} ${message}\n`;
        });
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📜 Logs: ${serviceId.slice(0, 15)}...`)
            .setDescription('```\n' + logText.slice(0, 4000) + '\n```')
            .setFooter({ text: `Showing ${Math.min(30, logsData.logs.length)} of ${logsData.logs.length} logs` })
            .setTimestamp();
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function suspendService(msg, serviceId, renderAPI) {
    if (!serviceId) {
        return msg.reply('❓ Usage: `.render suspend <service-id>`');
    }
    
    const status = await msg.reply('⏸️ Suspending service...');
    
    try {
        await renderAPI.suspendService(serviceId);
        
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⏸️ Service Suspended')
            .setDescription(`Service \`${serviceId}\` has been suspended.\n\n💡 Use \`.render resume ${serviceId}\` to activate again.`)
            .setTimestamp();
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function resumeService(msg, serviceId, renderAPI) {
    if (!serviceId) {
        return msg.reply('❓ Usage: `.render resume <service-id>`');
    }
    
    const status = await msg.reply('▶️ Resuming service...');
    
    try {
        await renderAPI.resumeService(serviceId);
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('▶️ Service Resumed')
            .setDescription(`Service \`${serviceId}\` is now active.`)
            .setTimestamp();
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function manageEnvVars(msg, args, renderAPI) {
    const serviceId = args[0];
    const action = args[1]?.toLowerCase();
    
    if (!serviceId) {
        return msg.reply('❓ Usage:\n```\n.render env <service-id> list\n.render env <service-id> set KEY value\n.render env <service-id> delete KEY\n```');
    }
    
    const status = await msg.reply('🔧 Managing environment variables...');
    
    try {
        if (action === 'list') {
            const vars = await renderAPI.getEnvVars(serviceId);
            
            if (!vars || vars.length === 0) {
                return status.edit('📝 No environment variables set');
            }
            
            const varList = vars.map(v => `• \`${v.key}\``).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🔐 Environment Variables')
                .setDescription(varList)
                .setFooter({ text: 'Values are hidden for security' })
                .setTimestamp();
            
            await status.edit({ content: null, embeds: [embed] });
            
        } else if (action === 'set') {
            const key = args[2];
            const value = args.slice(3).join(' ');
            
            if (!key || !value) {
                return status.edit('❓ Usage: `.render env <service-id> set KEY value`');
            }
            
            await renderAPI.setEnvVar(serviceId, key, value);
            
            await status.edit(`✅ Environment variable \`${key}\` has been set.\n\n⚠️ **Redeploy required** untuk apply changes:\n\`.render deploy ${serviceId}\``);
            
        } else if (action === 'delete') {
            const key = args[2];
            
            if (!key) {
                return status.edit('❓ Usage: `.render env <service-id> delete KEY`');
            }
            
            await renderAPI.deleteEnvVar(serviceId, key);
            
            await status.edit(`✅ Environment variable \`${key}\` has been deleted.`);
            
        } else {
            await status.edit('❓ Invalid action. Use: `list`, `set`, or `delete`');
        }
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function createService(msg, args, renderAPI) {
    // Interactive creation would be better with Discord buttons/modals
    // For now, simple command-line style
    
    if (args.length < 2) {
        return msg.reply('❓ Usage: `.render create <name> <repo-url> [branch] [region]`\n\n**Example:**\n`.render create my-api https://github.com/user/repo main oregon`');
    }
    
    const status = await msg.reply('🏗️ Creating service...');
    
    try {
        const name = args[0];
        const repo = args[1];
        const branch = args[2] || 'main';
        const region = args[3] || 'oregon';
        
        const result = await renderAPI.createService({
            name,
            repo,
            branch,
            region,
            plan: 'free'
        });
        
        const service = result.service;
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('✅ Service Created!')
            .addFields(
                { name: 'Name', value: service.name, inline: true },
                { name: 'ID', value: `\`${service.id}\``, inline: true },
                { name: 'Region', value: region, inline: true },
                { name: 'Branch', value: branch, inline: true }
            )
            .setFooter({ text: 'Service is deploying...' })
            .setTimestamp();
        
        if (service.serviceDetails?.url) {
            embed.addFields({ name: '🌐 URL', value: service.serviceDetails.url });
        }
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Create failed: ${error.message}`);
    }
}

async function showHelp(msg) {
    const embed = new EmbedBuilder()
        .setColor(0x46E7A8)
        .setTitle('📖 Render Commands Help')
        .setDescription('Manage Render services from Discord')
        .addFields(
            {
                name: '📋 Service Management',
                value: '```\n.render list\n.render status <id>\n.render create <name> <repo>\n```',
                inline: false
            },
            {
                name: '🚀 Deployment',
                value: '```\n.render deploy <id>\n.render deploy <id> clear\n.render logs <id> [limit]\n```',
                inline: false
            },
            {
                name: '⏯️ Control',
                value: '```\n.render suspend <id>\n.render resume <id>\n```',
                inline: false
            },
            {
                name: '🔐 Environment',
                value: '```\n.render env <id> list\n.render env <id> set KEY value\n.render env <id> delete KEY\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Admin only commands' })
        .setTimestamp();
    
    await msg.reply({ embeds: [embed] });
}

module.exports = { handle };
