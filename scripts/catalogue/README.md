# Offline FAA aircraft reference catalogue

The bundled `src/data/aircraft-types.json` contains **7,333 manufacturer/model aliases across 2,699 standard designators**, including **899 helicopter aliases across 178 codes**. Reference entries are not personal profiles. Selecting one only prefills an explicitly reviewed draft.

## Source and provenance

Federal Aviation Administration, **Order JO 7360.1K, Aircraft Type Designators**, effective **June 12, 2025**:
https://www.faa.gov/documentLibrary/media/Order/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf

Pinned PDF SHA-256: `64a709bf8863e177c3daffade253aa6362519186ba807943165f68490ee0c8fe`.
This is the base-order snapshot, not a claim of live amendment coverage. The JSON includes source edition, effective date, source hash, extraction issues and statistics.

The importer extracts Appendix A table rows using PDF coordinates and horizontal boundaries, rather than flattened text. Five malformed alias separators are resolved against explicit evidence in the same PDF's Appendix B. The importer rejects unsupported editions/layouts and unresolved aliases. Source spellings and legacy manufacturers are preserved; aliases are not necessarily technical variants.

## Rebuild and test

Run from the repository root. Download the PDF separately to a scratch directory; do not commit it or the virtual environment.

```sh
python3 -m venv /path/to/scratch/catalogue-venv
/path/to/scratch/catalogue-venv/bin/pip install -r scripts/catalogue/requirements.lock
/path/to/scratch/catalogue-venv/bin/python scripts/catalogue/import_faa.py \
  --pdf /path/to/scratch/faa7360.pdf --output /path/to/scratch/aircraft-types.json
FAA_PDF_PATH=/path/to/scratch/faa7360.pdf \
  /path/to/scratch/catalogue-venv/bin/pytest -q scripts/catalogue/test_importer.py
```

Review the generated diff and source metadata before replacing the bundled catalogue. Normal application startup/tests require only the bundled JSON, not Python or network access. Importer tests are separate maintainer checks because they need the source PDF and pinned Python dependencies. Runtime catalogue validation and search/UI tests run through `npm test`.

## Interpretation and quality limits

- `category`: helicopter, fixed-wing, gyroplane, powered-lift. Amphibian/seaplane markers normalize to fixed-wing; that distinction is not retained.
- `engineType`: turbine (FAA turboprop/turboshaft), piston, jet, electric, rocket. Counts follow FAA definitions, including two coupled engines where explicitly specified. These are not installed engine make/model identifiers.
- `wakeCategory`: ICAO WTC, not FAA weight class or CWT. Mixed `light/medium` values and nulls remain ambiguous, not confident defaults.
- Eight generic/special designators are intentionally omitted: BALL, GLID, GYRO, PARA, SHIP, UHEL, ULAC, ZZZZ.
- Do not infer AS350 subvariants, installed engine models, aircraft registration or operating limitations from a designator. Exact configuration needs user confirmation.
- Structural validation includes AS50/B212/R44/B06 cases, alias uniqueness, header rejection and count consistency. Extraction was independently reconciled against all Appendix A designators: 2,707 source codes minus eight exclusions equals 2,699 exported codes. This is not manual certification of every alias or a comprehensive global variant database.

## Attribution and rights

Attribute the factual table to the FAA and retain the source link/metadata. Selected aircraft facts were transcribed from the public FAA order, not scraped from ICAO's website. US federal government-authored works generally fall under 17 USC 105 in the United States; this is not a blanket assertion that the whole PDF, third-party material, trademarks, logos or international reuse is unrestricted. No FAA endorsement is implied. These identifiers are not an operational flight-planning authority. The application's MIT licence does not relicense third-party source material.
