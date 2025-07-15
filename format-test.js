// Test the exact markdown formatting logic
const fs = require('fs');
const path = require('path');

// Create a test MbBookNote object that matches the working_export.ts structure
const testNote = {
  excerptText: " discontinuous parts",
  noteTitle: undefined,
  colorIndex: "mbooks-annotation1a",
  fillIndex: null,
  mindmapPosition: null,
  noteId: "03A62BFD-93DB-4270-A2A6-ABF2036FB492",
  docMd5: "a474fc055562b0d594a7702c779a8ba4a474fc055562b0d594a7702c779a8ba4",
  notebookId: "057613E7-CEA4-4952-BB23-34B9214CA64A",
  startPage: 1,
  endPage: 1,
  startPos: "153.000000,721.000000",
  endPos: "256.753015,707.201946",
  excerptPic: undefined,
  createDate: 769406564.883809,
  modifiedDate: 769568005.940369,
  mediaList: "8f044298a3cc90393c6e8397bf7eaed9-",
  originNoteId: null,
  mindmapBranchClose: 0,
  notesText: "",
  groupNoteId: "1D871DAB-802E-4547-A38A-663F68EF33C3",
  realGroupNoteIdForTopicId: null,
  comments: null,
  parentNote: "1D871DAB-802E-4547-A38A-663F68EF33C3",
  linkedNotes: [],
  childNotes: [],
  summaryLinks: null,
  zLevel: -2147482877,
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

// Apply the exact formatting logic from working_export.ts lines 362-368
const mdContent = Object.entries(testNote)
  .map(([key, value]) => {
    if (key === 'noteTitle') return `# ${value}`;
    if (Array.isArray(value)) return `**${key}**: ${value.join(', ')}`;
    return `**${key}**: ${value}`;
  })
  .join('\n\n');

console.log('Generated markdown:');
console.log(mdContent);

// Compare with the expected output
const expectedFile = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/markdown_output/03A62BFD-93DB-4270-A2A6-ABF2036FB492.md';
if (fs.existsSync(expectedFile)) {
  const expected = fs.readFileSync(expectedFile, 'utf-8');
  console.log('\n\nExpected markdown:');
  console.log(expected);
  
  console.log('\n\nDo they match?', mdContent === expected ? 'YES' : 'NO');
  
  if (mdContent !== expected) {
    console.log('\n\nDifferences found. Let me check line by line...');
    const generatedLines = mdContent.split('\n');
    const expectedLines = expected.split('\n');
    
    const maxLines = Math.max(generatedLines.length, expectedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const gen = generatedLines[i] || '';
      const exp = expectedLines[i] || '';
      if (gen !== exp) {
        console.log(`Line ${i + 1}:`);
        console.log(`  Generated: "${gen}"`);
        console.log(`  Expected:  "${exp}"`);
      }
    }
  }
}