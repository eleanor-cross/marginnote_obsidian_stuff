/**
 * Comprehensive test for MarginNote parsing with actual extraction
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Import our TypeScript modules (we'll compile them)
console.log('Testing MarginNote parsing with real decompression...\n');

// Read the test file
const testFile = path.join(__dirname, 'temp', 'Testing3(2025-06-26-00-19-38).marginpkg');

if (!fs.existsSync(testFile)) {
    console.log('❌ Test file not found:', testFile);
    process.exit(1);
}

const fileData = fs.readFileSync(testFile);
console.log('✅ Test file loaded:', fileData.length, 'bytes');

// Check for ZIP signature
const signature = fileData.readUInt32LE(0);
console.log('File signature: 0x' + signature.toString(16));

if (signature !== 0x04034b50) {
    console.log('❌ Not a valid ZIP file');
    process.exit(1);
}

console.log('✅ Valid ZIP file detected\n');

// Parse ZIP structure manually
let offset = 0;
const files = [];

while (offset < fileData.length - 30) {
    const sig = fileData.readUInt32LE(offset);
    
    if (sig === 0x04034b50) { // Local file header
        try {
            const version = fileData.readUInt16LE(offset + 4);
            const flags = fileData.readUInt16LE(offset + 6);
            const method = fileData.readUInt16LE(offset + 8);
            const compressedSize = fileData.readUInt32LE(offset + 18);
            const uncompressedSize = fileData.readUInt32LE(offset + 22);
            const nameLength = fileData.readUInt16LE(offset + 26);
            const extraLength = fileData.readUInt16LE(offset + 28);
            
            // Extract filename
            const nameStart = offset + 30;
            const name = fileData.toString('utf8', nameStart, nameStart + nameLength);
            
            console.log(`📁 ZIP Entry: ${name}`);
            console.log(`   Compression: ${method === 0 ? 'None' : method === 8 ? 'Deflate' : method}`);
            console.log(`   Compressed size: ${compressedSize} bytes`);
            console.log(`   Uncompressed size: ${uncompressedSize} bytes`);
            
            // Extract compressed data
            const dataStart = nameStart + nameLength + extraLength;
            const compressedData = fileData.slice(dataStart, dataStart + compressedSize);
            
            let extractedData = null;
            
            if (method === 0) {
                // No compression
                extractedData = compressedData;
                console.log('   ✅ Extracted uncompressed data');
            } else if (method === 8) {
                // Deflate compression
                try {
                    extractedData = zlib.inflateRawSync(compressedData);
                    console.log(`   ✅ Successfully decompressed ${extractedData.length} bytes`);
                } catch (err1) {
                    try {
                        extractedData = zlib.inflateSync(compressedData);
                        console.log(`   ✅ Successfully inflated ${extractedData.length} bytes`);
                    } catch (err2) {
                        console.log(`   ❌ Decompression failed: ${err1.message}, ${err2.message}`);
                        extractedData = compressedData; // Use raw data as fallback
                    }
                }
            }
            
            if (extractedData) {
                files.push({
                    name,
                    data: extractedData,
                    compressed: method !== 0
                });
                
                // Analyze the extracted content
                console.log('   📊 Content analysis:');
                
                // Check if it's SQLite
                if (extractedData.length >= 16) {
                    const sqliteHeader = extractedData.toString('ascii', 0, 16);
                    if (sqliteHeader.startsWith('SQLite format 3')) {
                        console.log('   🗄️  SQLite database detected!');
                        
                        // Try to extract readable strings
                        const text = extractedData.toString('utf8', 0, Math.min(5000, extractedData.length));
                        const readableText = text.replace(/[\x00-\x1f\x7f-\xff]/g, ' ').trim();
                        
                        // Look for note content patterns
                        const patterns = [
                            /ZHIGHLIGHT_TEXT/g,
                            /ZNOTES_TEXT/g,
                            /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{8,}/g, // CJK
                            /[A-Za-z\s]{20,100}/g // English sentences
                        ];
                        
                        patterns.forEach((pattern, i) => {
                            const matches = text.match(pattern);
                            if (matches && matches.length > 0) {
                                console.log(`   📝 Pattern ${i + 1} matches: ${matches.length} (${pattern})`);
                                if (i >= 2) { // Content patterns
                                    console.log(`      Sample: "${matches[0].substring(0, 50)}..."`);
                                }
                            }
                        });
                    }
                }
                
                // Look for readable content
                const sampleText = extractedData.toString('utf8', 0, Math.min(500, extractedData.length));
                const printableChars = sampleText.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length;
                const readabilityRatio = printableChars / sampleText.length;
                
                console.log(`   📖 Readability: ${(readabilityRatio * 100).toFixed(1)}%`);
                if (readabilityRatio > 0.1) {
                    const cleanedSample = sampleText.replace(/[\x00-\x1f\x7f-\xff]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (cleanedSample.length > 20) {
                        console.log(`   📄 Sample text: "${cleanedSample.substring(0, 100)}..."`);
                    }
                }
            }
            
            console.log('');
            
            // Move to next entry
            offset = dataStart + compressedSize;
        } catch (error) {
            console.log(`   ❌ Error parsing entry: ${error.message}`);
            offset += 4;
        }
    } else {
        offset += 4;
    }
}

console.log(`\n🎯 Summary: Found ${files.length} files in the archive`);

// If we found a database, try to extract notes
const dbFile = files.find(f => f.name.endsWith('.marginnotes') || f.name.includes('margin'));
if (dbFile) {
    console.log(`\n🔍 Analyzing database file: ${dbFile.name}`);
    
    const text = dbFile.data.toString('utf8');
    console.log(`Database content length: ${text.length} characters`);
    
    // Extract potential note content
    const notePatterns = [
        /([^\x00-\x1f\x7f-\x9f]{20,200})\x00/g,  // Null-terminated strings
        /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{8,}/g,  // CJK text
        /\b[A-Za-z][A-Za-z\s.,!?]{15,100}[.!?]/g  // English sentences
    ];
    
    const extractedNotes = new Set();
    
    notePatterns.forEach((pattern, i) => {
        const matches = text.match(pattern);
        if (matches) {
            console.log(`\n📝 Pattern ${i + 1} found ${matches.length} potential notes:`);
            matches.slice(0, 5).forEach((match, j) => {
                const cleaned = match.replace(/\x00/g, '').trim();
                if (cleaned.length > 10 && !extractedNotes.has(cleaned)) {
                    extractedNotes.add(cleaned);
                    console.log(`   ${j + 1}. "${cleaned.substring(0, 80)}${cleaned.length > 80 ? '...' : ''}"`);
                }
            });
        }
    });
    
    if (extractedNotes.size > 0) {
        console.log(`\n✅ Successfully extracted ${extractedNotes.size} unique notes!`);
        
        // Save extracted notes to a file for verification
        const outputFile = path.join(__dirname, 'extracted_notes.txt');
        const notesList = Array.from(extractedNotes).map((note, i) => `${i + 1}. ${note}`).join('\n\n');
        fs.writeFileSync(outputFile, notesList);
        console.log(`📁 Extracted notes saved to: ${outputFile}`);
    } else {
        console.log('\n⚠️  No readable note content found');
    }
} else {
    console.log('\n❌ No database file found in the archive');
}