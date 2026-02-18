// src/modules/code-executor.js

const fetch = require('node-fetch');

class CodeExecutor {
    constructor() {
        this.baseUrl = 'https://emkc.org/api/v2/piston';
        this.supportedLanguages = null;
    }

    async getLanguages() {
        if (this.supportedLanguages) return this.supportedLanguages;
        
        try {
            const response = await fetch(`${this.baseUrl}/runtimes`);
            const runtimes = await response.json();
            
            this.supportedLanguages = runtimes.map(runtime => ({
                language: runtime.language,
                version: runtime.version,
                aliases: runtime.aliases || []
            }));
            
            return this.supportedLanguages;
        } catch (error) {
            console.error('Failed to fetch languages:', error.message);
            return [];
        }
    }

    async executeCode(language, code, stdin = '', args = []) {
        try {
            const response = await fetch(`${this.baseUrl}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: language,
                    version: '*',
                    files: [{
                        name: this.getFileName(language),
                        content: code
                    }],
                    stdin: stdin,
                    args: args,
                    compile_timeout: 10000,
                    run_timeout: 3000,
                    compile_memory_limit: -1,
                    run_memory_limit: -1
                })
            });

            if (!response.ok) {
                throw new Error(`Piston API error: ${response.status}`);
            }

            const result = await response.json();
            
            return {
                language: result.language,
                version: result.version,
                output: result.run.output || '',
                stdout: result.run.stdout || '',
                stderr: result.run.stderr || '',
                code: result.run.code,
                signal: result.run.signal,
                compile_output: result.compile?.output || '',
                success: result.run.code === 0
            };
        } catch (error) {
            console.error('Code execution error:', error.message);
            throw error;
        }
    }

    getFileName(language) {
        const extensions = {
            'python': 'main.py',
            'javascript': 'index.js',
            'typescript': 'index.ts',
            'java': 'Main.java',
            'c': 'main.c',
            'cpp': 'main.cpp',
            'csharp': 'Program.cs',
            'go': 'main.go',
            'rust': 'main.rs',
            'ruby': 'main.rb',
            'php': 'index.php',
            'swift': 'main.swift',
            'kotlin': 'Main.kt',
            'scala': 'Main.scala',
            'bash': 'script.sh',
            'r': 'script.r',
            'perl': 'script.pl',
            'lua': 'script.lua',
            'haskell': 'main.hs',
            'elixir': 'main.exs',
            'clojure': 'main.clj',
            'dart': 'main.dart',
            'sql': 'query.sql'
        };
        
        return extensions[language.toLowerCase()] || 'main.txt';
    }

    extractCodeBlock(message) {
        // Extract code from Discord code block
        const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/;
        const match = message.match(codeBlockRegex);
        
        if (match) {
            return {
                language: match[1] || 'text',
                code: match[2].trim()
            };
        }
        
        return null;
    }

    getLanguageIcon(language) {
        const icons = {
            'python': '🐍',
            'javascript': '🟨',
            'typescript': '🔷',
            'java': '☕',
            'c': '©️',
            'cpp': '➕',
            'csharp': '#️⃣',
            'go': '🐹',
            'rust': '🦀',
            'ruby': '💎',
            'php': '🐘',
            'swift': '🍎',
            'kotlin': '🅺',
            'scala': '⚖️',
            'bash': '🐚',
            'r': '📊',
            'sql': '🗄️',
            'html': '🌐',
            'css': '🎨'
        };
        
        return icons[language.toLowerCase()] || '📝';
    }

    formatOutput(output, maxLength = 1900) {
        if (!output) return '(no output)';
        
        if (output.length > maxLength) {
            return output.slice(0, maxLength) + '\n... (output truncated)';
        }
        
        return output;
    }
}

module.exports = CodeExecutor;
