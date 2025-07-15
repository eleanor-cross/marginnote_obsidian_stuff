// Debug ZIP extraction from .marginpkg file
const fs = require('fs');

const marginpkgPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3(2025-06-26-00-19-38).marginpkg';

if (!fs.existsSync(marginpkgPath)) {
    console.log('❌ .marginpkg file not found at:', marginpkgPath);
    process.exit(1);
}

console.log('✅ Found .marginpkg file');
const stats = fs.statSync(marginpkgPath);
console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Read first few bytes to check file format
const buffer = fs.readFileSync(marginpkgPath);
const firstBytes = buffer.slice(0, 100);

console.log('\nFirst 20 bytes as hex:');
console.log(Array.from(firstBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));

console.log('\nFirst 100 bytes as text:');
console.log(firstBytes.toString('utf-8', 0, 100).replace(/[\x00-\x1F\x7F-\x9F]/g, '.'));

// Check for ZIP signature
const zipSig = buffer.readUInt32LE(0);
console.log(`\nZIP signature check: 0x${zipSig.toString(16)} (expected: 0x04034b50)`);
if (zipSig === 0x04034b50) {
    console.log('✅ Valid ZIP file signature detected');
} else {
    console.log('❌ Not a standard ZIP file signature');
}

// Try to find central directory
console.log('\nSearching for central directory...');
const endCentralDirSig = 0x06054b50;
let found = false;

for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 1000); i--) {
    const sig = buffer.readUInt32LE(i);
    if (sig === endCentralDirSig) {
        console.log(`✅ Found end of central directory at offset: ${i}`);
        const centralDirOffset = buffer.readUInt32LE(i + 16);
        const totalEntries = buffer.readUInt16LE(i + 10);
        console.log(`Central directory offset: ${centralDirOffset}`);
        console.log(`Total entries: ${totalEntries}`);
        found = true;
        break;
    }
}

if (!found) {
    console.log('❌ Could not find central directory');
}

console.log('\n=== Analysis ===');
console.log('The .marginpkg file appears to be a ZIP archive.');
console.log('The plugin needs proper ZIP decompression to extract the SQLite database.');
console.log('Current TypeScript implementation may be failing at decompression step.');