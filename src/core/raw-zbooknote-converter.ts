/**
 * Raw ZBOOKNOTE to Markdown Converter
 * Simply writes each ZBOOKNOTE row as a markdown file with dictionary data
 * No post-processing, no ID manipulation
 */

import { DatabaseData } from './margin-note-importer';

export interface RawConversionOptions {
  outputDirectory: string;
  createSubdirectories?: boolean;
  vaultAdapter?: any; // Obsidian vault adapter
}

export interface ConversionResult {
  success: boolean;
  notesCreated: number;
  errors: string[];
  outputFiles: string[];
}

export class RawZBookNoteConverter {
  private options: RawConversionOptions;
  
  constructor(options: RawConversionOptions) {
    this.options = {
      createSubdirectories: false,
      ...options
    };
  }
  
  /**
   * Convert database data to markdown notes - one per ZBOOKNOTE row
   */
  async convertFromData(databaseData: DatabaseData): Promise<ConversionResult> {
    const result: ConversionResult = {
      success: false,
      notesCreated: 0,
      errors: [],
      outputFiles: []
    };
    
    try {
      console.log('Starting Raw ZBOOKNOTE to Markdown conversion...');
      console.log(`Output Directory: ${this.options.outputDirectory}`);
      console.log(`Total ZBOOKNOTE rows: ${databaseData.booknotes.length}`);
      
      // Create output directory
      await this.ensureDirectory(this.options.outputDirectory);
      
      // Convert each ZBOOKNOTE row to markdown
      for (let i = 0; i < databaseData.booknotes.length; i++) {
        const zbooknoteRow = databaseData.booknotes[i];
        
        try {
          const outputPath = await this.writeRawNoteToFile(zbooknoteRow, i);
          result.outputFiles.push(outputPath);
          result.notesCreated++;
          
          console.log(`Created: ${outputPath}`);
        } catch (error) {
          const errorMsg = `Failed to write ZBOOKNOTE row ${i}: ${error}`;
          console.warn(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      // Create simple index file
      await this.createSimpleIndexFile(databaseData.booknotes);
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
   * Write a single ZBOOKNOTE row as markdown with raw dictionary data
   */
  private async writeRawNoteToFile(zbooknoteRow: any, index: number): Promise<string> {
    // Generate simple filename based on index and any available title/ID
    const noteId = zbooknoteRow.ZNOTEID || `row_${index}`;
    const title = zbooknoteRow.ZNOTETITLE || zbooknoteRow.ZHIGHLIGHT_TEXT || `ZBOOKNOTE Row ${index + 1}`;
    const safeTitle = this.sanitizeFilename(title);
    const filename = `${safeTitle}.md`;
    
    // Create markdown content with raw dictionary
    const lines: string[] = [];
    
    // Title
    lines.push(`# ${title}`);
    lines.push('');
    
    // Raw ZBOOKNOTE data as formatted dictionary
    lines.push('## Raw ZBOOKNOTE Data');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(zbooknoteRow, null, 2));
    lines.push('```');
    lines.push('');
    
    // Quick access to key fields
    lines.push('## Key Fields');
    lines.push('');
    if (zbooknoteRow.ZNOTEID) lines.push(`**Note ID:** ${zbooknoteRow.ZNOTEID}`);
    if (zbooknoteRow.ZHIGHLIGHT_TEXT) lines.push(`**Highlight:** ${zbooknoteRow.ZHIGHLIGHT_TEXT}`);
    if (zbooknoteRow.ZNOTES_TEXT) lines.push(`**Notes:** ${zbooknoteRow.ZNOTES_TEXT}`);
    if (zbooknoteRow.ZSTARTPAGE) lines.push(`**Page:** ${zbooknoteRow.ZSTARTPAGE}`);
    if (zbooknoteRow.ZTOPICID) lines.push(`**Topic ID:** ${zbooknoteRow.ZTOPICID}`);
    if (zbooknoteRow.ZTYPE) lines.push(`**Type:** ${zbooknoteRow.ZTYPE}`);
    lines.push('');
    
    lines.push('---');
    lines.push(`*Raw ZBOOKNOTE row ${index + 1} - No post-processing applied*`);
    
    const content = lines.join('\n');
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
   * Create simple index file listing all notes
   */
  private async createSimpleIndexFile(zbooknoteRows: any[]): Promise<void> {
    const lines: string[] = [];
    
    lines.push('# Raw ZBOOKNOTE Import Index');
    lines.push('');
    lines.push(`Generated on: ${new Date().toISOString()}`);
    lines.push(`Total ZBOOKNOTE rows: ${zbooknoteRows.length}`);
    lines.push('');
    lines.push('## All Notes (Raw Data)');
    lines.push('');
    
    for (let i = 0; i < zbooknoteRows.length; i++) {
      const row = zbooknoteRows[i];
      const title = row.ZNOTETITLE || row.ZHIGHLIGHT_TEXT || `ZBOOKNOTE Row ${i + 1}`;
      const safeTitle = this.sanitizeFilename(title);
      const filename = `${safeTitle}.md`;
      
      lines.push(`- [[${filename}|${title}]]`);
      if (row.ZHIGHLIGHT_TEXT && row.ZHIGHLIGHT_TEXT !== title) {
        const preview = row.ZHIGHLIGHT_TEXT.substring(0, 100);
        lines.push(`  > ${preview}${row.ZHIGHLIGHT_TEXT.length > 100 ? '...' : ''}`);
      }
    }
    
    lines.push('');
    lines.push('---');
    lines.push('*Raw ZBOOKNOTE data - No processing or ID manipulation*');
    
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
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(title: string): string {
    if (!title) return 'untitled';
    
    return title
      .replace(/[/\\\\:*?"<>|]/g, '-') // Replace invalid filename characters
      .replace(/\\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50) // Limit length
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      || 'untitled';
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
}