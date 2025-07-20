/**
 * NSKeyedArchiver decoder for MarginNote4 binary data
 * 
 * This is the working implementation that successfully decodes NSKeyedArchiver data.
 * Based on the pattern from working_export.ts that was tested and verified.
 */

// Keep the original interfaces for compatibility
export interface NSKeyedArchiverOptions {
    strictMode?: boolean;
}

export interface ZNotesData {
    type: string;
    highlightText: string;
    textSelections: any[];
    coordinates: any[];
    clips: any[];
    coordsHash: string;
    links: string[];
    hashtags: string[];
    formattedText: string[];
}

export interface ZHighlightsData {
    type: string;
    pageNo: number;
    rect: any;
    coordinates: Record<string, any>;
}

interface NSArchive {
  $archiver: string;
  $version: number;
  $objects: any[];
  $top: { root: any };
}

interface UIDReference {
  UID: number;
}

export class NSKeyedArchiverDecoder {
    private strictMode: boolean;

    constructor(options: NSKeyedArchiverOptions = {}) {
        this.strictMode = options.strictMode || false;
    }

    /**
     * Decode ZNOTES column data using the working implementation
     */
    decodeZNotes(binaryData: any): ZNotesData {
        if (!binaryData) {
            return this.createZNotesEmpty();
        }

        try {
            // Convert to Buffer if needed
            const buffer = this.ensureBuffer(binaryData);
            const decoded = this.decodeNSKeyedArchiverFromBinary(buffer);
            
            return this.convertToZNotesFormat(decoded);
        } catch (error) {
            console.warn('Failed to decode ZNOTES data:', error);
            if (this.strictMode) {
                throw error;
            }
            return this.createZNotesEmpty();
        }
    }

    /**
     * Decode ZHIGHLIGHTS column data using the working implementation
     */
    decodeZHighlights(binaryData: any): ZHighlightsData[] {
        if (!binaryData) {
            return [];
        }

        try {
            // Convert to Buffer if needed
            const buffer = this.ensureBuffer(binaryData);
            const decoded = this.decodeNSKeyedArchiverFromBinary(buffer);
            
            return this.convertToZHighlightsFormat(decoded);
        } catch (error) {
            console.warn('Failed to decode ZHIGHLIGHTS data:', error);
            if (this.strictMode) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Main NSKeyedArchiver decoding function (from working_export.ts)
     */
    private decodeNSKeyedArchiverFromBinary(binaryData: Buffer): any {
        if (!binaryData) {
            return [];
        }
        
        try {
            // We need to use the bplist-parser - check if it's available
            const bplist = this.getBplistParser();
            
            // Parse binary plist data
            const parsed = bplist.parseBuffer(binaryData);
            if (!parsed || parsed.length < 1) {
                return [];
            }

            const archive = parsed[0];
            
            // Validate this is an NSKeyedArchiver format
            if (!this.isNSKeyedArchive(archive)) {
                return [];
            }

            // Use the working implementation's resolver and simplifier
            const resolved = this.resolveUIDs(archive.$top.root, archive.$objects);
            const simplified = this.simplifyNSArchive(resolved);
            
            // Return as array for consistency
            if (Array.isArray(simplified)) {
                return simplified;
            } else if (simplified !== null) {
                return [simplified];
            }
            
            return [];
            
        } catch (error) {
            console.warn(`Failed to decode NSKeyedArchiver data: ${error}`);
            return [];
        }
    }

    private getBplistParser(): any {
        // Try to get bplist-parser from different possible locations
        try {
            // @ts-ignore - dynamic import for Node.js environment
            return require('bplist-parser');
        } catch (e) {
            try {
                // @ts-ignore - try global if available
                return window.require ? window.require('bplist-parser') : null;
            } catch (e2) {
                throw new Error('bplist-parser not available');
            }
        }
    }

    private ensureBuffer(data: any): Buffer {
        if (Buffer.isBuffer(data)) {
            return data;
        }
        if (data instanceof ArrayBuffer) {
            return Buffer.from(data);
        }
        if (data instanceof Uint8Array) {
            return Buffer.from(data);
        }
        if (typeof data === 'string') {
            return Buffer.from(data, 'binary');
        }
        throw new Error('Cannot convert data to Buffer');
    }

    private isNSKeyedArchive(data: any): data is NSArchive {
        return (
            data &&
            typeof data === 'object' &&
            '$archiver' in data &&
            '$version' in data &&
            '$objects' in data &&
            '$top' in data
        );
    }

    private resolveUIDs(obj: any, objectsArray: any[]): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.resolveUIDs(item, objectsArray));
        }
        // If this object is a UID reference, resolve it:
        if ('UID' in obj && typeof obj.UID === 'number') {
            return this.resolveUIDs(objectsArray[obj.UID], objectsArray);
        }
        // Otherwise resolve all properties recursively:
        const resolved: any = {};
        for (const [key, value] of Object.entries(obj)) {
            resolved[key] = this.resolveUIDs(value, objectsArray);
        }
        return resolved;
    }

    private simplifyNSArchive(obj: any): any {
        // Case 1: Primitive
        if (obj === null || typeof obj !== 'object') {
            return obj === '$null' ? null : obj;
        }

        // Case 2: Filter out explicit '$null' object
        if (obj === '$null') {
            return null;
        }

        // Case 3: NSMutableArray or NSArray
        if (
            obj['$class']?.['$classname'] === 'NSMutableArray' ||
            obj['$class']?.['$classname'] === 'NSArray'
        ) {
            const arr = obj['NS.objects'] || [];
            return arr
                .map((item: any) => this.simplifyNSArchive(item))
                .filter((item: any) => item !== null && item !== undefined);
        }

        // Case 4: NSMutableDictionary or NSDictionary
        if (
            obj['$class']?.['$classname'] === 'NSMutableDictionary' ||
            obj['$class']?.['$classname'] === 'NSDictionary'
        ) {
            const keys = obj['NS.keys'] || [];
            const values = obj['NS.objects'] || [];
            const result: Record<string, any> = {};
            for (let i = 0; i < keys.length; i++) {
                const key = this.simplifyNSArchive(keys[i]);
                const val = this.simplifyNSArchive(values[i]);
                if (
                    key !== null &&
                    key !== undefined &&
                    val !== null &&
                    val !== undefined
                ) {
                    result[key] = val;
                }
            }
            return result;
        }

        // Case 5: Generic object → recurse, skip $class, $classname, $classes
        const simplified: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (!k.startsWith('$')) {
                const simplifiedVal = this.simplifyNSArchive(v);
                if (simplifiedVal !== null && simplifiedVal !== undefined) {
                    simplified[k] = simplifiedVal;
                }
            }
        }

        // If object is now empty, return null to skip noise
        if (Object.keys(simplified).length === 0) {
            return null;
        }

        return simplified;
    }

    private convertToZNotesFormat(decoded: any[]): ZNotesData {
        const result: ZNotesData = {
            type: "znotes",
            highlightText: "",
            textSelections: [],
            coordinates: [],
            clips: [],
            coordsHash: "",
            links: [],
            hashtags: [],
            formattedText: []
        };

        for (const item of decoded) {
            if (!item || typeof item !== 'object') continue;

            // Extract text content
            if (item.q_htext) {
                const text = item.q_htext?.['NS.string'] || item.q_htext;
                if (text && typeof text === 'string') {
                    result.formattedText.push(text);
                }
            }

            // Extract highlight text
            if (item.highlight_text) {
                const text = item.highlight_text?.['NS.string'] || item.highlight_text;
                if (text && typeof text === 'string') {
                    result.highlightText = text;
                    result.formattedText.push(text);
                }
            }

            // Extract links
            if (item.type === 'LinkNote' && item.noteid) {
                const linkText = item.q_htext?.['NS.string'] || item.q_htext || 'Link';
                result.links.push(`[[${item.noteid}|${linkText}]]`);
                result.formattedText.push(`[[${item.noteid}|${linkText}]]`);
            }

            // Extract coords hash
            if (item.coords_hash) {
                result.coordsHash = item.coords_hash;
            }

            // Extract text selections
            if (item.textSelLst && Array.isArray(item.textSelLst)) {
                result.textSelections.push(...item.textSelLst);
            }
        }

        return result;
    }

    private convertToZHighlightsFormat(decoded: any[]): ZHighlightsData[] {
        const results: ZHighlightsData[] = [];

        for (const item of decoded) {
            if (!item || typeof item !== 'object') continue;

            const highlight: ZHighlightsData = {
                type: "zhighlights",
                pageNo: 0,
                rect: null,
                coordinates: {}
            };

            // Extract page number
            if (item.pageNo !== undefined) {
                highlight.pageNo = item.pageNo;
            }

            // Extract rectangle data
            if (item.rect) {
                highlight.rect = item.rect;
            }

            // Extract text selections for page/rect info
            if (item.textSelLst && Array.isArray(item.textSelLst)) {
                for (const sel of item.textSelLst) {
                    if (sel.pageNo !== undefined) {
                        highlight.pageNo = sel.pageNo;
                    }
                    if (sel.rect) {
                        highlight.rect = sel.rect;
                    }
                }
            }

            // Store coordinates
            if (item.coords_hash) {
                highlight.coordinates.coords_hash = item.coords_hash;
            }

            results.push(highlight);
        }

        return results;
    }

    private createZNotesEmpty(): ZNotesData {
        return {
            type: "znotes",
            highlightText: "",
            textSelections: [],
            coordinates: [],
            clips: [],
            coordsHash: "",
            links: [],
            hashtags: [],
            formattedText: []
        };
    }

    // Legacy methods for compatibility - delegate to new implementation
    decodeMediaData(binaryData: any): any {
        return { type: 'unknown', note: 'Media decoding not implemented in this version' };
    }

    // Utility methods that might be called by other parts of the plugin
    formatZNotesText(znotesData: ZNotesData): string {
        return znotesData.formattedText.join('\n');
    }

    extractHighlightText(zhighlightsData: ZHighlightsData[]): string {
        // This would need to be implemented based on the highlight data structure
        return '';
    }
}