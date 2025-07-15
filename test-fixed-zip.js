/**
 * Fixed ZIP parser for MarginNote files
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

console.log('Testing fixed ZIP parsing for MarginNote...\n');

const testFile = path.join(__dirname, 'temp', 'Testing3(2025-06-26-00-19-38).marginpkg');

if (!fs.existsSync(testFile)) {
    console.log('❌ Test file not found:', testFile);
    process.exit(1);
}

const fileData = fs.readFileSync(testFile);
console.log('✅ Test file loaded:', fileData.length, 'bytes');

// Look for central directory to get proper file information
function findCentralDirectory(data) {
    // End of central directory signature: 0x06054b50
    for (let i = data.length - 22; i >= 0; i--) {
        if (data.readUInt32LE(i) === 0x06054b50) {
            const centralDirOffset = data.readUInt32LE(i + 16);
            const centralDirSize = data.readUInt32LE(i + 12);
            console.log(`📍 Found central directory at offset ${centralDirOffset}, size ${centralDirSize}`);
            return centralDirOffset;
        }
    }
    return null;
}

function parseCentralDirectory(data, offset) {
    const files = [];
    let currentOffset = offset;
    
    while (currentOffset < data.length - 46) {
        const signature = data.readUInt32LE(currentOffset);
        if (signature !== 0x02014b50) break; // Central directory file header signature
        
        const method = data.readUInt16LE(currentOffset + 10);
        const compressedSize = data.readUInt32LE(currentOffset + 20);
        const uncompressedSize = data.readUInt32LE(currentOffset + 24);
        const nameLength = data.readUInt16LE(currentOffset + 28);
        const extraLength = data.readUInt16LE(currentOffset + 30);
        const commentLength = data.readUInt16LE(currentOffset + 32);
        const localHeaderOffset = data.readUInt32LE(currentOffset + 42);
        
        const nameStart = currentOffset + 46;
        const name = data.toString('utf8', nameStart, nameStart + nameLength);
        
        files.push({
            name,
            method,
            compressedSize,
            uncompressedSize,
            localHeaderOffset
        });
        
        console.log(`📁 File: ${name}`);
        console.log(`   Method: ${method === 0 ? 'Stored' : method === 8 ? 'Deflate' : method}`);
        console.log(`   Compressed: ${compressedSize} bytes`);
        console.log(`   Uncompressed: ${uncompressedSize} bytes`);
        console.log(`   Local header at: ${localHeaderOffset}`);
        
        currentOffset += 46 + nameLength + extraLength + commentLength;
    }
    
    return files;
}

function extractFileData(data, fileInfo) {
    const offset = fileInfo.localHeaderOffset;
    
    // Read local file header
    const signature = data.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
        throw new Error('Invalid local file header');
    }
    
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressedData = data.slice(dataStart, dataStart + fileInfo.compressedSize);
    
    console.log(`   📦 Extracting from offset ${dataStart}, ${fileInfo.compressedSize} bytes`);
    
    if (fileInfo.method === 0) {
        // Stored (no compression)
        return compressedData;
    } else if (fileInfo.method === 8) {
        // Deflate compression
        try {
            return zlib.inflateRawSync(compressedData);
        } catch (err1) {
            try {
                return zlib.inflateSync(compressedData);
            } catch (err2) {
                console.log(`   ❌ Decompression failed: ${err1.message}`);
                return null;
            }
        }
    } else {
        console.log(`   ❌ Unsupported compression method: ${fileInfo.method}`);
        return null;
    }
}

// Parse the ZIP file
const centralDirOffset = findCentralDirectory(fileData);
if (!centralDirOffset) {
    console.log('❌ Could not find central directory');
    process.exit(1);
}

const files = parseCentralDirectory(fileData, centralDirOffset);
console.log(`\n🎯 Found ${files.length} files in archive\n`);

// Extract and analyze each file
for (const file of files) {
    try {
        console.log(`🔍 Extracting: ${file.name}`);
        const extractedData = extractFileData(fileData, file);
        
        if (extractedData) {
            console.log(`   ✅ Extracted ${extractedData.length} bytes`);
            
            // Check if it's a SQLite database
            if (extractedData.length >= 16) {
                const header = extractedData.toString('ascii', 0, 16);
                if (header.startsWith('SQLite format 3')) {
                    console.log('   🗄️  SQLite database detected!');
                    
                    // Save the database file for inspection
                    const dbFile = path.join(__dirname, `extracted_${file.name}`);
                    fs.writeFileSync(dbFile, extractedData);
                    console.log(`   📁 Database saved to: ${dbFile}`);
                    
                    // Try to find readable content
                    const text = extractedData.toString('latin1'); // Use latin1 to preserve bytes
                    
                    // Look for table names and content
                    const tableMatches = text.match(/CREATE TABLE (\w+)/gi);
                    if (tableMatches) {
                        console.log(`   📊 Found tables: ${tableMatches.map(m => m.split(' ')[2]).join(', ')}`);
                    }
                    
                    // Look for note content patterns
                    const contentPatterns = [
                        text.match(/ZHIGHLIGHT_TEXT/g),
                        text.match(/ZNOTES_TEXT/g),
                        text.match(/ZTOPIC/g),
                    ];
                    
                    contentPatterns.forEach((matches, i) => {
                        if (matches) {
                            const names = ['ZHIGHLIGHT_TEXT', 'ZNOTES_TEXT', 'ZTOPIC'][i];
                            console.log(`   📝 Found ${matches.length} instances of ${names}`);
                        }
                    });
                    
                    // Extract potential user content (looking for longer strings)
                    const userContent = [];
                    const regex = /[\x20-\x7E\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{15,}/g;
                    let match;
                    
                    while ((match = regex.exec(text)) !== null && userContent.length < 20) {
                        const content = match[0].trim();
                        if (content.length > 20 && 
                            !content.match(/^(CREATE|INSERT|SELECT|UPDATE|DELETE|PRAGMA)/i) &&
                            !content.match(/^[0-9\-:T.Z]+$/) && // Skip timestamps
                            !content.match(/^[a-f0-9\-]+$/i)) { // Skip UUIDs/hashes
                            userContent.push(content);
                        }
                    }
                    
                    if (userContent.length > 0) {
                        console.log(`   📖 Found ${userContent.length} potential user content pieces:`);
                        userContent.slice(0, 5).forEach((content, i) => {
                            console.log(`      ${i + 1}. "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`);
                        });
                        
                        // Save extracted content
                        const contentFile = path.join(__dirname, 'extracted_content.txt');
                        fs.writeFileSync(contentFile, userContent.join('\n\n'));
                        console.log(`   📁 Content saved to: ${contentFile}`);
                    }
                }
            }
        }
        
        console.log('');
    } catch (error) {
        console.log(`   ❌ Error extracting ${file.name}: ${error.message}\n`);
    }
}

console.log('✅ ZIP analysis complete!');