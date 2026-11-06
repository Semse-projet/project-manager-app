"""Synthetic-only tests; do not mistake fixtures for official BLS wage imports."""
import csv
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from oews_coverage import read_oews, run, parse_wage

HEADER = ["AREA", "AREA_TITLE", "OCC_CODE", "H_MEAN", "H_MEDIAN", "H_PCT25", "H_PCT75"]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as source:
        writer = csv.writer(source)
        writer.writerow(HEADER)
        writer.writerows(rows)


def write_synthetic_xlsx_zip(path, rows):
    def cell(index, value):
        col = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index]
        return f'<c r="{col}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'
    xml_rows = "".join(
        f'<row r="{number}">' +
        "".join(cell(i, value) for i, value in enumerate(row)) +
        "</row>"
        for number, row in enumerate([HEADER, *rows], 1)
    )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>' +
           '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
           '<sheetData>' + xml_rows + '</sheetData></worksheet>')
    inner = io.BytesIO()
    with zipfile.ZipFile(inner, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", xml)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("oesm25ma.xlsx", inner.getvalue())


class OEWSTests(unittest.TestCase):
    def test_suppressed_or_invalid_wages_never_become_zero(self):
        for value in ("", "*", "#", "**", "-", "NaN", "Infinity", "0", "-5"):
            self.assertIsNone(parse_wage(value))
        self.assertEqual(parse_wage("29.51"), "29.51")

    def test_synthetic_state_and_metro_coverage_is_reproducible(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state_path, metro_path = root / "oesm25st.csv", root / "oesm25ma.zip"
            write_csv(state_path, [
                ["12", "Florida", "47-2141", "27.50", "24.00", "20.00", "31.00"],
                ["13", "Georgia", "47-2141", "26.50", "*", "19.00", "30.00"],
                ["12", "Florida", "47-2081", "28", "25", "20", "30"],
            ])
            write_synthetic_xlsx_zip(metro_path, [
                ["33100", "Miami-Fort Lauderdale-West Palm Beach, FL", "47-2141", "30", "27", "22", "36"]
            ])
            output = root / "output"
            result = run(state_path, metro_path, output)
            self.assertEqual(result["classification"], "RESEARCH_ONLY_NOT_APPROVED")
            self.assertEqual(result["input"]["state"]["trade_area_rows"], 51 * 24)
            self.assertEqual(result["input"]["metro"]["trade_area_rows"], 24)
            self.assertEqual(result["input"]["state"]["stats"]["missing_or_suppressed_median"], 1)
            with (output / "state_trade_coverage.csv").open(encoding="utf-8") as stream:
                rows = list(csv.DictReader(stream))
            fl = next(row for row in rows if row["area_code"] == "FL" and row["trade"] == "painting")
            ga = next(row for row in rows if row["area_code"] == "GA" and row["trade"] == "painting")
            self.assertEqual(fl["reference_status"], "ALL_REFERENCE_WAGES_PRESENT")
            self.assertEqual(ga["reference_status"], "NO_REFERENCE_WAGES")
            self.assertEqual(json.loads((output / "manifest.json").read_text())["release_claim"], "May 2025")

    def test_duplicate_area_soc_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.csv"
            row = ["12", "Florida", "47-2141", "27", "25", "21", "32"]
            write_csv(path, [row, row])
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                read_oews(path, "state")


if __name__ == "__main__":
    unittest.main()
