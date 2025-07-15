/**
 * NSKeyedArchiver decoder for MarginNote4 binary data
 * 
 * Handles decoding of ZNOTES and ZHIGHLIGHTS columns which contain 
 * Apple NSKeyedArchiver formatted binary data.
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

export interface NSKeyedArchiverOptions {
    strictMode?: boolean;
}

export interface ZNotesData {
    type: string;
    highlightText: string;
    textSelections: TextSelection[];
    coordinates: CoordinateData[];
    clips: any[];
    coordsHash: string;
    links: string[];
    hashtags: string[];
    formattedText: string[];
}

export interface ZHighlightsData {
    type: string;
    pageNo: number;
    rect: RectData;
    coordinates: Record<string, any>;
}

export interface TextSelection {
    rect: RectData;
    pageNo: number;
    text: string;
}

export interface CoordinateData {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNo?: number;
}

export interface RectData {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MediaDecodeResult {
    type: string;
    imageData?: ArrayBuffer;
    hasStrokes?: boolean;
    strokeData?: any;
    hasRects?: boolean;
    rawText?: string;
    size?: number;
    error?: string;
}

export class NSKeyedArchiverError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NSKeyedArchiverError';
    }
}

export class NSKeyedArchiverDecoder {
    private strictMode: boolean;

    constructor(options: NSKeyedArchiverOptions = {}) {
        this.strictMode = options.strictMode || false;
    }

    /**
     * Decode ZNOTES column data
     */
    decodeZNotes(binaryData: ArrayBuffer | string): ZNotesData {
        if (!binaryData) {
            return this.createZNotesEmpty();
        }

        try {
            const data = this.prepareBinaryData(binaryData);
            const plistData = this.parsePlist(data);
            return this.extractZNotesStructure(plistData);
        } catch (error) {
            console.warn('Failed to decode ZNOTES data:', error);
            if (this.strictMode) {
                throw new NSKeyedArchiverError(`ZNOTES decode failed: ${error}`);
            }
            return this.createZNotesFallback(binaryData);
        }
    }

    /**
     * Decode ZHIGHLIGHTS column data
     */
    decodeZHighlights(binaryData: ArrayBuffer | string): ZHighlightsData[] {
        if (!binaryData) {
            return [];
        }

        try {
            const data = this.prepareBinaryData(binaryData);
            const plistData = this.parsePlist(data);
            return this.extractZHighlightsStructure(plistData);
        } catch (error) {
            console.warn('Failed to decode ZHIGHLIGHTS data:', error);
            if (this.strictMode) {
                throw new NSKeyedArchiverError(`ZHIGHLIGHTS decode failed: ${error}`);
            }
            return this.createZHighlightsFallback(binaryData);
        }
    }

    /**
     * Decode ZMEDIA binary data
     */
    decodeMediaData(binaryData: ArrayBuffer | string): MediaDecodeResult {
        if (!binaryData) {
            return { type: 'empty' };
        }

        try {
            const data = this.prepareBinaryData(binaryData);
            const mediaType = this.detectMediaType(data);

            switch (mediaType) {
                case 'png_image':
                    return this.decodePngMedia(data);
                case 'apple_ink':
                    return this.decodeInkMedia(data);
                case 'coordinates':
                    return this.decodeCoordinateMedia(data);
                default:
                    return this.decodeGenericMedia(data);
            }
        } catch (error) {
            console.warn('Failed to decode media data:', error);
            if (this.strictMode) {
                throw new NSKeyedArchiverError(`Media decode failed: ${error}`);
            }
            return { type: 'unknown', error: error.toString() };
        }
    }

    /**
     * Prepare binary data for processing
     */
    private prepareBinaryData(data: ArrayBuffer | string): ArrayBuffer {
        if (data instanceof ArrayBuffer) {
            return data;
        }

        if (typeof data === 'string') {
            // Handle Python bytes string representation
            if (data.startsWith("b'") || data.startsWith('b"')) {
                // This is a simplified approach - in practice you'd need a proper parser
                const cleaned = data.slice(2, -1);
                return this.stringToArrayBuffer(cleaned);
            }
            return this.stringToArrayBuffer(data);
        }

        throw new Error('Invalid binary data format');
    }

    /**
     * Convert string to ArrayBuffer
     */
    private stringToArrayBuffer(str: string): ArrayBuffer {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    }

    /**
     * Parse binary plist data
     * Note: This is a simplified implementation. A full plist parser would be more complex.
     */
    private parsePlist(data: ArrayBuffer): any {
        // Check if it's a binary plist
        const view = new Uint8Array(data);
        const header = Array.from(view.slice(0, 8)).map(b => String.fromCharCode(b)).join('');

        if (header.startsWith('bplist')) {
            return this.parseBinaryPlist(data);
        } else {
            // Try to parse as XML plist
            const text = new TextDecoder().decode(data);
            return this.parseXmlPlist(text);
        }
    }

    /**
     * Parse binary plist (simplified implementation)
     */
    private parseBinaryPlist(data: ArrayBuffer): any {
        // This is a very simplified binary plist parser
        // A full implementation would properly handle all binary plist formats
        
        const view = new Uint8Array(data);
        
        // Look for object table
        const objects: any[] = [];
        
        // Simple object extraction (this would need to be much more sophisticated)
        let offset = 8; // Skip header
        
        while (offset < view.length - 32) { // Leave space for trailer
            try {
                const obj = this.readBinaryPlistObject(view, offset);
                if (obj.value !== null) {
                    objects.push(obj.value);
                }
                offset = obj.nextOffset;
            } catch {
                offset++;
            }
        }

        return {
            '$objects': objects,
            '$version': 100000,
            '$archiver': 'NSKeyedArchiver',
            '$top': { root: 0 }
        };
    }

    /**
     * Read a binary plist object (simplified)
     */
    private readBinaryPlistObject(view: Uint8Array, offset: number): { value: any, nextOffset: number } {
        if (offset >= view.length) {
            return { value: null, nextOffset: offset + 1 };
        }

        const marker = view[offset];
        
        // String objects (simplified)
        if ((marker & 0xF0) === 0x50 || (marker & 0xF0) === 0x60) {
            const length = marker & 0x0F;
            if (length < 15 && offset + 1 + length < view.length) {
                const str = new TextDecoder().decode(view.slice(offset + 1, offset + 1 + length));
                return { value: str, nextOffset: offset + 1 + length };
            }
        }

        // Numbers (simplified)
        if ((marker & 0xF0) === 0x10) {
            const size = 1 << (marker & 0x0F);
            if (offset + 1 + size < view.length) {
                let value = 0;
                for (let i = 0; i < size; i++) {
                    value = (value << 8) | view[offset + 1 + i];
                }
                return { value, nextOffset: offset + 1 + size };
            }
        }

        return { value: null, nextOffset: offset + 1 };
    }

    /**
     * Parse XML plist (simplified)
     */
    private parseXmlPlist(text: string): any {
        try {
            // This is a very basic XML plist parser
            // In practice, you'd want to use a proper XML parser
            
            const objects: any[] = [];
            
            // Extract strings
            const stringMatches = text.matchAll(/<string>(.*?)<\/string>/g);
            for (const match of stringMatches) {
                objects.push(match[1]);
            }
            
            // Extract numbers
            const numberMatches = text.matchAll(/<(?:integer|real)>(.*?)<\/(?:integer|real)>/g);
            for (const match of numberMatches) {
                objects.push(parseFloat(match[1]));
            }

            return {
                '$objects': objects,
                '$version': 100000,
                '$archiver': 'NSKeyedArchiver',
                '$top': { root: 0 }
            };
        } catch (error) {
            throw new Error(`Failed to parse XML plist: ${error}`);
        }
    }

    /**
     * Extract structured content from ZNOTES plist data
     */
    private extractZNotesStructure(plistData: any): ZNotesData {
        const result: ZNotesData = {
            type: 'znotes',
            highlightText: '',
            textSelections: [],
            coordinates: [],
            clips: [],
            coordsHash: '',
            links: [],
            hashtags: [],
            formattedText: []
        };

        if (plistData.$objects && Array.isArray(plistData.$objects)) {
            for (const obj of plistData.$objects) {
                if (typeof obj === 'object' && obj !== null) {
                    // Extract highlight text
                    if (obj.highlight_text || obj.highlightText) {
                        result.highlightText = String(obj.highlight_text || obj.highlightText);
                    }

                    // Extract coordinates hash
                    if (obj.coords_hash || obj.coordsHash) {
                        result.coordsHash = String(obj.coords_hash || obj.coordsHash);
                    }

                    // Extract text selections
                    if (obj.textSelLst || obj.textSelections) {
                        result.textSelections = this.extractTextSelections(obj.textSelLst || obj.textSelections);
                    }

                    // Extract coordinate rectangles
                    if (obj.rect) {
                        const coord = this.extractRectData(obj);
                        if (coord) {
                            result.coordinates.push(coord);
                        }
                    }
                } else if (typeof obj === 'string') {
                    const text = String(obj);

                    // Extract hashtags
                    if (text.startsWith('#') || text.startsWith('＃')) {
                        result.hashtags.push(text);
                    }
                    // Extract MarginNote links
                    else if (text.startsWith('marginnote4app://note/')) {
                        const linkId = text.substring('marginnote4app://note/'.length);
                        result.links.push(linkId);
                    }
                    // Other formatted text
                    else if (text.trim() && !text.startsWith('NS') && text.length > 1) {
                        result.formattedText.push(text);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Extract highlight/coordinate data from ZHIGHLIGHTS plist data
     */
    private extractZHighlightsStructure(plistData: any): ZHighlightsData[] {
        const highlights: ZHighlightsData[] = [];

        if (plistData.$objects && Array.isArray(plistData.$objects)) {
            for (const obj of plistData.$objects) {
                if (typeof obj === 'object' && obj !== null) {
                    // Look for coordinate/rectangle data
                    if (obj.rect || obj.pageNo) {
                        const highlight: ZHighlightsData = {
                            type: 'highlight',
                            pageNo: obj.pageNo || obj.page_no || 1,
                            rect: this.extractRectData(obj) || { x: 0, y: 0, width: 0, height: 0 },
                            coordinates: {}
                        };

                        // Extract coordinate details
                        if (obj.rect) {
                            highlight.coordinates = this.parseRectString(String(obj.rect));
                        }

                        highlights.push(highlight);
                    }
                }
            }
        }

        return highlights;
    }

    /**
     * Extract text selection data
     */
    private extractTextSelections(selections: any): TextSelection[] {
        const result: TextSelection[] = [];

        if (Array.isArray(selections)) {
            for (const sel of selections) {
                if (typeof sel === 'object' && sel !== null) {
                    const textSel: TextSelection = {
                        rect: this.extractRectData(sel) || { x: 0, y: 0, width: 0, height: 0 },
                        pageNo: sel.pageNo || sel.page_no || 1,
                        text: sel.text || ''
                    };
                    result.push(textSel);
                }
            }
        }

        return result;
    }

    /**
     * Extract rectangle coordinate data
     */
    private extractRectData(obj: any): RectData | null {
        if (obj.rect) {
            const rectStr = String(obj.rect);
            return this.parseRectString(rectStr);
        }
        return null;
    }

    /**
     * Parse rectangle string like '{{x, y}, {width, height}}'
     */
    private parseRectString(rectStr: string): RectData {
        try {
            // Remove braces and parse
            const cleanStr = rectStr.replace(/[{}]/g, '');
            
            // Handle nested braces format
            if (cleanStr.includes('}, {')) {
                const parts = cleanStr.split('}, {');
                if (parts.length >= 2) {
                    const origin = parts[0].split(',').map(s => parseFloat(s.trim()));
                    const size = parts[1].split(',').map(s => parseFloat(s.trim()));
                    
                    if (origin.length >= 2 && size.length >= 2) {
                        return {
                            x: origin[0],
                            y: origin[1],
                            width: size[0],
                            height: size[1]
                        };
                    }
                }
            } else {
                // Simple comma-separated format
                const parts = cleanStr.split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 4) {
                    return {
                        x: parts[0],
                        y: parts[1],
                        width: parts[2],
                        height: parts[3]
                    };
                }
            }
        } catch (error) {
            console.debug('Failed to parse rect string:', rectStr, error);
        }

        return { x: 0, y: 0, width: 0, height: 0 };
    }

    /**
     * Detect type of media from binary content
     */
    private detectMediaType(data: ArrayBuffer): string {
        const view = new Uint8Array(data);
        
        // Check for PNG signature
        if (view.length >= 8 && 
            view[0] === 0x89 && view[1] === 0x50 && 
            view[2] === 0x4E && view[3] === 0x47) {
            return 'png_image';
        }

        // Check for Apple Ink
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
        if (text.includes('apple.ink.pen')) {
            return 'apple_ink';
        }

        // Check for coordinates
        if (text.includes('CGRect')) {
            return 'coordinates';
        }

        return 'unknown';
    }

    /**
     * Decode PNG image wrapped in plist
     */
    private decodePngMedia(data: ArrayBuffer): MediaDecodeResult {
        try {
            // Look for embedded PNG data
            const view = new Uint8Array(data);
            
            // Find PNG signature
            for (let i = 0; i < view.length - 8; i++) {
                if (view[i] === 0x89 && view[i + 1] === 0x50 && 
                    view[i + 2] === 0x4E && view[i + 3] === 0x47) {
                    // Found PNG, extract it
                    const pngData = data.slice(i);
                    return {
                        type: 'png_image',
                        imageData: pngData,
                        size: pngData.byteLength
                    };
                }
            }

            return { type: 'png_image', error: 'No PNG data found' };
        } catch (error) {
            return { type: 'png_image', error: error.toString() };
        }
    }

    /**
     * Decode Apple Ink pen stroke data
     */
    private decodeInkMedia(data: ArrayBuffer): MediaDecodeResult {
        try {
            const result: MediaDecodeResult = {
                type: 'apple_ink',
                hasStrokes: false,
                strokeData: null
            };

            const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
            
            // Look for ink stroke patterns
            if (text.includes('wrd')) {
                result.hasStrokes = true;
                result.strokeData = text;
            }

            return result;
        } catch (error) {
            return { type: 'apple_ink', error: error.toString() };
        }
    }

    /**
     * Decode coordinate/position data
     */
    private decodeCoordinateMedia(data: ArrayBuffer): MediaDecodeResult {
        try {
            const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
            
            return {
                type: 'coordinates',
                hasRects: text.includes('CGRect'),
                rawText: text.substring(0, 200) // First 200 chars for analysis
            };
        } catch (error) {
            return { type: 'coordinates', error: error.toString() };
        }
    }

    /**
     * Decode unknown media type
     */
    private decodeGenericMedia(data: ArrayBuffer): MediaDecodeResult {
        try {
            // Try parsing as plist first
            const plistData = this.parsePlist(data);
            return {
                type: 'generic_plist',
                size: data.byteLength
            };
        } catch {
            // Return basic info about binary data
            return {
                type: 'binary',
                size: data.byteLength
            };
        }
    }

    /**
     * Create empty ZNOTES structure
     */
    private createZNotesEmpty(): ZNotesData {
        return {
            type: 'znotes',
            highlightText: '',
            textSelections: [],
            coordinates: [],
            clips: [],
            coordsHash: '',
            links: [],
            hashtags: [],
            formattedText: []
        };
    }

    /**
     * Create fallback ZNOTES structure when decoding fails
     */
    private createZNotesFallback(binaryData: ArrayBuffer | string): ZNotesData {
        return {
            type: 'znotes_fallback',
            highlightText: '',
            textSelections: [],
            coordinates: [],
            clips: [],
            coordsHash: '',
            links: [],
            hashtags: [],
            formattedText: []
        };
    }

    /**
     * Create fallback ZHIGHLIGHTS structure when decoding fails
     */
    private createZHighlightsFallback(binaryData: ArrayBuffer | string): ZHighlightsData[] {
        return [{
            type: 'highlight_fallback',
            pageNo: 1,
            rect: { x: 0, y: 0, width: 0, height: 0 },
            coordinates: {}
        }];
    }
}

// Utility functions for external use
export function decodeZNotesSafe(binaryData: ArrayBuffer | string): ZNotesData {
    const decoder = new NSKeyedArchiverDecoder({ strictMode: false });
    return decoder.decodeZNotes(binaryData);
}

export function decodeZHighlightsSafe(binaryData: ArrayBuffer | string): ZHighlightsData[] {
    const decoder = new NSKeyedArchiverDecoder({ strictMode: false });
    return decoder.decodeZHighlights(binaryData);
}

export function decodeMediaSafe(binaryData: ArrayBuffer | string): MediaDecodeResult {
    const decoder = new NSKeyedArchiverDecoder({ strictMode: false });
    return decoder.decodeMediaData(binaryData);
}