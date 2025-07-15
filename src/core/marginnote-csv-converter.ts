/**
 * MarginNote CSV to Markdown Converter
 * Reads CSV files and converts to MbBookNote objects, then writes markdown files
 */

import { MbBookNote } from '../models/MbBookNote';
import { MarginNoteDatabaseReader } from './marginnote-database-reader';
import { CSVParser } from '../utils/csv-parser';

export interface ConversionOptions {
  csvDirectory: string;
  outputDirectory: string;
  useModifiedCSV?: boolean;
  createSubdirectories?: boolean;
  overwriteExisting?: boolean;
}

export interface ConversionResult {
  success: boolean;
  notesCreated: number;
  errors: string[];
  outputFiles: string[];
  statistics: any;
}

export class MarginNoteCSVConverter {
  private options: ConversionOptions;
  
  constructor(options: ConversionOptions) {
    this.options = {
      useModifiedCSV: true,
      createSubdirectories: true,
      overwriteExisting: true,
      ...options
    };
  }
  
  /**
   * Convert CSV files to markdown notes
   */
  async convert(): Promise<ConversionResult> {
    const result: ConversionResult = {
      success: false,
      notesCreated: 0,
      errors: [],
      outputFiles: [],
      statistics: {}
    };
    
    try {
      console.log('Starting MarginNote CSV to Markdown conversion...');
      console.log(`CSV Directory: ${this.options.csvDirectory}`);
      console.log(`Output Directory: ${this.options.outputDirectory}`);
      
      // Load CSV files
      const databaseData = await this.loadCSVFiles();
      
      // Create database reader
      const reader = new MarginNoteDatabaseReader(databaseData);
      result.statistics = reader.getStatistics();
      
      console.log('Database statistics:', result.statistics);
      
      // Parse book notes
      const bookNotes = reader.parseBookNotes();
      
      if (bookNotes.length === 0) {
        result.errors.push('No book notes found in CSV files');
        return result;
      }
      
      // Create output directory
      await this.ensureDirectory(this.options.outputDirectory);
      
      // Create subdirectories if enabled
      if (this.options.createSubdirectories) {
        await this.createSubdirectories();
      }
      
      // Convert each note to markdown
      for (const note of bookNotes) {
        try {
          const outputPath = await this.writeNoteToFile(note);
          result.outputFiles.push(outputPath);
          result.notesCreated++;
          
          console.log(`Created: ${outputPath}`);
        } catch (error) {
          const errorMsg = `Failed to write note ${note.noteId}: ${error}`;
          console.warn(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      // Create index file
      await this.createIndexFile(bookNotes);
      result.outputFiles.push('index.md');
      
      result.success = result.notesCreated > 0;
      
      console.log(`Conversion completed: ${result.notesCreated} notes created, ${result.errors.length} errors`);
      
    } catch (error) {
      const errorMsg = `Conversion failed: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    return result;
  }
  
  /**
   * Load data from CSV files
   */
  private async loadCSVFiles(): Promise<any> {
    const fs = require('fs');
    const path = require('path');
    
    // Determine which CSV file to use for ZBOOKNOTE
    const booknoteCsvFile = this.options.useModifiedCSV ? 'ZBOOKNOTE_modfied.csv' : 'ZBOOKNOTE.csv';
    const booknoteFilePath = path.join(this.options.csvDirectory, booknoteCsvFile);
    
    if (!fs.existsSync(booknoteFilePath)) {
      throw new Error(`Book notes CSV file not found: ${booknoteFilePath}`);
    }
    
    console.log(`Loading book notes from: ${booknoteCsvFile}`);
    const booknotes = await CSVParser.loadFromFile(booknoteFilePath);
    console.log(`Loaded ${booknotes.length} book notes`);
    
    // Load topics
    const topicsFilePath = path.join(this.options.csvDirectory, 'ZTOPIC.csv');
    let topics: any[] = [];
    if (fs.existsSync(topicsFilePath)) {
      topics = await CSVParser.loadFromFile(topicsFilePath);
      console.log(`Loaded ${topics.length} topics`);
    } else {
      console.warn('Topics CSV file not found, proceeding without topic data');
    }
    
    // Load media
    const mediaFilePath = path.join(this.options.csvDirectory, 'ZMEDIA.csv');
    let media: any[] = [];
    if (fs.existsSync(mediaFilePath)) {
      media = await CSVParser.loadFromFile(mediaFilePath);
      console.log(`Loaded ${media.length} media items`);
    } else {
      console.warn('Media CSV file not found, proceeding without media data');
    }
    
    return {
      booknotes,
      topics,
      media
    };
  }
  
  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    const fs = require('fs');
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }
  
  /**
   * Create subdirectories for organization
   */
  private async createSubdirectories(): Promise<void> {
    const subdirs = ['project', 'book', 'review', 'general', 'mindmap', 'flashcard'];
    
    for (const subdir of subdirs) {
      const subdirPath = require('path').join(this.options.outputDirectory, subdir);
      await this.ensureDirectory(subdirPath);
    }
  }
  
  /**
   * Write a note to markdown file
   */
  private async writeNoteToFile(note: MbBookNote): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    
    // Determine subdirectory
    let subdir = '';
    if (this.options.createSubdirectories) {
      subdir = this.getSubdirectoryForNote(note);
    }
    
    // Generate filename
    const filename = note.getFilename();
    const fullPath = path.join(this.options.outputDirectory, subdir, filename);
    
    // Check if file exists and handle overwrite
    if (fs.existsSync(fullPath) && !this.options.overwriteExisting) {
      const timestamp = Date.now();
      const nameWithoutExt = path.parse(filename).name;
      const ext = path.parse(filename).ext;
      const newFilename = `${nameWithoutExt}_${timestamp}${ext}`;
      const newFullPath = path.join(this.options.outputDirectory, subdir, newFilename);
      
      fs.writeFileSync(newFullPath, note.toMarkdown(), 'utf-8');
      return path.join(subdir, newFilename);
    } else {
      fs.writeFileSync(fullPath, note.toMarkdown(), 'utf-8');
      return path.join(subdir, filename);
    }
  }
  
  /**
   * Determine subdirectory for a note based on its properties
   */
  private getSubdirectoryForNote(note: MbBookNote): string {
    // Use topic type if available
    if (note.topicType) {
      switch (note.topicType) {
        case 'project': return 'project';
        case 'book': return 'book';
        case 'review': return 'review';
        case 'mindmap': return 'mindmap';
        case 'flashcard': return 'flashcard';
      }
    }
    
    // Use note type from ZTYPE
    if (note.topicType) {
      if (note.topicType.includes('flashcard')) return 'flashcard';
      if (note.topicType.includes('mindmap')) return 'mindmap';
    }
    
    return 'general';
  }
  
  /**
   * Create an index file with all notes
   */
  private async createIndexFile(notes: MbBookNote[]): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    const lines: string[] = [];
    
    lines.push('# MarginNote Import Index');
    lines.push('');
    lines.push(`Generated on: ${new Date().toISOString()}`);
    lines.push(`Total notes: ${notes.length}`);
    lines.push('');
    
    // Group notes by type
    const groupedNotes = new Map<string, MbBookNote[]>();
    
    for (const note of notes) {
      const type = note.topicType || 'general';
      if (!groupedNotes.has(type)) {
        groupedNotes.set(type, []);
      }
      groupedNotes.get(type)!.push(note);
    }
    
    // Generate index by type
    for (const [type, typeNotes] of groupedNotes) {
      lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} (${typeNotes.length})`);
      lines.push('');
      
      for (const note of typeNotes) {
        const subdir = this.options.createSubdirectories ? this.getSubdirectoryForNote(note) : '';
        const linkPath = subdir ? `${subdir}/${note.getFilename()}` : note.getFilename();
        
        lines.push(`- [[${linkPath}|${note.getDisplayTitle()}]]`);
        if (note.excerptText) {
          const preview = note.excerptText.substring(0, 100);
          lines.push(`  > ${preview}${note.excerptText.length > 100 ? '...' : ''}`);
        }
      }
      lines.push('');
    }
    
    // Statistics
    lines.push('## Statistics');
    lines.push('');
    for (const [type, typeNotes] of groupedNotes) {
      lines.push(`- **${type}**: ${typeNotes.length} notes`);
    }
    lines.push('');
    
    lines.push('---');
    lines.push('*Generated by MarginNote-Obsidian Converter*');
    
    const indexPath = path.join(this.options.outputDirectory, 'index.md');
    fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  }
}