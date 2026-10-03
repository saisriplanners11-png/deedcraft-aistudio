"""Check DOCX files downloaded by manual-entry-flow.mjs with the Python standard library."""

from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1] / "tmp" / "manual-entry-qa"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def document(name):
    with zipfile.ZipFile(ROOT / f"{name}.docx") as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs = ["".join(node.itertext()) for node in root.findall(".//w:p", NS)]
    return root, paragraphs, "\n".join(paragraphs)


categories = {
    "vacant-plot": "open plot",
    "open-place": "open place",
    "residential": "R.C.C. Building",
    "flat": "R.C.C. Building",
    "demolished": "dismantled house",
    "commercial": "R.C.C. Building",
    "agricultural-land": "open plot",
    "part-open-place": "open place",
}
for name, expected in categories.items():
    _, _, text = document(name)
    assert expected.lower() in text.lower(), (name, expected)
    assert "PLOT-101" in text and "SURVEY-101" in text, name
    if name in {"demolished", "part-open-place"}:
        assert "bearing H.No.SUBJECT-101" in text or "bearing H.No. SUBJECT-101" in text, name
    assert "    -10-2026" in text, name
    assert "Rs.34,07,000/-" in text, name
    assert "5,700" in text, name
    assert "5,71,881" not in text, name  # calculated value stays in the dashboard
    assert "(Thirty Four Lakh Seven Thousand Rupees Only)" in text, name
    assert "1. EXECUTANT-1" not in text and "1. CLAIMANT-1" not in text, name

_, paragraphs, text = document("all-title-points")
title_labels = [
    "Registered Deed:", "Vacant Land Tax/Assessment:", "Approved Layout:",
    "Title Deed:", "Nala Order:", "Property Tax:",
    "Tax/Assessment & Identification Particulars:", "House Permission:",
    "L.R.S.-2020 Application:", "L.R.S. Proceeding:",
]
for label in title_labels:
    assert label in text, label
assert text.count("Registered Deed:") == 1
for value in ["LINK-101", "LINK SRO (LS1)", "VLT-101", "ASSESS-101", "RECEIPT-101", "LAY-101", "TITLE-101", "NALA-101", "PERMIT-101", "LRS-APP-101", "LRS-PROC-101"]:
    assert value in text, value
assert "Nala Order No. NALA-101, dated 20-06-2021" in text
assert "Property Tax Receipt No. RECEIPT-101, dated 21-07-2025" in text
_, _, text = document("multiple-links")
assert text.count("Registered Deed:") == 2
assert "LINK-101" in text and "LINK-102" in text
assert "LINK SRO (LS1)" in text and "GIFT SRO (GS2)" in text

root, paragraphs, text = document("two-schedules")
first, second = text.split("FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2", 1)
assert "LINK-101" in first and "LINK-202" not in first
assert "LINK-202" in second and "LINK-101" not in second
assert "RECEIPT-101" in first and "RECEIPT-101" not in second
assert "VLT-202" in second and "VLT-202" not in first
for name in ["EXECUTANT-1", "EXECUTANT-2", "CLAIMANT-1", "CLAIMANT-2"]:
    assert text.count(name) >= 2, name
for numbered in ["1. EXECUTANT-1", "2. EXECUTANT-2", "1. CLAIMANT-1", "2. CLAIMANT-2"]:
    assert numbered in text, numbered
for first_name, last_name, closing in [
    ("1. EXECUTANT-1", "2. EXECUTANT-2", '(Hereinafter called the "VENDOR/S") of the ONE PART.'),
    ("1. CLAIMANT-1", "2. CLAIMANT-2", '(Hereinafter called the "VENDEE/S") of the OTHER PART.'),
]:
    first_line = next(p for p in paragraphs if p.startswith(first_name))
    last_line = next(p for p in paragraphs if p.startswith(last_name))
    assert first_line.endswith(".") and "Hereinafter called" not in first_line, first_name
    assert closing in last_line, last_name
    assert text.count(closing) == 1, closing
for signature in ["(EXECUTANT-1)", "(EXECUTANT-2)", "(CLAIMANT-1)", "(CLAIMANT-2)"]:
    assert signature in text, signature
assert "(1) CLAIMANT-1 — 60%; (2) CLAIMANT-2 — 40%" in text
assert "(1) CLAIMANT-1 — 45%; (2) CLAIMANT-2 — 55%" in text
assert text.count("Ground Floor") >= 2  # building table and Annexure 1A
assert text.count("First Floor") >= 2
assert "BUILDING / FLOOR DETAILS:" in text
assert "ANNEXURE – 1A" in text
assert "Executant's estimate M.V." in text and "Consideration" in text
assert "Rs.34,07,000/-" in text and "Rs.6,200/-" in text
floor_rows = [row for row in root.findall(".//w:tr", NS)
              if len(row.findall("./w:tc", NS)) == 3
              and any(re.fullmatch(r"(?:Ground|First) Floor", "".join(cell.itertext()).strip())
                      for cell in row.findall("./w:tc", NS))]
assert len(floor_rows) == 2
for row, expected in zip(floor_rows, [("3.", "Ground Floor", ": 700 sq.fts"), ("", "First Floor", ": 700 sq.fts")]):
    cells = row.findall("./w:tc", NS)
    assert len(cells) == 3
    assert tuple("".join(cell.itertext()).strip() for cell in cells) == expected
    assert row.find("./w:trPr/w:cantSplit", NS) is not None
building_rows = [row for row in root.findall(".//w:tr", NS)
                 if len(row.findall("./w:tc", NS)) == 5
                 and "".join(row.itertext()).strip().startswith(("Ground Floor", "First Floor"))]
assert len(building_rows) == 2
assert ["".join(row.findall("./w:tc", NS)[-1].itertext()).strip() for row in building_rows] == ["700 Sq.Ft.", "700 Sq.Ft."]

_, _, text = document("partial-title")
assert "Registered Deed:" not in text and "House Permission:" not in text
assert "Nala Order No. NALA-PARTIAL" in text
assert "Property Tax Receipt No. RECEIPT-PARTIAL" in text
assert "dated __________" not in text
assert "Tax/Assessment & Identification Particulars:" in text
assert "Assessment No. PTIN-PARTIAL" in text

_, paragraphs, text = document("one-executant-two-claimants")
assert "1. EXECUTANT-1" not in text
assert text.count("1. CLAIMANT-1") == 1 and text.count("2. CLAIMANT-2") == 1
assert text.count('(Hereinafter called the "VENDOR/S") of the ONE PART.') == 1
assert text.count('(Hereinafter called the "VENDEE/S") of the OTHER PART.') == 1
assert "Hereinafter called" not in next(p for p in paragraphs if p.startswith("1. CLAIMANT-1"))
assert '(Hereinafter called the "VENDEE/S") of the OTHER PART.' in next(p for p in paragraphs if p.startswith("2. CLAIMANT-2"))
assert "(EXECUTANT-1)" in text
assert re.search(r"1\.\s+_{8,}\s+\(CLAIMANT-1\)", text)
assert re.search(r"2\.\s+_{8,}\s+\(CLAIMANT-2\)", text)

_, _, text = document("incomplete")
assert "Registered Deed:" not in text

print("PASS: manual-entry downloads, title recitals, category schedules, parties, shares, amounts, and house layout")
