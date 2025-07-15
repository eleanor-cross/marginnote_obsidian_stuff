/**
 * MarginNote4 content extractor
 * 
 * Main content processing engine that extracts and processes data from ZBOOKNOTE
 * using Union-Find algorithm for content grouping (adapted from OhMyMN patterns).
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

import { 
    MNBookNote, MNBookNoteImpl, 
    MNTopic, MNTopicImpl,
    ContentGroup, ContentGroupImpl,
    MediaCollection, MediaCollectionImpl,
    TopicClassification, TopicClassificationImpl,
    MNMediaData, MNMediaDataImpl,
    MNMediaAttachment, MNMediaAttachmentImpl,
    TopicType, NoteType
} from '../models/types';
import { NSKeyedArchiverDecoder } from './nskeyedarchiver-decoder';
import { TextProcessor } from '../utils/text-utils';

export interface DatabaseRow {
    [key: string]: any;
}

export interface ExtractionResult {
    contentGroups: ContentGroup[];
    notes: Map<string, MNBookNote>;
    topics: Map<string, MNTopic>;
    mediaCollection: MediaCollection;
    topicClassification: TopicClassification;
    statistics: ExtractionStatistics;
}

export interface ExtractionStatistics {
    totalNotes: number;
    totalTopics: number;
    totalGroups: number;
    mediaStats: any;
    topicClassification: any;
    groupStatistics: {
        singleNoteGroups: number;
        multiNoteGroups: number;
        largestGroupSize: number;
        averageGroupSize: number;
    };
    contentFeatures: {
        totalHashtags: number;
        totalInternalLinks: number;
        notesWithMedia: number;
        notesWithContent: number;
    };
}

/**
 * Union-Find data structure for grouping related notes
 * Adapted from obsidian-bridge processing patterns
 */
export class UnionFind {
    private parent: Map<string, string> = new Map();
    private rank: Map<string, number> = new Map();

    /**
     * Find root of element with path compression
     */
    find(x: string): string {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
            this.rank.set(x, 0);
            return x;
        }

        const parentX = this.parent.get(x)!;
        if (parentX !== x) {
            // Path compression
            this.parent.set(x, this.find(parentX));
        }

        return this.parent.get(x)!;
    }

    /**
     * Union two elements by rank
     */
    union(x: string, y: string): void {
        const rootX = this.find(x);
        const rootY = this.find(y);

        if (rootX === rootY) return;

        // Union by rank
        const rankX = this.rank.get(rootX) || 0;
        const rankY = this.rank.get(rootY) || 0;

        if (rankX < rankY) {
            this.parent.set(rootX, rootY);
        } else if (rankX > rankY) {
            this.parent.set(rootY, rootX);
        } else {
            this.parent.set(rootY, rootX);
            this.rank.set(rootX, rankX + 1);
        }
    }

    /**
     * Get all connected components
     */
    getGroups(): string[][] {
        const groups = new Map<string, string[]>();

        for (const node of this.parent.keys()) {
            const root = this.find(node);
            if (!groups.has(root)) {
                groups.set(root, []);
            }
            groups.get(root)!.push(node);
        }

        return Array.from(groups.values());
    }
}

/**
 * Main content processing engine for MarginNote4 data
 * 
 * Extracts, processes, and groups note content using patterns
 * adapted from OhMyMN and obsidian-bridge.
 */
export class ContentExtractor {
    private decoder: NSKeyedArchiverDecoder;
    private textProcessor: typeof TextProcessor;
    private unionFind: UnionFind;

    // Processing state
    private notes: Map<string, MNBookNote> = new Map();
    private topics: Map<string, MNTopic> = new Map();
    private mediaCollection: MediaCollection;
    private topicClassification: TopicClassification;

    constructor(strictDecoding: boolean = false) {
        this.decoder = new NSKeyedArchiverDecoder({ strictMode: strictDecoding });
        this.textProcessor = TextProcessor;
        this.unionFind = new UnionFind();
        this.mediaCollection = new MediaCollectionImpl();
        this.topicClassification = new TopicClassificationImpl();
    }

    /**
     * Extract and process all content from database tables
     */
    extractAllContent(
        booknotesData: DatabaseRow[], 
        topicsData: DatabaseRow[], 
        mediaData: DatabaseRow[]
    ): ExtractionResult {
        console.log('Starting content extraction...');

        // Step 1: Process media data
        this.processMediaData(mediaData);

        // Step 2: Process topics and classify them
        this.processTopics(topicsData);

        // Step 3: Process notes and extract content
        this.processNotes(booknotesData);

        // Step 4: Group related content using Union-Find
        const contentGroups = this.groupRelatedContent();

        // Step 5: Identify master notes for each group
        this.identifyMasterNotes(contentGroups);

        // Step 6: Process content features (hashtags, links, etc.)
        this.processContentFeatures(contentGroups);

        console.log(`Content extraction complete: ${contentGroups.length} groups, ` +
                   `${this.notes.size} notes, ${this.topics.size} topics`);

        return {
            contentGroups,
            notes: this.notes,
            topics: this.topics,
            mediaCollection: this.mediaCollection,
            topicClassification: this.topicClassification,
            statistics: this.getExtractionStatistics(contentGroups)
        };
    }

    /**
     * Process ZMEDIA table and build media collection
     */
    private processMediaData(mediaData: DatabaseRow[]): void {
        console.log(`Processing ${mediaData.length} media items...`);

        for (const row of mediaData) {
            try {
                const media = MNMediaDataImpl.fromDatabaseRow(row);

                // Decode media content if needed
                if (media.data && media.mediaType.valueOf() !== 'unknown') {
                    const decodedContent = this.decoder.decodeMediaData(media.data);
                    media.parsedContent = decodedContent;
                }

                this.mediaCollection.addMedia(media);
            } catch (error) {
                console.warn(`Failed to process media ${row.ZMD5 || 'unknown'}:`, error);
            }
        }

        console.log('Processed media:', this.mediaCollection.getStatistics());
    }

    /**
     * Process ZTOPIC table and classify topics
     */
    private processTopics(topicsData: DatabaseRow[]): void {
        console.log(`Processing ${topicsData.length} topics...`);

        for (const row of topicsData) {
            try {
                const topic = MNTopicImpl.fromDatabaseRow(row);
                this.topics.set(topic.topicId, topic);
                this.topicClassification.addTopic(topic);
            } catch (error) {
                console.warn(`Failed to process topic ${row.ZTOPICID || 'unknown'}:`, error);
            }
        }

        console.log('Topic classification:', this.topicClassification.toDict());
    }

    /**
     * Process ZBOOKNOTE table and extract note content
     */
    private processNotes(booknotesData: DatabaseRow[]): void {
        console.log(`Processing ${booknotesData.length} notes...`);

        for (const row of booknotesData) {
            try {
                const note = MNBookNoteImpl.fromDatabaseRow(row);

                // Decode binary data if present
                if (note.notesData) {
                    const decodedNotes = this.decoder.decodeZNotes(note.notesData);
                    this.applyDecodedNotesData(note, decodedNotes);
                }

                if (note.highlightsData) {
                    const decodedHighlights = this.decoder.decodeZHighlights(note.highlightsData);
                    this.applyDecodedHighlightsData(note, decodedHighlights);
                }

                // Process media attachments
                if (row.ZMEDIA_LIST || row.mediaList) {
                    const attachments = MNMediaAttachmentImpl.fromMediaList(
                        row.ZMEDIA_LIST || row.mediaList,
                        this.mediaCollection.mediaItems
                    );
                    note.mediaAttachments = attachments;
                }

                // Extract text features
                const allText = note.getAllText();
                if (allText) {
                    const features = this.textProcessor.extractContentFeatures(allText);
                    note.hashtags = features.hashtags;
                    note.internalLinks = features.links;
                    note.formattedText = features.otherText;
                }

                this.notes.set(note.noteId, note);
            } catch (error) {
                console.warn(`Failed to process note ${row.ZNOTEID || 'unknown'}:`, error);
            }
        }

        console.log(`Processed ${this.notes.size} notes`);
    }

    /**
     * Apply decoded ZNOTES data to note object
     */
    private applyDecodedNotesData(note: MNBookNote, decodedData: any): void {
        if (decodedData.highlightText) {
            // Override or supplement excerpt text
            if (!note.excerptText) {
                note.excerptText = decodedData.highlightText;
            }
        }

        // Extract additional links and hashtags
        if (decodedData.links) {
            note.internalLinks.push(...decodedData.links);
        }

        if (decodedData.hashtags) {
            note.hashtags.push(...decodedData.hashtags);
        }

        // Add formatted text
        if (decodedData.formattedText) {
            note.formattedText.push(...decodedData.formattedText);
        }
    }

    /**
     * Apply decoded ZHIGHLIGHTS data to note object
     */
    private applyDecodedHighlightsData(note: MNBookNote, decodedData: any[]): void {
        if (decodedData.length > 0 && !note.excerptPic) {
            // Use first highlight for excerpt pic
            const firstHighlight = decodedData[0];
            if (firstHighlight.rect) {
                note.excerptPic = {
                    rect: firstHighlight.rect,
                    pageNo: firstHighlight.pageNo || 1,
                    hasContent: () => true
                };
            }
        }
    }

    /**
     * Group related notes using Union-Find algorithm
     */
    private groupRelatedContent(): ContentGroup[] {
        console.log('Grouping related content using Union-Find...');

        // Apply Union-Find to note relationships
        for (const note of this.notes.values()) {
            const noteId = note.noteId;

            // Link with group note
            if (note.groupNoteId) {
                this.unionFind.union(noteId, note.groupNoteId);
            }

            // Link with evernote ID
            if (note.evernoteId) {
                this.unionFind.union(noteId, note.evernoteId);
            }

            // Link with internal links
            for (const linkedId of note.internalLinks) {
                if (this.notes.has(linkedId)) {
                    this.unionFind.union(noteId, linkedId);
                }
            }
        }

        // Get groups and create ContentGroup objects
        const groups = this.unionFind.getGroups();
        const contentGroups: ContentGroup[] = [];

        for (const groupIds of groups) {
            if (groupIds.length === 1) {
                // Single note group
                const noteId = groupIds[0];
                const note = this.notes.get(noteId);
                if (note) {
                    const contentGroup = new ContentGroupImpl(noteId, groupIds, [note]);
                    contentGroup.masterNote = note;
                    contentGroups.push(contentGroup);
                }
            } else {
                // Multi-note group - need to identify master
                const validIds = groupIds.filter(nid => this.notes.has(nid));
                if (validIds.length > 0) {
                    const notes = validIds.map(nid => this.notes.get(nid)!);
                    const contentGroup = new ContentGroupImpl(validIds[0], validIds, notes);
                    contentGroups.push(contentGroup);
                }
            }
        }

        console.log(`Created ${contentGroups.length} content groups`);
        return contentGroups;
    }

    /**
     * Identify master note for each group using priority system
     */
    private identifyMasterNotes(contentGroups: ContentGroup[]): void {
        console.log('Identifying master notes...');

        for (const group of contentGroups) {
            if (group.notes.length === 1) {
                group.masterNote = group.notes[0];
                group.masterNoteId = group.notes[0].noteId;
                continue;
            }

            // Priority system: Projects > Books > Review Topics
            const masterNote = this.selectMasterNote(group.notes);
            group.masterNote = masterNote;
            group.masterNoteId = masterNote.noteId;

            // Determine group type
            if (masterNote.topicId) {
                const topicType = this.topicClassification.getTopicType(masterNote.topicId);
                if (topicType) {
                    group.groupType = topicType.toString();
                }
            }
        }
    }

    /**
     * Select master note using priority system (adapted from OhMyMN patterns)
     */
    private selectMasterNote(notes: MNBookNote[]): MNBookNote {
        // Categorize notes by topic type
        const projectNotes: MNBookNote[] = [];
        const bookNotes: MNBookNote[] = [];
        const reviewNotes: MNBookNote[] = [];
        const otherNotes: MNBookNote[] = [];

        for (const note of notes) {
            if (note.topicId) {
                const topicType = this.topicClassification.getTopicType(note.topicId);
                if (topicType === TopicType.PROJECT) {
                    projectNotes.push(note);
                } else if (topicType === TopicType.BOOK) {
                    bookNotes.push(note);
                } else if (topicType === TopicType.REVIEW_TOPIC) {
                    reviewNotes.push(note);
                } else {
                    otherNotes.push(note);
                }
            } else {
                otherNotes.push(note);
            }
        }

        // Priority: Projects > Books > Review > Other
        const priorityLists = [projectNotes, bookNotes, reviewNotes, otherNotes];
        for (const noteList of priorityLists) {
            if (noteList.length > 0) {
                // Within same priority, prefer original content (no groupNoteId)
                const originalNotes = noteList.filter(n => !n.groupNoteId);
                if (originalNotes.length > 0) {
                    return originalNotes[0];
                } else {
                    return noteList[0];
                }
            }
        }

        // Fallback
        return notes[0];
    }

    /**
     * Process content features for all groups
     */
    private processContentFeatures(contentGroups: ContentGroup[]): void {
        console.log('Processing content features...');

        for (const group of contentGroups) {
            if (group.masterNote) {
                // Ensure features are extracted
                const allText = group.masterNote.getAllText();
                if (allText && group.masterNote.hashtags.length === 0) {
                    const features = this.textProcessor.extractContentFeatures(allText);
                    group.masterNote.hashtags = features.hashtags;
                    group.masterNote.internalLinks = features.links;
                    group.masterNote.formattedText = features.otherText;
                }
            }
        }
    }

    /**
     * Get statistics about the extraction process
     */
    private getExtractionStatistics(contentGroups: ContentGroup[]): ExtractionStatistics {
        // Group statistics
        const groupSizes = contentGroups.map(group => group.notes.length);
        const groupStats = {
            singleNoteGroups: groupSizes.filter(size => size === 1).length,
            multiNoteGroups: groupSizes.filter(size => size > 1).length,
            largestGroupSize: Math.max(...groupSizes, 0),
            averageGroupSize: groupSizes.length > 0 ? groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length : 0
        };

        // Content features
        const notes = Array.from(this.notes.values());
        const totalHashtags = notes.reduce((sum, note) => sum + note.hashtags.length, 0);
        const totalLinks = notes.reduce((sum, note) => sum + note.internalLinks.length, 0);
        const notesWithMedia = notes.filter(note => note.mediaAttachments.length > 0).length;
        const notesWithContent = notes.filter(note => note.hasContent()).length;

        return {
            totalNotes: this.notes.size,
            totalTopics: this.topics.size,
            totalGroups: contentGroups.length,
            mediaStats: this.mediaCollection.getStatistics(),
            topicClassification: this.topicClassification.toDict(),
            groupStatistics: groupStats,
            contentFeatures: {
                totalHashtags,
                totalInternalLinks: totalLinks,
                notesWithMedia,
                notesWithContent
            }
        };
    }
}

/**
 * Convenience function to extract all content from database tables
 */
export function extractContentFromDatabase(
    booknotesData: DatabaseRow[],
    topicsData: DatabaseRow[], 
    mediaData: DatabaseRow[],
    strictDecoding: boolean = false
): ExtractionResult {
    const extractor = new ContentExtractor(strictDecoding);
    return extractor.extractAllContent(booknotesData, topicsData, mediaData);
}