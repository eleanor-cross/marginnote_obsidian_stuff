# MarginNote Obsidian Import Plugin

✅ **Plugin successfully built and ready for use!**

## Installation

The plugin is already installed in your Obsidian plugins directory:
```
.obsidian/plugins/marginnote-obsidian/
```

## Setup

1. **Enable the plugin in Obsidian:**
   - Open Obsidian Settings → Community Plugins
   - Find "MarginNote Obsidian Import" in your installed plugins
   - Toggle it ON

2. **Install Python dependencies:**
   ```bash
   pip install pandas
   ```

## Usage

### Quick Start

1. **Click the MarginNote ribbon icon** (book icon) in Obsidian's left sidebar
2. **Select your .marginpkg file** when prompted
3. **Copy the command** that appears in your clipboard
4. **Open terminal** and paste the command to complete the import
5. **Refresh Obsidian** to see your imported notes

### Configuration

Access plugin settings via:
- Settings → Community Plugins → MarginNote Obsidian Import → Settings

Available options:
- **Default output folder**: Where imported notes will be created
- **Create subdirectories**: Organize by topic type (project/book/review/general)
- **Include metadata**: Add detailed metadata to each note
- **Include coordinates**: Add page/position information
- **Skip empty notes**: Don't create notes with no content
- **Strict decoding**: Use strict mode for NSKeyedArchiver (may fail on some files)

## How It Works

1. **Plugin UI**: Provides easy file selection and configuration
2. **Python Backend**: Handles the complex MarginNote processing
3. **Bridge Script**: Connects the Obsidian plugin to Python processing
4. **Output**: Creates one Obsidian note per content extract

## File Structure

```
marginnote-obsidian/
├── main.js              # Built plugin code
├── manifest.json        # Plugin metadata
├── import_bridge.py     # Python bridge script
├── src/                 # Complete Python processing pipeline
│   ├── main.py         # CLI entry point
│   ├── core/           # Core processing components
│   ├── models/         # Data structures
│   └── utils/          # Text processing utilities
└── config.example.json # Configuration template
```

## Example Output

Each imported note combines all related content:

```markdown
# Research Note Title

## Highlights

> Your highlighted text from the PDF

**Location:** Page 42 | Position: (123, 456)

## Notes

Your personal notes and annotations

**Tags:** #important #research

## Related Notes

- [[other_note_id]]

---
## Metadata

**Note ID:** `ABC123`
**Source:** Research Project  
**Created:** 2024-01-15 14:35:00
**Tags:** 2
**Links:** 1

---
```

## Troubleshooting

### Plugin not appearing
- Ensure it's enabled in Community Plugins settings
- Restart Obsidian if needed

### Import command fails
- Verify Python is installed: `python --version`
- Install pandas: `pip install pandas`
- Check file path in the generated command

### No notes appear after import
- Refresh Obsidian (Ctrl+R or Cmd+R)
- Check the output folder specified in settings
- Look for error messages in the Obsidian console (Ctrl+Shift+I)

### Python errors
- Ensure you're using Python 3.7+
- Try the command manually first
- Check the import report for detailed error information

## Advanced Usage

### Direct CLI Usage

You can also use the Python CLI directly:

```bash
python import_bridge.py your_file.marginpkg "/path/to/vault/folder" '{"strict_decoding": false}'
```

### Custom Configuration

Create a `config.json` file based on `config.example.json` for advanced customization.

## Technical Details

- **Processing Pipeline**: Extract → Parse → Decode → Process → Deduplicate → Convert
- **Content Grouping**: Uses Union-Find algorithm to group related content
- **Deduplication**: Handles MarginNote's merged vs original content relationships
- **CJK Support**: Full support for Chinese, Japanese, and Korean text
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Support

If you encounter issues:
1. Check the console (Ctrl+Shift+I) for error messages
2. Try the direct CLI command first
3. Enable verbose logging in the Python script
4. Check the generated import report for detailed statistics

---

🎉 **Ready to import your MarginNote files into Obsidian!**