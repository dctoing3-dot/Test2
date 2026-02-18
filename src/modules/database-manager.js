// src/modules/database-manager.js

const { Pool } = require('pg');
const Redis = require('ioredis');

class DatabaseManager {
    constructor(config) {
        this.config = config;
        this.pg = null;
        this.redis = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // PostgreSQL connection
            if (this.config.postgresUrl) {
                this.pg = new Pool({
                    connectionString: this.config.postgresUrl,
                    ssl: this.config.postgresSsl ? { rejectUnauthorized: false } : false,
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                });

                await this.pg.query('SELECT NOW()');
                console.log('✅ PostgreSQL connected');

                // Create tables
                await this.createTables();
            }

            // Redis connection
            if (this.config.redisUrl) {
                this.redis = new Redis(this.config.redisUrl, {
                    retryStrategy: (times) => {
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    },
                    maxRetriesPerRequest: 3
                });

                this.redis.on('connect', () => console.log('✅ Redis connected'));
                this.redis.on('error', (err) => console.error('Redis error:', err.message));
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Database initialization failed:', error.message);
            return false;
        }
    }

    async createTables() {
        const queries = [
            // User preferences
            `CREATE TABLE IF NOT EXISTS user_preferences (
                user_id VARCHAR(20) PRIMARY KEY,
                guild_id VARCHAR(20),
                preferences JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )`,

            // Conversation history
            `CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                role VARCHAR(20),
                content TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )`,

            // Knowledge base
            `CREATE TABLE IF NOT EXISTS knowledge_base (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                user_id VARCHAR(20),
                title VARCHAR(255),
                content TEXT,
                metadata JSONB DEFAULT '{}',
                embedding VECTOR(1536),
                created_at TIMESTAMP DEFAULT NOW()
            )`,

            // Usage analytics
            `CREATE TABLE IF NOT EXISTS usage_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                command VARCHAR(100),
                provider VARCHAR(50),
                model VARCHAR(100),
                latency INTEGER,
                success BOOLEAN,
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )`,

            // Indexes
            `CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_usage_logs_guild ON usage_logs(guild_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_kb_guild ON knowledge_base(guild_id)`
        ];

        for (const query of queries) {
            try {
                await this.pg.query(query);
            } catch (error) {
                // Ignore "already exists" errors
                if (!error.message.includes('already exists')) {
                    console.error('Table creation error:', error.message);
                }
            }
        }
    }

    // User Preferences
    async getUserPreferences(userId, guildId) {
        if (!this.pg) return {};

        try {
            const result = await this.pg.query(
                'SELECT preferences FROM user_preferences WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            return result.rows[0]?.preferences || {};
        } catch (error) {
            console.error('Get preferences error:', error.message);
            return {};
        }
    }

    async setUserPreference(userId, guildId, key, value) {
        if (!this.pg) return false;

        try {
            await this.pg.query(
                `INSERT INTO user_preferences (user_id, guild_id, preferences)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    preferences = user_preferences.preferences || $3,
                    updated_at = NOW()`,
                [userId, guildId, JSON.stringify({ [key]: value })]
            );

            return true;
        } catch (error) {
            console.error('Set preference error:', error.message);
            return false;
        }
    }

    // Conversation History
    async saveConversation(userId, guildId, role, content, metadata = {}) {
        if (!this.pg) return false;

        try {
            await this.pg.query(
                'INSERT INTO conversations (user_id, guild_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5)',
                [userId, guildId, role, content, metadata]
            );

            return true;
        } catch (error) {
            console.error('Save conversation error:', error.message);
            return false;
        }
    }

    async getConversationHistory(userId, guildId, limit = 50) {
        if (!this.pg) return [];

        try {
            const result = await this.pg.query(
                'SELECT role, content, created_at FROM conversations WHERE user_id = $1 AND guild_id = $2 ORDER BY created_at DESC LIMIT $3',
                [userId, guildId, limit]
            );

            return result.rows.reverse();
        } catch (error) {
            console.error('Get conversation error:', error.message);
            return [];
        }
    }

    async clearConversationHistory(userId, guildId) {
        if (!this.pg) return false;

        try {
            await this.pg.query(
                'DELETE FROM conversations WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            return true;
        } catch (error) {
            console.error('Clear conversation error:', error.message);
            return false;
        }
    }

    // Usage Analytics
    async logUsage(userId, guildId, command, provider, model, latency, success, error = null) {
        if (!this.pg) return;

        try {
            await this.pg.query(
                'INSERT INTO usage_logs (user_id, guild_id, command, provider, model, latency, success, error) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [userId, guildId, command, provider, model, latency, success, error]
            );
        } catch (err) {
            console.error('Log usage error:', err.message);
        }
    }

    async getUsageStats(guildId, days = 30) {
        if (!this.pg) return null;

        try {
            const result = await this.pg.query(
                `SELECT 
                    COUNT(*) as total_requests,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(latency) as avg_latency,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
                    command,
                    provider,
                    model
                FROM usage_logs
                WHERE guild_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
                GROUP BY command, provider, model
                ORDER BY total_requests DESC`,
                [guildId]
            );

            return result.rows;
        } catch (error) {
            console.error('Get usage stats error:', error.message);
            return null;
        }
    }

    // Redis Cache
    async cacheSet(key, value, expirySeconds = 3600) {
        if (!this.redis) return false;

        try {
            await this.redis.setex(key, expirySeconds, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Cache set error:', error.message);
            return false;
        }
    }

    async cacheGet(key) {
        if (!this.redis) return null;

        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error.message);
            return null;
        }
    }

    async cacheDel(key) {
        if (!this.redis) return false;

        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error('Cache del error:', error.message);
            return false;
        }
    }

    async close() {
        if (this.pg) {
            await this.pg.end();
            console.log('PostgreSQL connection closed');
        }

        if (this.redis) {
            this.redis.disconnect();
            console.log('Redis connection closed');
        }
    }
}

module.exports = DatabaseManager;
