// Debug SQL queries on extracted database
const initSqlJs = require('sql.js');
const fs = require('fs');

async function debugDatabase() {
    console.log('=== Debugging SQLite Database ===');
    
    // Use the extracted database from fflate
    const dbPath = '/mnt/c/Users/ezraa/Desktop/MarginNote stuff/.obsidian/plugins/marginnote-obsidian/fflate-extracted.marginnotes';
    
    if (!fs.existsSync(dbPath)) {
        console.log('❌ Database file not found. Run test-fflate.js first.');
        return;
    }
    
    const dbData = fs.readFileSync(dbPath);
    console.log(`Database size: ${dbData.length} bytes`);
    
    try {
        // Initialize sql.js (Node.js version)
        const SQL = await initSqlJs();
        const db = new SQL.Database(dbData);
        
        // List all tables
        console.log('\n=== Available Tables ===');
        const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = [];
        while (tablesStmt.step()) {
            const row = tablesStmt.getAsObject();
            tables.push(row.name);
            console.log(`- ${row.name}`);
        }
        tablesStmt.free();
        
        // Check ZBOOKNOTE table specifically
        if (tables.includes('ZBOOKNOTE')) {
            console.log('\n=== ZBOOKNOTE Table Schema ===');
            const schemaStmt = db.prepare("PRAGMA table_info(ZBOOKNOTE)");
            const columns = [];
            while (schemaStmt.step()) {
                const row = schemaStmt.getAsObject();
                columns.push(row.name);
                console.log(`- ${row.name}: ${row.type}`);
            }
            schemaStmt.free();
            
            console.log('\n=== ZBOOKNOTE Row Count ===');
            const countStmt = db.prepare("SELECT COUNT(*) as count FROM ZBOOKNOTE");
            countStmt.step();
            const countResult = countStmt.getAsObject();
            console.log(`Total rows: ${countResult.count}`);
            countStmt.free();
            
            if (countResult.count > 0) {
                console.log('\n=== First 3 ZBOOKNOTE Rows ===');
                const sampleStmt = db.prepare("SELECT * FROM ZBOOKNOTE LIMIT 3");
                let rowNum = 1;
                while (sampleStmt.step()) {
                    const row = sampleStmt.getAsObject();
                    console.log(`\nRow ${rowNum}:`);
                    for (const [key, value] of Object.entries(row)) {
                        if (key === 'ZNOTEID' || key === 'ZHIGHLIGHT_TEXT' || key === 'ZTITLE') {
                            console.log(`  ${key}: ${value}`);
                        }
                    }
                    rowNum++;
                }
                sampleStmt.free();
            }
        } else {
            console.log('❌ ZBOOKNOTE table not found!');
        }
        
        db.close();
        
    } catch (error) {
        console.error('❌ SQL debugging failed:', error);
    }
}

debugDatabase().catch(console.error);