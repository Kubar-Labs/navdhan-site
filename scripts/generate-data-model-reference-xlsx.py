"""Generate a structured XLSX workbook from data-model-reference.md.

The generator intentionally uses only Python's standard library so it can run
without Excel, LibreOffice, network access, or third-party spreadsheet modules.
"""

from __future__ import annotations

import hashlib
import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "data-model-reference.md"
OUTPUT_PATH = ROOT / "data-model-reference.xlsx"


@dataclass(frozen=True)
class Column:
    position: int
    name: str
    data_type: str
    purpose: str


@dataclass(frozen=True)
class Table:
    section: str
    name: str
    description: str
    qualifier: str
    columns: tuple[Column, ...] = field(default_factory=tuple)
    constraints: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class EnumDefinition:
    name: str
    values: str

    @property
    def value_count(self) -> int:
        return len([value for value in self.values.split(",") if value.strip()])


def clean_markdown(value: str) -> str:
    cleaned = value.replace("**", "").replace("`", "").strip()
    cleaned = re.sub(r"^\*+|\*+$", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def markdown_cells(line: str) -> list[str]:
    parts = line.split("|")
    if len(parts) < 3:
        return []
    return [part.strip() for part in parts[1:-1]]


def parse_reference(source: str) -> tuple[list[EnumDefinition], list[Table]]:
    lines = source.splitlines()
    enums: list[EnumDefinition] = []
    tables: list[Table] = []
    current_section = ""
    position = 0

    while position < len(lines):
        line = lines[position]
        section_match = re.match(r"^#\s+(\d+\s+·\s+.+)$", line)
        if section_match:
            current_section = clean_markdown(section_match.group(1))
            position += 1
            continue

        if line.strip() == "| Enum | Values |":
            position += 2
            while position < len(lines) and lines[position].startswith("|"):
                cells = markdown_cells(lines[position])
                if len(cells) >= 2:
                    enums.append(
                        EnumDefinition(
                            name=clean_markdown(cells[0]),
                            values=clean_markdown(cells[1]),
                        )
                    )
                position += 1
            continue

        heading_match = re.match(r"^#{2,3}\s+(.+)$", line)
        if not heading_match:
            position += 1
            continue

        heading = heading_match.group(1)
        table_names = re.findall(r"`([^`]+)`", heading)
        if not table_names:
            position += 1
            continue

        header_index = None
        for candidate in range(position + 1, min(position + 12, len(lines))):
            if lines[candidate].strip() == "| Column | Type | Purpose |":
                header_index = candidate
                break
            if re.match(r"^#{1,3}\s+", lines[candidate]):
                break
        if header_index is None:
            position += 1
            continue

        qualifier = heading
        for table_name in table_names:
            qualifier = qualifier.replace(f"`{table_name}`", "")
        qualifier = clean_markdown(re.sub(r"^\s*·\s*", "", qualifier))

        description_parts = [
            clean_markdown(lines[index])
            for index in range(position + 1, header_index)
            if clean_markdown(lines[index]) not in {"", "---"}
        ]
        description = " ".join(description_parts)

        columns: list[Column] = []
        constraints: list[str] = []
        row_index = header_index + 2
        while row_index < len(lines) and lines[row_index].startswith("|"):
            cells = markdown_cells(lines[row_index])
            if len(cells) >= 3:
                column_name = clean_markdown(cells[0])
                data_type = clean_markdown(cells[1])
                purpose = clean_markdown("|".join(cells[2:]))
                if column_name:
                    columns.append(
                        Column(
                            position=len(columns) + 1,
                            name=column_name,
                            data_type=data_type,
                            purpose=purpose,
                        )
                    )
                elif purpose:
                    constraints.append(purpose)
            row_index += 1

        for table_name in table_names:
            tables.append(
                Table(
                    section=current_section,
                    name=table_name,
                    description=description,
                    qualifier=qualifier,
                    columns=tuple(columns),
                    constraints=tuple(constraints),
                )
            )
        position = row_index

    if not enums or not tables:
        raise ValueError(f"Parsing failed: enums={len(enums)}, tables={len(tables)}")

    duplicate_tables = sorted(
        name for name in {table.name for table in tables} if sum(table.name == name for table in tables) > 1
    )
    if duplicate_tables:
        raise ValueError(f"Duplicate table definitions: {', '.join(duplicate_tables)}")

    for table in tables:
        names = [column.name for column in table.columns]
        duplicates = sorted({name for name in names if names.count(name) > 1})
        if duplicates:
            raise ValueError(f"Duplicate columns in {table.name}: {', '.join(duplicates)}")

    return enums, tables


def column_letter(number: int) -> str:
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_xml(reference: str, value: object, style: int = 0) -> str:
    style_attribute = f' s="{style}"' if style else ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{reference}"{style_attribute} t="n"><v>{value}</v></c>'
    text = escape("" if value is None else str(value))
    return (
        f'<c r="{reference}"{style_attribute} t="inlineStr">'
        f'<is><t xml:space="preserve">{text}</t></is></c>'
    )


def worksheet_xml(
    rows: list[list[object]],
    widths: list[float],
    *,
    header: bool = True,
    merge_title: bool = False,
    label_rows: bool = False,
) -> str:
    max_columns = max((len(row) for row in rows), default=1)
    max_rows = max(len(rows), 1)
    row_parts: list[str] = []

    for row_number, values in enumerate(rows, start=1):
        cells: list[str] = []
        visible_values = values[:1] if merge_title and row_number == 1 else values
        for column_number, value in enumerate(visible_values, start=1):
            style = 0
            if row_number == 1:
                style = 3 if merge_title else 1
            elif label_rows and column_number == 1:
                style = 2
            cells.append(cell_xml(f"{column_letter(column_number)}{row_number}", value, style))
        height = ' ht="30" customHeight="1"' if row_number == 1 and merge_title else ""
        row_parts.append(f'<row r="{row_number}"{height}>{"".join(cells)}</row>')

    columns = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(widths, start=1)
    )
    frozen_pane = (
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        if header and not merge_title
        else ""
    )
    auto_filter = (
        f'<autoFilter ref="A1:{column_letter(max_columns)}{max_rows}"/>'
        if header and not merge_title and max_rows > 1
        else ""
    )
    merge_cells = (
        f'<mergeCells count="1"><mergeCell ref="A1:{column_letter(max_columns)}1"/></mergeCells>'
        if merge_title
        else ""
    )
    dimension = f"A1:{column_letter(max_columns)}{max_rows}"

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="{dimension}"/>
  <sheetViews><sheetView workbookViewId="0">{frozen_pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>{columns}</cols>
  <sheetData>{"".join(row_parts)}</sheetData>
  {auto_filter}
  {merge_cells}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>'''


STYLES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF000000"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>'''


def build_workbook(source: str, enums: list[EnumDefinition], tables: list[Table]) -> dict[str, int]:
    source_hash = hashlib.sha256(source.encode("utf-8")).hexdigest().upper()
    column_count = sum(len(table.columns) for table in tables)
    constraint_count = sum(len(table.constraints) for table in tables)
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")

    overview_rows: list[list[object]] = [
        ["NavDhan Data Model — Excel Reference", "", "", "", "", ""],
        [],
        ["Source file", SOURCE_PATH.name],
        ["Source SHA-256", source_hash],
        ["Generated at", generated_at],
        ["Target", "PostgreSQL 16 / Cloud SQL"],
        ["Enums", len(enums)],
        ["Logical tables", len(tables)],
        ["Columns", column_count],
        ["Constraints", constraint_count],
        ["Workbook structure", "Enums, table catalogue, column inventory, and constraints"],
        [
            "Conventions",
            "UUIDv7 application-generated PKs; timestamptz timestamps; numeric(18,2) money; "
            "marketplace-leading composite tenant FKs; forced RLS",
        ],
    ]
    enum_rows: list[list[object]] = [["Enum", "Values", "Value count"]] + [
        [enum.name, enum.values, enum.value_count] for enum in enums
    ]
    table_rows: list[list[object]] = [
        ["Section", "Table", "Description", "Qualifier / status", "Column count", "Constraint count"]
    ] + [
        [
            table.section,
            table.name,
            table.description,
            table.qualifier,
            len(table.columns),
            len(table.constraints),
        ]
        for table in tables
    ]
    column_rows: list[list[object]] = [
        ["Section", "Table", "Position", "Column", "Data type", "Purpose"]
    ] + [
        [table.section, table.name, column.position, column.name, column.data_type, column.purpose]
        for table in tables
        for column in table.columns
    ]
    constraint_rows: list[list[object]] = [["Section", "Table", "Constraint"]] + [
        [table.section, table.name, constraint]
        for table in tables
        for constraint in table.constraints
    ]

    sheets = [
        ("Overview", worksheet_xml(overview_rows, [24, 100, 12, 12, 12, 12], header=False, merge_title=True, label_rows=True)),
        ("Enums", worksheet_xml(enum_rows, [28, 100, 12])),
        ("Tables", worksheet_xml(table_rows, [28, 38, 80, 32, 14, 16])),
        ("Columns", worksheet_xml(column_rows, [28, 38, 10, 34, 22, 100])),
        ("Constraints", worksheet_xml(constraint_rows, [28, 38, 110])),
    ]

    content_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, len(sheets) + 1)
    )
    content_types = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  {content_overrides}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''
    root_relationships = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''
    workbook_sheets = "".join(
        f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, (name, _) in enumerate(sheets, start=1)
    )
    workbook_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>{workbook_sheets}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>'''
    workbook_relationships = "".join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, len(sheets) + 1)
    ) + f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    workbook_rels_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{workbook_relationships}</Relationships>'''
    app_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex XLSX Generator</Application>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(sheets)}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="{len(sheets)}" baseType="lpstr">{"".join(f'<vt:lpstr>{escape(name)}</vt:lpstr>' for name, _ in sheets)}</vt:vector></TitlesOfParts>
</Properties>'''
    core_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>NavDhan Data Model Reference</dc:title>
  <dc:creator>Codex</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">{generated_at}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{generated_at}</dcterms:modified>
</cp:coreProperties>'''

    temporary_path = OUTPUT_PATH.with_suffix(".xlsx.tmp")
    with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", root_relationships)
        archive.writestr("docProps/app.xml", app_xml)
        archive.writestr("docProps/core.xml", core_xml)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        archive.writestr("xl/styles.xml", STYLES_XML)
        for index, (_, sheet_xml) in enumerate(sheets, start=1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml)
    temporary_path.replace(OUTPUT_PATH)

    return {
        "enums": len(enums),
        "tables": len(tables),
        "columns": column_count,
        "constraints": constraint_count,
        "sheets": len(sheets),
    }


def validate_workbook(expected: dict[str, int]) -> dict[str, object]:
    required_parts = {
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/sheet2.xml",
        "xl/worksheets/sheet3.xml",
        "xl/worksheets/sheet4.xml",
        "xl/worksheets/sheet5.xml",
    }
    with zipfile.ZipFile(OUTPUT_PATH, "r") as archive:
        corrupt_part = archive.testzip()
        if corrupt_part:
            raise ValueError(f"Corrupt XLSX member: {corrupt_part}")
        missing = required_parts.difference(archive.namelist())
        if missing:
            raise ValueError(f"Missing XLSX members: {', '.join(sorted(missing))}")
        for member_name in archive.namelist():
            if member_name.endswith((".xml", ".rels")):
                try:
                    ElementTree.fromstring(archive.read(member_name))
                except ElementTree.ParseError as error:
                    raise ValueError(f"Malformed XML member {member_name}: {error}") from error
        workbook_root = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        sheet_names = [sheet.attrib["name"] for sheet in workbook_root.findall("x:sheets/x:sheet", namespace)]
        if sheet_names != ["Overview", "Enums", "Tables", "Columns", "Constraints"]:
            raise ValueError(f"Unexpected sheets: {sheet_names}")
        row_counts = []
        for index in range(1, 6):
            sheet_root = ElementTree.fromstring(archive.read(f"xl/worksheets/sheet{index}.xml"))
            row_counts.append(len(sheet_root.findall("x:sheetData/x:row", namespace)))

    expected_rows = [12, expected["enums"] + 1, expected["tables"] + 1, expected["columns"] + 1, expected["constraints"] + 1]
    if row_counts != expected_rows:
        raise ValueError(f"Unexpected row counts: {row_counts}, expected {expected_rows}")
    return {"sheet_names": sheet_names, "row_counts": row_counts, "zip_integrity": "ok"}


def main() -> None:
    source = SOURCE_PATH.read_text(encoding="utf-8")
    enums, tables = parse_reference(source)
    counts = build_workbook(source, enums, tables)
    validation = validate_workbook(counts)
    print(
        json.dumps(
            {
                "source": str(SOURCE_PATH),
                "output": str(OUTPUT_PATH),
                **counts,
                **validation,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
