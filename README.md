# MarginNote4-Obsidian Import Tool

A cross-platform Python tool for importing MarginNote4 `.marginpkg` files into Obsidian. Creates one note per content extract, combining highlights, review cards, mindmap nodes, and related content into single markdown files.

## Features

- **One Note Per Extract**: Combines highlights, review cards, and mindmap nodes into single Obsidian notes
- **Cross-Platform**: Works on Windows, macOS, and iOS (tested on Windows)
- **CJK Language Support**: Full support for Chinese, Japanese, and Korean text processing
- **Smart Deduplication**: Handles merged vs original content to avoid duplicate notes
- **Media Support**: Includes images and ink drawings with proper references
- **Configurable Output**: Customizable Obsidian markdown formatting
- **Comprehensive Reporting**: Detailed import statistics and validation

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd MarginNote-stuff
```

2. Install dependencies:
```bash
pip install pandas
```

## Usage

### Basic Usage

Import a `.marginpkg` file:
```bash
python -m src.main your_notes.marginpkg
```

Specify output directory:
```bash
python -m src.main your_notes.marginpkg --output ./my_obsidian_vault
```

### Advanced Usage

Use configuration file:
```bash
python -m src.main your_notes.marginpkg --config config.json
```

Enable verbose logging:
```bash
python -m src.main your_notes.marginpkg --verbose
```

Strict decoding mode:
```bash
python -m src.main your_notes.marginpkg --strict
```

Include empty notes:
```bash
python -m src.main your_notes.marginpkg --include-empty
```

Disable subdirectories:
```bash
python -m src.main your_notes.marginpkg --no-subdirs
```

## Configuration

Copy `config.example.json` to `config.json` and customize:

```json
{
  "output_directory": "./obsidian_import",
  "create_subdirectories": true,
  "strict_decoding": false,
  "include_metadata": true,
  "skip_empty_notes": true,
  "log_level": "INFO",
  
  "obsidian_config": {
    "note_template": "# {title}\n\n{content}\n\n{metadata}",
    "include_coordinates": true,
    "link_format": "[[{note_id}]]",
    "hashtag_format": "#{tag}",
    "date_format": "%Y-%m-%d %H:%M:%S"
  }
}
```

## Output Structure

The tool creates the following structure:

```
obsidian_import/
├── project/           # Project-type topics
│   ├── Note 1.md
│   └── Note 2.md
├── book/              # Book-type topics  
│   ├── Chapter 1.md
│   └── Chapter 2.md
├── review_topic/      # Review topics
│   └── Review.md
├── general/           # Other content
│   └── General Note.md
└── import_report.json # Detailed import statistics
```

## Note Format

Each imported note follows this structure:

```markdown
# Note Title

## Highlights

> Your highlighted text from the PDF

**Location:** Page 42 | Position: (123, 456)

## Notes

Your personal notes and annotations

## Additional Content

- Bulleted lists
- Formatted content
- Other text

**Tags:** #important #research

## Related Notes

- [[other_note_id]]
- [[another_note_id]]

## Media

![Image](image_hash)

---
## Metadata

**Note ID:** `ABC123`
**Source:** Research Project
**Type:** Project
**Highlighted:** 2024-01-15 14:30:00
**Created:** 2024-01-15 14:35:00
**Category:** Project
**Tags:** 2
**Links:** 1
**Media:** 1

---
```

## Development

### Project Structure

```
src/
├── main.py                    # CLI entry point
├── core/                      # Core processing components
│   ├── extractor.py          # ZIP extraction
│   ├── parser.py             # Database parsing  
│   ├── content_extractor.py  # Main processing with Union-Find
│   ├── nskeyedarchiver_decoder.py  # Apple format decoder
│   ├── deduplicator.py       # Content deduplication
│   └── converter.py          # Obsidian conversion
├── models/                    # Data models
│   ├── note.py               # Note structures
│   ├── topic.py              # Topic structures
│   └── media.py              # Media structures
└── utils/                     # Utilities
    └── text_utils.py         # CJK-aware text processing
```

### Testing

Run individual components:
```bash
python -m src.core.content_extractor
python -m src.core.converter
python -m src.utils.text_utils
```

## Technical Details

### Processing Pipeline

1. **Extract**: Unzip `.marginpkg` file and validate structure
2. **Parse**: Read SQLite database tables (ZBOOKNOTE, ZTOPIC, ZMEDIA)
3. **Decode**: Process Apple NSKeyedArchiver binary data
4. **Extract**: Use Union-Find algorithm to group related content
5. **Deduplicate**: Handle merged vs original content relationships
6. **Convert**: Generate Obsidian-compatible markdown

### Content Grouping

Uses Union-Find algorithm to group related notes based on:
- Group note relationships (`ZGROUPNOTEID`)
- Internal links (`marginnote4app://note/...`)
- Evernote ID relationships

### Deduplication Strategy

- **Merged Content**: Has `ZGROUPNOTEID` pointing to originals, contains proper ordering
- **Original Content**: Has empty `ZGROUPNOTEID`, may lack proper ordering
- **Strategy**: Use merged as master, supplement with unique content from originals

### CJK Language Support

Adapted from OhMyMN patterns:
- CJK characters count as individual words
- Supports both `#` and full-width `＃` hashtags
- Proper Unicode normalization and byte-aware operations

## Troubleshooting

### Common Issues

1. **Import fails with "No .marginpkg file"**
   - Ensure file has `.marginpkg` extension
   - Check file exists and is readable

2. **Missing content in output**
   - Try `--strict` mode for stricter decoding
   - Check `import_report.json` for processing statistics
   - Enable `--verbose` logging for details

3. **Encoding errors with CJK text**
   - Ensure terminal supports UTF-8
   - Check input file isn't corrupted

4. **Empty notes generated**
   - Use `--include-empty` to see all notes
   - Check deduplication report for content loss

## License

[License information]

## Contributing

[Contributing guidelines]