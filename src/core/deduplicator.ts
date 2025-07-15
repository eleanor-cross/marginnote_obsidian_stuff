/**
 * MarginNote4 content deduplicator
 * 
 * Handles deduplication of merged vs original content to avoid redundant notes.
 * Critical component for ensuring one note per extract without duplicates.
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

import { MNBookNote, ContentGroup, ContentGroupImpl } from '../models/types';

export interface DeduplicationReport {
    statistics: DeduplicationStatistics;
    processedGroups: number;
    efficiency: {
        duplicateRemovalRate: number;
        contentCombinationRate: number;
    };
    validation?: ValidationReport;
}

export interface DeduplicationStatistics {
    totalGroupsProcessed: number;
    mergedContentFound: number;
    originalContentPreserved: number;
    duplicatesRemoved: number;
    contentCombined: number;
}

export interface ValidationReport {
    originalCount: number;
    deduplicatedCount: number;
    contentPreserved: boolean;
    issues: string[];
    reductionRatio: number;
    emptyGroups: number;
}

/**
 * Deduplicates MarginNote content to prevent redundant notes
 * 
 * Handles the complex relationship between original content and merged content:
 * - Original content has empty ZGROUPNOTEID
 * - Merged content references originals via ZGROUPNOTEID
 * - Only merged content contains proper ordering in ZNOTES
 * - Must avoid creating duplicate notes from both versions
 */
export class ContentDeduplicator {
    private processedGroups: Set<string> = new Set();
    private deduplicationStats: DeduplicationStatistics = {
        totalGroupsProcessed: 0,
        mergedContentFound: 0,
        originalContentPreserved: 0,
        duplicatesRemoved: 0,
        contentCombined: 0
    };

    /**
     * Deduplicate content groups to ensure one note per extract
     */
    deduplicateContentGroups(contentGroups: ContentGroup[]): ContentGroup[] {
        console.log(`Starting deduplication of ${contentGroups.length} content groups...`);

        const deduplicatedGroups: ContentGroup[] = [];

        for (const group of contentGroups) {
            if (!this.processedGroups.has(group.masterNoteId)) {
                const deduplicatedGroup = this.deduplicateSingleGroup(group);
                if (deduplicatedGroup && deduplicatedGroup.masterNote) {
                    deduplicatedGroups.push(deduplicatedGroup);
                    this.processedGroups.add(deduplicatedGroup.masterNoteId);
                }

                this.deduplicationStats.totalGroupsProcessed++;
            }
        }

        console.log(`Deduplication complete: ${deduplicatedGroups.length} final groups`);
        console.log('Stats:', this.deduplicationStats);

        return deduplicatedGroups;
    }

    /**
     * Deduplicate a single content group
     */
    private deduplicateSingleGroup(group: ContentGroup): ContentGroup | null {
        if (!group.notes || group.notes.length === 0) {
            return null;
        }

        // Separate merged and original content
        const [mergedNotes, originalNotes] = this.separateMergedAndOriginal(group.notes);

        if (mergedNotes.length > 0 && originalNotes.length > 0) {
            // Both merged and original exist - use merged as master, combine content
            return this.handleMixedContent(group, mergedNotes, originalNotes);
        } else if (mergedNotes.length > 0) {
            // Only merged content - use as-is
            return this.handleMergedOnlyContent(group, mergedNotes);
        } else if (originalNotes.length > 0) {
            // Only original content - use as-is
            return this.handleOriginalOnlyContent(group, originalNotes);
        } else {
            // No valid content
            return null;
        }
    }

    /**
     * Separate notes into merged and original content
     */
    private separateMergedAndOriginal(notes: MNBookNote[]): [MNBookNote[], MNBookNote[]] {
        const mergedNotes: MNBookNote[] = [];
        const originalNotes: MNBookNote[] = [];

        for (const note of notes) {
            if (note.isMergedContent()) {
                mergedNotes.push(note);
            } else if (note.isOriginalContent()) {
                originalNotes.push(note);
            }
        }

        return [mergedNotes, originalNotes];
    }

    /**
     * Handle groups with both merged and original content
     * 
     * Strategy: Use merged content as master (has proper ordering), 
     * but supplement with any unique content from originals.
     */
    private handleMixedContent(
        group: ContentGroup, 
        mergedNotes: MNBookNote[], 
        originalNotes: MNBookNote[]
    ): ContentGroup {
        this.deduplicationStats.mergedContentFound++;

        // Select best merged note as master
        const masterNote = this.selectBestMergedNote(mergedNotes);

        // Combine unique content from original notes
        this.supplementWithOriginalContent(masterNote, originalNotes);

        // Create deduplicated group
        const deduplicatedGroup = new ContentGroupImpl(
            masterNote.noteId,
            [masterNote.noteId],
            [masterNote]
        );
        deduplicatedGroup.masterNote = masterNote;
        deduplicatedGroup.groupType = group.groupType;

        this.deduplicationStats.contentCombined++;
        return deduplicatedGroup;
    }

    /**
     * Handle groups with only merged content
     */
    private handleMergedOnlyContent(group: ContentGroup, mergedNotes: MNBookNote[]): ContentGroup {
        const masterNote = this.selectBestMergedNote(mergedNotes);

        const result = new ContentGroupImpl(
            masterNote.noteId,
            [masterNote.noteId],
            [masterNote]
        );
        result.masterNote = masterNote;
        result.groupType = group.groupType;

        return result;
    }

    /**
     * Handle groups with only original content
     */
    private handleOriginalOnlyContent(group: ContentGroup, originalNotes: MNBookNote[]): ContentGroup {
        this.deduplicationStats.originalContentPreserved++;

        // If multiple original notes, combine them
        let masterNote: MNBookNote;
        if (originalNotes.length > 1) {
            masterNote = this.combineOriginalNotes(originalNotes);
        } else {
            masterNote = originalNotes[0];
        }

        const result = new ContentGroupImpl(
            masterNote.noteId,
            [masterNote.noteId],
            [masterNote]
        );
        result.masterNote = masterNote;
        result.groupType = group.groupType;

        return result;
    }

    /**
     * Select the best merged note from multiple candidates
     * 
     * Priority:
     * 1. Note with most content
     * 2. Note with title
     * 3. Most recent note
     */
    private selectBestMergedNote(mergedNotes: MNBookNote[]): MNBookNote {
        if (mergedNotes.length === 1) {
            return mergedNotes[0];
        }

        // Score notes based on content richness
        const scoredNotes = mergedNotes.map(note => ({
            note,
            score: this.calculateContentScore(note)
        }));

        // Sort by score (highest first)
        scoredNotes.sort((a, b) => b.score - a.score);

        return scoredNotes[0].note;
    }

    /**
     * Calculate content richness score for a note
     */
    private calculateContentScore(note: MNBookNote): number {
        let score = 0;

        // Text content
        if (note.excerptText) {
            score += note.excerptText.trim().length;
        }
        if (note.notesText) {
            score += note.notesText.trim().length * 2; // Notes text weighted higher
        }
        if (note.noteTitle) {
            score += note.noteTitle.trim().length * 3; // Title weighted highest
        }

        // Feature content
        score += note.hashtags.length * 10;
        score += note.internalLinks.length * 5;
        score += note.formattedText.length * 2;

        // Media content
        score += note.mediaAttachments.length * 15;

        // Visual content
        if (note.excerptPic && note.excerptPic.hasContent()) {
            score += 20;
        }

        return score;
    }

    /**
     * Supplement master note with unique content from original notes
     * 
     * Adds content that's not already present in the master note.
     */
    private supplementWithOriginalContent(masterNote: MNBookNote, originalNotes: MNBookNote[]): void {
        for (const originalNote of originalNotes) {
            // Supplement text content if master is missing it
            if (!masterNote.excerptText && originalNote.excerptText) {
                masterNote.excerptText = originalNote.excerptText;
            }

            if (!masterNote.notesText && originalNote.notesText) {
                masterNote.notesText = originalNote.notesText;
            }

            if (!masterNote.noteTitle && originalNote.noteTitle) {
                masterNote.noteTitle = originalNote.noteTitle;
            }

            // Supplement visual content
            if (!masterNote.excerptPic && originalNote.excerptPic) {
                masterNote.excerptPic = originalNote.excerptPic;
            }

            // Add unique hashtags
            for (const hashtag of originalNote.hashtags) {
                if (!masterNote.hashtags.includes(hashtag)) {
                    masterNote.hashtags.push(hashtag);
                }
            }

            // Add unique links
            for (const link of originalNote.internalLinks) {
                if (!masterNote.internalLinks.includes(link)) {
                    masterNote.internalLinks.push(link);
                }
            }

            // Add unique formatted text
            for (const text of originalNote.formattedText) {
                if (!masterNote.formattedText.includes(text)) {
                    masterNote.formattedText.push(text);
                }
            }

            // Add unique media attachments
            const existingHashes = new Set(masterNote.mediaAttachments.map(m => m.mediaHash));
            for (const media of originalNote.mediaAttachments) {
                if (!existingHashes.has(media.mediaHash)) {
                    masterNote.mediaAttachments.push(media);
                }
            }
        }
    }

    /**
     * Combine multiple original notes into a single note
     */
    private combineOriginalNotes(originalNotes: MNBookNote[]): MNBookNote {
        if (originalNotes.length === 1) {
            return originalNotes[0];
        }

        // Use first note as master
        const masterNote = originalNotes[0];
        const otherNotes = originalNotes.slice(1);

        // Combine content from other notes
        this.supplementWithOriginalContent(masterNote, otherNotes);

        return masterNote;
    }

    /**
     * Remove duplicate features within each group's master note
     */
    removeDuplicateFeatures(groups: ContentGroup[]): ContentGroup[] {
        console.log('Removing duplicate features...');

        for (const group of groups) {
            if (group.masterNote) {
                this.removeNoteDuplicates(group.masterNote);
            }
        }

        return groups;
    }

    /**
     * Remove duplicate features from a single note
     */
    private removeNoteDuplicates(note: MNBookNote): void {
        // Remove duplicate hashtags while preserving order
        const seenHashtags = new Set<string>();
        note.hashtags = note.hashtags.filter(hashtag => {
            if (seenHashtags.has(hashtag)) {
                return false;
            }
            seenHashtags.add(hashtag);
            return true;
        });

        // Remove duplicate links
        const seenLinks = new Set<string>();
        note.internalLinks = note.internalLinks.filter(link => {
            if (seenLinks.has(link)) {
                return false;
            }
            seenLinks.add(link);
            return true;
        });

        // Remove duplicate formatted text
        const seenText = new Set<string>();
        note.formattedText = note.formattedText.filter(text => {
            const cleanText = text.trim();
            if (!cleanText || seenText.has(cleanText)) {
                return false;
            }
            seenText.add(cleanText);
            return true;
        });

        // Remove duplicate media attachments
        const seenMedia = new Set<string>();
        note.mediaAttachments = note.mediaAttachments.filter(media => {
            if (seenMedia.has(media.mediaHash)) {
                return false;
            }
            seenMedia.add(media.mediaHash);
            return true;
        });
    }

    /**
     * Validate that deduplication preserved all important content
     */
    validateDeduplication(
        originalGroups: ContentGroup[], 
        deduplicatedGroups: ContentGroup[]
    ): ValidationReport {
        const validationReport: ValidationReport = {
            originalCount: originalGroups.length,
            deduplicatedCount: deduplicatedGroups.length,
            contentPreserved: true,
            issues: [],
            reductionRatio: 0,
            emptyGroups: 0
        };

        // Check for significant content loss
        const originalNotes = originalGroups.reduce((sum, g) => sum + g.notes.length, 0);
        const finalNotes = deduplicatedGroups.length;

        const reductionRatio = originalNotes > 0 ? (originalNotes - finalNotes) / originalNotes : 0;
        validationReport.reductionRatio = reductionRatio;

        if (reductionRatio > 0.9) { // More than 90% reduction might indicate over-deduplication
            validationReport.issues.push(`High reduction ratio: ${(reductionRatio * 100).toFixed(1)}%`);
            validationReport.contentPreserved = false;
        }

        // Check that all groups have content
        const emptyGroups = deduplicatedGroups.filter(g => 
            !g.masterNote || !g.masterNote.hasContent()
        ).length;
        
        validationReport.emptyGroups = emptyGroups;
        
        if (emptyGroups > 0) {
            validationReport.issues.push(`${emptyGroups} groups have no content`);
            validationReport.contentPreserved = false;
        }

        return validationReport;
    }

    /**
     * Get detailed deduplication report
     */
    getDeduplicationReport(): DeduplicationReport {
        const totalProcessed = Math.max(this.deduplicationStats.totalGroupsProcessed, 1);
        
        return {
            statistics: { ...this.deduplicationStats },
            processedGroups: this.processedGroups.size,
            efficiency: {
                duplicateRemovalRate: this.deduplicationStats.duplicatesRemoved / totalProcessed,
                contentCombinationRate: this.deduplicationStats.contentCombined / totalProcessed
            }
        };
    }
}

/**
 * Convenience function to deduplicate content groups
 */
export function deduplicateContent(contentGroups: ContentGroup[]): [ContentGroup[], DeduplicationReport] {
    const deduplicator = new ContentDeduplicator();

    // Perform deduplication
    const deduplicated = deduplicator.deduplicateContentGroups(contentGroups);

    // Remove duplicate features
    const cleaned = deduplicator.removeDuplicateFeatures(deduplicated);

    // Generate report
    const report = deduplicator.getDeduplicationReport();
    report.validation = deduplicator.validateDeduplication(contentGroups, cleaned);

    return [cleaned, report];
}