/**
 * Text processing utilities for MarginNote4 import
 * 
 * Text processing functions adapted from OhMyMN patterns with 
 * support for CJK languages and MarginNote-specific content.
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

export interface ContentFeatures {
    hashtags: string[];
    links: string[];
    otherText: string[];
    formattedText: string;
    language: string;
    wordCount: number;
}

export class TextProcessor {
    // Language detection patterns
    private static readonly CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
    private static readonly JAPANESE_PATTERN = /[\u3040-\u309f\u30a0-\u30ff]/g;
    private static readonly KOREAN_PATTERN = /[\uac00-\ud7af]/g;
    private static readonly LATIN_PATTERN = /[a-zA-Z]/g;

    // MarginNote link patterns
    private static readonly MARGINNOTE_LINK_PATTERN = /marginnote4app:\/\/note\/([A-Za-z0-9\-]+)/g;

    // Hashtag patterns (support both # and full-width ＃)
    private static readonly HASHTAG_PATTERN = /[#＃]([^\s#＃\n\r]+)/g;

    // List detection patterns (adapted from OhMyMN)
    private static readonly LIST_PATTERNS = [
        /^\s*[\(\[\{]?\d+[\)\]\}\.: -]+\s*/,           // 1. 1) (1) [1] 1: 1-
        /^\s*[\(\[\{]?[A-Z][\)\]\}\.: -]+\s*/,         // A. A) (A) [A] A: A-
        /^\s*[\(\[\{]?[a-z][\)\]\}\.: -]+\s*/,         // a. a) (a) [a] a: a-
        /^\s*[\(\[\{]?[IVXLCDM]+[\)\]\}\.: -]+\s*/,    // I. II) (III) [IV] V: VI-
        /^\s*[\(\[\{]?[ivxlcdm]+[\)\]\}\.: -]+\s*/,    // i. ii) (iii) [iv] v: vi-
        /^\s*[-*•]\s+/,                                 // - item, * item, • item
    ];

    /**
     * Count words with CJK awareness (adapted from OhMyMN countWord)
     * 
     * CJK characters count as individual words, Latin words count by boundaries.
     */
    static countWordsCJK(text: string): number {
        if (!text) return 0;

        // Count CJK characters as individual words
        const cjkMatches = text.match(TextProcessor.CJK_PATTERN);
        const cjkChars = cjkMatches ? cjkMatches.length : 0;

        // Count Latin words by word boundaries
        const latinMatches = text.match(/\b[a-zA-Z]+\b/g);
        const latinWords = latinMatches ? latinMatches.length : 0;

        // Count Japanese kana separately if needed
        const japaneseMatches = text.match(TextProcessor.JAPANESE_PATTERN);
        const japaneseChars = japaneseMatches ? japaneseMatches.length : 0;

        // Count Korean characters
        const koreanMatches = text.match(TextProcessor.KOREAN_PATTERN);
        const koreanChars = koreanMatches ? koreanMatches.length : 0;

        return cjkChars + latinWords + japaneseChars + koreanChars;
    }

    /**
     * Detect primary language of text (adapted from OhMyMN isLanguage patterns)
     */
    static detectLanguage(text: string): string {
        if (!text) return 'unknown';

        // Count character types
        const chineseMatches = text.match(TextProcessor.CJK_PATTERN);
        const chineseCount = chineseMatches ? chineseMatches.length : 0;
        
        const japaneseMatches = text.match(TextProcessor.JAPANESE_PATTERN);
        const japaneseCount = japaneseMatches ? japaneseMatches.length : 0;
        
        const koreanMatches = text.match(TextProcessor.KOREAN_PATTERN);
        const koreanCount = koreanMatches ? koreanMatches.length : 0;
        
        const latinMatches = text.match(TextProcessor.LATIN_PATTERN);
        const latinCount = latinMatches ? latinMatches.length : 0;

        const totalChars = text.trim().length;
        if (totalChars === 0) return 'unknown';

        // Calculate percentages
        const ratios = {
            chinese: chineseCount / totalChars,
            japanese: japaneseCount / totalChars,
            korean: koreanCount / totalChars,
            latin: latinCount / totalChars
        };

        // Determine primary language
        const maxRatio = Math.max(...Object.values(ratios));
        if (maxRatio < 0.1) {
            return 'unknown';
        } else if (maxRatio < 0.5) {
            return 'mixed';
        } else {
            const language = Object.entries(ratios).find(([_, ratio]) => ratio === maxRatio)?.[0];
            return language || 'unknown';
        }
    }

    /**
     * Get byte length of text (adapted from OhMyMN byteLength)
     */
    static byteLength(text: string): number {
        return new TextEncoder().encode(text).length;
    }

    /**
     * Slice text by byte positions (adapted from OhMyMN byteSlice)
     */
    static byteSlice(text: string, start: number, end: number): string {
        try {
            const encoded = new TextEncoder().encode(text);
            const sliced = encoded.slice(start, end);
            return new TextDecoder('utf-8', { fatal: false }).decode(sliced);
        } catch {
            return text.slice(start, end); // Fallback to character slicing
        }
    }

    /**
     * Extract hashtags from text with CJK support
     * 
     * Supports both regular # and full-width ＃ hashtags.
     */
    static extractHashtags(text: string): string[] {
        if (!text) return [];

        const hashtags: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed.startsWith('＃')) {
                // Full line hashtag
                const hashtag = trimmed.replace(/^[#＃]+/, '').trim();
                if (hashtag) {
                    hashtags.push(hashtag);
                }
            } else {
                // Inline hashtags
                const matches = Array.from(trimmed.matchAll(TextProcessor.HASHTAG_PATTERN));
                for (const match of matches) {
                    hashtags.push(match[1]);
                }
            }
        }

        // Remove duplicates while preserving order
        const seen = new Set<string>();
        return hashtags.filter(tag => {
            if (seen.has(tag)) {
                return false;
            }
            seen.add(tag);
            return true;
        });
    }

    /**
     * Extract MarginNote internal links from text
     * 
     * Finds links in format: marginnote4app://note/{note_id}
     */
    static extractMarginNoteLinks(text: string): string[] {
        if (!text) return [];

        const links: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Check for full line links
            if (trimmed.startsWith('marginnote4app://note/')) {
                const noteId = trimmed.substring('marginnote4app://note/'.length);
                if (noteId) {
                    links.push(noteId);
                }
            } else {
                // Find inline links
                const matches = Array.from(trimmed.matchAll(TextProcessor.MARGINNOTE_LINK_PATTERN));
                for (const match of matches) {
                    links.push(match[1]);
                }
            }
        }

        // Remove duplicates while preserving order
        const seen = new Set<string>();
        return links.filter(link => {
            if (seen.has(link)) {
                return false;
            }
            seen.add(link);
            return true;
        });
    }

    /**
     * Extract non-hashtag, non-link text content
     */
    static extractOtherText(text: string, excludeHashtags: string[] = [], excludeLinks: string[] = []): string[] {
        if (!text) return [];

        // Create sets for fast lookup
        const hashtagSet = new Set<string>();
        for (const tag of excludeHashtags) {
            hashtagSet.add(`#${tag}`);
            hashtagSet.add(`＃${tag}`);
        }

        const linkSet = new Set<string>();
        for (const link of excludeLinks) {
            linkSet.add(`marginnote4app://note/${link}`);
        }

        const otherText: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) continue;

            // Skip hashtag lines
            if (hashtagSet.has(trimmed)) continue;

            // Skip link lines
            if (linkSet.has(trimmed)) continue;

            // Skip lines that are only hashtags or links
            if (trimmed.startsWith('#') || trimmed.startsWith('＃') ||
                trimmed.startsWith('marginnote4app://note/')) {
                continue;
            }

            otherText.push(line);
        }

        return otherText;
    }

    /**
     * Check if lines form a bulleted/numbered list (adapted from OhMyMN)
     * 
     * Supports various formats: 1. 2. 3.; (1) (2) (3); A) B) C); 
     * a) b) c); I. II. III.; etc.
     */
    static isBulletedList(lines: string[]): boolean {
        if (lines.length < 2) return false;

        let matchingLines = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check against list patterns
            for (const pattern of TextProcessor.LIST_PATTERNS) {
                if (pattern.test(trimmed)) {
                    matchingLines++;
                    break;
                }
            }
        }

        // Consider it a list if at least half the lines match patterns
        return matchingLines >= lines.length / 2;
    }

    /**
     * Format lines as a proper list if they appear to be list items
     */
    static formatAsList(lines: string[]): string {
        if (!lines.length) return '';

        if (TextProcessor.isBulletedList(lines)) {
            // Return as formatted list
            return lines.join('\n');
        } else {
            // Join as paragraph text
            return lines.map(line => line.trim()).filter(line => line).join(' ');
        }
    }

    /**
     * Clean and normalize text content
     */
    static cleanText(text: string): string {
        if (!text) return '';

        // Normalize unicode characters
        let cleaned = text.normalize('NFC');

        // Remove excessive whitespace
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Strip leading/trailing whitespace
        cleaned = cleaned.trim();

        return cleaned;
    }

    /**
     * Extract all content features from text in one pass
     */
    static extractContentFeatures(text: string): ContentFeatures {
        if (!text) {
            return {
                hashtags: [],
                links: [],
                otherText: [],
                formattedText: '',
                language: 'unknown',
                wordCount: 0
            };
        }

        // Extract features
        const hashtags = TextProcessor.extractHashtags(text);
        const links = TextProcessor.extractMarginNoteLinks(text);
        const otherText = TextProcessor.extractOtherText(text, hashtags, links);

        return {
            hashtags,
            links,
            otherText,
            formattedText: TextProcessor.formatAsList(otherText),
            language: TextProcessor.detectLanguage(text),
            wordCount: TextProcessor.countWordsCJK(text)
        };
    }
}

// Utility functions for external use
export function processNoteText(text: string): ContentFeatures {
    return TextProcessor.extractContentFeatures(text);
}

export function isCJKText(text: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text);
}

export function cleanAndFormat(text: string): string {
    return TextProcessor.cleanText(text);
}

// Example usage and testing
export function testTextProcessing(): void {
    const testText = `
    #重要
    这是一个测试文本。
    marginnote4app://note/ABC123
    #测试 #标签
    
    1. 第一项
    2. 第二项
    3. 第三项
    
    Some English text here.
    `;

    const features = TextProcessor.extractContentFeatures(testText);
    console.log('Extracted features:', features);

    const language = TextProcessor.detectLanguage(testText);
    console.log('Language detection:', language);

    const wordCount = TextProcessor.countWordsCJK(testText);
    console.log('Word count:', wordCount);

    const listLines = ["1. First item", "2. Second item", "3. Third item"];
    console.log('Is bulleted list:', TextProcessor.isBulletedList(listLines));
}