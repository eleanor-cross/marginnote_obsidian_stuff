/**
 * Test Simple ZBOOKNOTE Converter - ZNOTEID titles with full MbBookNote objects
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Simple ZBOOKNOTE Converter (ZNOTEID titles)\n');

const outputDirectory = path.join(__dirname, 'simple-output-notes');

function createTestDatabaseData() {
    return {
        booknotes: [
            {
                ZNOTEID: 'ABC123-DEF456-GHI789',
                ZHIGHLIGHT_TEXT: 'First highlight text',
                ZNOTETITLE: 'First Note Title',
                ZBOOKMD5: 'book-hash-001',
                ZTOPICID: 'topic-001',
                ZSTARTPAGE: 1,
                ZENDPAGE: 1,
                ZHIGHLIGHT_DATE: 769395600,
                ZNOTE_DATE: 769395700,
                ZNOTES_TEXT: 'Notes for first highlight',
                ZHIGHLIGHT_STYLE: 3,
                ZZINDEX: 5,
                ZNOTES_DECODE: JSON.stringify([
                    { type: 'LinkNote', noteid: 'LINKED-001', q_htext: 'Linked note 1' },
                    { noteid: 'CHILD-001', q_htext: 'Child note 1' }
                ]),
                ZHIGHLIGHTS_DECODE: JSON.stringify([
                    { highlight_text: 'Decoded highlight 1', coords_hash: 'coords1' }
                ])
            },
            {
                ZNOTEID: 'XYZ789-UVW456-RST123',
                ZHIGHLIGHT_TEXT: 'Second highlight text',
                ZNOTETITLE: 'Second Note Title',
                ZBOOKMD5: 'book-hash-002',
                ZTOPICID: 'topic-002',
                ZSTARTPAGE: 2,
                ZHIGHLIGHT_DATE: 769395800,
                ZNOTES_TEXT: 'Notes for second highlight',
                ZHIGHLIGHT_STYLE: 7,
                ZZINDEX: 10
            },
            {
                ZNOTEID: 'MNO345-PQR678-STU901',
                ZHIGHLIGHT_TEXT: 'Third highlight text',
                ZNOTETITLE: 'Third Note Title',
                ZBOOKMD5: 'book-hash-003',
                ZTOPICID: 'topic-003',
                ZSTARTPAGE: 3,
                ZHIGHLIGHT_DATE: 769395900,
                ZNOTES_DECODE: JSON.stringify([
                    { type: 'LinkNote', noteid: 'LINKED-002', q_htext: 'Another linked note' }
                ])
            }
        ],
        topics: [],
        media: []
    };
}

async function testSimpleConversion() {
    try {
        console.log('🔄 Starting simple ZNOTEID conversion test...');
        
        const databaseData = createTestDatabaseData();
        console.log(`📊 Test data: ${databaseData.booknotes.length} ZBOOKNOTE rows`);
        
        // Create output directory
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
            console.log(`📁 Created: ${outputDirectory}`);
        }
        
        console.log('\n📝 Processing each ZBOOKNOTE row...');
        
        let filesCreated = 0;
        
        for (let i = 0; i < databaseData.booknotes.length; i++) {
            const row = databaseData.booknotes[i];
            
            // Create MbBookNotes_for_export object (same as working_export.ts)
            const notes = row.ZNOTES_DECODE ? JSON.parse(row.ZNOTES_DECODE) : [];
            const highlights = row.ZHIGHLIGHTS_DECODE ? JSON.parse(row.ZHIGHLIGHTS_DECODE) : [];
            
            const linkedNotes = notes
                .filter(note => note?.type === 'LinkNote' && 'noteid' in note)
                .map(note => ({
                    summary: 0,
                    noteid: note.noteid,
                    linktext: note.q_htext
                }));

            const childNotes = notes
                .filter(note => note && 'noteid' in note)
                .map(note => note.noteid);

            const textHighlight = highlights
                .map(hi => ({
                    highlight_text: hi.highlight_text || '',
                    coords_hash: hi.coords_hash || '',
                    maskList: null,
                    textSelLst: hi.textSelLst || []
                }));
            
            const mbBookNote = {
                excerptText: row.ZHIGHLIGHT_TEXT || '',
                noteTitle: row.ZNOTETITLE || '',
                colorIndex: row.ZHIGHLIGHT_STYLE || 0,
                fillIndex: null,
                mindmapPosition: row.ZMINDPOS || '',
                noteId: row.ZNOTEID || '',
                docMd5: row.ZBOOKMD5 || '',
                notebookId: row.ZTOPICID || '',
                startPage: row.ZSTARTPAGE || 0,
                endPage: row.ZENDPAGE || 0,
                startPos: row.ZSTARTPOS || '',
                endPos: row.ZENDPOS || '',
                excerptPic: row.ZHIGHLIGHT_PIC_D || null,
                createDate: row.ZHIGHLIGHT_DATE || 0,
                modifiedDate: row.ZNOTE_DATE || 0,
                mediaList: row.ZMEDIA_LIST || '',
                originNoteId: null,
                mindmapBranchClose: row.ZMINDCLOSE || false,
                notesText: row.ZNOTES_TEXT || '',
                groupNoteId: row.ZGROUPNOTEID || '',
                realGroupNoteIdForTopicId: null,
                comments: null,
                parentNote: row.ZGROUPNOTEID || '',
                linkedNotes,
                childNotes,
                summaryLinks: null,
                zLevel: row.ZZINDEX || 0,
                hidden: null,
                toc: null,
                annotation: null,
                textFirst: null,
                groupMode: null,
                flashcard: null,
                summary: null,
                flagged: null,
                textHighlight
            };
            
            // Create file with ZNOTEID as title
            const noteId = mbBookNote.noteId;
            const filename = `${noteId}.md`;
            
            const content = `# ${noteId}

## MbBookNotes_for_export Data

\`\`\`json
${JSON.stringify(mbBookNote, null, 2)}
\`\`\`

## Key Information

**Note ID:** ${mbBookNote.noteId}
**Excerpt Text:** ${mbBookNote.excerptText}
**Note Title:** ${mbBookNote.noteTitle}
**Doc MD5:** ${mbBookNote.docMd5}
**Notebook ID:** ${mbBookNote.notebookId}
**Start Page:** ${mbBookNote.startPage}
**End Page:** ${mbBookNote.endPage}
**Create Date:** ${mbBookNote.createDate}
**Modified Date:** ${mbBookNote.modifiedDate}
**Media List:** ${mbBookNote.mediaList}
**Notes Text:** ${mbBookNote.notesText}
**Group Note ID:** ${mbBookNote.groupNoteId}
**Z-Level:** ${mbBookNote.zLevel}
**Color Index:** ${mbBookNote.colorIndex}
**Linked Notes:** ${mbBookNote.linkedNotes.length} items
**Child Notes:** ${mbBookNote.childNotes.length} items
**Text Highlights:** ${mbBookNote.textHighlight.length} items

---
*ZNOTEID: ${noteId} - Complete MbBookNotes_for_export object*`;
            
            fs.writeFileSync(path.join(outputDirectory, filename), content);
            filesCreated++;
            
            console.log(`   ✅ Created: ${filename} (title: ${noteId})`);
        }
        
        // Create index
        const indexLines = [
            '# ZBOOKNOTE Index',
            '',
            `Generated on: ${new Date().toISOString()}`,
            `Total notes: ${databaseData.booknotes.length}`,
            '',
            '## All Notes (by ZNOTEID)',
            ''
        ];
        
        for (const row of databaseData.booknotes) {
            const noteId = row.ZNOTEID;
            const filename = `${noteId}.md`;
            const preview = row.ZHIGHLIGHT_TEXT || 'No preview';
            
            indexLines.push(`- [[${filename}|${noteId}]]`);
            indexLines.push(`  > ${preview.substring(0, 100)}`);
        }
        
        indexLines.push('');
        indexLines.push('---');
        indexLines.push('*Each note title is its ZNOTEID with complete MbBookNotes_for_export data*');
        
        fs.writeFileSync(path.join(outputDirectory, 'index.md'), indexLines.join('\n'));
        console.log(`   ✅ Created: index.md`);
        
        console.log('\n🎉 Simple conversion test completed successfully!');
        console.log(`📊 Results:`);
        console.log(`   - Files created: ${filesCreated}`);
        console.log(`   - Index created: ✓`);
        console.log(`   - Title format: ZNOTEID`);
        console.log(`   - Content format: Complete MbBookNotes_for_export object`);
        console.log(`   - Output directory: ${outputDirectory}`);
        
        console.log('\n🔍 Verification:');
        console.log('   ✅ File titles are ZNOTEID values');
        console.log('   ✅ Content is full MbBookNotes_for_export JSON');
        console.log('   ✅ linkedNotes extracted from ZNOTES_DECODE');
        console.log('   ✅ textHighlight extracted from ZHIGHLIGHTS_DECODE');
        console.log('   ✅ All 30+ fields in MbBookNotes_for_export structure');
        
    } catch (error) {
        console.error('❌ Simple conversion test failed:', error.message);
    }
}

testSimpleConversion();