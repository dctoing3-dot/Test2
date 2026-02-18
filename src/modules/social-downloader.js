// src/modules/social-downloader.js

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class SocialDownloader {
    constructor(tempPath = './temp') {
        this.tempPath = tempPath;
        this.apiEndpoints = {
            tiktok: 'https://api.tiklydown.eu.org/api/download/v3',
            instagram: 'https://v3.igdownloader.app/api/ajaxSearch',
            twitter: 'https://twitsave.com/info',
            facebook: 'https://getmyfb.com/process'
        };
    }

    detectPlatform(url) {
        if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) return 'tiktok';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
        return null;
    }

    async download(url) {
        const platform = this.detectPlatform(url);
        if (!platform) {
            throw new Error('Platform tidak didukung. Supported: TikTok, Instagram, Twitter/X, Facebook');
        }

        console.log(`Downloading from ${platform}: ${url}`);

        try {
            switch (platform) {
                case 'tiktok':
                    return await this.downloadTikTok(url);
                case 'instagram':
                    return await this.downloadInstagram(url);
                case 'twitter':
                    return await this.downloadTwitter(url);
                case 'facebook':
                    return await this.downloadFacebook(url);
                default:
                    throw new Error('Platform tidak dikenali');
            }
        } catch (error) {
            console.error(`Download error (${platform}):`, error.message);
            throw error;
        }
    }

    async downloadTikTok(url) {
        try {
            // Method 1: TiklyDown API (No Watermark)
            const response = await fetch(this.apiEndpoints.tiktok, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (data.result && data.result.video) {
                const videoUrl = data.result.video;
                const filename = `tiktok_${Date.now()}.mp4`;
                const filepath = await this.downloadFile(videoUrl, filename);

                return {
                    success: true,
                    platform: 'tiktok',
                    type: 'video',
                    title: data.result.title || 'TikTok Video',
                    author: data.result.author?.nickname || 'Unknown',
                    thumbnail: data.result.cover,
                    filepath: filepath,
                    url: videoUrl,
                    stats: {
                        likes: data.result.stats?.likes || 0,
                        comments: data.result.stats?.comments || 0,
                        shares: data.result.stats?.shares || 0
                    }
                };
            }

            throw new Error('Failed to extract TikTok video');
        } catch (error) {
            // Fallback: Manual scraping
            return await this.downloadTikTokFallback(url);
        }
    }

    async downloadTikTokFallback(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const html = await response.text();
            
            // Extract video URL from script tags
            const videoMatch = html.match(/"downloadAddr":"([^"]+)"/);
            if (videoMatch) {
                const videoUrl = videoMatch[1].replace(/\\u002F/g, '/');
                const filename = `tiktok_${Date.now()}.mp4`;
                const filepath = await this.downloadFile(videoUrl, filename);

                return {
                    success: true,
                    platform: 'tiktok',
                    type: 'video',
                    title: 'TikTok Video',
                    filepath: filepath,
                    url: videoUrl
                };
            }

            throw new Error('Video URL not found');
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
        }
    }

    async downloadInstagram(url) {
        try {
            const response = await fetch(this.apiEndpoints.instagram, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: `recaptchaToken=&q=${encodeURIComponent(url)}&t=media&lang=en`
            });

            const data = await response.json();

            if (data.status === 'ok' && data.data) {
                const $ = cheerio.load(data.data);
                const downloadLinks = [];

                // Extract all media links
                $('a[href*="cdninstagram"]').each((i, elem) => {
                    const href = $(elem).attr('href');
                    if (href && !downloadLinks.includes(href)) {
                        downloadLinks.push(href);
                    }
                });

                if (downloadLinks.length > 0) {
                    const mainUrl = downloadLinks[0];
                    const isVideo = mainUrl.includes('.mp4');
                    const ext = isVideo ? 'mp4' : 'jpg';
                    const filename = `instagram_${Date.now()}.${ext}`;
                    const filepath = await this.downloadFile(mainUrl, filename);

                    return {
                        success: true,
                        platform: 'instagram',
                        type: isVideo ? 'video' : 'image',
                        filepath: filepath,
                        url: mainUrl,
                        additionalMedia: downloadLinks.slice(1)
                    };
                }
            }

            throw new Error('Failed to extract Instagram media');
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    async downloadTwitter(url) {
        try {
            const response = await fetch(this.apiEndpoints.twitter, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: `url=${encodeURIComponent(url)}`
            });

            const html = await response.text();
            const $ = cheerio.load(html);

            // Find download links
            const videoUrl = $('.download-btn').first().attr('href');

            if (videoUrl) {
                const filename = `twitter_${Date.now()}.mp4`;
                const filepath = await this.downloadFile(videoUrl, filename);

                return {
                    success: true,
                    platform: 'twitter',
                    type: 'video',
                    filepath: filepath,
                    url: videoUrl
                };
            }

            throw new Error('Video URL not found');
        } catch (error) {
            throw new Error(`Twitter download failed: ${error.message}`);
        }
    }

    async downloadFacebook(url) {
        try {
            const response = await fetch(this.apiEndpoints.facebook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `id=${encodeURIComponent(url)}&locale=en`
            });

            const data = await response.json();

            if (data.sd || data.hd) {
                const videoUrl = data.hd || data.sd;
                const filename = `facebook_${Date.now()}.mp4`;
                const filepath = await this.downloadFile(videoUrl, filename);

                return {
                    success: true,
                    platform: 'facebook',
                    type: 'video',
                    title: data.title || 'Facebook Video',
                    filepath: filepath,
                    url: videoUrl,
                    quality: data.hd ? 'HD' : 'SD'
                };
            }

            throw new Error('Video URL not found');
        } catch (error) {
            throw new Error(`Facebook download failed: ${error.message}`);
        }
    }

    async downloadFile(url, filename) {
        const filepath = path.join(this.tempPath, filename);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: HTTP ${response.status}`);
        }

        const buffer = await response.buffer();
        fs.writeFileSync(filepath, buffer);

        console.log(`Downloaded: ${filepath} (${buffer.length} bytes)`);
        return filepath;
    }

    cleanupFile(filepath) {
        try {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`Cleaned up: ${filepath}`);
            }
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }
}

module.exports = SocialDownloader;
