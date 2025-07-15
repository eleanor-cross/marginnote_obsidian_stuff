// Test exact format matching
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Test with Example Note Database
const db = new Database('/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3_extracted/Testing3(2025-06-26-00-19-38).marginnotes');

function getTableByName(tableName) {
    const stmt = db.prepare(`SELECT * FROM "${tableName}"`);
    return stmt.all();
}

const ZBOOKNOTE = getTableByName('ZBOOKNOTE');
console.log(`Found ${ZBOOKNOTE.length} notes in ZBOOKNOTE`);

// Test first note
const firstNote = ZBOOKNOTE[0];
console.log('\nFirst note ZNOTEID:', firstNote.ZNOTEID);
console.log('Available fields:', Object.keys(firstNote));

// Create MbBookNotes_for_export object exactly like working_export.ts
const mbBookNote = {
  excerptText: firstNote.ZHIGHLIGHT_TEXT,
  noteTitle: firstNote.ZTITLE,
  colorIndex: firstNote.ZHIGHLIGHT_STYLE,
  fillIndex: null,
  mindmapPosition: firstNote.ZMINDPOS,
  noteId: firstNote.ZNOTEID,
  docMd5: firstNote.ZBOOKMD5,
  notebookId: firstNote.ZTOPICID,
  startPage: firstNote.ZSTARTPAGE,
  endPage: firstNote.ZENDPAGE,
  startPos: firstNote.ZSTARTPOS,
  endPos: firstNote.ZENDPOS,
  excerptPic: firstNote.ZHIGHLIGHT_PIC_D,
  createDate: firstNote.ZHIGHLIGHT_DATE,
  modifiedDate: firstNote.ZNOTE_DATE,
  mediaList: firstNote.ZMEDIA_LIST,
  originNoteId: firstNote.ZEVERNOTEID,
  mindmapBranchClose: firstNote.ZMINDCLOSE,
  notesText: firstNote.ZNOTES_TEXT,
  groupNoteId: firstNote.ZGROUPNOTEID,
  realGroupNoteIdForTopicId: null,
  comments: null,
  parentNote: firstNote.ZGROUPNOTEID,
  linkedNotes: [],
  childNotes: [],
  summaryLinks: null,
  zLevel: firstNote.ZZINDEX,
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

// Create markdown content exactly like working_export.ts
const mdContent = Object.entries(mbBookNote)
  .map(([key, value]) => {
    if (key === 'noteTitle') return `# ${value}`;
    if (Array.isArray(value)) return `**${key}**: ${value.join(', ')}`;
    return `**${key}**: ${value}`;
  })
  .join('\n\n');

console.log('\nGenerated markdown content:');
console.log(mdContent);

// Save test file
const testDir = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/test-output';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const filename = `${firstNote.ZNOTEID}.md`;
const filePath = path.join(testDir, filename);
fs.writeFileSync(filePath, mdContent);

console.log(`\nTest file created: ${filePath}`);
console.log(`Note ID: ${firstNote.ZNOTEID}`);

db.close();