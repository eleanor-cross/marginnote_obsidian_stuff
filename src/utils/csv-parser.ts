/**
 * Simple CSV Parser for MarginNote database CSV files
 */

export interface CSVParseOptions {
  hasHeader?: boolean;
  delimiter?: string;
  quote?: string;
  escape?: string;
}

export class CSVParser {
  private options: Required<CSVParseOptions>;
  
  constructor(options: CSVParseOptions = {}) {
    this.options = {
      hasHeader: true,
      delimiter: ',',
      quote: '"',
      escape: '"',
      ...options
    };
  }
  
  /**
   * Parse CSV content into array of objects
   */
  parse(csvContent: string): any[] {
    const lines = this.splitLines(csvContent);
    if (lines.length === 0) return [];
    
    let headers: string[] = [];
    let dataStartIndex = 0;
    
    if (this.options.hasHeader) {
      headers = this.parseLine(lines[0]);
      dataStartIndex = 1;
    } else {
      // Generate generic headers
      const firstLine = this.parseLine(lines[0]);
      headers = firstLine.map((_, index) => `column_${index}`);
    }
    
    const results: any[] = [];
    
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      try {
        const values = this.parseLine(line);
        const obj: any = {};
        
        // Map values to headers
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = j < values.length ? values[j] : '';
          obj[header] = this.parseValue(value);
        }
        
        results.push(obj);
      } catch (error) {
        console.warn(`Error parsing CSV line ${i + 1}:`, error);
        console.warn(`Line content: ${line.substring(0, 100)}...`);
      }
    }
    
    return results;
  }
  
  /**
   * Split CSV content into lines, handling quoted newlines
   */
  private splitLines(content: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < content.length) {
      const char = content[i];
      
      if (char === this.options.quote) {
        if (inQuotes && i + 1 < content.length && content[i + 1] === this.options.quote) {
          // Escaped quote
          currentLine += this.options.quote;
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          currentLine += char;
          i++;
        }
      } else if (char === '\n' && !inQuotes) {
        // End of line
        lines.push(currentLine);
        currentLine = '';
        i++;
      } else if (char === '\r' && !inQuotes) {
        // Handle \r\n or standalone \r
        if (i + 1 < content.length && content[i + 1] === '\n') {
          i++; // Skip the \r, \n will be handled next iteration
        }
        lines.push(currentLine);
        currentLine = '';
        i++;
      } else {
        currentLine += char;
        i++;
      }
    }
    
    // Add the last line if it doesn't end with newline
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  /**
   * Parse a single CSV line into array of values
   */
  private parseLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === this.options.quote) {
        if (inQuotes && i + 1 < line.length && line[i + 1] === this.options.quote) {
          // Escaped quote
          currentValue += this.options.quote;
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === this.options.delimiter && !inQuotes) {
        // End of field
        values.push(currentValue);
        currentValue = '';
        i++;
      } else {
        currentValue += char;
        i++;
      }
    }
    
    // Add the last value
    values.push(currentValue);
    
    return values;
  }
  
  /**
   * Parse and convert a value to appropriate type
   */
  private parseValue(value: string): any {
    // Remove surrounding quotes if present
    if (value.startsWith(this.options.quote) && value.endsWith(this.options.quote)) {
      value = value.slice(1, -1);
      // Unescape quotes
      value = value.replace(new RegExp(`${this.options.escape}${this.options.quote}`, 'g'), this.options.quote);
    }
    
    // Return empty string as is
    if (value === '') return '';
    
    // Try to parse as number
    if (/^-?\d+\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return Number.isInteger(num) ? parseInt(value) : num;
      }
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Return as string
    return value;
  }
  
  /**
   * Load and parse CSV from file path (Node.js environment)
   */
  static async loadFromFile(filePath: string, options?: CSVParseOptions): Promise<any[]> {
    if (typeof require === 'undefined') {
      throw new Error('File loading only available in Node.js environment');
    }
    
    const fs = require('fs');
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new CSVParser(options);
    return parser.parse(csvContent);
  }
}