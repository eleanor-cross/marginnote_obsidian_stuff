/**
 * Test script for MarginNote CSV to Markdown conversion
 */

const fs = require('fs');
const path = require('path');

// Simple TypeScript-like imports (we'll compile the TS files to JS)
console.log('🧪 Testing MarginNote CSV to Markdown Conversion\n');

// Paths  
const csvDirectory = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3_extracted/csvs';
const outputDirectory = path.join(__dirname, 'output-notes');

console.log(`📁 CSV Directory: ${csvDirectory}`);
console.log(`📤 Output Directory: ${outputDirectory}`);

// Check if CSV directory exists
if (!fs.existsSync(csvDirectory)) {
    console.log('❌ CSV directory not found:', csvDirectory);
    process.exit(1);
}

console.log('✅ CSV directory found');

// Check for required CSV files
const requiredFiles = ['ZBOOKNOTE_modfied.csv', 'ZTOPIC.csv'];
const missingFiles = [];

for (const file of requiredFiles) {
    const filePath = path.join(csvDirectory, file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file}: ${stats.size} bytes`);
    } else {
        console.log(`❌ ${file}: Not found`);
        missingFiles.push(file);
    }
}

if (missingFiles.length > 0) {
    console.log('\n⚠️  Some files are missing, but we can still proceed with available data');
}

// Create output directory
if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
    console.log(`📁 Created output directory: ${outputDirectory}`);
}

console.log('\n🔄 Starting conversion process...');

// Since we can't directly import TypeScript, let's implement a simplified version
// that demonstrates the conversion process

async function convertCSVToMarkdown() {
    try {
        // Load the modified ZBOOKNOTE CSV
        const csvPath = path.join(csvDirectory, 'ZBOOKNOTE_modfied.csv');
        
        if (!fs.existsSync(csvPath)) {
            throw new Error('ZBOOKNOTE_modfied.csv not found');
        }
        
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        console.log(`📄 Loaded CSV file: ${csvContent.length} characters`);
        
        // Simple CSV parsing (first row is headers)
        const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
            throw new Error('CSV file appears to be empty or invalid');
        }
        
        // Parse headers
        const headers = parseCsvLine(lines[0]);
        console.log(`📊 Found ${headers.length} columns: ${headers.slice(0, 5).join(', ')}...`);
        
        // Parse data rows
        const notes = [];
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCsvLine(lines[i]);
                const note = {};
                
                // Map values to headers
                for (let j = 0; j < headers.length && j < values.length; j++) {
                    note[headers[j]] = values[j];
                }
                
                notes.push(note);
            } catch (error) {
                console.warn(`⚠️  Failed to parse line ${i + 1}: ${error.message}`);
            }
        }
        
        console.log(`✅ Parsed ${notes.length} notes from CSV`);
        
        // Convert each note to markdown
        let notesCreated = 0;
        const outputFiles = [];
        
        for (const note of notes) {
            try {
                const markdown = convertNoteToMarkdown(note);
                const filename = generateFilename(note);
                const filePath = path.join(outputDirectory, filename);
                
                fs.writeFileSync(filePath, markdown, 'utf-8');
                outputFiles.push(filename);
                notesCreated++;
                
                console.log(`📝 Created: ${filename}`);
            } catch (error) {
                console.warn(`⚠️  Failed to convert note ${note.ZNOTEID || 'unknown'}: ${error.message}`);
            }
        }
        
        // Create index file
        createIndexFile(notes, outputFiles);
        
        console.log(`\n🎉 Conversion completed successfully!`);
        console.log(`📊 Results:`);
        console.log(`   - Notes processed: ${notes.length}`);
        console.log(`   - Notes created: ${notesCreated}`);
        console.log(`   - Output directory: ${outputDirectory}`);
        
    } catch (error) {
        console.error(`❌ Conversion failed: ${error.message}`);
        process.exit(1);
    }
}

// Simple CSV line parser
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Convert a note object to markdown
function convertNoteToMarkdown(note) {
    const lines = [];
    
    // Title
    const title = generateTitle(note);
    lines.push(`# ${title}`);
    lines.push('');
    
    // Excerpt/Highlight
    if (note.ZHIGHLIGHT_TEXT) {
        lines.push('## Highlights');
        lines.push('');
        lines.push(`> ${note.ZHIGHLIGHT_TEXT}`);
        lines.push('');
    }
    
    // Notes
    if (note.ZNOTES_TEXT) {
        lines.push('## Notes');
        lines.push('');
        lines.push(note.ZNOTES_TEXT);
        lines.push('');
    }
    
    // Decoded content if available
    if (note.ZHIGHLIGHTS_DECODE) {
        try {
            const decoded = JSON.parse(note.ZHIGHLIGHTS_DECODE);
            if (Array.isArray(decoded) && decoded.length > 0) {
                lines.push('## Additional Highlights');
                lines.push('');
                for (const item of decoded) {
                    if (item.highlight_text) {
                        lines.push(`> ${item.highlight_text}`);
                        lines.push('');
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    // Linked notes
    if (note.ZNOTES_DECODE) {
        try {
            const decoded = JSON.parse(note.ZNOTES_DECODE);
            if (Array.isArray(decoded) && decoded.length > 0) {
                lines.push('## Linked Notes');
                lines.push('');
                for (const item of decoded) {
                    if (item.noteid) {
                        lines.push(`- Link to note: ${item.noteid}`);
                    }
                }
                lines.push('');
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    // Metadata
    lines.push('## Metadata');
    lines.push('');
    if (note.ZNOTEID) lines.push(`**Note ID:** ${note.ZNOTEID}`);
    if (note.ZTOPICID) lines.push(`**Topic ID:** ${note.ZTOPICID}`);
    if (note.ZSTARTPAGE) lines.push(`**Page:** ${note.ZSTARTPAGE}`);
    if (note.ZTYPE) lines.push(`**Type:** ${note.ZTYPE}`);
    if (note.ZHIGHLIGHT_DATE) {
        const date = parseDate(note.ZHIGHLIGHT_DATE);
        lines.push(`**Created:** ${date.toISOString()}`);
    }
    lines.push('');
    
    lines.push('---');
    lines.push('*Imported from MarginNote*');
    
    return lines.join('\n');
}

// Generate title for a note
function generateTitle(note) {
    if (note.ZNOTETITLE) {
        return note.ZNOTETITLE;
    }
    
    if (note.ZHIGHLIGHT_TEXT) {
        const text = note.ZHIGHLIGHT_TEXT;
        if (text.length <= 50) {
            return text;
        }
        return text.substring(0, 47) + '...';
    }
    
    return `Note ${(note.ZNOTEID || 'unknown').substring(0, 8)}`;
}

// Generate filename for a note
function generateFilename(note) {
    const title = generateTitle(note)
        .replace(/[\/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    
    return `${title}.md`;
}

// Parse Core Data timestamp
function parseDate(timestamp) {
    if (!timestamp || timestamp === '') return new Date();
    
    const parsed = parseFloat(timestamp);
    if (isNaN(parsed)) return new Date();
    
    // Core Data reference date: January 1, 2001 00:00:00 UTC
    const referenceDate = new Date('2001-01-01T00:00:00Z');
    return new Date(referenceDate.getTime() + parsed * 1000);
}

// Create index file
function createIndexFile(notes, outputFiles) {
    const lines = [];
    
    lines.push('# MarginNote Import Index');
    lines.push('');
    lines.push(`Generated on: ${new Date().toISOString()}`);
    lines.push(`Total notes: ${notes.length}`);
    lines.push('');
    
    lines.push('## All Notes');
    lines.push('');
    
    for (let i = 0; i < notes.length && i < outputFiles.length; i++) {
        const note = notes[i];
        const filename = outputFiles[i];
        const title = generateTitle(note);
        
        lines.push(`- [[${filename}|${title}]]`);
        if (note.ZHIGHLIGHT_TEXT) {
            const preview = note.ZHIGHLIGHT_TEXT.substring(0, 100);
            lines.push(`  > ${preview}${note.ZHIGHLIGHT_TEXT.length > 100 ? '...' : ''}`);
        }
    }
    
    lines.push('');
    lines.push('---');
    lines.push('*Generated by MarginNote CSV Converter*');
    
    const indexPath = path.join(outputDirectory, 'index.md');
    fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
    console.log('📋 Created index.md');
}

// Run the conversion
convertCSVToMarkdown();