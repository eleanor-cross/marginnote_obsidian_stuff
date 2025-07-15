// Test fflate ZIP extraction
const fs = require('fs');
const { unzip } = require('fflate');

const marginpkgPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3(2025-06-26-00-19-38).marginpkg';

console.log('Testing fflate ZIP extraction...');

const buffer = fs.readFileSync(marginpkgPath);
const uint8Array = new Uint8Array(buffer);

unzip(uint8Array, (err, unzipped) => {
    if (err) {
        console.error('❌ fflate extraction failed:', err);
        return;
    }
    
    console.log('✅ fflate extraction successful!');
    console.log(`Extracted ${Object.keys(unzipped).length} files:`);
    
    for (const [filename, data] of Object.entries(unzipped)) {
        console.log(`  ${filename}: ${data.length} bytes`);
        
        if (filename.endsWith('.marginnotes')) {
            console.log(`\n🎯 Found database file: ${filename}`);
            console.log(`Database size: ${data.length} bytes`);
            
            // Write it for comparison
            const extractedPath = `/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/fflate-extracted.marginnotes`;
            fs.writeFileSync(extractedPath, data);
            console.log(`Wrote extracted database to: ${extractedPath}`);
        }
    }
});