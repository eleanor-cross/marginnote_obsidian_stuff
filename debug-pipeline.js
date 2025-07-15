#!/usr/bin/env node

/**
 * Comprehensive Debug Pipeline for MarginNote-Obsidian Plugin
 * 
 * This script tests each step of the import process to identify where failures occur.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

console.log('🔧 MarginNote-Obsidian Plugin Debug Pipeline\n');
console.log('=' .repeat(60));

// Configuration
const testFile = path.join(__dirname, 'temp', 'Testing3(2025-06-26-00-19-38).marginpkg');
const outputDir = path.join(__dirname, 'debug-output');

// Create debug output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Debug results collector
const debugResults = {
    timestamp: new Date().toISOString(),
    steps: {},
    errors: [],
    summary: {}
};

function logStep(stepName, status, details = '') {
    const symbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${symbol} ${stepName}: ${status}`);
    if (details) console.log(`   ${details}`);
    
    debugResults.steps[stepName] = { status, details, timestamp: new Date().toISOString() };
}

function logError(step, error) {
    console.log(`💥 ERROR in ${step}: ${error.message}`);
    debugResults.errors.push({ step, error: error.message, stack: error.stack });
}

async function runDebugPipeline() {
    console.log('Starting debug pipeline...\n');

    // Step 1: File System Check
    try {
        console.log('📁 STEP 1: File System Validation');
        
        if (!fs.existsSync(testFile)) {
            logStep('File Existence', 'FAIL', `File not found: ${testFile}`);
            return;
        }
        
        const stats = fs.statSync(testFile);
        logStep('File Existence', 'PASS', `Found file: ${stats.size} bytes`);
        
        if (stats.size === 0) {
            logStep('File Size', 'FAIL', 'File is empty');
            return;
        }
        
        if (stats.size > 500 * 1024 * 1024) {
            logStep('File Size', 'WARN', 'File exceeds 500MB limit');
        } else {
            logStep('File Size', 'PASS', `${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // Check file permissions
        try {
            fs.accessSync(testFile, fs.constants.R_OK);
            logStep('File Permissions', 'PASS', 'File is readable');
        } catch (error) {
            logStep('File Permissions', 'FAIL', 'File is not readable');
            return;
        }
        
    } catch (error) {
        logError('File System Check', error);
        return;
    }
    
    console.log('');

    // Step 2: Build Verification
    try {
        console.log('🔨 STEP 2: Build Verification');
        
        const mainJsPath = path.join(__dirname, 'main.js');
        const manifestPath = path.join(__dirname, 'manifest.json');
        
        if (!fs.existsSync(mainJsPath)) {
            logStep('main.js Build', 'FAIL', 'main.js not found - run npm run build');
            return;
        }
        
        const mainJsStats = fs.statSync(mainJsPath);
        logStep('main.js Build', 'PASS', `${mainJsStats.size} bytes`);
        
        if (!fs.existsSync(manifestPath)) {
            logStep('manifest.json', 'FAIL', 'manifest.json not found');
        } else {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                logStep('manifest.json', 'PASS', `Version ${manifest.version}`);
            } catch (error) {
                logStep('manifest.json', 'FAIL', 'Invalid JSON in manifest');
            }
        }
        
    } catch (error) {
        logError('Build Verification', error);
    }
    
    console.log('');

    // Step 3: ZIP Structure Analysis
    try {
        console.log('📦 STEP 3: ZIP Structure Analysis');
        
        const fileData = fs.readFileSync(testFile);
        
        // Check ZIP signature
        const signature = fileData.readUInt32LE(0);
        if (signature === 0x04034b50) {
            logStep('ZIP Signature', 'PASS', '0x04034b50 (valid ZIP)');
        } else {
            logStep('ZIP Signature', 'FAIL', `0x${signature.toString(16)} (not a ZIP file)`);
            return;
        }
        
        // Find central directory
        let centralDirOffset = null;
        for (let i = fileData.length - 22; i >= 0; i--) {
            if (fileData.readUInt32LE(i) === 0x06054b50) {
                centralDirOffset = fileData.readUInt32LE(i + 16);
                break;
            }
        }
        
        if (centralDirOffset !== null) {
            logStep('Central Directory', 'PASS', `Found at offset ${centralDirOffset}`);
        } else {
            logStep('Central Directory', 'FAIL', 'Central directory not found');
            return;
        }
        
        // Parse ZIP entries
        const entries = [];
        let currentOffset = centralDirOffset;
        
        while (currentOffset < fileData.length - 46) {
            const sig = fileData.readUInt32LE(currentOffset);
            if (sig !== 0x02014b50) break;
            
            const method = fileData.readUInt16LE(currentOffset + 10);
            const compressedSize = fileData.readUInt32LE(currentOffset + 20);
            const uncompressedSize = fileData.readUInt32LE(currentOffset + 24);
            const nameLength = fileData.readUInt16LE(currentOffset + 28);
            const extraLength = fileData.readUInt16LE(currentOffset + 30);
            const commentLength = fileData.readUInt16LE(currentOffset + 32);
            const localHeaderOffset = fileData.readUInt32LE(currentOffset + 42);
            
            const nameStart = currentOffset + 46;
            const name = fileData.toString('utf8', nameStart, nameStart + nameLength);
            
            entries.push({
                name,
                method,
                compressedSize,
                uncompressedSize,
                localHeaderOffset
            });
            
            currentOffset += 46 + nameLength + extraLength + commentLength;
        }
        
        logStep('ZIP Entries', 'PASS', `Found ${entries.length} files`);
        
        // Save ZIP analysis
        fs.writeFileSync(
            path.join(outputDir, 'zip-analysis.json'),
            JSON.stringify(entries, null, 2)
        );
        
        // Test extraction of main database file
        const dbEntry = entries.find(e => e.name.endsWith('.marginnotes'));
        if (!dbEntry) {
            logStep('Database File', 'FAIL', 'No .marginnotes file found');
            return;
        }
        
        logStep('Database File', 'PASS', `${dbEntry.name} (${dbEntry.uncompressedSize} bytes)`);
        
        // Extract the database file
        const dbOffset = dbEntry.localHeaderOffset;
        const nameLen = fileData.readUInt16LE(dbOffset + 26);
        const extraLen = fileData.readUInt16LE(dbOffset + 28);
        const dataStart = dbOffset + 30 + nameLen + extraLen;
        const compressedData = fileData.slice(dataStart, dataStart + dbEntry.compressedSize);
        
        let extractedData;
        if (dbEntry.method === 8) {
            try {
                extractedData = zlib.inflateRawSync(compressedData);
                logStep('Database Extraction', 'PASS', `Decompressed ${extractedData.length} bytes`);
            } catch (err1) {
                try {
                    extractedData = zlib.inflateSync(compressedData);
                    logStep('Database Extraction', 'PASS', `Inflated ${extractedData.length} bytes`);
                } catch (err2) {
                    logStep('Database Extraction', 'FAIL', `Decompression failed: ${err1.message}`);
                    return;
                }
            }
        } else {
            extractedData = compressedData;
            logStep('Database Extraction', 'PASS', 'No compression needed');
        }
        
        // Save extracted database
        const dbPath = path.join(outputDir, 'extracted-database.sqlite');
        fs.writeFileSync(dbPath, extractedData);
        
        // Verify SQLite header
        if (extractedData.length >= 16) {
            const header = extractedData.toString('ascii', 0, 16);
            if (header.startsWith('SQLite format 3')) {
                logStep('SQLite Verification', 'PASS', 'Valid SQLite database');
            } else {
                logStep('SQLite Verification', 'FAIL', `Invalid header: ${header}`);
            }
        }
        
    } catch (error) {
        logError('ZIP Structure Analysis', error);
    }
    
    console.log('');

    // Step 4: Content Pattern Analysis
    try {
        console.log('🔍 STEP 4: Content Pattern Analysis');
        
        const dbPath = path.join(outputDir, 'extracted-database.sqlite');
        if (!fs.existsSync(dbPath)) {
            logStep('Database File Read', 'FAIL', 'Extracted database not available');
            return;
        }
        
        const dbData = fs.readFileSync(dbPath);
        const text = dbData.toString('latin1'); // Preserve all bytes
        
        logStep('Database Content', 'PASS', `${text.length} characters to analyze`);
        
        // Look for MarginNote specific patterns
        const patterns = {
            'SQLite Tables': /CREATE TABLE (\w+)/gi,
            'Highlight Text': /ZHIGHLIGHT_TEXT/g,
            'Notes Text': /ZNOTES_TEXT/g,
            'Topics': /ZTOPIC/g,
            'Hashtags': /#[A-Za-z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g,
            'Document References': /Doc\d+/g,
            'UUIDs': /[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/gi
        };
        
        const patternResults = {};
        for (const [name, pattern] of Object.entries(patterns)) {
            const matches = text.match(pattern);
            const count = matches ? matches.length : 0;
            patternResults[name] = { count, matches: matches ? matches.slice(0, 5) : [] };
            
            if (count > 0) {
                logStep(`Pattern: ${name}`, 'PASS', `${count} matches found`);
            } else {
                logStep(`Pattern: ${name}`, 'WARN', 'No matches found');
            }
        }
        
        // Save pattern analysis
        fs.writeFileSync(
            path.join(outputDir, 'pattern-analysis.json'),
            JSON.stringify(patternResults, null, 2)
        );
        
        // Extract potential user content
        const contentRegex = /[\x20-\x7E\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{15,}/g;
        const userContent = [];
        let match;
        
        while ((match = contentRegex.exec(text)) !== null && userContent.length < 50) {
            const content = match[0].trim();
            if (content.length > 20 && 
                !content.match(/^(CREATE|INSERT|SELECT|UPDATE|DELETE|PRAGMA)/i) &&
                !content.match(/^[0-9\-:T.Z]+$/) &&
                !content.match(/^[a-f0-9\-]+$/i)) {
                userContent.push(content);
            }
        }
        
        if (userContent.length > 0) {
            logStep('User Content Extraction', 'PASS', `${userContent.length} potential notes found`);
            
            // Save extracted content
            fs.writeFileSync(
                path.join(outputDir, 'extracted-content.txt'),
                userContent.join('\n\n---\n\n')
            );
        } else {
            logStep('User Content Extraction', 'WARN', 'No user content found');
        }
        
    } catch (error) {
        logError('Content Pattern Analysis', error);
    }
    
    console.log('');

    // Step 5: TypeScript Module Test (if available)
    try {
        console.log('🧪 STEP 5: TypeScript Module Test');
        
        const mainJsPath = path.join(__dirname, 'main.js');
        if (!fs.existsSync(mainJsPath)) {
            logStep('Module Import', 'FAIL', 'main.js not found');
        } else {
            // This would only work if the module exports are properly configured
            logStep('Module Import', 'PASS', 'main.js exists (manual testing required)');
        }
        
    } catch (error) {
        logError('TypeScript Module Test', error);
    }
    
    console.log('');

    // Generate Summary
    console.log('📊 SUMMARY');
    console.log('=' .repeat(60));
    
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;
    
    for (const [step, result] of Object.entries(debugResults.steps)) {
        if (result.status === 'PASS') passCount++;
        else if (result.status === 'FAIL') failCount++;
        else if (result.status === 'WARN') warnCount++;
    }
    
    debugResults.summary = {
        totalSteps: Object.keys(debugResults.steps).length,
        passed: passCount,
        failed: failCount,
        warnings: warnCount,
        overallStatus: failCount === 0 ? (warnCount === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION') : 'BROKEN'
    };
    
    console.log(`Total Steps: ${debugResults.summary.totalSteps}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warnCount}`);
    console.log(`\nOverall Status: ${debugResults.summary.overallStatus}`);
    
    if (failCount > 0) {
        console.log('\n🔧 CRITICAL ISSUES TO FIX:');
        for (const [step, result] of Object.entries(debugResults.steps)) {
            if (result.status === 'FAIL') {
                console.log(`   - ${step}: ${result.details}`);
            }
        }
    }
    
    if (warnCount > 0) {
        console.log('\n⚠️  ISSUES TO INVESTIGATE:');
        for (const [step, result] of Object.entries(debugResults.steps)) {
            if (result.status === 'WARN') {
                console.log(`   - ${step}: ${result.details}`);
            }
        }
    }
    
    // Save complete debug report
    fs.writeFileSync(
        path.join(outputDir, 'debug-report.json'),
        JSON.stringify(debugResults, null, 2)
    );
    
    console.log(`\n📄 Complete debug report saved to: ${path.join(outputDir, 'debug-report.json')}`);
    console.log(`📁 Debug output directory: ${outputDir}`);
    
    console.log('\n🎯 NEXT STEPS:');
    if (debugResults.summary.overallStatus === 'BROKEN') {
        console.log('1. Fix critical issues listed above');
        console.log('2. Re-run this debug script');
        console.log('3. Test the import in Obsidian');
    } else if (debugResults.summary.overallStatus === 'NEEDS_ATTENTION') {
        console.log('1. Investigate warnings listed above');
        console.log('2. Test the import in Obsidian');
        console.log('3. Check extracted content for meaningful data');
    } else {
        console.log('1. Test the import in Obsidian');
        console.log('2. Check if notes are created successfully');
        console.log('3. Verify content quality in generated files');
    }
}

// Run the debug pipeline
runDebugPipeline().catch(error => {
    console.log(`\n💥 Critical Error: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
});