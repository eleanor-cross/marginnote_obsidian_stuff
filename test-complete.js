/**
 * Complete test of the TypeScript MarginNote parsing pipeline
 */

const fs = require('fs');
const path = require('path');

// Test file
const testFile = path.join(__dirname, 'temp', 'Testing3(2025-06-26-00-19-38).marginpkg');

console.log('🧪 Testing complete MarginNote TypeScript pipeline...\n');

// Simulate the main.js import process
async function testMarginNoteImport() {
    console.log('📁 Loading test file...');
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ Test file not found:', testFile);
        return;
    }
    
    const fileBuffer = fs.readFileSync(testFile);
    console.log(`✅ Test file loaded: ${fileBuffer.length} bytes`);
    
    // Simulate File object
    const mockFile = {
        name: 'Testing3(2025-06-26-00-19-38).marginpkg',
        size: fileBuffer.length,
        arrayBuffer: () => Promise.resolve(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))
    };
    
    console.log('\n🔧 Testing database parser...');
    
    // Import our compiled TypeScript modules - simulate what would happen in Obsidian
    const { parseMarginPkgFile, isValidMarginPkgFile } = require('./main.js');
    
    console.log('📋 Validating file...');
    const isValid = isValidMarginPkgFile(mockFile);
    console.log(`File validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (!isValid) return;
    
    console.log('\n🗄️  Parsing MarginNote database...');
    try {
        const databaseData = await parseMarginPkgFile(mockFile, false);
        
        console.log('✅ Database parsing completed!');
        console.log(`📊 Results:`);
        console.log(`   - Booknotes: ${databaseData.booknotes.length}`);
        console.log(`   - Topics: ${databaseData.topics.length}`);
        console.log(`   - Media: ${databaseData.media.length}`);
        
        if (databaseData.booknotes.length > 0) {
            console.log('\n📝 Sample booknote:');
            const sampleNote = databaseData.booknotes[0];
            console.log(`   ID: ${sampleNote.ZNOTEID}`);
            console.log(`   Highlight: "${sampleNote.ZHIGHLIGHT_TEXT}"`);
            console.log(`   Notes: "${sampleNote.ZNOTES_TEXT}"`);
            console.log(`   Title: "${sampleNote.ZNOTE_TITLE}"`);
        }
        
        if (databaseData.topics.length > 0) {
            console.log('\n📂 Sample topic:');
            const sampleTopic = databaseData.topics[0];
            console.log(`   ID: ${sampleTopic.ZTOPICID}`);
            console.log(`   Title: "${sampleTopic.ZTITLE}"`);
        }
        
        console.log('\n🎯 Testing import pipeline...');
        
        // Test the full import process
        const { MarginNoteImporter } = require('./main.js');
        
        const importConfig = {
            outputDirectory: './test_output',
            createSubdirectories: true,
            includeMetadata: true,
            includeCoordinates: true,
            skipEmptyNotes: true,
            strictDecoding: false
        };
        
        const importer = new MarginNoteImporter(importConfig);
        const result = await importer.importMarginNoteData(databaseData);
        
        console.log('\n📈 Import Results:');
        console.log(`   Success: ${result.success ? '✅' : '❌'}`);
        console.log(`   Notes Created: ${result.notesCreated}`);
        console.log(`   Errors: ${result.statistics.errors}`);
        console.log(`   Warnings: ${result.statistics.warnings}`);
        
        if (result.importReport) {
            console.log(`   Output Files: ${result.importReport.outputFiles.length}`);
            if (result.importReport.outputFiles.length > 0) {
                console.log('   Files:');
                result.importReport.outputFiles.slice(0, 5).forEach(file => {
                    console.log(`     - ${file}`);
                });
            }
        }
        
        if (result.success) {
            console.log('\n🎉 SUCCESS: Complete MarginNote import pipeline working!');
            
            // Save test results
            const testReport = {
                timestamp: new Date().toISOString(),
                fileSize: mockFile.size,
                fileName: mockFile.name,
                parsingResults: {
                    booknotes: databaseData.booknotes.length,
                    topics: databaseData.topics.length,
                    media: databaseData.media.length
                },
                importResults: {
                    success: result.success,
                    notesCreated: result.notesCreated,
                    errors: result.statistics.errors,
                    warnings: result.statistics.warnings,
                    outputFiles: result.importReport?.outputFiles || []
                }
            };
            
            fs.writeFileSync(path.join(__dirname, 'test-results.json'), JSON.stringify(testReport, null, 2));
            console.log('📄 Test results saved to test-results.json');
            
        } else {
            console.log(`\n❌ FAILED: ${result.error}`);
        }
        
    } catch (error) {
        console.log(`❌ Error during testing: ${error.message}`);
        console.log('Stack trace:', error.stack);
    }
}

// Run the test
testMarginNoteImport().then(() => {
    console.log('\n✨ Test completed!');
}).catch(error => {
    console.log('\n💥 Test failed:', error.message);
});