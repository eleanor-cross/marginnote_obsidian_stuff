/**
 * TypeScript data models for MarginNote4 content
 * 
 * Converted from Python dataclasses to TypeScript interfaces and classes.
 * Represents the core data structures used throughout the import process.
 */

export enum NoteType {
    HIGHLIGHT = "highlight",
    NOTE = "note", 
    MINDMAP = "mindmap",
    REVIEW_CARD = "review_card",
    PROJECT = "project",
    UNKNOWN = "unknown"
}

export enum TopicType {
    PROJECT = "project",
    BOOK = "book", 
    REVIEW_TOPIC = "review_topic",
    GENERAL = "general",
    UNKNOWN = "unknown"
}

export enum MediaType {
    PNG_IMAGE = "png_image",
    APPLE_INK = "apple_ink", 
    COORDINATES = "coordinates",
    BINARY = "binary",
    UNKNOWN = "unknown"
}

export interface MNRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MNExcerptPic {
    rect?: MNRect;
    pageNo?: number;
    
    hasContent(): boolean;
}

export interface MNNoteComment {
    text: string;
    author?: string;
    createDate?: Date;
    modifyDate?: Date;
}

export interface MNMediaData {
    mediaHash: string;
    mediaType: MediaType;
    data?: ArrayBuffer;
    parsedContent?: any;
    size: number;
    
    isImage(): boolean;
    isInkDrawing(): boolean;
    toMarkdownImage(altText: string): string | null;
}

export interface MNMediaAttachment {
    mediaHash: string;
    mediaData?: MNMediaData;
    
    hasMediaData(): boolean;
    isImage(): boolean;
    isInkDrawing(): boolean;
}

export interface MNBookNote {
    noteId: string;
    topicId?: string;
    groupNoteId?: string;
    evernoteId?: string;
    
    // Text content
    excerptText?: string;
    notesText?: string;
    noteTitle?: string;
    formattedText: string[];
    
    // Metadata
    noteDate?: Date;
    highlightDate?: Date;
    author?: string;
    startPage?: number;
    endPage?: number;
    
    // Visual content
    excerptPic?: MNExcerptPic;
    
    // Processed features
    hashtags: string[];
    internalLinks: string[];
    mediaAttachments: MNMediaAttachment[];
    comments: MNNoteComment[];
    
    // Binary data (to be decoded)
    notesData?: ArrayBuffer;
    highlightsData?: ArrayBuffer;
    
    // Methods
    hasContent(): boolean;
    getAllText(): string;
    isMergedContent(): boolean;
    isOriginalContent(): boolean;
    getNoteType(): NoteType;
}

export interface MNTopic {
    topicId: string;
    title: string;
    topicType: TopicType;
    parentTopicId?: string;
    
    // Metadata
    createDate?: Date;
    modifyDate?: Date;
    author?: string;
    
    // Configuration data
    forumOwner?: any;
    
    hasValidContent(): boolean;
}

export interface ContentGroup {
    masterNoteId: string;
    noteIds: string[];
    masterNote?: MNBookNote;
    notes: MNBookNote[];
    groupType: string;
}

export interface MediaCollection {
    mediaItems: Map<string, MNMediaData>;
    
    addMedia(media: MNMediaData): void;
    getMedia(hash: string): MNMediaData | undefined;
    getStatistics(): any;
}

export interface TopicClassification {
    projectTopics: Set<string>;
    bookTopics: Set<string>;
    reviewTopics: Set<string>;
    generalTopics: Set<string>;
    
    addTopic(topic: MNTopic): void;
    getTopicType(topicId: string): TopicType | undefined;
    toDict(): any;
}

// Implementation classes

export class MNExcerptPicImpl implements MNExcerptPic {
    rect?: MNRect;
    pageNo?: number;
    
    constructor(data: Partial<MNExcerptPic> = {}) {
        this.rect = data.rect;
        this.pageNo = data.pageNo;
    }
    
    hasContent(): boolean {
        return !!(this.rect || this.pageNo);
    }
}

export class MNMediaDataImpl implements MNMediaData {
    mediaHash: string;
    mediaType: MediaType;
    data?: ArrayBuffer;
    parsedContent?: any;
    size: number;
    
    constructor(hash: string, type: MediaType = MediaType.UNKNOWN, data?: ArrayBuffer) {
        this.mediaHash = hash;
        this.mediaType = type;
        this.data = data;
        this.size = data?.byteLength || 0;
    }
    
    isImage(): boolean {
        return this.mediaType === MediaType.PNG_IMAGE;
    }
    
    isInkDrawing(): boolean {
        return this.mediaType === MediaType.APPLE_INK;
    }
    
    toMarkdownImage(altText: string): string | null {
        if (!this.isImage()) return null;
        return `![${altText}](${this.mediaHash})`;
    }
    
    static fromDatabaseRow(row: any): MNMediaDataImpl {
        const hash = row.ZMD5 || row.mediaHash || '';
        const data = row.ZDATA || row.data;
        
        // Detect media type from data or filename
        let mediaType = MediaType.UNKNOWN;
        if (data && data instanceof ArrayBuffer) {
            const view = new Uint8Array(data.slice(0, 10));
            if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) {
                mediaType = MediaType.PNG_IMAGE;
            }
        }
        
        return new MNMediaDataImpl(hash, mediaType, data);
    }
}

export class MNMediaAttachmentImpl implements MNMediaAttachment {
    mediaHash: string;
    mediaData?: MNMediaData;
    
    constructor(hash: string, data?: MNMediaData) {
        this.mediaHash = hash;
        this.mediaData = data;
    }
    
    hasMediaData(): boolean {
        return !!this.mediaData;
    }
    
    isImage(): boolean {
        return this.mediaData?.isImage() || false;
    }
    
    isInkDrawing(): boolean {
        return this.mediaData?.isInkDrawing() || false;
    }
    
    static fromMediaList(mediaList: any, mediaItems: Map<string, MNMediaData>): MNMediaAttachmentImpl[] {
        if (!mediaList) return [];
        
        const attachments: MNMediaAttachmentImpl[] = [];
        
        // Parse media list (could be JSON string or array)
        let items = mediaList;
        if (typeof mediaList === 'string') {
            try {
                items = JSON.parse(mediaList);
            } catch {
                return [];
            }
        }
        
        if (Array.isArray(items)) {
            for (const item of items) {
                const hash = typeof item === 'string' ? item : item.hash || item.mediaHash;
                if (hash) {
                    const mediaData = mediaItems.get(hash);
                    attachments.push(new MNMediaAttachmentImpl(hash, mediaData));
                }
            }
        }
        
        return attachments;
    }
}

export class MNBookNoteImpl implements MNBookNote {
    noteId: string;
    topicId?: string;
    groupNoteId?: string;
    evernoteId?: string;
    
    excerptText?: string;
    notesText?: string;
    noteTitle?: string;
    formattedText: string[] = [];
    
    noteDate?: Date;
    highlightDate?: Date;
    author?: string;
    startPage?: number;
    endPage?: number;
    
    excerptPic?: MNExcerptPic;
    
    hashtags: string[] = [];
    internalLinks: string[] = [];
    mediaAttachments: MNMediaAttachment[] = [];
    comments: MNNoteComment[] = [];
    
    notesData?: ArrayBuffer;
    highlightsData?: ArrayBuffer;
    
    constructor(noteId: string) {
        this.noteId = noteId;
    }
    
    hasContent(): boolean {
        return !!(
            this.excerptText?.trim() ||
            this.notesText?.trim() ||
            this.noteTitle?.trim() ||
            this.formattedText.length > 0 ||
            this.hashtags.length > 0 ||
            this.mediaAttachments.length > 0
        );
    }
    
    getAllText(): string {
        const texts = [
            this.excerptText,
            this.notesText,
            this.noteTitle,
            ...this.formattedText
        ].filter(t => t?.trim());
        
        return texts.join('\n');
    }
    
    isMergedContent(): boolean {
        return !!this.groupNoteId;
    }
    
    isOriginalContent(): boolean {
        return !this.groupNoteId;
    }
    
    getNoteType(): NoteType {
        // Determine note type based on content and metadata
        if (this.topicId) {
            return NoteType.PROJECT;
        } else if (this.excerptText) {
            return NoteType.HIGHLIGHT;
        } else if (this.notesText) {
            return NoteType.NOTE;
        } else {
            return NoteType.UNKNOWN;
        }
    }
    
    static fromDatabaseRow(row: any): MNBookNoteImpl {
        const note = new MNBookNoteImpl(row.ZNOTEID || row.noteId || '');
        
        // Basic fields
        note.topicId = row.ZTOPICID || row.topicId;
        note.groupNoteId = row.ZGROUPNOTEID || row.groupNoteId;
        note.evernoteId = row.ZEVERNOTE_ID || row.evernoteId;
        
        // Text content
        note.excerptText = row.ZHIGHLIGHT_TEXT || row.excerptText;
        note.notesText = row.ZNOTES_TEXT || row.notesText;
        note.noteTitle = row.ZNOTE_TITLE || row.noteTitle;
        
        // Dates
        const dateOffset = 978307200000; // Core Data timestamp offset
        if (row.ZNOTE_DATE || row.noteDate) {
            const timestamp = (row.ZNOTE_DATE || row.noteDate) * 1000 + dateOffset;
            note.noteDate = new Date(timestamp);
        }
        if (row.ZHIGHLIGHT_DATE || row.highlightDate) {
            const timestamp = (row.ZHIGHLIGHT_DATE || row.highlightDate) * 1000 + dateOffset;
            note.highlightDate = new Date(timestamp);
        }
        
        // Pages
        note.startPage = row.ZSTART_PAGE || row.startPage;
        note.endPage = row.ZEND_PAGE || row.endPage;
        
        // Author
        note.author = row.ZAUTHOR || row.author;
        
        // Binary data
        note.notesData = row.ZNOTES || row.notesData;
        note.highlightsData = row.ZHIGHLIGHTS || row.highlightsData;
        
        // Excerpt pic
        if (row.ZEXCERPT_PIC || row.excerptPic) {
            const picData = row.ZEXCERPT_PIC || row.excerptPic;
            // This would need NSKeyedArchiver decoding
            note.excerptPic = new MNExcerptPicImpl();
        }
        
        return note;
    }
}

export class MNTopicImpl implements MNTopic {
    topicId: string;
    title: string;
    topicType: TopicType;
    parentTopicId?: string;
    createDate?: Date;
    modifyDate?: Date;
    author?: string;
    forumOwner?: any;
    
    constructor(topicId: string, title: string) {
        this.topicId = topicId;
        this.title = title;
        this.topicType = TopicType.UNKNOWN;
    }
    
    hasValidContent(): boolean {
        return !!(this.title?.trim());
    }
    
    static fromDatabaseRow(row: any): MNTopicImpl {
        const topic = new MNTopicImpl(
            row.ZTOPICID || row.topicId || '',
            row.ZTITLE || row.title || ''
        );
        
        topic.parentTopicId = row.ZPARENT_TOPIC || row.parentTopicId;
        topic.author = row.ZAUTHOR || row.author;
        
        // Parse forum owner for topic classification
        const forumOwnerStr = row.ZFORUMOWNER || row.forumOwner;
        if (forumOwnerStr) {
            try {
                topic.forumOwner = JSON.parse(forumOwnerStr);
                
                // Classify topic type
                if (topic.forumOwner.projectTopic) {
                    topic.topicType = TopicType.PROJECT;
                } else if (topic.forumOwner.reviewTopic) {
                    topic.topicType = TopicType.REVIEW_TOPIC;
                } else if (topic.forumOwner.bookTopic) {
                    topic.topicType = TopicType.BOOK;
                } else {
                    topic.topicType = TopicType.GENERAL;
                }
            } catch {
                topic.topicType = TopicType.GENERAL;
            }
        }
        
        // Dates
        const dateOffset = 978307200000;
        if (row.ZCREATE_DATE || row.createDate) {
            const timestamp = (row.ZCREATE_DATE || row.createDate) * 1000 + dateOffset;
            topic.createDate = new Date(timestamp);
        }
        if (row.ZMODIFY_DATE || row.modifyDate) {
            const timestamp = (row.ZMODIFY_DATE || row.modifyDate) * 1000 + dateOffset;
            topic.modifyDate = new Date(timestamp);
        }
        
        return topic;
    }
}

export class ContentGroupImpl implements ContentGroup {
    masterNoteId: string;
    noteIds: string[];
    masterNote?: MNBookNote;
    notes: MNBookNote[];
    groupType: string;
    
    constructor(masterNoteId: string, noteIds: string[], notes: MNBookNote[] = []) {
        this.masterNoteId = masterNoteId;
        this.noteIds = noteIds;
        this.notes = notes;
        this.groupType = "unknown";
    }
}

export class MediaCollectionImpl implements MediaCollection {
    mediaItems: Map<string, MNMediaData> = new Map();
    
    addMedia(media: MNMediaData): void {
        this.mediaItems.set(media.mediaHash, media);
    }
    
    getMedia(hash: string): MNMediaData | undefined {
        return this.mediaItems.get(hash);
    }
    
    getStatistics(): any {
        const stats = {
            totalItems: this.mediaItems.size,
            images: 0,
            inkDrawings: 0,
            other: 0
        };
        
        for (const media of this.mediaItems.values()) {
            if (media.isImage()) {
                stats.images++;
            } else if (media.isInkDrawing()) {
                stats.inkDrawings++;
            } else {
                stats.other++;
            }
        }
        
        return stats;
    }
}

export class TopicClassificationImpl implements TopicClassification {
    projectTopics: Set<string> = new Set();
    bookTopics: Set<string> = new Set();
    reviewTopics: Set<string> = new Set();
    generalTopics: Set<string> = new Set();
    
    addTopic(topic: MNTopic): void {
        switch (topic.topicType) {
            case TopicType.PROJECT:
                this.projectTopics.add(topic.topicId);
                break;
            case TopicType.BOOK:
                this.bookTopics.add(topic.topicId);
                break;
            case TopicType.REVIEW_TOPIC:
                this.reviewTopics.add(topic.topicId);
                break;
            default:
                this.generalTopics.add(topic.topicId);
                break;
        }
    }
    
    getTopicType(topicId: string): TopicType | undefined {
        if (this.projectTopics.has(topicId)) return TopicType.PROJECT;
        if (this.bookTopics.has(topicId)) return TopicType.BOOK;
        if (this.reviewTopics.has(topicId)) return TopicType.REVIEW_TOPIC;
        if (this.generalTopics.has(topicId)) return TopicType.GENERAL;
        return undefined;
    }
    
    toDict(): any {
        return {
            projects: this.projectTopics.size,
            books: this.bookTopics.size,
            reviewTopics: this.reviewTopics.size,
            general: this.generalTopics.size
        };
    }
}