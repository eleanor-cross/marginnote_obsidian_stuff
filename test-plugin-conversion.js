// Test the complete plugin conversion process
const fs = require('fs');

// Test with a simple .marginpkg file to see if the plugin works
console.log('Testing plugin conversion process...');

// Check if the built plugin exists
const mainJsPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/main.js';
if (fs.existsSync(mainJsPath)) {
    console.log('✅ Plugin build file exists: main.js');
} else {
    console.log('❌ Plugin build file missing: main.js');
    process.exit(1);
}

// Check if test marginpkg file exists
const testFile = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Testing3(2025-06-26-00-19-38).marginpkg';
if (fs.existsSync(testFile)) {
    console.log('✅ Test .marginpkg file exists');
    
    const stats = fs.statSync(testFile);
    console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
    console.log('❌ Test .marginpkg file not found');
    console.log('   Expected location:', testFile);
}

// Check plugin manifest
const manifestPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/manifest.json';
if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log('✅ Plugin manifest loaded:');
    console.log(`   ID: ${manifest.id}`);
    console.log(`   Name: ${manifest.name}`);
    console.log(`   Version: ${manifest.version}`);
} else {
    console.log('❌ Plugin manifest missing');
}

// Check for test database
const dbPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/Example Note Database/Testing3_extracted/Testing3(2025-06-26-00-19-38).marginnotes';
if (fs.existsSync(dbPath)) {
    console.log('✅ Example database exists');
    
    const stats = fs.statSync(dbPath);
    console.log(`   Database size: ${(stats.size / 1024).toFixed(2)} KB`);
} else {
    console.log('⚠️  Example database not found - this is expected if extraction hasn\'t been done');
}

console.log('\n=== Plugin Status ===');
console.log('The plugin should now be ready to use.');
console.log('To test:');
console.log('1. Reload Obsidian (Ctrl+R or Cmd+R)');
console.log('2. Use "Import MarginNote file" command');
console.log('3. Select your .marginpkg file');
console.log('4. Check the "MarginNote Import" folder for results');

console.log('\n=== Expected Results ===');
console.log('The plugin should:');
console.log('- Create markdown files with ZNOTEID as filename');
console.log('- Format content exactly like working_export.ts output');
console.log('- Match the format in markdown_output/ directory');
console.log('- Show progress notices during import');

console.log('\n=== Troubleshooting ===');
console.log('If import fails:');
console.log('1. Check Obsidian developer console (Ctrl+Shift+I)');
console.log('2. Look for error messages');
console.log('3. Verify .marginpkg file is valid');
console.log('4. Check plugin is enabled in Obsidian settings');