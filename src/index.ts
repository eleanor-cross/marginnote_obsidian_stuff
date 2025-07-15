/**
 * MarginNote4-Obsidian Import Tool - TypeScript Implementation
 * 
 * Complete TypeScript implementation for importing MarginNote4 .marginpkg files
 * into Obsidian. No external dependencies required.
 */

// Core processing components
export { MarginNoteImporter } from './core/margin-note-importer';
export { MarginNoteDatabaseParser, parseMarginPkgFile, isValidMarginPkgFile } from './core/database-parser';
export { ContentExtractor, extractContentFromDatabase } from './core/content-extractor';
export { NSKeyedArchiverDecoder } from './core/nskeyedarchiver-decoder';
export { ContentDeduplicator, deduplicateContent } from './core/deduplicator';
export { ObsidianConverter, convertToObsidian } from './core/obsidian-converter';

// Data models and types
export * from './models/types';

// Utilities
export { TextProcessor, processNoteText, isCJKText, cleanAndFormat } from './utils/text-utils';

// Type exports for configuration
export type {
    ImportConfig,
    ImportResult,
    ImportReport,
    DatabaseData
} from './core/margin-note-importer';

export type {
    ObsidianConfig,
    ConversionReport
} from './core/obsidian-converter';

export type {
    DeduplicationReport
} from './core/deduplicator';

export type {
    ExtractionResult,
    ExtractionStatistics
} from './core/content-extractor';

// Version information
export const VERSION = '1.0.0';
export const DESCRIPTION = 'Complete TypeScript implementation for MarginNote4-Obsidian integration';