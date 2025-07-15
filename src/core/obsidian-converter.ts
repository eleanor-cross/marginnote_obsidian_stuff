/**
 * Obsidian markdown converter
 * 
 * Converts processed MarginNote4 content to Obsidian-compatible markdown format.
 * Creates one note per content extract as specified in requirements.
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

import { ContentGroup, MNBookNote, MNTopic, MNMediaAttachment } from '../models/types';
import { TextProcessor } from '../utils/text-utils';

export interface ObsidianConfig {
    noteTemplate: string;
    includeCoordinates: boolean;
    includeMediaReferences: boolean;
    preserveHierarchy: boolean;
    linkFormat: string;
    hashtagFormat: string;
    mediaFormat: string;
    dateFormat: string;
    metadataSection: boolean;
    contentSections: {
        highlights: boolean;
        notes: boolean;
        tags: boolean;
        links: boolean;
        media: boolean;
        coordinates: boolean;
    };
}

export interface ConversionStatistics {
    notesConverted: number;
    mediaIncluded: number;
    linksProcessed: number;
    hashtagsProcessed: number;
    errors: number;
}

export interface ConversionReport {
    statistics: ConversionStatistics;
    configUsed: ObsidianConfig;
    successRate: number;
}

/**
 * Converts MarginNote4 content to Obsidian markdown format
 * 
 * Creates one note per content extract, combining highlights, review cards,
 * mindmap nodes, and related content into single markdown files.
 */
export class ObsidianConverter {
    private config: ObsidianConfig;
    private textProcessor: typeof TextProcessor;
    private conversionStats: ConversionStatistics;

    constructor(config?: Partial<ObsidianConfig>) {
        this.config = { ...this.getDefaultConfig(), ...config };
        this.textProcessor = TextProcessor;
        this.conversionStats = {
            notesConverted: 0,
            mediaIncluded: 0,
            linksProcessed: 0,
            hashtagsProcessed: 0,
            errors: 0
        };
    }

    /**
     * Get default configuration for Obsidian conversion
     */
    private getDefaultConfig(): ObsidianConfig {
        return {
            noteTemplate: `# {title}

{content}

{metadata}`,
            includeCoordinates: true,
            includeMediaReferences: true,
            preserveHierarchy: true,
            linkFormat: "[[{note_id}]]",
            hashtagFormat: "#{tag}",
            mediaFormat: "![{alt_text}]({media_ref})",
            dateFormat: "YYYY-MM-DD HH:mm:ss",
            metadataSection: true,
            contentSections: {
                highlights: true,
                notes: true,
                tags: true,
                links: true,
                media: true,
                coordinates: true
            }
        };
    }

    /**
     * Convert all content groups to Obsidian markdown
     */
    convertContentGroups(
        contentGroups: ContentGroup[], 
        topics: Map<string, MNTopic>
    ): Map<string, string> {
        console.log(`Converting ${contentGroups.length} content groups to Obsidian format...`);

        const obsidianNotes = new Map<string, string>();

        for (const group of contentGroups) {
            try {
                if (group.masterNote && group.masterNote.hasContent()) {
                    const noteId = group.masterNote.noteId;
                    const topic = group.masterNote.topicId ? topics.get(group.masterNote.topicId) : undefined;

                    const markdownContent = this.convertSingleNote(group, topic);
                    obsidianNotes.set(noteId, markdownContent);

                    this.conversionStats.notesConverted++;
                }
            } catch (error) {
                console.warn(`Failed to convert group ${group.masterNoteId}:`, error);
                this.conversionStats.errors++;
            }
        }

        console.log(`Conversion complete: ${obsidianNotes.size} notes created`);
        console.log('Stats:', this.conversionStats);

        return obsidianNotes;
    }

    /**
     * Convert a single content group to Obsidian markdown
     */
    convertSingleNote(group: ContentGroup, topic?: MNTopic): string {
        const note = group.masterNote;
        if (!note) return '';

        // Generate title
        const title = this.generateNoteTitle(note, topic);

        // Generate content sections
        const contentSections: string[] = [];

        // Highlights section
        if (note.excerptText && this.config.contentSections.highlights) {
            contentSections.push(this.formatHighlightsSection(note));
        }

        // Notes section
        if (note.notesText && this.config.contentSections.notes) {
            contentSections.push(this.formatNotesSection(note));
        }

        // Additional formatted text
        if (note.formattedText.length > 0) {
            contentSections.push(this.formatAdditionalText(note.formattedText));
        }

        // Tags section
        if (note.hashtags.length > 0 && this.config.contentSections.tags) {
            contentSections.push(this.formatTagsSection(note.hashtags));
        }

        // Links section
        if (note.internalLinks.length > 0 && this.config.contentSections.links) {
            contentSections.push(this.formatLinksSection(note.internalLinks));
        }

        // Media section
        if (note.mediaAttachments.length > 0 && this.config.contentSections.media) {
            contentSections.push(this.formatMediaSection(note.mediaAttachments));
        }

        // Combine content
        const content = contentSections.filter(section => section.trim()).join('\n\n');

        // Generate metadata
        let metadata = '';
        if (this.config.metadataSection) {
            metadata = this.formatMetadataSection(note, topic, group);
        }

        // Apply template
        const markdown = this.config.noteTemplate
            .replace('{title}', title)
            .replace('{content}', content)
            .replace('{metadata}', metadata);

        return markdown.trim();
    }

    /**
     * Generate appropriate title for the note
     */
    private generateNoteTitle(note: MNBookNote, topic?: MNTopic): string {
        // Priority: Note title > First hashtag > Excerpt text > Topic name > Note ID

        if (note.noteTitle) {
            return this.cleanTitle(note.noteTitle);
        }

        if (note.hashtags.length > 0) {
            return this.cleanTitle(note.hashtags[0]);
        }

        if (note.excerptText) {
            // Use first line or first 50 characters
            const firstLine = note.excerptText.split('\n')[0].trim();
            if (firstLine.length > 50) {
                return this.cleanTitle(firstLine.substring(0, 47) + "...");
            }
            return this.cleanTitle(firstLine);
        }

        if (topic && topic.title) {
            return `${this.cleanTitle(topic.title)} - Extract`;
        }

        return `Note ${note.noteId.substring(0, 8)}`;
    }

    /**
     * Clean title for Obsidian compatibility
     */
    private cleanTitle(title: string): string {
        // Remove invalid characters for filenames
        let cleaned = title.replace(/[<>:"/\\|?*]/g, '');
        
        // Remove hashtag prefix if present
        cleaned = cleaned.replace(/^[#＃]+/, '').trim();
        
        // Limit length
        if (cleaned.length > 100) {
            cleaned = cleaned.substring(0, 97) + "...";
        }
        
        return cleaned || "Untitled Note";
    }

    /**
     * Format highlights section
     */
    private formatHighlightsSection(note: MNBookNote): string {
        const content: string[] = [];
        content.push("## Highlights");
        content.push("");

        // Main highlight text
        if (note.excerptText) {
            // Format as blockquote
            const highlightLines = note.excerptText.trim().split('\n');
            for (const line of highlightLines) {
                if (line.trim()) {
                    content.push(`> ${line}`);
                }
            }
            content.push("");
        }

        // Coordinate information if available and enabled
        if (this.config.includeCoordinates && 
            this.config.contentSections.coordinates && 
            note.excerptPic) {
            const coordInfo = this.formatCoordinateInfo(note);
            if (coordInfo) {
                content.push(coordInfo);
                content.push("");
            }
        }

        return content.join('\n');
    }

    /**
     * Format notes section
     */
    private formatNotesSection(note: MNBookNote): string {
        const content: string[] = [];
        content.push("## Notes");
        content.push("");

        // Process notes text for features
        const notesFeatures = this.textProcessor.extractContentFeatures(note.notesText || '');

        // Format the text appropriately
        if (notesFeatures.otherText.length > 0) {
            const formattedText = this.textProcessor.formatAsList(notesFeatures.otherText);
            content.push(formattedText);
        }

        return content.join('\n');
    }

    /**
     * Format additional formatted text
     */
    private formatAdditionalText(formattedText: string[]): string {
        if (formattedText.length === 0) return '';

        const content: string[] = [];
        content.push("## Additional Content");
        content.push("");

        // Check if it's a list
        if (this.textProcessor.isBulletedList(formattedText)) {
            content.push(...formattedText);
        } else {
            // Join as paragraphs
            for (const text of formattedText) {
                if (text.trim()) {
                    content.push(text.trim());
                    content.push("");
                }
            }
        }

        return content.join('\n');
    }

    /**
     * Format tags section
     */
    private formatTagsSection(hashtags: string[]): string {
        if (hashtags.length === 0) return '';

        // Convert to Obsidian tag format
        const obsidianTags: string[] = [];
        for (const tag of hashtags) {
            // Clean and format tag
            const cleanTag = tag.replace(/[^\w\-_]/g, '');
            if (cleanTag) {
                const formattedTag = this.config.hashtagFormat.replace('{tag}', cleanTag);
                obsidianTags.push(formattedTag);
                this.conversionStats.hashtagsProcessed++;
            }
        }

        if (obsidianTags.length > 0) {
            return `**Tags:** ${obsidianTags.join(' ')}`;
        }

        return '';
    }

    /**
     * Format internal links section
     */
    private formatLinksSection(internalLinks: string[]): string {
        if (internalLinks.length === 0) return '';

        const content: string[] = [];
        content.push("## Related Notes");
        content.push("");

        for (const link of internalLinks) {
            // Format as Obsidian link
            const obsidianLink = this.config.linkFormat.replace('{note_id}', link);
            content.push(`- ${obsidianLink}`);
            this.conversionStats.linksProcessed++;
        }

        return content.join('\n');
    }

    /**
     * Format media attachments section
     */
    private formatMediaSection(mediaAttachments: MNMediaAttachment[]): string {
        if (mediaAttachments.length === 0) return '';

        const content: string[] = [];
        content.push("## Media");
        content.push("");

        for (const media of mediaAttachments) {
            if (media.hasMediaData()) {
                if (media.isImage()) {
                    // Embed image if possible
                    if (this.config.includeMediaReferences) {
                        const altText = `Image ${media.mediaHash.substring(0, 8)}`;
                        if (media.mediaData && media.mediaData.toMarkdownImage) {
                            const markdownImg = media.mediaData.toMarkdownImage(altText);
                            if (markdownImg) {
                                content.push(markdownImg);
                                content.push("");
                                this.conversionStats.mediaIncluded++;
                                continue;
                            }
                        }
                    }

                    // Fallback to reference
                    content.push(`![Image](${media.mediaHash})`);
                } else if (media.isInkDrawing()) {
                    content.push(`🖊️ **Drawing:** \`${media.mediaHash}\``);
                } else {
                    content.push(`📎 **Attachment:** \`${media.mediaHash}\``);
                }
            } else {
                // Missing media reference
                content.push(`❓ **Missing Media:** \`${media.mediaHash}\``);
            }

            content.push("");
        }

        return content.join('\n');
    }

    /**
     * Format coordinate information
     */
    private formatCoordinateInfo(note: MNBookNote): string {
        if (!note.excerptPic) return '';

        const coordParts: string[] = [];

        if (note.startPage !== undefined) {
            if (note.endPage && note.endPage !== note.startPage) {
                coordParts.push(`Pages ${note.startPage}-${note.endPage}`);
            } else {
                coordParts.push(`Page ${note.startPage}`);
            }
        }

        if (note.excerptPic.rect) {
            const rect = note.excerptPic.rect;
            coordParts.push(`Position: (${Math.round(rect.x)}, ${Math.round(rect.y)})`);
        }

        if (coordParts.length > 0) {
            return `**Location:** ${coordParts.join(' | ')}`;
        }

        return '';
    }

    /**
     * Format metadata section
     */
    private formatMetadataSection(note: MNBookNote, topic?: MNTopic, group?: ContentGroup): string {
        const metadataLines: string[] = [];
        metadataLines.push("---");
        metadataLines.push("## Metadata");
        metadataLines.push("");

        // Basic info
        metadataLines.push(`**Note ID:** \`${note.noteId}\``);

        if (topic) {
            metadataLines.push(`**Source:** ${topic.title}`);
            metadataLines.push(`**Type:** ${topic.topicType.toString().replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
        }

        // Dates
        if (note.highlightDate) {
            const dateStr = this.formatDate(note.highlightDate);
            metadataLines.push(`**Highlighted:** ${dateStr}`);
        }

        if (note.noteDate) {
            const dateStr = this.formatDate(note.noteDate);
            metadataLines.push(`**Created:** ${dateStr}`);
        }

        // Content info
        if (group && group.groupType !== "unknown") {
            const groupType = group.groupType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            metadataLines.push(`**Category:** ${groupType}`);
        }

        if (note.author) {
            metadataLines.push(`**Author:** ${note.author}`);
        }

        // Statistics
        if (note.hashtags.length > 0) {
            metadataLines.push(`**Tags:** ${note.hashtags.length}`);
        }

        if (note.internalLinks.length > 0) {
            metadataLines.push(`**Links:** ${note.internalLinks.length}`);
        }

        if (note.mediaAttachments.length > 0) {
            metadataLines.push(`**Media:** ${note.mediaAttachments.length}`);
        }

        metadataLines.push("");
        metadataLines.push("---");

        return metadataLines.join('\n');
    }

    /**
     * Format date according to configuration
     */
    private formatDate(date: Date): string {
        // Simple date formatting - in a real implementation you might use a date library
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Generate appropriate filename for the note
     */
    generateFilename(note: MNBookNote, topic?: MNTopic): string {
        const title = this.generateNoteTitle(note, topic);

        // Clean filename
        let safeFilename = title.replace(/[<>:"/\\|?*]/g, '');
        safeFilename = safeFilename.trim();

        // Limit length
        if (safeFilename.length > 100) {
            safeFilename = safeFilename.substring(0, 97) + "...";
        }

        // Ensure unique filename by appending note ID if needed
        if (safeFilename.length < 3) {
            safeFilename = `Note_${note.noteId.substring(0, 8)}`;
        }

        return `${safeFilename}.md`;
    }

    /**
     * Get detailed conversion report
     */
    getConversionReport(): ConversionReport {
        const successRate = this.conversionStats.notesConverted > 0 ? 
            (this.conversionStats.notesConverted - this.conversionStats.errors) / this.conversionStats.notesConverted : 0;

        return {
            statistics: { ...this.conversionStats },
            configUsed: { ...this.config },
            successRate
        };
    }
}

/**
 * Convenience function to convert content groups to Obsidian format
 */
export function convertToObsidian(
    contentGroups: ContentGroup[], 
    topics: Map<string, MNTopic>,
    config?: Partial<ObsidianConfig>
): Map<string, string> {
    const converter = new ObsidianConverter(config);
    return converter.convertContentGroups(contentGroups, topics);
}