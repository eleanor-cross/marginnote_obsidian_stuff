/**
 * MarginNote4-Obsidian Import Processor
 * 
 * Main orchestrator that handles the complete import process:
 * .marginpkg → Extraction → Processing → Deduplication → Obsidian Markdown
 * 
 * Converted from Python to TypeScript for full JavaScript compatibility.
 */

import { extractContentFromDatabase } from './content-extractor';
import { deduplicateContent } from './deduplicator';
import { convertToObsidian, ObsidianConverter, ObsidianConfig } from './obsidian-converter';
import { ContentGroup, MNTopic } from '../models/types';

export interface ImportConfig {
    outputDirectory: string;
    createSubdirectories: boolean;
    preserveStructure: boolean;
    strictDecoding: boolean;
    includeMetadata: boolean;
    includeMedia: boolean;
    includeCoordinates: boolean;
    skipEmptyNotes: boolean;
    obsidianConfig: Partial<ObsidianConfig>;
}

export interface ImportStatistics {
    startTime: Date;
    endTime?: Date;
    filesProcessed: number;
    notesImported: number;
    errors: number;
    warnings: number;
}

export interface ImportResult {
    success: boolean;
    outputDirectory?: string;
    notesCreated?: number;
    statistics: ImportStatistics;
    importReport?: ImportReport;
    error?: string;
}

export interface ImportReport {
    importSummary: {
        timestamp: string;
        durationSeconds?: number;
        success: boolean;
        notesCreated: number;
        warnings: number;
        errors: number;
    };
    sourceData: {
        totalBooknotes: number;
        totalTopics: number;
        totalMedia: number;
    };
    processingStatistics: any;
    deduplicationReport: any;
    outputFiles: string[];
    configuration: ImportConfig;
}

export interface DatabaseData {
    booknotes: any[];
    topics: any[];
    media: any[];
}

/**
 * Main importer class that orchestrates the complete import process
 */
export class MarginNoteImporter {
    private config: ImportConfig;
    private importStats: ImportStatistics;

    constructor(config?: Partial<ImportConfig>) {
        this.config = { ...this.getDefaultConfig(), ...config };
        this.importStats = {
            startTime: new Date(),
            filesProcessed: 0,
            notesImported: 0,
            errors: 0,
            warnings: 0
        };
    }

    /**
     * Get default configuration for import process
     */
    private getDefaultConfig(): ImportConfig {
        return {
            outputDirectory: "./obsidian_import",
            createSubdirectories: true,
            preserveStructure: true,
            strictDecoding: false,
            includeMetadata: true,
            includeMedia: true,
            includeCoordinates: true,
            skipEmptyNotes: true,
            obsidianConfig: {
                noteTemplate: `# {title}

{content}

{metadata}`,
                includeCoordinates: true,
                includeMediaReferences: true,
                preserveHierarchy: true,
                linkFormat: "[[{note_id}]]",
                hashtagFormat: "#{tag}",
                dateFormat: "YYYY-MM-DD HH:mm:ss",
                metadataSection: true
            }
        };
    }

    /**
     * Import MarginNote database data to Obsidian format
     */
    async importMarginNoteData(
        databaseData: DatabaseData,
        outputDirectory?: string
    ): Promise<ImportResult> {
        this.importStats.startTime = new Date();
        console.log('Starting MarginNote import...');

        try {
            // Setup output directory
            if (outputDirectory) {
                this.config.outputDirectory = outputDirectory;
            }

            this.importStats.filesProcessed = 1;

            // Step 1: Extract and process content
            console.log("Step 1: Processing database content...");
            const extractionResult = extractContentFromDatabase(
                databaseData.booknotes,
                databaseData.topics,
                databaseData.media,
                this.config.strictDecoding
            );

            const contentGroups = extractionResult.contentGroups;
            const topics = extractionResult.topics;

            console.log(`Extracted ${contentGroups.length} content groups`);

            // Step 2: Deduplicate content
            console.log("Step 2: Deduplicating content...");
            const [deduplicatedGroups, dedupReport] = deduplicateContent(contentGroups);

            console.log(`Deduplicated to ${deduplicatedGroups.length} unique content groups`);

            // Step 3: Convert to Obsidian format
            console.log("Step 3: Converting to Obsidian markdown...");
            const obsidianNotes = convertToObsidian(
                deduplicatedGroups,
                topics,
                this.config.obsidianConfig
            );

            this.importStats.notesImported = obsidianNotes.size;

            // Step 4: Prepare output data
            console.log("Step 4: Preparing output data...");
            const outputFiles = this.prepareOutputFiles(
                obsidianNotes,
                deduplicatedGroups,
                topics
            );

            // Step 5: Generate import report
            const importReport = this.generateImportReport(
                extractionResult,
                dedupReport,
                outputFiles,
                databaseData
            );

            this.importStats.endTime = new Date();

            console.log('Import completed successfully!');
            console.log(`Generated ${outputFiles.length} Obsidian notes`);

            return {
                success: true,
                outputDirectory: this.config.outputDirectory,
                notesCreated: outputFiles.length,
                statistics: this.importStats,
                importReport
            };

        } catch (error) {
            this.importStats.errors++;
            this.importStats.endTime = new Date();

            console.error('Import failed:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                statistics: this.importStats
            };
        }
    }

    /**
     * Prepare output files data structure
     */
    prepareOutputFiles(
        obsidianNotes: Map<string, string>,
        contentGroups: ContentGroup[],
        topics: Map<string, MNTopic>
    ): Array<{ filename: string; content: string; path: string }> {
        const converter = new ObsidianConverter(this.config.obsidianConfig);
        const outputFiles: Array<{ filename: string; content: string; path: string }> = [];

        // Create group lookup for filename generation
        const groupLookup = new Map<string, ContentGroup>();
        for (const group of contentGroups) {
            groupLookup.set(group.masterNoteId, group);
        }

        for (const [noteId, markdownContent] of obsidianNotes) {
            try {
                // Skip empty notes if configured
                if (this.config.skipEmptyNotes && !markdownContent.trim()) {
                    continue;
                }

                // Generate filename
                const group = groupLookup.get(noteId);
                let filename: string;
                let subdirectory = '';

                if (group && group.masterNote) {
                    const topic = group.masterNote.topicId ? topics.get(group.masterNote.topicId) : undefined;
                    filename = converter.generateFilename(group.masterNote, topic);

                    // Create subdirectory structure if enabled
                    if (this.config.createSubdirectories && topic) {
                        subdirectory = topic.topicType.toString().replace('_', '-');
                    }
                } else {
                    filename = `note_${noteId.substring(0, 8)}.md`;
                }

                // Determine full path
                const path = subdirectory ? `${subdirectory}/${filename}` : filename;

                outputFiles.push({
                    filename,
                    content: markdownContent,
                    path
                });

            } catch (error) {
                console.warn(`Failed to prepare output for note ${noteId}:`, error);
                this.importStats.warnings++;
            }
        }

        return outputFiles;
    }

    /**
     * Generate comprehensive import report
     */
    private generateImportReport(
        extractionResult: any,
        dedupReport: any,
        outputFiles: Array<{ filename: string; content: string; path: string }>,
        databaseData: DatabaseData
    ): ImportReport {
        let duration: number | undefined;
        if (this.importStats.endTime) {
            duration = (this.importStats.endTime.getTime() - this.importStats.startTime.getTime()) / 1000;
        }

        return {
            importSummary: {
                timestamp: new Date().toISOString(),
                durationSeconds: duration,
                success: this.importStats.errors === 0,
                notesCreated: outputFiles.length,
                warnings: this.importStats.warnings,
                errors: this.importStats.errors
            },
            sourceData: {
                totalBooknotes: databaseData.booknotes.length,
                totalTopics: databaseData.topics.length,
                totalMedia: databaseData.media.length
            },
            processingStatistics: extractionResult.statistics,
            deduplicationReport: dedupReport,
            outputFiles: outputFiles.map(f => f.path),
            configuration: this.config
        };
    }

    /**
     * Get current import statistics
     */
    getStatistics(): ImportStatistics {
        return { ...this.importStats };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ImportConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}

/**
 * Convenience function for quick imports
 */
export async function importMarginNoteDatabase(
    databaseData: DatabaseData,
    config?: Partial<ImportConfig>
): Promise<ImportResult> {
    const importer = new MarginNoteImporter(config);
    return await importer.importMarginNoteData(databaseData);
}

/**
 * Create default import configuration
 */
export function createDefaultImportConfig(): ImportConfig {
    return new MarginNoteImporter().getStatistics() as any;
}

// Types are already exported above