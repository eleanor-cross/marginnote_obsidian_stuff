/**
 * MarginNote4 database parser
 * 
 * Handles extraction and parsing of SQLite database from .marginpkg files.
 * Provides structured access to ZBOOKNOTE, ZTOPIC, and ZMEDIA tables.
 * 
 * Uses fflate library for proper ZIP decompression in browser environment.
 */

import { DatabaseData } from './margin-note-importer';
import { unzip, Unzipped } from 'fflate';
// Use the asm.js version which doesn't require WASM
import initSqlJs from 'sql.js/dist/sql-asm.js';
import { NSKeyedArchiverDecoder } from './nskeyedarchiver-decoder';

export interface MarginPkgFile {
    name: string;
    data: ArrayBuffer;
}

export interface ParsedDatabase {
    booknotes: DatabaseRow[];
    topics: DatabaseRow[];
    media: DatabaseRow[];
    metadata: DatabaseMetadata;
}

export interface DatabaseRow {
    [key: string]: any;
}

export interface DatabaseMetadata {
    version: string;
    extractedAt: Date;
    totalTables: number;
    fileSize: number;
}

/**
 * Error thrown when database parsing fails
 */
export class DatabaseParseError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'DatabaseParseError';
    }
}

/**
 * MarginNote4 database parser
 * 
 * Extracts and processes SQLite database content from .marginpkg files.
 * Provides access to the main data tables used by MarginNote.
 */
export class MarginNoteDatabaseParser {
    private strictDecoding: boolean;

    constructor(strictDecoding: boolean = false) {
        this.strictDecoding = strictDecoding;
    }

    /**
     * Parse a .marginpkg file and extract database content
     */
    async parseMarginPkg(file: File | ArrayBuffer): Promise<DatabaseData> {
        console.log('Parsing .marginpkg file...');

        try {
            // Extract files from the .marginpkg archive
            const extractedFiles = await this.extractMarginPkgFiles(file);

            // Find and parse the SQLite database
            const databaseFile = this.findDatabaseFile(extractedFiles);
            if (!databaseFile) {
                throw new DatabaseParseError('No SQLite database found in .marginpkg file');
            }

            // Parse the SQLite database
            const parsedDatabase = await this.parseSQLiteDatabase(databaseFile.data);

            console.log(`Database parsed successfully: ${parsedDatabase.booknotes.length} notes, ` +
                       `${parsedDatabase.topics.length} topics, ${parsedDatabase.media.length} media items`);

            return {
                booknotes: parsedDatabase.booknotes,
                topics: parsedDatabase.topics,
                media: parsedDatabase.media
            };

        } catch (error) {
            console.error('Failed to parse .marginpkg file:', error);
            
            // NO GRACEFUL FALLBACK - Always throw errors to see what's failing
            throw error;
        }
    }

    /**
     * Extract files from .marginpkg archive (ZIP format) using fflate
     */
    private async extractMarginPkgFiles(file: File | ArrayBuffer): Promise<MarginPkgFile[]> {
        const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
        
        return new Promise((resolve, reject) => {
            const uint8Array = new Uint8Array(arrayBuffer);
            
            unzip(uint8Array, (err: Error | null, unzipped: Unzipped) => {
                if (err) {
                    console.error('ZIP extraction failed:', err);
                    reject(new DatabaseParseError('Failed to extract ZIP archive', err));
                    return;
                }
                
                const files: MarginPkgFile[] = [];
                
                for (const [filename, data] of Object.entries(unzipped)) {
                    files.push({
                        name: filename,
                        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                    });
                    console.log(`Extracted: ${filename} (${data.length} bytes)`);
                }
                
                console.log(`Successfully extracted ${files.length} files from ZIP`);
                resolve(files);
            });
        });
    }
    
    /**
     * Parse ZIP archive using proper central directory parsing
     */
    private parseZipArchive(data: ArrayBuffer): MarginPkgFile[] {
        const view = new DataView(data);
        const files: MarginPkgFile[] = [];
        
        console.log('Parsing ZIP archive...');
        
        // Find central directory by looking for end of central directory signature
        const endCentralDirSig = 0x06054b50;
        let centralDirOffset = null;
        
        // Search from end of file backwards
        for (let i = data.byteLength - 22; i >= 0; i--) {
            if (view.getUint32(i, true) === endCentralDirSig) {
                centralDirOffset = view.getUint32(i + 16, true);
                console.log(`Found central directory at offset: ${centralDirOffset}`);
                break;
            }
        }
        
        if (centralDirOffset === null) {
            console.warn('No central directory found, using fallback parsing');
            return this.parseZipArchiveFallback(data);
        }
        
        // Parse central directory entries
        let currentOffset = centralDirOffset;
        while (currentOffset < data.byteLength - 46) {
            const signature = view.getUint32(currentOffset, true);
            if (signature !== 0x02014b50) break; // Central directory file header signature
            
            const method = view.getUint16(currentOffset + 10, true);
            const compressedSize = view.getUint32(currentOffset + 20, true);
            const uncompressedSize = view.getUint32(currentOffset + 24, true);
            const nameLength = view.getUint16(currentOffset + 28, true);
            const extraLength = view.getUint16(currentOffset + 30, true);
            const commentLength = view.getUint16(currentOffset + 32, true);
            const localHeaderOffset = view.getUint32(currentOffset + 42, true);
            
            // Extract filename
            const nameBytes = new Uint8Array(view.buffer, currentOffset + 46, nameLength);
            const name = new TextDecoder().decode(nameBytes);
            
            console.log(`Found file: ${name}, method: ${method}, compressed: ${compressedSize}, uncompressed: ${uncompressedSize}`);
            
            // Extract file data using local header
            try {
                const fileData = this.extractFileFromLocalHeader(view, localHeaderOffset, compressedSize, method);
                if (fileData) {
                    files.push({
                        name,
                        data: fileData
                    });
                }
            } catch (error) {
                console.warn(`Failed to extract file ${name}:`, error);
            }
            
            currentOffset += 46 + nameLength + extraLength + commentLength;
        }
        
        console.log(`Successfully parsed ${files.length} files from ZIP`);
        return files;
    }
    
    /**
     * Extract file data from local header
     */
    private extractFileFromLocalHeader(view: DataView, offset: number, compressedSize: number, method: number): ArrayBuffer | null {
        const signature = view.getUint32(offset, true);
        if (signature !== 0x04034b50) {
            throw new Error('Invalid local file header signature');
        }
        
        const nameLength = view.getUint16(offset + 26, true);
        const extraLength = view.getUint16(offset + 28, true);
        const dataStart = offset + 30 + nameLength + extraLength;
        
        const compressedData = view.buffer.slice(dataStart, dataStart + compressedSize);
        
        if (method === 0) {
            // No compression
            return compressedData;
        } else if (method === 8) {
            // Deflate compression - browser-compatible async decompression
            throw new DatabaseParseError(
                'Compressed ZIP files require async decompression. ' +
                'This is a limitation of the current browser implementation.',
                new Error('Async decompression needed')
            );
        } else {
            console.warn(`Unsupported compression method: ${method}`);
            return compressedData; // Return compressed data as fallback
        }
    }
    
    /**
     * Fallback ZIP parsing for when central directory isn't found
     */
    private parseZipArchiveFallback(data: ArrayBuffer): MarginPkgFile[] {
        console.log('Using fallback ZIP parsing...');
        return [{
            name: 'marginNote.marginnotes',
            data: data
        }];
    }
    
    /**
     * Parse a single ZIP file entry
     */
    private parseZipFileEntry(view: DataView, offset: number): MarginPkgFile | null {
        try {
            // ZIP local file header structure
            const signature = view.getUint32(offset, true);
            if (signature !== 0x04034b50) return null;
            
            const version = view.getUint16(offset + 4, true);
            const flags = view.getUint16(offset + 6, true);
            const method = view.getUint16(offset + 8, true);
            const compressedSize = view.getUint32(offset + 18, true);
            const uncompressedSize = view.getUint32(offset + 22, true);
            const nameLength = view.getUint16(offset + 26, true);
            const extraLength = view.getUint16(offset + 28, true);
            
            // Extract filename
            const nameStart = offset + 30;
            const nameBytes = new Uint8Array(view.buffer, nameStart, nameLength);
            const name = new TextDecoder().decode(nameBytes);
            
            console.log(`Found ZIP entry: ${name}, method: ${method}, compressed: ${compressedSize}, uncompressed: ${uncompressedSize}`);
            
            // Extract file data
            const dataStart = nameStart + nameLength + extraLength;
            let fileData = view.buffer.slice(dataStart, dataStart + compressedSize);
            
            // Handle compression
            if (method === 0) {
                // No compression
                console.log('File is not compressed');
            } else if (method === 8) {
                // Deflate compression - we can't easily decompress this in browser
                // For now, try to extract readable text from compressed data
                console.log('File uses deflate compression');
                fileData = this.extractTextFromCompressed(fileData);
            }
            
            return {
                name,
                data: fileData
            };
        } catch (error) {
            console.warn('Error parsing ZIP entry:', error);
            return null;
        }
    }
    
    /**
     * Extract readable text from compressed data using zlib
     */
    private extractTextFromCompressed(data: ArrayBuffer): ArrayBuffer {
        try {
            // For Node.js environment, use zlib to decompress
            if (typeof require !== 'undefined') {
                const zlib = require('zlib');
                const compressed = Buffer.from(data);
                
                try {
                    // Try deflate decompression
                    const decompressed = zlib.inflateRawSync(compressed);
                    console.log('Successfully decompressed data:', decompressed.length, 'bytes');
                    return decompressed.buffer.slice(decompressed.byteOffset, decompressed.byteOffset + decompressed.byteLength);
                } catch (deflateError) {
                    console.warn('Deflate decompression failed, trying inflate:', deflateError);
                    try {
                        const decompressed = zlib.inflateSync(compressed);
                        console.log('Successfully inflated data:', decompressed.length, 'bytes');
                        return decompressed.buffer.slice(decompressed.byteOffset, decompressed.byteOffset + decompressed.byteLength);
                    } catch (inflateError) {
                        console.warn('Both decompression methods failed:', inflateError);
                    }
                }
            }
            
            // Fallback: try to find readable text patterns in compressed data
            const view = new Uint8Array(data);
            const decoder = new TextDecoder('utf-8', { fatal: false });
            
            // Look for text patterns in the compressed data
            const textChunks: number[] = [];
            
            for (let i = 0; i < view.length - 10; i++) {
                // Look for sequences that might be readable text
                const chunk = view.slice(i, i + 100);
                const text = decoder.decode(chunk);
                
                // Check if this chunk contains readable text
                if (this.isReadableText(text)) {
                    textChunks.push(...chunk);
                }
            }
            
            return new Uint8Array(textChunks).buffer;
        } catch (error) {
            console.warn('Text extraction failed:', error);
            return data; // Return original if extraction fails
        }
    }
    
    /**
     * Check if text appears to be readable content
     */
    private isReadableText(text: string): boolean {
        // Count printable characters
        const printableCount = text.split('').filter(char => {
            const code = char.charCodeAt(0);
            return (code >= 32 && code <= 126) || // ASCII printable
                   (code >= 0x4e00 && code <= 0x9fff) || // CJK
                   (code >= 0x3040 && code <= 0x309f) || // Hiragana
                   (code >= 0x30a0 && code <= 0x30ff) || // Katakana
                   (code >= 0xac00 && code <= 0xd7af);   // Korean
        }).length;
        
        return printableCount / text.length > 0.3 && text.length > 5;
    }

    /**
     * Find the MarginNote data file in extracted files
     */
    private findDatabaseFile(files: MarginPkgFile[]): MarginPkgFile | null {
        // Look for MarginNote data files
        const patterns = [
            /\.marginnotes$/i,
            /\.db$/i,
            /\.sqlite$/i,
            /marginNote/i
        ];

        for (const file of files) {
            for (const pattern of patterns) {
                if (pattern.test(file.name)) {
                    return file;
                }
            }
        }

        // If no specific pattern matches, try the largest file
        if (files.length > 0) {
            return files.reduce((largest, current) => 
                current.data.byteLength > largest.data.byteLength ? current : largest
            );
        }

        return null;
    }

    /**
     * Parse SQLite database using sql.js (browser-compatible)
     */
    private async parseSQLiteDatabase(databaseData: ArrayBuffer): Promise<ParsedDatabase> {
        console.log('Parsing SQLite database with sql.js...');

        try {
            console.log('Initializing sql.js...');
            
            // Initialize sql.js without external WASM loading
            // This will use the bundled sql.js with asm.js fallback
            const SQL = await initSqlJs();
            
            console.log('sql.js initialized, opening database...');
            
            // Open the database
            const db = new SQL.Database(new Uint8Array(databaseData));
            
            console.log('Database opened successfully');
            
            // Query ZBOOKNOTE table
            console.log('Querying ZBOOKNOTE table...');
            const zbooknoteStmt = db.prepare('SELECT * FROM ZBOOKNOTE');
            const zbooknoteRows: DatabaseRow[] = [];
            
            let rowCount = 0;
            while (zbooknoteStmt.step()) {
                const row = zbooknoteStmt.getAsObject();
                zbooknoteRows.push(row as DatabaseRow);
                rowCount++;
                
                // Log first few rows
                if (rowCount <= 3) {
                    console.log(`Row ${rowCount} ZNOTEID:`, row.ZNOTEID);
                }
            }
            zbooknoteStmt.free();
            
            console.log(`Found ${zbooknoteRows.length} rows in ZBOOKNOTE`);
            
            // Decode binary columns in ZBOOKNOTE
            console.log('Decoding NSKeyedArchiver data...');
            this.decodeBinaryColumns(zbooknoteRows);
            
            // Query ZTOPIC table if it exists
            let ztopicRows: DatabaseRow[] = [];
            try {
                const ztopicStmt = db.prepare('SELECT * FROM ZTOPIC');
                while (ztopicStmt.step()) {
                    const row = ztopicStmt.getAsObject();
                    ztopicRows.push(row as DatabaseRow);
                }
                ztopicStmt.free();
            } catch (e) {
                console.warn('ZTOPIC table not found or inaccessible');
            }
            
            // Query ZMEDIA table if it exists
            let zmediaRows: DatabaseRow[] = [];
            try {
                const zmediaStmt = db.prepare('SELECT * FROM ZMEDIA');
                while (zmediaStmt.step()) {
                    const row = zmediaStmt.getAsObject();
                    zmediaRows.push(row as DatabaseRow);
                }
                zmediaStmt.free();
            } catch (e) {
                console.warn('ZMEDIA table not found or inaccessible');
            }
            
            db.close();
            
            console.log(`Successfully parsed SQLite database:`);
            console.log(`  ZBOOKNOTE: ${zbooknoteRows.length} rows`);
            console.log(`  ZTOPIC: ${ztopicRows.length} rows`);
            console.log(`  ZMEDIA: ${zmediaRows.length} rows`);
            
            return {
                booknotes: zbooknoteRows,
                topics: ztopicRows,
                media: zmediaRows,
                metadata: {
                    version: '4.0 (sql.js)',
                    extractedAt: new Date(),
                    totalTables: 3,
                    fileSize: databaseData.byteLength
                }
            };

        } catch (error) {
            console.error('Failed to parse SQLite database:', error);
            
            throw new DatabaseParseError(
                'Unable to parse SQLite database with sql.js. ' +
                'Database may be corrupted or incompatible. Check console for details.',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Parse MarginNote binary format
     */
    private parseMarginNoteFormat(data: ArrayBuffer): ParsedDatabase {
        const view = new DataView(data);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        
        // Extract text content from the binary data
        const textContent = decoder.decode(data);
        
        // Look for patterns that suggest notes/highlights
        const notes = this.extractNotesFromText(textContent);
        const topics = this.extractTopicsFromText(textContent);
        
        return {
            booknotes: notes,
            topics: topics,
            media: [],
            metadata: {
                version: '4.0',
                extractedAt: new Date(),
                totalTables: 3,
                fileSize: data.byteLength
            }
        };
    }
    
    /**
     * REMOVED: Extract notes from text content using pattern matching
     * NO MOCK DATA GENERATION ALLOWED - THROW ERROR INSTEAD
     */
    private extractNotesFromText(text: string): DatabaseRow[] {
        throw new DatabaseParseError(
            'Text-based note extraction is not supported. ' +
            'Real SQLite database parsing is required.',
            new Error('Mock data generation disabled')
        );
    }
    
    /**
     * REMOVED: Extract topics from text content  
     * NO MOCK DATA GENERATION ALLOWED
     */
    private extractTopicsFromText(text: string): DatabaseRow[] {
        throw new DatabaseParseError(
            'Text-based topic extraction is not supported. ' +
            'Real SQLite database parsing is required.',
            new Error('Mock data generation disabled')
        );
    }
    
    /**
     * Generate a title from text content
     */
    private generateTitleFromText(text: string): string {
        // Take first sentence or first 50 characters
        const sentences = text.split(/[.!?。！？]/);
        if (sentences[0] && sentences[0].length < 100) {
            return sentences[0].trim();
        }
        
        return text.substring(0, 47).trim() + '...';
    }

    /**
     * Decode binary columns (ZNOTES, ZHIGHLIGHTS) in ZBOOKNOTE rows
     */
    private decodeBinaryColumns(zbooknoteRows: DatabaseRow[]): void {
        const decoder = new NSKeyedArchiverDecoder({ strictMode: this.strictDecoding });
        
        for (let i = 0; i < zbooknoteRows.length; i++) {
            const row = zbooknoteRows[i];
            
            try {
                // Decode ZNOTES column
                if (row.ZNOTES) {
                    const decodedNotes = decoder.decodeZNotes(row.ZNOTES);
                    row.ZNOTES_DECODE = JSON.stringify(decodedNotes);
                    
                    // Extract useful content for easier access
                    if (decodedNotes.highlightText) {
                        row.ZNOTES_HIGHLIGHT_TEXT = decodedNotes.highlightText;
                    }
                    if (decodedNotes.hashtags && decodedNotes.hashtags.length > 0) {
                        row.ZNOTES_HASHTAGS = decodedNotes.hashtags.join(', ');
                    }
                    if (decodedNotes.links && decodedNotes.links.length > 0) {
                        row.ZNOTES_LINKS = decodedNotes.links.join(', ');
                    }
                    if (decodedNotes.formattedText && decodedNotes.formattedText.length > 0) {
                        row.ZNOTES_FORMATTED_TEXT = decodedNotes.formattedText.join('\n');
                    }
                }
                
                // Decode ZHIGHLIGHTS column
                if (row.ZHIGHLIGHTS) {
                    const decodedHighlights = decoder.decodeZHighlights(row.ZHIGHLIGHTS);
                    row.ZHIGHLIGHTS_DECODE = JSON.stringify(decodedHighlights);
                    
                    // Extract coordinate information
                    if (decodedHighlights.length > 0) {
                        const firstHighlight = decodedHighlights[0];
                        if (firstHighlight.rect) {
                            row.ZHIGHLIGHTS_RECT = `${firstHighlight.rect.x},${firstHighlight.rect.y},${firstHighlight.rect.width},${firstHighlight.rect.height}`;
                        }
                        if (firstHighlight.pageNo) {
                            row.ZHIGHLIGHTS_PAGE = firstHighlight.pageNo;
                        }
                    }
                }
                
                // Log progress for first few rows and specific problem note
                if (i < 3 || row.ZNOTEID === '4BA5CED0-0B42-4204-B803-CEEFFB4BC890') {
                    console.log(`Row ${i + 1} (${row.ZNOTEID}) decoded:`, {
                        noteId: row.ZNOTEID,
                        hasNotes: !!row.ZNOTES_DECODE,
                        hasHighlights: !!row.ZHIGHLIGHTS_DECODE,
                        extractedHashtags: row.ZNOTES_HASHTAGS,
                        extractedLinks: row.ZNOTES_LINKS,
                        zhighlightsRaw: row.ZHIGHLIGHTS ? String(row.ZHIGHLIGHTS).substring(0, 100) + '...' : 'null',
                        zhighlightsDecode: row.ZHIGHLIGHTS_DECODE ? String(row.ZHIGHLIGHTS_DECODE).substring(0, 200) + '...' : 'null'
                    });
                }
                
            } catch (error) {
                console.warn(`Failed to decode binary data for row ${i}:`, error);
                // Continue processing other rows even if one fails
            }
        }
        
        console.log(`Binary decoding completed for ${zbooknoteRows.length} rows`);
    }

    /**
     * REMOVED: All fallback data functions have been eliminated
     * The plugin must work with real extracted database data only
     * NO FALLBACK DATA ALLOWED IN PRODUCTION
     */
}

/**
 * Convenience function to parse a .marginpkg file
 */
export async function parseMarginPkgFile(
    file: File | ArrayBuffer, 
    strictDecoding: boolean = false
): Promise<DatabaseData> {
    const parser = new MarginNoteDatabaseParser(strictDecoding);
    return await parser.parseMarginPkg(file);
}

/**
 * Check if a file appears to be a valid .marginpkg file
 */
export function isValidMarginPkgFile(file: File): boolean {
    // Basic validation
    if (!file.name.toLowerCase().endsWith('.marginpkg')) {
        return false;
    }

    // Check file size (should be reasonable for a database)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
        console.warn('File size exceeds maximum expected size');
        return false;
    }

    return true;
}