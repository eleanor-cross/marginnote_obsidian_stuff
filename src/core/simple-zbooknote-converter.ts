/**
 * Simple ZBOOKNOTE Converter
 * Title = ZNOTEID, Content = Full MbBookNotes_for_export object
 */

import { DatabaseData } from './margin-note-importer';

export interface SimpleConversionOptions {
  outputDirectory: string;
  vaultAdapter?: any;
}

export interface ConversionResult {
  success: boolean;
  notesCreated: number;
  errors: string[];
  outputFiles: string[];
}

export class SimpleZBookNoteConverter {
  private options: SimpleConversionOptions;
  
  constructor(options: SimpleConversionOptions) {
    this.options = options;
  }
  
  async convertFromData(databaseData: DatabaseData): Promise<ConversionResult> {
    const result: ConversionResult = {
      success: false,
      notesCreated: 0,
      errors: [],
      outputFiles: []
    };
    
    try {
      console.log('Starting Simple ZBOOKNOTE Conversion...');
      console.log(`Total ZBOOKNOTE rows: ${databaseData.booknotes.length}`);
      
      // Create output directory
      await this.ensureDirectory(this.options.outputDirectory);
      
      // Process each ZBOOKNOTE row
      for (let i = 0; i < databaseData.booknotes.length; i++) {
        const row = databaseData.booknotes[i];
        
        try {
          // Create MbBookNotes_for_export object for this row
          const mbBookNote = this.createMbBookNoteForExport(row);
          
          // Write file with ZNOTEID as title
          const filename = await this.writeNoteFile(mbBookNote, i);
          result.outputFiles.push(filename);
          result.notesCreated++;
          
          console.log(`Created: ${filename}`);
        } catch (error) {
          const errorMsg = `Failed to process row ${i}: ${error}`;
          console.warn(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      // Create simple index
      await this.createIndexFile(databaseData.booknotes);
      
      result.success = result.notesCreated > 0;
      console.log(`Conversion completed: ${result.notesCreated} notes created`);
      
    } catch (error) {
      const errorMsg = `Conversion failed: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    return result;
  }
  
  /**
   * Create MbBookNotes_for_export object from ZBOOKNOTE row
   */
  private createMbBookNoteForExport(row: any): any {
    // Decode notes and highlights
    const notes = this.decodeNotes(row);
    const highlights = this.decodeHighlights(row);
    
    // Extract linked notes
    const linkedNotes = notes
      .filter((note: any) => note?.type === 'LinkNote' && 'noteid' in note)
      .map((note: any) => ({
        summary: 0,
        noteid: note.noteid,
        linktext: note.q_htext
      }));

    // Extract child note IDs
    const childNotes = notes
      .filter((note: any) => note && 'noteid' in note)
      .map((note: any) => note.noteid);

    // Extract text highlights
    const textHighlight = highlights
      .map((hi: any) => ({
        highlight_text: hi.highlight_text || '',
        coords_hash: hi.coords_hash || '',
        maskList: null,
        textSelLst: hi.textSelLst || []
      }));
    
    // Return complete MbBookNotes_for_export structure - EXACTLY like working_export.ts lines 190-338
    return {
      excerptText: row.ZHIGHLIGHT_TEXT,
      noteTitle: row.ZTITLE,
      colorIndex: row.ZHIGHLIGHT_STYLE,
      fillIndex: null,
      mindmapPosition: row.ZMINDPOS,
      noteId: row.ZNOTEID,
      docMd5: row.ZBOOKMD5,
      notebookId: row.ZTOPICID,
      startPage: row.ZSTARTPAGE,
      endPage: row.ZENDPAGE,
      startPos: row.ZSTARTPOS,
      endPos: row.ZENDPOS,
      excerptPic: row.ZHIGHLIGHT_PIC_D,
      createDate: row.ZHIGHLIGHT_DATE,
      modifiedDate: row.ZNOTE_DATE,
      mediaList: row.ZMEDIA_LIST,
      originNoteId: row.ZEVERNOTEID,
      mindmapBranchClose: row.ZMINDCLOSE,
      notesText: row.ZNOTES_TEXT,
      groupNoteId: row.ZGROUPNOTEID,
      realGroupNoteIdForTopicId: null,
      comments: null,
      parentNote: row.ZGROUPNOTEID,
      linkedNotes,
      childNotes,
      summaryLinks: null,
      zLevel: row.ZZINDEX,
      hidden: null,
      toc: null,
      annotation: null,
      textFirst: null,
      groupMode: null,
      flashcard: null,
      summary: null,
      flagged: null,
      textHighlight
    };
  }
  
  /**
   * Decode notes from ZBOOKNOTE row
   */
  private decodeNotes(row: any): any[] {
    try {
      if (row.ZNOTES_DECODE) {
        const parsed = JSON.parse(row.ZNOTES_DECODE);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      // Handle parse error
    }
    return [];
  }
  
  /**
   * Decode highlights from ZBOOKNOTE row
   */
  private decodeHighlights(row: any): any[] {
    try {
      if (row.ZHIGHLIGHTS_DECODE) {
        const parsed = JSON.parse(row.ZHIGHLIGHTS_DECODE);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      // Handle parse error
    }
    return [];
  }
  
  /**
   * Write note file with ZNOTEID as title and full MbBookNote object as content
   * Format matches working_export.ts exactly
   */
  private async writeNoteFile(mbBookNote: any, index: number): Promise<string> {
    // Use ZNOTEID as the title and filename - no fallback, use exact value
    const noteId = mbBookNote.noteId;
    const filename = this.sanitizeFileName(noteId) + '.md';
    
    // Create markdown content with YAML frontmatter
    const frontmatterEntries = Object.entries(mbBookNote)
      .map(([key, value]) => {
        // Handle special values for YAML
        if (value === null) return `${key}: null`;
        if (value === undefined) return `${key}: null`;
        if (Array.isArray(value)) {
          if (value.length === 0) return `${key}: []`;
          return `${key}: [${value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(', ')}]`;
        }
        if (typeof value === 'string') {
          // Escape quotes and handle multiline strings
          const escapedValue = value.replace(/"/g, '\\"');
          if (value.includes('\n')) {
            return `${key}: |\n  ${escapedValue.split('\n').join('\n  ')}`;
          }
          return `${key}: "${escapedValue}"`;
        }
        return `${key}: ${value}`;
      });
    
    const frontmatter = frontmatterEntries.join('\n');
    
    // Create full markdown with YAML frontmatter
    const noteTitle = mbBookNote.noteTitle || mbBookNote.excerptText || 'Untitled';
    const content = `---
${frontmatter}
---

# ${noteTitle}

**Note ID:** ${mbBookNote.noteId}
**Excerpt:** ${mbBookNote.excerptText || 'No excerpt'}
**Notes:** ${mbBookNote.notesText || 'No notes'}`;

    const fullPath = `${this.options.outputDirectory}/${filename}`;
    
    if (this.options.vaultAdapter) {
      await this.options.vaultAdapter.write(fullPath, content);
    } else {
      const fs = require('fs');
      const path = require('path');
      const systemPath = path.join(this.options.outputDirectory, filename);
      fs.writeFileSync(systemPath, content, 'utf-8');
    }
    
    return filename;
  }
  
  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '_');
  }
  
  /**
   * Create index file
   */
  private async createIndexFile(zbooknoteRows: any[]): Promise<void> {
    const lines: string[] = [];
    
    lines.push('# ZBOOKNOTE Index');
    lines.push('');
    lines.push(`Generated on: ${new Date().toISOString()}`);
    lines.push(`Total notes: ${zbooknoteRows.length}`);
    lines.push('');
    lines.push('## All Notes (by ZNOTEID)');
    lines.push('');
    
    for (const row of zbooknoteRows) {
      const noteId = row.ZNOTEID || 'UNKNOWN';
      const filename = `${noteId}.md`;
      const preview = row.ZHIGHLIGHT_TEXT || row.ZNOTETITLE || 'No preview';
      
      lines.push(`- [[${filename}|${noteId}]]`);
      lines.push(`  > ${preview.substring(0, 100)}${preview.length > 100 ? '...' : ''}`);
    }
    
    lines.push('');
    lines.push('---');
    lines.push('*Each note title is its ZNOTEID with complete MbBookNotes_for_export data*');
    
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
  
  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    if (this.options.vaultAdapter) {
      if (!(await this.options.vaultAdapter.exists(dirPath))) {
        await this.options.vaultAdapter.mkdir(dirPath);
        console.log(`Created vault directory: ${dirPath}`);
      }
    } else {
      const fs = require('fs');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      }
    }
  }
}