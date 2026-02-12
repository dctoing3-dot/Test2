// ============================================================
//         GITHUB COMMANDS HANDLER
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Store untuk pending confirmations
const pendingConfirmations = new Map();

async function handle(msg, args, githubAPI) {
    const subCmd = args[0]?.toLowerCase();

    switch (subCmd) {
        case 'repos':
        case 'list':
            await listRepos(msg, githubAPI);
            break;
            
        case 'repo':
        case 'info':
            await showRepoInfo(msg, args[1], githubAPI);
            break;
            
        case 'fork':
            await forkRepo(msg, args.slice(1), githubAPI);
            break;
            
        case 'create':
        case 'new':
            await createRepo(msg, args.slice(1), githubAPI);
            break;
            
        case 'delete':
        case 'rm':
            await deleteRepo(msg, args[1], githubAPI);
            break;
            
        case 'browse':
        case 'files':
        case 'ls':
            await browseFiles(msg, args.slice(1), githubAPI);
            break;
            
        case 'read':
        case 'cat':
        case 'view':
            await readFile(msg, args.slice(1), githubAPI);
            break;
            
        case 'commits':
        case 'log':
            await listCommits(msg, args.slice(1), githubAPI);
            break;
            
        case 'branches':
            await listBranches(msg, args[1], githubAPI);
            break;
            
        default:
            await showHelp(msg);
    }
}

// ========== REPOSITORY COMMANDS ==========

async function listRepos(msg, githubAPI) {
    const status = await msg.reply('🔄 Fetching repositories...');
    
    try {
        const repos = await githubAPI.listRepos(30);
        
        if (!repos || repos.length === 0) {
            return status.edit('❌ No repositories found');
        }
        
        const embed = new EmbedBuilder()
            .setColor(0x24292E)
            .setTitle('📚 GitHub Repositories')
            .setDescription(`Found **${repos.length}** repositories`)
            .setTimestamp();
        
        // Split into public and private
        const publicRepos = repos.filter(r => !r.private).slice(0, 8);
        const privateRepos = repos.filter(r => r.private).slice(0, 5);
        
        if (publicRepos.length > 0) {
            const publicList = publicRepos.map(r => {
                const stars = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : '';
                const lang = r.language ? ` • ${r.language}` : '';
                return `🌐 **${r.name}**${stars}${lang}\n└─ ${r.description?.slice(0, 50) || 'No description'}`;
            }).join('\n\n');
            
            embed.addFields({ name: '🌐 Public', value: publicList.slice(0, 1024) });
        }
        
        if (privateRepos.length > 0) {
            const privateList = privateRepos.map(r => {
                return `🔒 **${r.name}**\n└─ ${r.description?.slice(0, 40) || 'No description'}`;
            }).join('\n\n');
            
            embed.addFields({ name: '🔒 Private', value: privateList.slice(0, 1024) });
        }
        
        embed.setFooter({ text: 'Use .github repo <name> for details' });
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function showRepoInfo(msg, repoName, githubAPI) {
    if (!repoName) {
        return msg.reply('❓ Usage: `.github repo <owner/repo>` or `.github repo <repo>`');
    }
    
    const status = await msg.reply('🔄 Fetching repository info...');
    
    try {
        // Parse owner/repo or just repo
        let owner, repo;
        if (repoName.includes('/')) {
            [owner, repo] = repoName.split('/');
        } else {
            owner = await githubAPI.getUser();
            repo = repoName;
        }
        
        const repoData = await githubAPI.getRepo(owner, repo);
        const branches = await githubAPI.listBranches(owner, repo);
        
        const embed = new EmbedBuilder()
            .setColor(repoData.private ? 0xFFA500 : 0x24292E)
            .setTitle(`${repoData.private ? '🔒' : '🌐'} ${repoData.full_name}`)
            .setURL(repoData.html_url)
            .setDescription(repoData.description || 'No description')
            .addFields(
                { name: 'Language', value: repoData.language || 'N/A', inline: true },
                { name: 'Stars', value: `⭐ ${repoData.stargazers_count}`, inline: true },
                { name: 'Forks', value: `🍴 ${repoData.forks_count}`, inline: true },
                { name: 'Default Branch', value: `\`${repoData.default_branch}\``, inline: true },
                { name: 'Branches', value: `${branches.length}`, inline: true },
                { name: 'Visibility', value: repoData.private ? 'Private' : 'Public', inline: true }
            )
            .setTimestamp();
        
        if (repoData.homepage) {
            embed.addFields({ name: '🌐 Homepage', value: repoData.homepage });
        }
        
        // Add clone URLs
        embed.addFields({
            name: '📋 Clone',
            value: `\`\`\`\ngit clone ${repoData.clone_url}\n\`\`\``
        });
        
        // Action buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Open in GitHub')
                .setURL(repoData.html_url)
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setCustomId(`gh_browse_${owner}_${repo}`)
                .setLabel('Browse Files')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📁')
        );
        
        await status.edit({ content: null, embeds: [embed], components: [row] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

// ========== FORK COMMAND ==========

async function forkRepo(msg, args, githubAPI) {
    if (args.length === 0) {
        return msg.reply(`🍴 **Fork Repository**

**Usage:**
\`.github fork <url>\`
\`.github fork <owner/repo>\`
\`.github fork <owner/repo> <new-name>\`

**Examples:**
\`.github fork https://github.com/vercel/next.js\`
\`.github fork facebook/react my-react-fork\``);
    }
    
    const status = await msg.reply('🍴 Forking repository...');
    
    try {
        let owner, repo, newName;
        const input = args[0];
        
        // Parse URL or owner/repo
        if (input.includes('github.com')) {
            const match = input.match(/github\.com\/([^\/]+)\/([^\/\?]+)/);
            if (!match) throw new Error('Invalid GitHub URL');
            owner = match[1];
            repo = match[2].replace('.git', '');
        } else if (input.includes('/')) {
            [owner, repo] = input.split('/');
        } else {
            throw new Error('Invalid format. Use URL or owner/repo');
        }
        
        newName = args[1] || null;
        
        const result = await githubAPI.forkRepo(owner, repo, newName);
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('🍴 Repository Forked!')
            .addFields(
                { name: 'Original', value: `\`${owner}/${repo}\``, inline: true },
                { name: 'Your Fork', value: `\`${result.full_name}\``, inline: true },
                { name: 'URL', value: result.html_url }
            )
            .setTimestamp();
        
        // Add action buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Open Fork')
                .setURL(result.html_url)
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setCustomId(`gh_browse_${result.owner.login}_${result.name}`)
                .setLabel('Browse Files')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📁')
        );
        
        await status.edit({ content: null, embeds: [embed], components: [row] });
        
    } catch (error) {
        if (error.message.includes('already exists')) {
            await status.edit(`⚠️ Fork sudah ada! Gunakan nama berbeda:\n\`.github fork ${args[0]} nama-baru\``);
        } else {
            await status.edit(`❌ Fork failed: ${error.message}`);
        }
    }
}

// ========== CREATE & DELETE REPO ==========

async function createRepo(msg, args, githubAPI) {
    if (args.length === 0) {
        return msg.reply(`📦 **Create Repository**

**Usage:**
\`.github create <name> [description] [--private]\`

**Examples:**
\`.github create my-project\`
\`.github create my-api "REST API project"\`
\`.github create secret-project --private\``);
    }
    
    const status = await msg.reply('📦 Creating repository...');
    
    try {
        const name = args[0];
        const isPrivate = args.includes('--private');
        const description = args.filter(a => a !== '--private' && a !== name).join(' ');
        
        const result = await githubAPI.createRepo(name, description, isPrivate);
        
        const embed = new EmbedBuilder()
            .setColor(0x46E7A8)
            .setTitle('✅ Repository Created!')
            .addFields(
                { name: 'Name', value: result.name, inline: true },
                { name: 'Visibility', value: isPrivate ? '🔒 Private' : '🌐 Public', inline: true },
                { name: 'URL', value: result.html_url }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Open Repository')
                .setURL(result.html_url)
                .setStyle(ButtonStyle.Link)
        );
        
        await status.edit({ content: null, embeds: [embed], components: [row] });
        
    } catch (error) {
        await status.edit(`❌ Create failed: ${error.message}`);
    }
}

async function deleteRepo(msg, repoName, githubAPI) {
    if (!repoName) {
        return msg.reply('❓ Usage: `.github delete <repo-name>`\n\n⚠️ **WARNING:** This action is PERMANENT!');
    }
    
    // Confirmation required
    const confirmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 CONFIRM DELETION')
        .setDescription(`Are you sure you want to **PERMANENTLY DELETE** repository \`${repoName}\`?\n\n**This action cannot be undone!**`)
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gh_delete_confirm_${repoName}`)
            .setLabel('DELETE')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('gh_delete_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const confirmMsg = await msg.reply({ embeds: [confirmEmbed], components: [row] });
    
    // Store pending confirmation
    pendingConfirmations.set(msg.author.id, {
        action: 'delete_repo',
        repoName,
        githubAPI,
        messageId: confirmMsg.id,
        expiresAt: Date.now() + 30000 // 30 seconds
    });
    
    // Auto-cancel after 30 seconds
    setTimeout(async () => {
        const pending = pendingConfirmations.get(msg.author.id);
        if (pending && pending.messageId === confirmMsg.id) {
            pendingConfirmations.delete(msg.author.id);
            try {
                await confirmMsg.edit({ 
                    content: '⏱️ Confirmation expired', 
                    embeds: [], 
                    components: [] 
                });
            } catch {}
        }
    }, 30000);
}

// ========== FILE BROWSING ==========

async function browseFiles(msg, args, githubAPI) {
    if (args.length === 0) {
        return msg.reply('❓ Usage: `.github browse <repo> [path] [branch]`\n\n**Example:**\n`.github browse my-repo src main`');
    }
    
    const status = await msg.reply('📁 Fetching files...');
    
    try {
        let owner, repo;
        const repoArg = args[0];
        
        if (repoArg.includes('/')) {
            [owner, repo] = repoArg.split('/');
        } else {
            owner = await githubAPI.getUser();
            repo = repoArg;
        }
        
        const filePath = args[1] || '';
        const branch = args[2] || 'main';
        
        const contents = await githubAPI.listContents(owner, repo, filePath, branch);
        
        if (!Array.isArray(contents)) {
            // It's a file, not a directory
            return readFile(msg, args, githubAPI);
        }
        
        // Separate folders and files
        const folders = contents.filter(c => c.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
        const files = contents.filter(c => c.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
        
        const embed = new EmbedBuilder()
            .setColor(0x24292E)
            .setTitle(`📂 ${repo}/${filePath || '(root)'}`)
            .setDescription(`Branch: \`${branch}\` | Items: **${contents.length}**`)
            .setTimestamp();
        
        // Format folder list
        if (folders.length > 0) {
            const folderList = folders.slice(0, 15).map(f => `📁 **${f.name}/**`).join('\n');
            embed.addFields({ name: `Folders (${folders.length})`, value: folderList });
        }
        
        // Format file list
        if (files.length > 0) {
            const fileList = files.slice(0, 20).map(f => {
                const size = f.size > 1024 ? `${(f.size/1024).toFixed(1)}KB` : `${f.size}B`;
                const icon = getFileIcon(f.name);
                return `${icon} ${f.name} *(${size})*`;
            }).join('\n');
            embed.addFields({ name: `Files (${files.length})`, value: fileList });
        }
        
        if (contents.length > 35) {
            embed.setFooter({ text: `Showing 35 of ${contents.length} items` });
        }
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function readFile(msg, args, githubAPI) {
    if (args.length < 2) {
        return msg.reply('❓ Usage: `.github read <repo> <file-path> [branch]`\n\n**Example:**\n`.github read my-repo src/index.js main`');
    }
    
    const status = await msg.reply('📄 Reading file...');
    
    try {
        let owner, repo;
        const repoArg = args[0];
        
        if (repoArg.includes('/')) {
            [owner, repo] = repoArg.split('/');
        } else {
            owner = await githubAPI.getUser();
            repo = repoArg;
        }
        
        const filePath = args[1];
        const branch = args[2] || 'main';
        
        const file = await githubAPI.getFile(owner, repo, filePath, branch);
        
        if (!file.decoded_content) {
            throw new Error('Cannot read binary file');
        }
        
        const content = file.decoded_content;
        const ext = filePath.split('.').pop() || '';
        
        // Determine syntax highlight language
        const langMap = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python',
            'json': 'json', 'yml': 'yaml', 'yaml': 'yaml',
            'md': 'markdown', 'html': 'html', 'css': 'css',
            'sh': 'bash', 'sql': 'sql', 'go': 'go', 'rs': 'rust'
        };
        const lang = langMap[ext] || '';
        
        const embed = new EmbedBuilder()
            .setColor(0x24292E)
            .setTitle(`📄 ${filePath}`)
            .setDescription(`\`\`\`${lang}\n${content.slice(0, 4000)}\n\`\`\``)
            .setFooter({ text: `${file.size} bytes | SHA: ${file.sha.slice(0, 7)}` })
            .setTimestamp();
        
        if (content.length > 4000) {
            embed.addFields({ 
                name: '⚠️ Truncated', 
                value: `File is ${content.length} chars. Showing first 4000.` 
            });
        }
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

// ========== COMMITS & BRANCHES ==========

async function listCommits(msg, args, githubAPI) {
    if (args.length === 0) {
        return msg.reply('❓ Usage: `.github commits <repo> [branch]`');
    }
    
    const status = await msg.reply('📝 Fetching commits...');
    
    try {
        let owner, repo;
        const repoArg = args[0];
        
        if (repoArg.includes('/')) {
            [owner, repo] = repoArg.split('/');
        } else {
            owner = await githubAPI.getUser();
            repo = repoArg;
        }
        
        const branch = args[1] || 'main';
        const commits = await githubAPI.listCommits(owner, repo, branch, 10);
        
        const embed = new EmbedBuilder()
            .setColor(0x24292E)
            .setTitle(`📝 Commits: ${repo}`)
            .setDescription(`Branch: \`${branch}\``)
            .setTimestamp();
        
        const commitList = commits.map(c => {
            const sha = c.sha.slice(0, 7);
            const msg = c.commit.message.split('\n')[0].slice(0, 50);
            const author = c.commit.author.name;
            const date = new Date(c.commit.author.date).toLocaleDateString('id-ID');
            return `\`${sha}\` ${msg}\n└─ *${author}* • ${date}`;
        }).join('\n\n');
        
        embed.addFields({ name: `Recent Commits (${commits.length})`, value: commitList.slice(0, 1024) });
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

async function listBranches(msg, repoArg, githubAPI) {
    if (!repoArg) {
        return msg.reply('❓ Usage: `.github branches <repo>`');
    }
    
    const status = await msg.reply('🌿 Fetching branches...');
    
    try {
        let owner, repo;
        
        if (repoArg.includes('/')) {
            [owner, repo] = repoArg.split('/');
        } else {
            owner = await githubAPI.getUser();
            repo = repoArg;
        }
        
        const branches = await githubAPI.listBranches(owner, repo);
        
        const embed = new EmbedBuilder()
            .setColor(0x24292E)
            .setTitle(`🌿 Branches: ${repo}`)
            .setDescription(branches.map(b => `• \`${b.name}\``).join('\n'))
            .setFooter({ text: `${branches.length} branches` })
            .setTimestamp();
        
        await status.edit({ content: null, embeds: [embed] });
        
    } catch (error) {
        await status.edit(`❌ Error: ${error.message}`);
    }
}

// ========== HELPERS ==========

function getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons = {
        'js': '🟨', 'ts': '🔷', 'py': '🐍', 'java': '☕',
        'json': '📋', 'yml': '⚙️', 'yaml': '⚙️', 'xml': '📄',
        'md': '📝', 'txt': '📄', 'html': '🌐', 'css': '🎨',
        'png': '🖼️', 'jpg': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
        'pdf': '📕', 'doc': '📘', 'docx': '📘', 'xls': '📗',
        'sh': '🖥️', 'bash': '🖥️', 'dockerfile': '🐳',
        'go': '🔵', 'rs': '🦀', 'rb': '💎', 'php': '🐘'
    };
    return icons[ext] || '📄';
}

async function showHelp(msg) {
    const embed = new EmbedBuilder()
        .setColor(0x24292E)
        .setTitle('📖 GitHub Commands Help')
        .setDescription('Manage GitHub repositories from Discord')
        .addFields(
            {
                name: '📚 Repositories',
                value: '```\n.github repos\n.github repo <name>\n.github create <name>\n.github delete <name>\n```',
                inline: false
            },
            {
                name: '🍴 Fork',
                value: '```\n.github fork <url>\n.github fork <owner/repo>\n.github fork <owner/repo> <new-name>\n```',
                inline: false
            },
            {
                name: '📁 Files',
                value: '```\n.github browse <repo> [path]\n.github read <repo> <file>\n```',
                inline: false
            },
            {
                name: '📝 History',
                value: '```\n.github commits <repo> [branch]\n.github branches <repo>\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Admin only commands' })
        .setTimestamp();
    
    await msg.reply({ embeds: [embed] });
}

// ========== EXPORT ==========

module.exports = { 
    handle,
    pendingConfirmations
};
