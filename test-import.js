/**
 * Test script to verify MarginNote import functionality
 */

const fs = require('fs');
const path = require('path');

// Read the test file
const testFile = path.join(__dirname, 'temp', 'Testing3(2025-06-26-00-19-38).marginpkg');

if (fs.existsSync(testFile)) {
    const fileData = fs.readFileSync(testFile);
    console.log('Test file loaded:', fileData.length, 'bytes');
    
    // Check for ZIP signature
    const signature = fileData.readUInt32LE(0);
    console.log('File signature:', signature.toString(16));
    
    if (signature === 0x04034b50) {
        console.log('✅ Valid ZIP file detected');
        
        // Try to extract text content
        const textContent = fileData.toString('utf8', 0, Math.min(2000, fileData.length));
        console.log('Sample content preview:');
        console.log(textContent.substring(0, 500));
        
        // Look for patterns
        const patterns = [
            /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{10,}/g,
            /[a-zA-Z\s]{20,100}/g
        ];
        
        console.log('\nFound text patterns:');
        patterns.forEach((pattern, i) => {
            const matches = textContent.match(pattern);
            if (matches) {
                console.log(`Pattern ${i + 1}:`, matches.slice(0, 3));
            }
        });
        
    } else {
        console.log('❌ Not a valid ZIP file');
    }
    
} else {
    console.log('❌ Test file not found:', testFile);
}