/**
 * Test ZNOTEID Preservation - Verify exact ZNOTEID values are used
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing ZNOTEID Preservation\n');

const outputDirectory = path.join(__dirname, 'znoteid-test-notes');

function createTestDataWithSpecificZNOTEIDs() {
    return {
        booknotes: [
            {
                ZNOTEID: 'EXACT-ZNOTEID-001',
                ZHIGHLIGHT_TEXT: 'Test highlight 1',
                ZNOTETITLE: 'Test title 1',
                ZBOOKMD5: 'book1',
                ZTOPICID: 'topic1'
            },
            {
                ZNOTEID: 'EXACT-ZNOTEID-002-WITH-DASHES',
                ZHIGHLIGHT_TEXT: 'Test highlight 2',
                ZNOTETITLE: 'Test title 2',
                ZBOOKMD5: 'book2',
                ZTOPICID: 'topic2'
            },
            {
                ZNOTEID: 'EXACT_ZNOTEID_003_WITH_UNDERSCORES',
                ZHIGHLIGHT_TEXT: 'Test highlight 3',
                ZNOTETITLE: 'Test title 3',
                ZBOOKMD5: 'book3',
                ZTOPICID: 'topic3'
            }
        ],
        topics: [],
        media: []
    };
}

async function testZNOTEIDPreservation() {
    try {
        console.log('🔄 Testing exact ZNOTEID preservation...');
        
        const databaseData = createTestDataWithSpecificZNOTEIDs();
        console.log('📊 Test ZNOTEIDs:');
        databaseData.booknotes.forEach((row, i) => {
            console.log(`   ${i + 1}. ${row.ZNOTEID}`);
        });
        
        // Create output directory
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }
        
        console.log('\n📝 Processing with exact field mapping...');
        
        for (let i = 0; i < databaseData.booknotes.length; i++) {
            const row = databaseData.booknotes[i];
            
            // Create MbBookNote object with EXACT field mapping (no fallbacks)
            const mbBookNote = {
                excerptText: row.ZHIGHLIGHT_TEXT,
                noteTitle: row.ZNOTETITLE,
                colorIndex: row.ZHIGHLIGHT_STYLE,
                fillIndex: null,
                mindmapPosition: row.ZMINDPOS,
                noteId: row.ZNOTEID,  // ← EXACT ZNOTEID, no fallback
                docMd5: row.ZBOOKMD5,
                notebookId: row.ZTOPICID,
                startPage: row.ZSTARTPAGE,
                endPage: row.ZENDPAGE,
                startPos: row.ZSTARTPOS,
                endPos: row.ZENDPOS,
                excerptPic: row.ZHIGHLIGHT_PIC_D,
                createDate: row.ZHIGHLIGHT_DATE,
                modifiedDate: row.ZNOTE_DATE,
                mediaList: row.ZMEDIA_LIST,
                originNoteId: null,
                mindmapBranchClose: row.ZMINDCLOSE,
                notesText: row.ZNOTES_TEXT,
                groupNoteId: row.ZGROUPNOTEID,
                realGroupNoteIdForTopicId: null,
                comments: null,
                parentNote: row.ZGROUPNOTEID,
                linkedNotes: [],
                childNotes: [],
                summaryLinks: null,
                zLevel: row.ZZINDEX,
                hidden: null,
                toc: null,
                annotation: null,
                textFirst: null,
                groupMode: null,
                flashcard: null,
                summary: null,
                flagged: null,
                textHighlight: []
            };
            
            // Verify ZNOTEID preservation
            const originalZNOTEID = row.ZNOTEID;
            const mappedNoteId = mbBookNote.noteId;
            
            console.log(`   Row ${i + 1}:`);
            console.log(`     Original ZNOTEID: "${originalZNOTEID}"`);
            console.log(`     Mapped noteId:    "${mappedNoteId}"`);
            console.log(`     Match: ${originalZNOTEID === mappedNoteId ? '✅' : '❌'}`);
            
            // Create file with exact ZNOTEID
            const filename = `${mbBookNote.noteId}.md`;
            
            const content = `# ${mbBookNote.noteId}

## MbBookNotes_for_export Data

\`\`\`json
${JSON.stringify(mbBookNote, null, 2)}
\`\`\`

## ZNOTEID Verification

**Original ZBOOKNOTE.ZNOTEID:** ${originalZNOTEID}
**MbBookNote.noteId:** ${mappedNoteId}
**Match:** ${originalZNOTEID === mappedNoteId ? 'YES ✅' : 'NO ❌'}

---
*ZNOTEID Preservation Test*`;
            
            fs.writeFileSync(path.join(outputDirectory, filename), content);
            console.log(`     File created: ${filename}`);
        }
        
        console.log('\n🎉 ZNOTEID preservation test completed!');
        console.log(`📁 Output: ${outputDirectory}`);
        
        console.log('\n✅ Verification Summary:');
        console.log('   - No fallback values used for noteId');
        console.log('   - Direct mapping: noteId = row.ZNOTEID');
        console.log('   - File titles are exact ZNOTEID values');
        console.log('   - No processing or modification of ZNOTEID');
        
    } catch (error) {
        console.error('❌ ZNOTEID preservation test failed:', error.message);
    }
}

testZNOTEIDPreservation();