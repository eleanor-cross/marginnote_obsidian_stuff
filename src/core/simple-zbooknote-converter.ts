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
  outputFolder?: string;
}

export class SimpleZBookNoteConverter {
  private options: SimpleConversionOptions;
  private currentData: DatabaseData | null = null;
  
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
      
      // Store reference to current data for access in other methods
      this.currentData = databaseData;
      
      // Extract project name from ZMEDIA or ZTOPIC
      const projectName = this.extractProjectName(databaseData);
      console.log(`Project name: ${projectName}`);
      
      // Use project name as output directory
      const outputDir = projectName || this.options.outputDirectory;
      
      // Create output directory
      await this.ensureDirectory(outputDir);
      
      // Process each ZBOOKNOTE row
      for (let i = 0; i < databaseData.booknotes.length; i++) {
        const row = databaseData.booknotes[i];
        
        try {
          // Create MbBookNotes_for_export object for this row
          const mbBookNote = this.createMbBookNoteForExport(row);
          
          // Write file with ZNOTEID as title
          const filename = await this.writeNoteFile(mbBookNote, i, outputDir);
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
      await this.createIndexFile(databaseData.booknotes, outputDir);
      
      result.success = result.notesCreated > 0;
      result.outputFolder = outputDir;
      console.log(`Conversion completed: ${result.notesCreated} notes created in ${outputDir}`);
      
    } catch (error) {
      const errorMsg = `Conversion failed: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    return result;
  }
  
  /**
   * Extract project name from database data
   */
  private extractProjectName(databaseData: DatabaseData): string | null {
    try {
      // First try to find project name from ZMEDIA
      if (databaseData.media && databaseData.media.length > 0) {
        // Look for ZMEDIA row that has ZMINDLINKS (indicates it's a project)
        for (const mediaRow of databaseData.media) {
          if (mediaRow.ZMINDLINKS && mediaRow.ZTITLE) {
            console.log(`Found project in ZMEDIA: ${mediaRow.ZTITLE}`);
            return this.sanitizeFileName(mediaRow.ZTITLE);
          }
        }
      }
      
      // If not found in ZMEDIA, try ZTOPIC table
      if (databaseData.topics && databaseData.topics.length > 0) {
        // Look for project topics (ones with ZMINDLINKS or marked as projects in ZFORUMOWNER)
        for (const topicRow of databaseData.topics) {
          if (topicRow.ZTITLE) {
            // Check if it's a project topic (has mindmap links or is not a book/review topic)
            if (topicRow.ZMINDLINKS || (topicRow.ZFORUMOWNER && !topicRow.ZFORUMOWNER.includes('"reviewDecks"'))) {
              console.log(`Found project in ZTOPIC: ${topicRow.ZTITLE}`);
              return this.sanitizeFileName(topicRow.ZTITLE);
            }
          }
        }
      }
      
      console.log('No project name found in database');
      return null;
    } catch (error) {
      console.error('Error extracting project name:', error);
      return null;
    }
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
   * Helper methods for NSKeyedArchiver decoding (copied from working_export.ts)
   */
  private isNSKeyedArchive(data: any): boolean {
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

  /**
   * Decode highlights from ZBOOKNOTE row
   */
  private decodeHighlights(row: any): any[] {
    try {
      // First try the existing ZHIGHLIGHTS_DECODE field
      if (row.ZHIGHLIGHTS_DECODE) {
        const parsed = JSON.parse(row.ZHIGHLIGHTS_DECODE);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      // If that's not available, decode directly from ZHIGHLIGHTS using our decoder
      if (row.ZHIGHLIGHTS) {
        // Use the same decoding approach as working_export.ts
        const bplist = require('bplist-parser');
        const parsed = bplist.parseBuffer(row.ZHIGHLIGHTS);
        
        if (parsed && parsed.length > 0) {
          const archive = parsed[0];
          if (this.isNSKeyedArchive(archive)) {
            const resolved = this.resolveUIDs(archive.$top.root, archive.$objects);
            const simplified = this.simplifyNSArchive(resolved);
            const highlights = Array.isArray(simplified) ? simplified : [simplified];
            
            // Convert to the expected format, extracting actual highlight text
            return highlights.map((highlight: any) => ({
              highlight_text: highlight.highlight_text?.['NS.string'] || highlight.highlight_text || '',
              coords_hash: highlight.coords_hash || '',
              maskList: null,
              textSelLst: highlight.textSelLst || []
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Failed to decode highlights:', e);
    }
    return [];
  }
  
  /**
   * Write note file with ZNOTEID as title and full MbBookNote object as content
   * Format matches working_export.ts exactly
   */
  private async writeNoteFile(mbBookNote: any, index: number, outputDir: string): Promise<string> {
    // Use ZNOTEID as the title and filename - no fallback, use exact value
    const noteId = mbBookNote.noteId;
    const filename = this.sanitizeFileName(noteId) + '.md';
    
    // Create markdown content with flattened YAML frontmatter
    const frontmatterEntries = Object.entries(mbBookNote)
      .flatMap(([key, value]) => {
        // Handle special values for YAML
        if (value === null || value === undefined) {
          return [`${key}: null`];
        }
        
        // Special handling for textHighlight arrays
        if (key === 'textHighlight' && Array.isArray(value)) {
          if (value.length === 0) {
            return [
              'textHighlight_highlight_text: ""',
              'textHighlight_coords_hash: ""',
              'textHighlight_maskList: ""',
              'textHighlight_textSelLst: ""'
            ];
          }
          
          // Extract values from each item in the array
          const highlightTexts: string[] = [];
          const coordsHashes: string[] = [];
          const maskLists: string[] = [];
          const textSelLsts: string[] = [];
          
          value.forEach((item) => {
            if (typeof item === 'object' && item !== null) {
              highlightTexts.push(item.highlight_text || '');
              coordsHashes.push(item.coords_hash || '');
              maskLists.push(item.maskList || '');
              textSelLsts.push(item.textSelLst ? JSON.stringify(item.textSelLst) : '');
            }
          });
          
          return [
            `textHighlight_highlight_text: "${highlightTexts.join(', ').replace(/"/g, '\\"')}"`,
            `textHighlight_coords_hash: "${coordsHashes.join(', ').replace(/"/g, '\\"')}"`,
            `textHighlight_maskList: "${maskLists.join(', ').replace(/"/g, '\\"')}"`,
            `textHighlight_textSelLst: "${textSelLsts.join(', ').replace(/"/g, '\\"')}"`
          ];
        }
        
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return [`${key}: []`];
          }
          
          // For arrays of objects, flatten each object with indexed keys
          if (value.some(v => typeof v === 'object' && v !== null)) {
            const flatEntries: string[] = [];
            value.forEach((item, index) => {
              if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([subKey, subValue]) => {
                  const flatKey = `${key}.${index}.${subKey}`;
                  if (typeof subValue === 'string') {
                    flatEntries.push(`${flatKey}: "${String(subValue).replace(/"/g, '\\"')}"`);
                  } else {
                    flatEntries.push(`${flatKey}: ${subValue}`);
                  }
                });
              } else {
                flatEntries.push(`${key}.${index}: "${String(item).replace(/"/g, '\\"')}"`);
              }
            });
            return flatEntries;
          } else {
            // Simple array of primitives
            return [`${key}: [${value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(', ')}]`];
          }
        }
        
        if (typeof value === 'object' && value !== null) {
          // Flatten nested objects
          return Object.entries(value).map(([subKey, subValue]) => {
            const flatKey = `${key}.${subKey}`;
            if (typeof subValue === 'string') {
              return `${flatKey}: "${String(subValue).replace(/"/g, '\\"')}"`;
            } else {
              return `${flatKey}: ${subValue}`;
            }
          });
        }
        
        if (typeof value === 'string') {
          // Escape quotes and handle multiline strings
          const escapedValue = value.replace(/"/g, '\\"');
          if (value.includes('\n')) {
            return [`${key}: |\n  ${escapedValue.split('\n').join('\n  ')}`];
          }
          return [`${key}: "${escapedValue}"`];
        }
        
        return [`${key}: ${value}`];
      });
    
    const frontmatter = frontmatterEntries.join('\n');
    
    // Create enhanced markdown with decoded content
    const noteTitle = mbBookNote.noteTitle || mbBookNote.excerptText || 'Untitled';
    
    // Extract additional decoded content
    const row = this.getCurrentRow(mbBookNote.noteId);
    const hashtags = row?.ZNOTES_HASHTAGS || '';
    const links = row?.ZNOTES_LINKS || '';
    const formattedText = row?.ZNOTES_FORMATTED_TEXT || '';
    const highlightText = row?.ZNOTES_HIGHLIGHT_TEXT || mbBookNote.excerptText;
    const coordinates = row?.ZHIGHLIGHTS_RECT || '';
    const pageNo = row?.ZHIGHLIGHTS_PAGE || mbBookNote.startPage;
    
    const content = `---
${frontmatter}
---

# ${noteTitle}

## Content

${highlightText ? `**Highlight:** ${highlightText}` : ''}

${formattedText ? `**Notes:** ${formattedText}` : ''}

${hashtags ? `**Tags:** ${hashtags}` : ''}

${links ? `**Links:** ${links}` : ''}

## Metadata

**Note ID:** ${mbBookNote.noteId}
**Page:** ${pageNo}
${coordinates ? `**Coordinates:** ${coordinates}` : ''}
**Created:** ${new Date(mbBookNote.createDate * 1000 + 978307200000).toISOString()}
**Modified:** ${new Date(mbBookNote.modifiedDate * 1000 + 978307200000).toISOString()}`;

    const fullPath = `${outputDir}/${filename}`;
    
    if (this.options.vaultAdapter) {
      await this.options.vaultAdapter.write(fullPath, content);
    } else {
      const fs = require('fs');
      const path = require('path');
      const systemPath = path.join(outputDir, filename);
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
   * Get current row data by note ID
   */
  private getCurrentRow(noteId: string): any {
    if (!this.currentData) return null;
    
    return this.currentData.booknotes.find(row => row.ZNOTEID === noteId);
  }
  
  /**
   * Create index file
   */
  private async createIndexFile(zbooknoteRows: any[], outputDir: string): Promise<void> {
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
    
    const indexPath = `${outputDir}/index.md`;
    const content = lines.join('\n');
    
    if (this.options.vaultAdapter) {
      await this.options.vaultAdapter.write(indexPath, content);
    } else {
      const fs = require('fs');
      const path = require('path');
      const systemPath = path.join(outputDir, 'index.md');
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