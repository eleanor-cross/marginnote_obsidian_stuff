/**
 * MarginNote Book Note Model
 * Based on the MbBookNote specification for MarginNote 4
 */

export interface CGPoint {
  x: number;
  y: number;
}

export interface CGSize {
  width: number;
  height: number;
}

export interface ExcerptPic {
  paint?: string;
  size?: CGSize;
  selLst?: any[];
}

export interface NoteComment {
  text: string;
  html?: string;
  size?: CGSize;
  tag?: string;
}

export interface LinkedNote {
  summary: boolean;
  noteid: string;
  linktext: string;
}

export interface TextHighlight {
  highlight_text: string;
  coords_hash: string;
  maskList?: string[];
  textSelLst?: any[];
}

export class MbBookNote {
  // Basic note properties
  readonly noteId: string;
  readonly notebookId?: string;
  readonly docMd5?: string;
  excerptText?: string;
  noteTitle?: string;
  readonly notesText?: string;
  
  // Visual properties
  colorIndex: number = 0;
  fillIndex: number = 0;
  
  // Position and page information
  readonly startPage?: number;
  readonly endPage?: number;
  readonly startPos?: string;
  readonly endPos?: string;
  readonly mindmapPosition?: CGPoint;
  
  // Dates
  readonly createDate: Date;
  readonly modifiedDate?: Date;
  
  // Media and content
  readonly excerptPic?: ExcerptPic;
  readonly mediaList?: string;
  readonly textHighlight?: TextHighlight;
  
  // Hierarchy and relationships
  readonly groupNoteId?: string;
  readonly parentNote?: MbBookNote;
  readonly childNotes: MbBookNote[] = [];
  readonly linkedNotes: LinkedNote[] = [];
  readonly summaryLinks: string[] = [];
  
  // Other properties
  readonly zLevel?: number;
  readonly hidden?: boolean;
  readonly toc?: number;
  readonly annotation?: string;
  readonly textFirst?: boolean;
  readonly groupMode?: number;
  readonly flashcard?: number;
  readonly summary?: number;
  readonly flagged?: number;
  readonly comments: NoteComment[] = [];
  readonly options?: any;
  
  // Topic information
  readonly topicId?: string;
  readonly topicType?: string;

  constructor(data: any) {
    // Required fields
    this.noteId = data.ZNOTEID || data.noteId || '';
    this.createDate = this.parseDate(data.ZHIGHLIGHT_DATE || data.createDate);
    
    // Optional basic fields
    this.notebookId = data.ZBOOKMD5 || data.notebookId;
    this.docMd5 = data.ZBOOKMD5 || data.docMd5;
    this.excerptText = data.ZHIGHLIGHT_TEXT || data.excerptText;
    this.noteTitle = data.ZNOTETITLE || data.noteTitle;
    this.notesText = data.ZNOTES_TEXT || data.notesText;
    
    // Position and page data
    this.startPage = data.ZSTARTPAGE || data.startPage;
    this.endPage = data.ZENDPAGE || data.endPage;
    this.startPos = data.ZSTARTPOS || data.startPos;
    this.endPos = data.ZENDPOS || data.endPos;
    
    // Parse mindmap position
    if (data.ZMINDPOS) {
      const [x, y] = data.ZMINDPOS.split(',').map(parseFloat);
      this.mindmapPosition = { x, y };
    }
    
    // Dates
    this.modifiedDate = this.parseDate(data.ZNOTE_DATE || data.modifiedDate);
    
    // Media and content
    this.mediaList = data.ZMEDIA_LIST || data.mediaList;
    
    // Parse text highlight from decoded data
    if (data.ZHIGHLIGHTS_DECODE) {
      this.textHighlight = this.parseTextHighlight(data.ZHIGHLIGHTS_DECODE);
    }
    
    // Parse excerpt picture from decoded data
    if (data.ZHIGLIGHTPIC_DECODE) {
      this.excerptPic = this.parseExcerptPic(data.ZHIGLIGHTPIC_DECODE);
    }
    
    // Hierarchy
    this.groupNoteId = data.ZGROUPNOTEID || data.groupNoteId;
    
    // Parse child notes and linked notes from decoded ZNOTES
    if (data.ZNOTES_DECODE) {
      this.parseChildAndLinkedNotes(data.ZNOTES_DECODE);
    }
    
    // Other fields
    this.zLevel = data.ZZINDEX || data.zLevel;
    this.annotation = data.ZRECOGNIZE_TEXT || data.annotation;
    this.topicId = data.ZTOPICID || data.topicId;
    
    // Parse topic type from ZTYPE
    this.topicType = this.parseTopicType(data.ZTYPE);
  }
  
  /**
   * Parse Core Data timestamp (seconds since 2001-01-01) to JavaScript Date
   */
  private parseDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    if (typeof timestamp === 'string') {
      const parsed = parseFloat(timestamp);
      if (isNaN(parsed)) return new Date();
      timestamp = parsed;
    }
    
    // Core Data reference date: January 1, 2001 00:00:00 UTC
    const referenceDate = new Date('2001-01-01T00:00:00Z');
    return new Date(referenceDate.getTime() + timestamp * 1000);
  }
  
  /**
   * Parse text highlight from decoded ZHIGHLIGHTS data
   */
  private parseTextHighlight(decodedData: any): TextHighlight | undefined {
    try {
      let parsed = decodedData;
      if (typeof decodedData === 'string') {
        parsed = JSON.parse(decodedData);
      }
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        const highlight = parsed[0];
        return {
          highlight_text: highlight.highlight_text || '',
          coords_hash: highlight.coords_hash || '',
          maskList: highlight.maskList,
          textSelLst: highlight.textSelLst
        };
      }
    } catch (error) {
      console.warn('Failed to parse text highlight:', error);
    }
    return undefined;
  }
  
  /**
   * Parse excerpt picture from decoded ZHIGHLIGHT_PIC data
   */
  private parseExcerptPic(decodedData: any): ExcerptPic | undefined {
    try {
      let parsed = decodedData;
      if (typeof decodedData === 'string') {
        parsed = JSON.parse(decodedData);
      }
      
      if (parsed && typeof parsed === 'object') {
        return {
          paint: parsed.paint,
          size: parsed.size ? this.parseSize(parsed.size) : undefined,
          selLst: parsed.selLst
        };
      }
    } catch (error) {
      console.warn('Failed to parse excerpt picture:', error);
    }
    return undefined;
  }
  
  /**
   * Parse size from NSValue format
   */
  private parseSize(sizeData: any): CGSize | undefined {
    try {
      if (sizeData && sizeData.NS && sizeData.NS.sizeval) {
        const sizeStr = sizeData.NS.sizeval;
        const match = sizeStr.match(/\{(\d+),\s*(\d+)\}/);
        if (match) {
          return {
            width: parseInt(match[1]),
            height: parseInt(match[2])
          };
        }
      }
    } catch (error) {
      console.warn('Failed to parse size:', error);
    }
    return undefined;
  }
  
  /**
   * Parse child notes and linked notes from decoded ZNOTES data
   */
  private parseChildAndLinkedNotes(decodedData: any): void {
    try {
      let parsed = decodedData;
      if (typeof decodedData === 'string') {
        parsed = JSON.parse(decodedData);
      }
      
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          // Check for child notes (q_htext indicates child note)
          if (item.q_htext && item.noteid) {
            this.linkedNotes.push({
              summary: false,
              noteid: item.noteid,
              linktext: item.q_htext
            });
          }
          
          // Check for linked notes (type: LinkNote)
          if (item.type === 'LinkNote' && item.noteid) {
            this.linkedNotes.push({
              summary: false,
              noteid: item.noteid,
              linktext: 'Linked Note'
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse child and linked notes:', error);
    }
    
    // Also check notesText for marginnote4app:// links
    if (this.notesText) {
      const linkPattern = /marginnote4app:\/\/note\/([A-F0-9\-]+)/g;
      let match;
      while ((match = linkPattern.exec(this.notesText)) !== null) {
        this.linkedNotes.push({
          summary: false,
          noteid: match[1],
          linktext: 'Linked Note'
        });
      }
    }
  }
  
  /**
   * Parse topic type from ZTYPE field
   */
  private parseTopicType(ztype: any): string {
    if (!ztype) return 'unknown';
    
    const typeMap: { [key: number]: string } = {
      1: 'mindmap',
      4: 'outline', 
      7: 'flashcard',
      256: 'highlight',
      512: 'note'
    };
    
    return typeMap[ztype] || `type_${ztype}`;
  }
  
  /**
   * Get all text content (highlights + notes)
   */
  allNoteText(): string {
    const parts: string[] = [];
    
    if (this.excerptText) {
      parts.push(this.excerptText);
    }
    
    if (this.notesText) {
      parts.push(this.notesText);
    }
    
    if (this.textHighlight?.highlight_text) {
      parts.push(this.textHighlight.highlight_text);
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * Get display title for the note
   */
  getDisplayTitle(): string {
    if (this.noteTitle) {
      return this.noteTitle;
    }
    
    if (this.excerptText) {
      // Use first line or first 50 characters as title
      const firstLine = this.excerptText.split('\n')[0];
      if (firstLine.length <= 50) {
        return firstLine;
      }
      return firstLine.substring(0, 47) + '...';
    }
    
    return `Note ${this.noteId.substring(0, 8)}`;
  }
  
  /**
   * Get filename for this note
   */
  getFilename(): string {
    const title = this.getDisplayTitle()
      .replace(/[\/\\:*?"<>|]/g, '-') // Replace invalid filename characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
    
    return `${title}.md`;
  }
  
  /**
   * Convert to Obsidian markdown format
   */
  toMarkdown(): string {
    const lines: string[] = [];
    
    // Title
    lines.push(`# ${this.getDisplayTitle()}`);
    lines.push('');
    
    // Excerpt/Highlight section
    if (this.excerptText || this.textHighlight?.highlight_text) {
      lines.push('## Highlights');
      lines.push('');
      
      if (this.excerptText) {
        lines.push(`> ${this.excerptText}`);
        lines.push('');
      }
      
      if (this.textHighlight?.highlight_text && this.textHighlight.highlight_text !== this.excerptText) {
        lines.push(`> ${this.textHighlight.highlight_text}`);
        lines.push('');
      }
    }
    
    // Notes section
    if (this.notesText) {
      lines.push('## Notes');
      lines.push('');
      lines.push(this.notesText);
      lines.push('');
    }
    
    // Linked notes
    if (this.linkedNotes.length > 0) {
      lines.push('## Linked Notes');
      lines.push('');
      for (const link of this.linkedNotes) {
        lines.push(`- [[${link.noteid}|${link.linktext}]]`);
      }
      lines.push('');
    }
    
    // Child notes (if any were parsed)
    if (this.childNotes.length > 0) {
      lines.push('## Child Notes');
      lines.push('');
      for (const child of this.childNotes) {
        lines.push(`- [[${child.noteId}|${child.getDisplayTitle()}]]`);
      }
      lines.push('');
    }
    
    // Metadata section
    lines.push('## Metadata');
    lines.push('');
    lines.push(`**Note ID:** ${this.noteId}`);
    if (this.topicId) lines.push(`**Topic ID:** ${this.topicId}`);
    if (this.topicType) lines.push(`**Type:** ${this.topicType}`);
    if (this.startPage) lines.push(`**Page:** ${this.startPage}${this.endPage && this.endPage !== this.startPage ? `-${this.endPage}` : ''}`);
    if (this.startPos) lines.push(`**Position:** ${this.startPos}`);
    lines.push(`**Created:** ${this.createDate.toISOString()}`);
    if (this.modifiedDate) lines.push(`**Modified:** ${this.modifiedDate.toISOString()}`);
    if (this.mediaList) lines.push(`**Media:** ${this.mediaList}`);
    lines.push('');
    
    // Tags (from topic type and other metadata)
    const tags: string[] = [];
    if (this.topicType) tags.push(`#${this.topicType}`);
    if (this.flashcard) tags.push('#flashcard');
    if (this.flagged) tags.push('#flagged');
    
    if (tags.length > 0) {
      lines.push(`**Tags:** ${tags.join(' ')}`);
      lines.push('');
    }
    
    lines.push('---');
    lines.push('*Imported from MarginNote*');
    
    return lines.join('\n');
  }
}