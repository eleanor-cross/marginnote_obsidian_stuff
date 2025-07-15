/**
 * MarginNote In-Memory Data to Markdown Converter
 * Works directly with database data objects instead of CSV files
 */

import { MbBookNote } from '../models/MbBookNote';
import { DatabaseData } from './margin-note-importer';

export interface MemoryConversionOptions {
  outputDirectory: string;
  createSubdirectories?: boolean;
  overwriteExisting?: boolean;
  vaultAdapter?: any; // Obsidian vault adapter
}

export interface ConversionResult {
  success: boolean;
  notesCreated: number;
  errors: string[];
  outputFiles: string[];
  statistics: any;
}

export class MarginNoteMemoryConverter {
  private options: MemoryConversionOptions;
  
  constructor(options: MemoryConversionOptions) {
    this.options = {
      createSubdirectories: true,
      overwriteExisting: true,
      ...options
    };
  }
  
  /**
   * Convert database data to markdown notes
   */
  async convertFromData(databaseData: DatabaseData): Promise<ConversionResult> {
    const result: ConversionResult = {
      success: false,
      notesCreated: 0,
      errors: [],
      outputFiles: [],
      statistics: {}
    };
    
    try {
      console.log('Starting MarginNote in-memory data to Markdown conversion...');
      console.log(`Output Directory: ${this.options.outputDirectory}`);
      
      // Generate statistics
      result.statistics = {
        totalBooknotes: databaseData.booknotes.length,
        totalTopics: databaseData.topics.length,
        totalMedia: databaseData.media.length,
        notesWithHighlights: databaseData.booknotes.filter(n => n.ZHIGHLIGHT_TEXT).length,
        notesWithNotes: databaseData.booknotes.filter(n => n.ZNOTES_TEXT).length,
        notesWithMedia: databaseData.booknotes.filter(n => n.ZMEDIA_LIST).length,
        notesWithLinkedNotes: databaseData.booknotes.filter(n => n.ZMINDLINKS).length
      };
      
      console.log('Database statistics:', result.statistics);
      
      // Create enhanced note data by joining with topics and media
      const enhancedNotes = this.enhanceNoteData(databaseData);
      
      // Convert to MbBookNote objects
      const bookNotes: MbBookNote[] = [];
      for (const rawNote of enhancedNotes) {
        try {
          const note = new MbBookNote(rawNote);
          bookNotes.push(note);
          console.log(`Created note: ${note.getDisplayTitle()} (${note.noteId})`);
        } catch (error) {
          console.warn(`Failed to process note:`, error);
          result.errors.push(`Failed to process note: ${error}`);
        }
      }
      
      if (bookNotes.length === 0) {
        result.errors.push('No book notes found in database data');
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
   * Enhance note data with topic and media information
   */
  private enhanceNoteData(databaseData: DatabaseData): any[] {
    console.log(`Processing ${databaseData.booknotes.length} book notes from database`);
    
    // Create topic lookup for faster access
    const topicLookup = new Map<string, any>();
    for (const topic of databaseData.topics) {
      const topicId = topic.ZTOPICID || topic.topicId || topic.Z_PK;
      if (topicId) {
        topicLookup.set(topicId.toString(), topic);
      }
    }
    
    // Create media lookup
    const mediaLookup = new Map<string, any>();
    for (const media of databaseData.media) {
      const mediaId = media.ZMD5 || media.md5 || media.Z_PK;
      if (mediaId) {
        mediaLookup.set(mediaId.toString(), media);
      }
    }
    
    const enhancedNotes: any[] = [];
    
    // Process each book note
    for (const rawNote of databaseData.booknotes) {
      try {
        // Enhance note data with topic and media information
        const enhanced = { ...rawNote };
        
        // Add topic information
        const topicId = rawNote.ZTOPICID || rawNote.topicId;
        if (topicId && topicLookup.has(topicId.toString())) {
          const topic = topicLookup.get(topicId.toString());
          enhanced.topicTitle = topic.ZTITLE || topic.title;
          enhanced.topicType = this.parseTopicTypeFromTopic(topic);
        }
        
        // Parse and enhance media list
        const mediaList = rawNote.ZMEDIA_LIST || rawNote.mediaList;
        if (mediaList && typeof mediaList === 'string') {
          const mediaIds = mediaList.split('-').filter(id => id.length > 0);
          enhanced.mediaObjects = [];
          
          for (const mediaId of mediaIds) {
            if (mediaLookup.has(mediaId)) {
              enhanced.mediaObjects.push(mediaLookup.get(mediaId));
            }
          }
        }
        
        enhancedNotes.push(enhanced);
      } catch (error) {
        console.warn(`Failed to enhance note:`, error);
      }
    }
    
    console.log(`Successfully enhanced ${enhancedNotes.length} notes`);
    return enhancedNotes;
  }
  
  /**
   * Parse topic type from topic data
   */
  private parseTopicTypeFromTopic(topic: any): string {
    // Check ZFORUMOWNER for topic type information
    const forumOwner = topic.ZFORUMOWNER || topic.forumOwner;
    if (forumOwner) {
      try {
        const parsed = JSON.parse(forumOwner);
        if (parsed.projectTopic) return 'project';
        if (parsed.bookTopic) return 'book';
        if (parsed.reviewTopic) return 'review';
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return 'general';
  }
  
  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    if (this.options.vaultAdapter) {
      // Use Obsidian vault adapter
      if (!(await this.options.vaultAdapter.exists(dirPath))) {
        await this.options.vaultAdapter.mkdir(dirPath);
        console.log(`Created vault directory: ${dirPath}`);
      }
    } else {
      // Fallback to file system
      const fs = require('fs');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      }
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
    // Determine subdirectory
    let subdir = '';
    if (this.options.createSubdirectories) {
      subdir = this.getSubdirectoryForNote(note);
    }
    
    // Generate filename
    const filename = note.getFilename();
    const relativePath = subdir ? `${subdir}/${filename}` : filename;
    const fullPath = `${this.options.outputDirectory}/${relativePath}`;
    
    if (this.options.vaultAdapter) {
      // Use Obsidian vault adapter
      const content = note.toMarkdown();
      
      // Check if file exists and handle overwrite
      if ((await this.options.vaultAdapter.exists(fullPath)) && !this.options.overwriteExisting) {
        const timestamp = Date.now();
        const nameWithoutExt = filename.replace(/\.md$/, '');
        const newFilename = `${nameWithoutExt}_${timestamp}.md`;
        const newRelativePath = subdir ? `${subdir}/${newFilename}` : newFilename;
        const newFullPath = `${this.options.outputDirectory}/${newRelativePath}`;
        
        await this.options.vaultAdapter.write(newFullPath, content);
        return newRelativePath;
      } else {
        await this.options.vaultAdapter.write(fullPath, content);
        return relativePath;
      }
    } else {
      // Fallback to file system
      const fs = require('fs');
      const path = require('path');
      const systemPath = path.join(this.options.outputDirectory, relativePath);
      
      // Check if file exists and handle overwrite
      if (fs.existsSync(systemPath) && !this.options.overwriteExisting) {
        const timestamp = Date.now();
        const nameWithoutExt = path.parse(filename).name;
        const ext = path.parse(filename).ext;
        const newFilename = `${nameWithoutExt}_${timestamp}${ext}`;
        const newSystemPath = path.join(this.options.outputDirectory, subdir, newFilename);
        const newRelativePath = subdir ? `${subdir}/${newFilename}` : newFilename;
        
        fs.writeFileSync(newSystemPath, note.toMarkdown(), 'utf-8');
        return newRelativePath;
      } else {
        fs.writeFileSync(systemPath, note.toMarkdown(), 'utf-8');
        return relativePath;
      }
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
    
    // Use note type from parsed type
    const noteType = note.topicType;
    if (noteType) {
      if (noteType.includes('flashcard')) return 'flashcard';
      if (noteType.includes('mindmap')) return 'mindmap';
    }
    
    return 'general';
  }
  
  /**
   * Create an index file with all notes
   */
  private async createIndexFile(notes: MbBookNote[]): Promise<void> {
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
    
    const indexPath = `${this.options.outputDirectory}/index.md`;
    const content = lines.join('\n');
    
    if (this.options.vaultAdapter) {
      await this.options.vaultAdapter.write(indexPath, content);
    } else {
      const fs = require('fs');
      const path = require('path');
      const systemPath = path.join(this.options.outputDirectory, 'index.md');
      fs.writeFileSync(systemPath, content, 'utf-8');
    }
  }
}