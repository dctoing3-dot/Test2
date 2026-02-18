// src/modules/youtube-intelligence.js

const fetch = require('node-fetch');
const cheerio = require('cheerio');

class YouTubeIntelligence {
    constructor() {
        this.baseUrl = 'https://www.youtube.com';
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    async getVideoInfo(videoId) {
        try {
            const url = `${this.baseUrl}/watch?v=${videoId}`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Extract metadata
            const title = $('meta[property="og:title"]').attr('content') || 
                         $('meta[name="title"]').attr('content') || '';
            
            const description = $('meta[property="og:description"]').attr('content') || 
                               $('meta[name="description"]').attr('content') || '';
            
            const thumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
            
            // Extract from JSON data
            let videoDetails = null;
            let transcript = null;
            
            const scriptTags = $('script');
            scriptTags.each((i, elem) => {
                const content = $(elem).html();
                
                // Extract ytInitialPlayerResponse
                if (content && content.includes('ytInitialPlayerResponse')) {
                    const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
                    if (match) {
                        try {
                            const data = JSON.parse(match[1]);
                            videoDetails = data.videoDetails;
                            
                            // Try to get captions
                            const captions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                            if (captions && captions.length > 0) {
                                // Prioritize Indonesian or English
                                const caption = captions.find(c => c.languageCode === 'id') || 
                                              captions.find(c => c.languageCode === 'en') || 
                                              captions[0];
                                
                                if (caption) {
                                    transcript = { url: caption.baseUrl, language: caption.languageCode };
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse video details:', e.message);
                        }
                    }
                }
            });
            
            return {
                videoId,
                title: title || videoDetails?.title || 'Unknown',
                description: description || videoDetails?.shortDescription || '',
                author: videoDetails?.author || 'Unknown',
                lengthSeconds: parseInt(videoDetails?.lengthSeconds || 0),
                viewCount: parseInt(videoDetails?.viewCount || 0),
                thumbnail: thumbnailUrl,
                transcript: transcript,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
            
        } catch (error) {
            console.error('YouTube fetch error:', error.message);
            throw new Error('Failed to fetch video information');
        }
    }

    async getTranscript(transcriptUrl) {
        try {
            const response = await fetch(transcriptUrl);
            const xml = await response.text();
            
            const $ = cheerio.load(xml, { xmlMode: true });
            
            const lines = [];
            $('text').each((i, elem) => {
                const text = $(elem).text()
                    .replace(/&amp;/g, '&')
                    .replace(/&#39;/g, "'")
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
                
                const start = parseFloat($(elem).attr('start'));
                
                if (text.trim()) {
                    lines.push({
                        start: Math.floor(start),
                        text: text.trim()
                    });
                }
            });
            
            return lines;
            
        } catch (error) {
            console.error('Transcript fetch error:', error.message);
            return null;
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    formatViewCount(count) {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }

    generateTimestamps(transcript, intervalSeconds = 300) {
        // Generate summary timestamps every X seconds
        if (!transcript || transcript.length === 0) return [];
        
        const timestamps = [];
        let currentChapter = null;
        
        transcript.forEach(line => {
            if (!currentChapter || line.start - currentChapter.start >= intervalSeconds) {
                if (currentChapter) {
                    timestamps.push(currentChapter);
                }
                currentChapter = {
                    start: line.start,
                    startFormatted: this.formatDuration(line.start),
                    text: line.text
                };
            } else {
                currentChapter.text += ' ' + line.text;
            }
        });
        
        if (currentChapter) {
            timestamps.push(currentChapter);
        }
        
        return timestamps;
    }

    summarizeTranscript(transcript, maxLength = 3000) {
        if (!transcript || transcript.length === 0) return '';
        
        const fullText = transcript.map(line => line.text).join(' ');
        
        if (fullText.length <= maxLength) {
            return fullText;
        }
        
        // Take first part and last part
        const halfLength = Math.floor(maxLength / 2);
        return fullText.slice(0, halfLength) + '\n\n[...]\n\n' + fullText.slice(-halfLength);
    }
}

module.exports = YouTubeIntelligence;
