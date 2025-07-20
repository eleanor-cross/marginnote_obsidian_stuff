import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';
import { SimpleZBookNoteConverter } from './src/core/simple-zbooknote-converter';
import { parseMarginPkgFile, isValidMarginPkgFile } from './src/core/database-parser';
import { DatabaseData } from './src/core/margin-note-importer';

interface MarginNoteSettings {
	defaultOutputFolder: string;
	createSubdirectories: boolean;
	includeMetadata: boolean;
	includeCoordinates: boolean;
	skipEmptyNotes: boolean;
	strictDecoding: boolean;
}

const DEFAULT_SETTINGS: MarginNoteSettings = {
	defaultOutputFolder: 'MarginNote Import',
	createSubdirectories: true,
	includeMetadata: true,
	includeCoordinates: true,
	skipEmptyNotes: true,
	strictDecoding: false
}

export default class MarginNotePlugin extends Plugin {
	settings: MarginNoteSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('book-open', 'Import MarginNote', (evt: MouseEvent) => {
			this.openImportDialog();
		});
		ribbonIconEl.addClass('marginnote-ribbon-class');

		// Add command
		this.addCommand({
			id: 'import-marginnote-file',
			name: 'Import MarginNote file',
			callback: () => {
				this.openImportDialog();
			}
		});

		// Add settings tab
		this.addSettingTab(new MarginNoteSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openImportDialog() {
		// Create file input element
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.marginpkg';
		input.style.display = 'none';
		
		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];
			
			if (file && file.name.endsWith('.marginpkg')) {
				await this.importMarginNoteFile(file);
			} else {
				new Notice('Please select a .marginpkg file');
			}
		};
		
		document.body.appendChild(input);
		input.click();
		document.body.removeChild(input);
	}

	async importMarginNoteFile(file: File) {
		try {
			new Notice('Starting MarginNote import...');
			
			// Validate file
			if (!isValidMarginPkgFile(file)) {
				new Notice('Invalid .marginpkg file');
				return;
			}
			
			// Parse the .marginpkg file and extract database data
			const databaseData: DatabaseData = await parseMarginPkgFile(file, this.settings.strictDecoding);
			
			// Setup simple converter - title = ZNOTEID, content = MbBookNotes_for_export
			const converterConfig = {
				outputDirectory: this.settings.defaultOutputFolder,
				vaultAdapter: this.app.vault.adapter
			};
			
			// Perform conversion - ZNOTEID titles with full MbBookNote objects
			const converter = new SimpleZBookNoteConverter(converterConfig);
			const result = await converter.convertFromData(databaseData);
			
			if (result.success) {
				const folderName = result.outputFolder || this.settings.defaultOutputFolder;
				new Notice(`Import completed! Created ${result.notesCreated} notes in ${folderName}.`);
				console.log(`Import completed: ${result.notesCreated} notes created in vault folder: ${folderName}`);
			} else {
				new Notice(`Import failed: ${result.errors.join(', ')}`);
				console.error('Import errors:', result.errors);
			}
			
		} catch (error) {
			console.error('MarginNote import error:', error);
			new Notice('Import failed. Check console for details.');
		}
	}

	/**
	 * Copy generated notes from temp directory to vault
	 * @deprecated - Memory converter now writes directly to vault
	 */
	async copyNotesToVault(result: any): Promise<void> {
		const outputFolder = this.settings.defaultOutputFolder;
		
		// Create output folder if it doesn't exist
		if (!(await this.app.vault.adapter.exists(outputFolder))) {
			await this.app.vault.adapter.mkdir(outputFolder);
		}

		// Create subdirectories if needed
		if (this.settings.createSubdirectories) {
			const subdirs = ['project', 'book', 'review', 'general', 'mindmap', 'flashcard'];
			for (const subdir of subdirs) {
				const subdirPath = `${outputFolder}/${subdir}`;
				if (!(await this.app.vault.adapter.exists(subdirPath))) {
					await this.app.vault.adapter.mkdir(subdirPath);
				}
			}
		}

		// Copy the generated files to vault
		if (result.outputFiles && result.outputFiles.length > 0) {
			console.log(`Copying ${result.outputFiles.length} files to vault...`);
			
			const fs = require('fs');
			
			for (const outputFile of result.outputFiles) {
				try {
					// Read the generated file
					const tempFilePath = outputFile;
					if (fs.existsSync(tempFilePath)) {
						const content = fs.readFileSync(tempFilePath, 'utf-8');
						
						// Write to vault
						const vaultPath = `${outputFolder}/${require('path').basename(outputFile)}`;
						await this.app.vault.adapter.write(vaultPath, content);
						
						console.log(`Copied: ${vaultPath}`);
					} else {
						console.warn(`Generated file not found: ${tempFilePath}`);
					}
				} catch (error) {
					console.warn(`Failed to copy file ${outputFile}:`, error);
				}
			}
		} else {
			// Create summary file if no individual notes were generated
			const defaultPath = `${outputFolder}/marginnote_import_${new Date().toISOString().slice(0,10)}.md`;
			const content = `# MarginNote Import Results

## ✅ Processing Complete

Successfully processed your MarginNote file.

### Import Summary
- **Processing Time:** ${new Date().toISOString()}
- **Notes Created:** ${result.notesCreated || 0}
- **Success Status:** ${result.success ? '✅ Success' : '❌ Failed'}
- **Errors:** ${result.errors?.length || 0}

### Processing Details
The MarginNote file was processed using the CSV converter system. This system:
1. Extracts the SQLite database from the .marginpkg file
2. Converts database records to MbBookNote objects
3. Generates individual markdown files for each note
4. Preserves all metadata and relationships

### Next Steps
1. Check individual note files in this folder
2. Review the generated index.md for navigation
3. Verify all expected content was imported

---

*Generated by MarginNote-Obsidian Plugin*`;

			await this.app.vault.adapter.write(defaultPath, content);
		}

		// Write conversion statistics
		const reportPath = `${outputFolder}/conversion_report.json`;
		await this.app.vault.adapter.write(reportPath, JSON.stringify({
			timestamp: new Date().toISOString(),
			result: result,
			statistics: result.statistics
		}, null, 2));

		console.log(`Import completed! Created ${result.notesCreated} files in: ${outputFolder}`);
	}
}

class MarginNoteSettingTab extends PluginSettingTab {
	plugin: MarginNotePlugin;

	constructor(app: App, plugin: MarginNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'MarginNote Import Settings'});

		new Setting(containerEl)
			.setName('Default output folder')
			.setDesc('Folder where imported notes will be created')
			.addText(text => text
				.setPlaceholder('MarginNote Import')
				.setValue(this.plugin.settings.defaultOutputFolder)
				.onChange(async (value) => {
					this.plugin.settings.defaultOutputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Create subdirectories')
			.setDesc('Organize notes into subdirectories by topic type')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createSubdirectories)
				.onChange(async (value) => {
					this.plugin.settings.createSubdirectories = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include metadata')
			.setDesc('Add metadata section to imported notes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeMetadata)
				.onChange(async (value) => {
					this.plugin.settings.includeMetadata = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include coordinates')
			.setDesc('Include page coordinates and location information')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeCoordinates)
				.onChange(async (value) => {
					this.plugin.settings.includeCoordinates = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Skip empty notes')
			.setDesc('Don\'t create notes that have no content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.skipEmptyNotes)
				.onChange(async (value) => {
					this.plugin.settings.skipEmptyNotes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Strict decoding')
			.setDesc('Use strict mode for NSKeyedArchiver decoding (may fail on some files)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.strictDecoding)
				.onChange(async (value) => {
					this.plugin.settings.strictDecoding = value;
					await this.plugin.saveSettings();
				}));

		// Instructions section
		containerEl.createEl('h3', {text: 'Usage Instructions'});
		
		const instructionsEl = containerEl.createEl('div');
		instructionsEl.innerHTML = `
			<p><strong>How to import a .marginpkg file:</strong></p>
			<ol>
				<li>Click the MarginNote ribbon icon or use "Import MarginNote file" command</li>
				<li>Select your .marginpkg file</li>
				<li>The plugin will automatically process and import your notes</li>
				<li>Check your output folder for the imported Obsidian notes</li>
			</ol>
			
			<p><strong>Features:</strong></p>
			<ul>
				<li>✅ Full TypeScript implementation - no external dependencies</li>
				<li>✅ One note per extract - combines highlights, review cards, mindmap nodes</li>
				<li>✅ Smart deduplication - handles merged vs original content</li>
				<li>✅ CJK language support - Chinese, Japanese, Korean text processing</li>
				<li>✅ Configurable output - customize markdown formatting</li>
				<li>✅ Cross-platform compatibility</li>
			</ul>
			
			<p><strong>Note:</strong> This plugin now includes a complete TypeScript backend for MarginNote processing, eliminating the need for external Python dependencies.</p>
		`;
	}
}