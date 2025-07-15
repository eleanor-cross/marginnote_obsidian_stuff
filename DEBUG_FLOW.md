# MarginNote-Obsidian Plugin Debug Flow

## Overview
This document provides a step-by-step debugging flow for the MarginNote-Obsidian plugin to help identify where processing failures occur.

## Processing Pipeline Flow

### 1. Plugin Initialization
**File:** `main.ts`
**Function:** `onload()`

```
Plugin Loads → Registers Commands → Adds Settings Tab → Waits for User Action
```

**Debug Points:**
- Check if plugin appears in Obsidian's community plugins list
- Verify ribbon icon appears (book-open icon)
- Check if command "Import MarginNote file" appears in command palette

**Console Logs to Look For:**
```
(No specific logs at this stage)
```

---

### 2. User Triggers Import
**File:** `main.ts`  
**Function:** `openImportDialog()`

```
User Clicks Ribbon/Command → File Dialog Opens → User Selects .marginpkg File → File Validation
```

**Debug Points:**
- Does file dialog open when clicking ribbon icon?
- Can you select .marginpkg files in the dialog?
- Check file validation logic

**Console Logs to Look For:**
```
"Starting MarginNote import..."
```

**Common Issues:**
- File dialog doesn't appear: Check browser file API support
- Can't select .marginpkg: Check file filter settings

---

### 3. File Validation
**File:** `main.ts`  
**Function:** `importMarginNoteFile()` → `isValidMarginPkgFile()`

```
File Selected → Check Extension → Check File Size → Validation Result
```

**Debug Points:**
- File must end with `.marginpkg`
- File size must be < 500MB
- File must exist and be readable

**Console Logs to Look For:**
```
"File size exceeds maximum expected size" (if too large)
```

**Test Commands:**
```bash
# Check if your file meets criteria
ls -la "Testing3(2025-06-26-00-19-38).marginpkg"
file "Testing3(2025-06-26-00-19-38).marginpkg"
```

---

### 4. Database Parsing - ZIP Extraction
**File:** `src/core/database-parser.ts`  
**Function:** `parseMarginPkg()` → `extractMarginPkgFiles()`

```
File Buffer → ZIP Signature Check → Central Directory Search → File Extraction
```

**Debug Points:**
- ZIP signature should be `0x04034b50`
- Central directory should be found
- Files should be extracted and decompressed

**Console Logs to Look For:**
```
"Parsing .marginpkg file..."
"Parsing ZIP archive..."
"Found central directory at offset: XXXXX"
"Found file: Testing3(2025-06-26-00-19-38).marginnotes, method: 8, compressed: XXXXX, uncompressed: XXXXX"
"Successfully parsed X files from ZIP"
```

**Manual Test:**
```bash
# Run our ZIP extraction test
cd "/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian"
node test-fixed-zip.js
```

---

### 5. Database Content Parsing
**File:** `src/core/database-parser.ts`  
**Function:** `parseSQLiteDatabase()` → `parseMarginNoteFormat()`

```
SQLite Database → Text Extraction → Pattern Matching → Note Creation
```

**Debug Points:**
- SQLite header should be detected: "SQLite format 3"
- Text patterns should be found and extracted
- Valid notes should be created

**Console Logs to Look For:**
```
"Parsing MarginNote database..."
"Extracting notes from text data, length: XXXXX"
"Extracted X notes from text content"
```

**Manual Test:**
```bash
# Check if database was extracted properly
ls -la extracted_*.marginnotes
head -c 100 "extracted_Testing3(2025-06-26-00-19-38).marginnotes"
```

---

### 6. Content Processing Pipeline
**File:** `src/core/margin-note-importer.ts`  
**Function:** `importMarginNoteData()`

```
Database Data → Content Extraction → Deduplication → Obsidian Conversion → File Preparation
```

**Debug Points:**
- Content groups should be extracted from database
- Deduplication should process groups
- Obsidian notes should be generated
- Output files should be prepared

**Console Logs to Look For:**
```
"Starting MarginNote import..."
"Step 1: Processing database content..."
"Extracted X content groups"
"Step 2: Deduplicating content..."
"Deduplicated to X unique content groups"
"Step 3: Converting to Obsidian markdown..."
"Step 4: Preparing output data..."
"Import completed successfully!"
"Generated X Obsidian notes"
```

---

### 7. File Writing to Vault
**File:** `main.ts`  
**Function:** `writeNotesToVault()`

```
Import Result → Folder Creation → File Writing → Success Notice
```

**Debug Points:**
- Output folder should be created
- Subdirectories should be created if enabled
- Files should be written to vault
- Import report should be saved

**Console Logs to Look For:**
```
"Writing X files to vault..."
"Import completed! Created X files in: MarginNote Import"
"Import report saved to: MarginNote Import/marginnote_import_report.json"
```

**Manual Check:**
```bash
# Check if files were created in Obsidian vault
ls -la "/path/to/obsidian/vault/MarginNote Import/"
```

---

## Debug Commands & Tests

### Test 1: ZIP Extraction
```bash
cd "/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian"
node test-fixed-zip.js
```
**Expected Output:** Should extract SQLite database and show content patterns

### Test 2: Build Verification
```bash
npm run build
```
**Expected Output:** No TypeScript errors, main.js should be generated

### Test 3: File Existence Check
```bash
ls -la temp/Testing3*
file temp/Testing3*
```

### Test 4: Plugin File Check
```bash
ls -la main.js manifest.json
```

---

## Common Failure Points & Solutions

### Issue: "Importing creates folders but no notes"

**Possible Causes:**
1. **ZIP extraction fails** → Check test-fixed-zip.js output
2. **Content extraction finds no valid patterns** → Check extracted_content.txt
3. **File writing permissions** → Check Obsidian vault permissions
4. **Empty import result** → Check console logs for content processing

**Debug Steps:**
```bash
# 1. Test ZIP extraction
node test-fixed-zip.js

# 2. Check extracted content
cat extracted_content.txt

# 3. Check plugin build
npm run build

# 4. Check Obsidian console
# Open Obsidian → Developer Tools → Console → Look for errors
```

### Issue: Plugin doesn't appear in Obsidian

**Possible Causes:**
1. **Build failed** → Run npm run build
2. **Wrong location** → Plugin must be in .obsidian/plugins/marginnote-obsidian/
3. **Manifest issues** → Check manifest.json syntax
4. **Not enabled** → Enable in Obsidian settings

### Issue: File dialog doesn't open

**Possible Causes:**
1. **Browser security** → Obsidian file API restrictions
2. **Plugin not loaded** → Check plugin status in settings
3. **JavaScript errors** → Check browser console

---

## Step-by-Step Manual Debug Process

### Step 1: Verify Plugin Installation
```bash
cd "/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian"
ls -la main.js manifest.json
```

### Step 2: Test ZIP Processing
```bash
node test-fixed-zip.js > debug-zip.log 2>&1
cat debug-zip.log
```

### Step 3: Test TypeScript Build
```bash
npm run build > debug-build.log 2>&1
cat debug-build.log
```

### Step 4: Check File Permissions
```bash
ls -la temp/Testing3*
stat temp/Testing3*
```

### Step 5: Obsidian Console Check
1. Open Obsidian
2. Press Ctrl+Shift+I (Developer Tools)
3. Go to Console tab
4. Try importing file
5. Look for errors/logs

### Step 6: Check Generated Files
```bash
# After attempting import
ls -la "../../../MarginNote Import/"
cat "../../../MarginNote Import/marginnote_import_report.json"
```

---

## Expected Console Output (Success Case)

```
Starting MarginNote import...
Parsing ZIP archive...
Found central directory at offset: 400839
Found file: Testing3(2025-06-26-00-19-38).marginnotes, method: 8, compressed: 371529, uncompressed: 884736
Successfully decompressed data: 884736 bytes
Successfully parsed 5 files from ZIP
Parsing MarginNote database...
Extracting notes from text data, length: 884736
Extracted 3 notes from text content
Step 1: Processing database content...
Extracted 3 content groups
Step 2: Deduplicating content...
Deduplicated to 3 unique content groups
Step 3: Converting to Obsidian markdown...
Step 4: Preparing output data...
Import completed successfully!
Generated 3 Obsidian notes
Writing 3 files to vault...
Import completed! Created 3 files in: MarginNote Import
```

---

## Next Steps for User

1. **Run each test command above**
2. **Check console output in Obsidian**
3. **Verify file permissions and locations**
4. **Report which step fails with specific error messages**

This will help identify exactly where in the pipeline the issue occurs.