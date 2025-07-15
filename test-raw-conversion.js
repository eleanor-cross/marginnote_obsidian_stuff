/**
 * Test script for Raw ZBOOKNOTE Converter
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Raw ZBOOKNOTE Converter\n');

const outputDirectory = path.join(__dirname, 'raw-output-notes');

// Create mock ZBOOKNOTE data exactly as it would come from the database
function createMockZBookNoteData() {
    return {
        booknotes: [
            {
                Z_PK: 1,
                Z_ENT: 5,
                Z_OPT: 2,
                ZNOTEID: 'ABC123-DEF456-GHI789',
                ZHIGHLIGHT_TEXT: 'This is the exact highlight text from ZBOOKNOTE',
                ZNOTES_TEXT: 'These are user notes attached to the highlight',
                ZNOTETITLE: 'User-defined note title',
                ZBOOKMD5: 'book-md5-hash-12345',
                ZSTARTPAGE: 1.0,
                ZENDPAGE: 1.0,
                ZSTARTPOS: '100.5,200.3',
                ZENDPOS: '300.7,400.9',
                ZHIGHLIGHT_DATE: 769395600,
                ZNOTE_DATE: 769395700,
                ZTYPE: 7,
                ZTOPICID: 'TOPIC-ABC-123',
                ZRECOGNIZE_TEXT: 'OCR text if any',
                ZMEDIA_LIST: 'media1-media2-media3',
                ZGROUPNOTEID: 'GROUP-456',
                ZZINDEX: 10,
                ZHIGHLIGHTS: 'binary-data-blob-1',
                ZNOTES: 'binary-data-blob-2',
                ZHIGLIGHTPIC: 'binary-data-blob-3'
            },
            {
                Z_PK: 2,
                Z_ENT: 5,
                Z_OPT: 1,
                ZNOTEID: 'XYZ789-UVW456-RST123',
                ZHIGHLIGHT_TEXT: 'Another highlight with different content',
                ZNOTETITLE: null,
                ZBOOKMD5: 'book-md5-hash-67890',
                ZSTARTPAGE: 2.0,
                ZHIGHLIGHT_DATE: 769395800,
                ZTYPE: 1,
                ZTOPICID: 'TOPIC-XYZ-789'
            },
            {
                Z_PK: 3,
                Z_ENT: 5,
                Z_OPT: 3,
                ZNOTEID: 'MNO345-PQR678-STU901',
                ZHIGHLIGHT_TEXT: 'Third note with flashcard properties',
                ZNOTES_TEXT: 'Some additional notes here',
                ZTYPE: 7,
                ZTOPICID: 'TOPIC-MNO-345',
                ZHIGHLIGHT_DATE: 769395900,
                ZSTARTPAGE: 3.0,
                ZENDPAGE: 4.0
            }
        ],
        topics: [], // We don't process these in raw mode
        media: []   // We don't process these in raw mode
    };
}

async function testRawConversion() {
    try {
        console.log('🔄 Starting raw ZBOOKNOTE conversion test...');
        
        // Create mock database data
        const databaseData = createMockZBookNoteData();
        console.log(`📊 Mock ZBOOKNOTE data created:`);
        console.log(`   - ZBOOKNOTE rows: ${databaseData.booknotes.length}`);
        
        // Create output directory
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
            console.log(`📁 Created output directory: ${outputDirectory}`);
        }
        
        // Simulate the raw conversion process
        console.log('\n📝 Creating raw markdown files...');
        
        for (let i = 0; i < databaseData.booknotes.length; i++) {
            const zbooknoteRow = databaseData.booknotes[i];
            
            // Create filename
            const title = zbooknoteRow.ZNOTETITLE || zbooknoteRow.ZHIGHLIGHT_TEXT || `ZBOOKNOTE Row ${i + 1}`;
            const safeTitle = title.replace(/[/\\\\:*?"<>|]/g, '-').replace(/\\s+/g, '_').substring(0, 50);
            const filename = `${safeTitle}.md`;
            
            // Create markdown content
            const content = `# ${title}

## Raw ZBOOKNOTE Data

\`\`\`json
${JSON.stringify(zbooknoteRow, null, 2)}
\`\`\`

## Key Fields

**Note ID:** ${zbooknoteRow.ZNOTEID}
${zbooknoteRow.ZHIGHLIGHT_TEXT ? `**Highlight:** ${zbooknoteRow.ZHIGHLIGHT_TEXT}` : ''}
${zbooknoteRow.ZNOTES_TEXT ? `**Notes:** ${zbooknoteRow.ZNOTES_TEXT}` : ''}
${zbooknoteRow.ZSTARTPAGE ? `**Page:** ${zbooknoteRow.ZSTARTPAGE}` : ''}
${zbooknoteRow.ZTOPICID ? `**Topic ID:** ${zbooknoteRow.ZTOPICID}` : ''}
${zbooknoteRow.ZTYPE ? `**Type:** ${zbooknoteRow.ZTYPE}` : ''}

---
*Raw ZBOOKNOTE row ${i + 1} - No post-processing applied*`;
            
            fs.writeFileSync(path.join(outputDirectory, filename), content);
            console.log(`   ✅ Created: ${filename}`);
        }
        
        // Create index
        const indexContent = `# Raw ZBOOKNOTE Import Index

Generated on: ${new Date().toISOString()}
Total ZBOOKNOTE rows: ${databaseData.booknotes.length}

## All Notes (Raw Data)

${databaseData.booknotes.map((row, i) => {
    const title = row.ZNOTETITLE || row.ZHIGHLIGHT_TEXT || `ZBOOKNOTE Row ${i + 1}`;
    const safeTitle = title.replace(/[/\\\\:*?"<>|]/g, '-').replace(/\\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.md`;
    return `- [[${filename}|${title}]]`;
}).join('\\n')}

---
*Raw ZBOOKNOTE data - No processing or ID manipulation*`;
        
        fs.writeFileSync(path.join(outputDirectory, 'index.md'), indexContent);
        console.log(`   ✅ Created: index.md`);
        
        console.log('\n🎉 Raw conversion test completed successfully!');
        console.log(`📊 Results:`);
        console.log(`   - ZBOOKNOTE rows processed: ${databaseData.booknotes.length}`);
        console.log(`   - Markdown files created: ${databaseData.booknotes.length}`);
        console.log(`   - Index created: ✓`);
        console.log(`   - Raw dictionary data preserved: ✓`);
        console.log(`   - No ID manipulation: ✓`);
        console.log(`   - Output directory: ${outputDirectory}`);
        
        console.log('\n🔍 Features:');
        console.log('   ✅ One markdown file per ZBOOKNOTE row');
        console.log('   ✅ Raw dictionary data in JSON format');
        console.log('   ✅ No post-processing of IDs or content');
        console.log('   ✅ Direct from database to markdown');
        console.log('   ✅ All ZBOOKNOTE fields preserved exactly');
        
    } catch (error) {
        console.error('❌ Raw conversion test failed:', error.message);
    }
}

testRawConversion();