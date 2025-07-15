// Debug detailed ZIP extraction from .marginpkg file
const fs = require('fs');

const marginpkgPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3(2025-06-26-00-19-38).marginpkg';

console.log('=== Detailed ZIP Analysis ===');

const buffer = fs.readFileSync(marginpkgPath);
console.log(`File size: ${buffer.length} bytes`);

// Find central directory
const endCentralDirSig = 0x06054b50;
let centralDirOffset = null;

for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 1000); i--) {
    const sig = buffer.readUInt32LE(i);
    if (sig === endCentralDirSig) {
        centralDirOffset = buffer.readUInt32LE(i + 16);
        const totalEntries = buffer.readUInt16LE(i + 10);
        console.log(`✅ Central directory found at: ${centralDirOffset}`);
        console.log(`Total entries: ${totalEntries}`);
        break;
    }
}

if (!centralDirOffset) {
    console.log('❌ Could not find central directory');
    process.exit(1);
}

// Parse central directory entries
console.log('\n=== Central Directory Entries ===');
let currentOffset = centralDirOffset;
const entries = [];

for (let i = 0; i < 10; i++) { // Max 10 entries for debugging
    if (currentOffset >= buffer.length - 46) break;
    
    const signature = buffer.readUInt32LE(currentOffset);
    if (signature !== 0x02014b50) {
        console.log(`Entry ${i}: Invalid signature 0x${signature.toString(16)}`);
        break;
    }
    
    const method = buffer.readUInt16LE(currentOffset + 10);
    const compressedSize = buffer.readUInt32LE(currentOffset + 20);
    const uncompressedSize = buffer.readUInt32LE(currentOffset + 24);
    const nameLength = buffer.readUInt16LE(currentOffset + 28);
    const extraLength = buffer.readUInt16LE(currentOffset + 30);
    const commentLength = buffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(currentOffset + 42);
    
    // Extract filename
    const nameBytes = buffer.slice(currentOffset + 46, currentOffset + 46 + nameLength);
    const name = nameBytes.toString('utf-8');
    
    entries.push({
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset
    });
    
    console.log(`Entry ${i}: ${name}`);
    console.log(`  Method: ${method} (0=Store, 8=Deflate)`);
    console.log(`  Compressed: ${compressedSize} bytes`);
    console.log(`  Uncompressed: ${uncompressedSize} bytes`);
    console.log(`  Local header at: ${localHeaderOffset}`);
    
    currentOffset += 46 + nameLength + extraLength + commentLength;
}

// Try to extract the .marginnotes file specifically
const databaseEntry = entries.find(e => e.name.endsWith('.marginnotes'));
if (databaseEntry) {
    console.log(`\n=== Extracting Database File: ${databaseEntry.name} ===`);
    
    // Read local header
    const localOffset = databaseEntry.localHeaderOffset;
    const localSig = buffer.readUInt32LE(localOffset);
    
    if (localSig !== 0x04034b50) {
        console.log(`❌ Invalid local header signature: 0x${localSig.toString(16)}`);
    } else {
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        
        console.log(`Data starts at offset: ${dataOffset}`);
        console.log(`Compression method: ${databaseEntry.method}`);
        
        if (databaseEntry.method === 0) {
            // Stored (no compression)
            const extractedData = buffer.slice(dataOffset, dataOffset + databaseEntry.compressedSize);
            console.log(`✅ Extracted ${extractedData.length} bytes (stored)`);
            
            // Write to debug file
            const debugPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/debug-extracted.marginnotes';
            fs.writeFileSync(debugPath, extractedData);
            console.log(`Wrote debug file: ${debugPath}`);
            
        } else if (databaseEntry.method === 8) {
            // Deflate compression
            console.log('⚠️  File is compressed with Deflate - need to decompress');
            const compressedData = buffer.slice(dataOffset, dataOffset + databaseEntry.compressedSize);
            
            try {
                const zlib = require('zlib');
                const decompressed = zlib.inflateRawSync(compressedData);
                console.log(`✅ Decompressed ${decompressed.length} bytes`);
                
                // Write to debug file
                const debugPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/debug-extracted.marginnotes';
                fs.writeFileSync(debugPath, decompressed);
                console.log(`Wrote decompressed debug file: ${debugPath}`);
                
            } catch (error) {
                console.log(`❌ Decompression failed: ${error.message}`);
            }
        }
    }
} else {
    console.log('❌ No .marginnotes file found in ZIP entries');
}