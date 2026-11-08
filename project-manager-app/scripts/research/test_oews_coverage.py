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
SCOPED_HEADER = HEADER + ["AREA_TYPE", "NAICS", "I_GROUP", "OWN_CODE", "O_GROUP"]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as source:
        writer = csv.writer(source)
        writer.writerow(HEADER)
        writer.writerows(rows)


def write_synthetic_xlsx_zip(path, rows, include_scope=True):
    def cell(index, value):
        col = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index]
        return f'<c r="{col}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'
    contents = ([SCOPED_HEADER] + [list(row) + [
        "4", "000000", "cross-industry", "1235", "detailed"] for row in rows]
        if include_scope else [HEADER, *rows])
    xml_rows = "".join(
        f'<row r="{number}">' +
        "".join(cell(i, value) for i, value in enumerate(row)) +
        "</row>"
        for number, row in enumerate(contents, 1)
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
            self.assertFalse(result["release_verified"])
            self.assertEqual(result["source_authentication"], "NOT_VERIFIED_OFFLINE")
            self.assertEqual(result["input"]["state"]["area_count_observed"], 2)
            self.assertEqual(result["input"]["state"]["area_count_expected"], 51)
            self.assertEqual(result["input"]["metro"]["area_count_observed"], 1)
            self.assertIsNone(result["input"]["metro"]["area_count_expected"])
            self.assertTrue(result["input"]["state"]["coverage_not_commercial_approval"])
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

    def test_invalid_second_source_leaves_no_partial_coverage_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state, metro, out = root / "state.csv", root / "metro.csv", root / "result"
            write_csv(state, [["12", "Florida", "47-2141", "29", "25", "20", "31"]])
            with metro.open("w", newline="", encoding="utf-8") as source:
                source.write("invalid,header\\n")
            with self.assertRaisesRegex(ValueError, "required headers"):
                run(state, metro, out)
            self.assertEqual(list(out.glob("*")), [],
                             "No state-only report should survive failed metro validation")

    def test_zip_with_missing_scope_columns_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25ma.zip"
            write_synthetic_xlsx_zip(path, [
                ["33100", "Miami-Fort Lauderdale-West Palm Beach, FL",
                 "47-2141", "30", "27", "22", "36"]
            ], include_scope=False)
            with self.assertRaisesRegex(ValueError, "required scope fields missing"):
                read_oews(path, "metro")

    def test_ambiguous_zip_fails_closed_instead_of_picking_first_workbook(self):
        from oews_coverage import records
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25st.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("first.xlsx", b"not relevant")
                archive.writestr("second.xlsx", b"not relevant")
            with self.assertRaisesRegex(ValueError, "Ambiguous OEWS ZIP"):
                list(records(path))

    def test_empty_zip_cannot_silently_create_research_coverage(self):
        from oews_coverage import records
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25ma.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("README.txt", "synthetic-only")
            with self.assertRaisesRegex(ValueError, "Expected an XLSX"):
                list(records(path))

    def test_state_scope_filters_other_area_industries_ownership_and_group(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25st.csv"
            baseline = ["12", "Florida", "47-2141", "29", "25", "20", "31",
                        "2", "000000", "cross-industry", "1235", "detailed"]
            samples = [
                baseline,
                baseline[:7] + ["4", "000000", "cross-industry", "1235", "detailed"],
                baseline[:7] + ["2", "238000", "3-digit", "5", "detailed"],
                baseline[:7] + ["2", "000000", "sector", "1235", "detailed"],
                baseline[:7] + ["2", "000000", "cross-industry", "5", "detailed"],
                baseline[:7] + ["2", "000000", "cross-industry", "1235", "major"],
                ["13", "Georgia", "47-2141", "27", "24", "20", "31",
                 "2", "000000", "cross-industry", "1235", "detailed"],
            ]
            with path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(SCOPED_HEADER)
                writer.writerows(samples)
            records, meta = read_oews(path, "state")
            self.assertEqual(len(records), 2)
            self.assertEqual(records[("FL", "47-2141")]["median"], "25")
            self.assertEqual(records[("GA", "47-2141")]["median"], "24")
            self.assertEqual(meta["scope_fields_present"], 5)
            self.assertEqual(meta["skipped_wrong_geography"], 1)
            self.assertEqual(meta["skipped_non_cross_industry"], 2)
            self.assertEqual(meta["skipped_ownership_scope"], 1)
            self.assertEqual(meta["skipped_non_detailed_occupation"], 1)

    def test_metro_accepts_types_four_and_six_not_state_or_national(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25ma.csv"
            with path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(SCOPED_HEADER)
                writer.writerows([
                    ["33100", "Miami-Fort Lauderdale-West Palm Beach, FL", "47-2141",
                     "30", "27", "22", "36", "4", "000000", "cross-industry", "1235", "detailed"],
                    ["1200004", "North Florida nonmetropolitan area", "47-2141",
                     "26", "23", "18", "31", "6", "000000", "cross-industry", "1235", "detailed"],
                    ["33100", "Miami-Fort Lauderdale-West Palm Beach, FL", "47-2141",
                     "30", "99", "22", "36", "2", "000000", "cross-industry", "1235", "detailed"],
                ])
            records, meta = read_oews(path, "metro")
            self.assertEqual(len(records), 2)
            self.assertEqual(records[("33100", "47-2141")]["median"], "27")
            self.assertEqual(records[("1200004", "47-2141")]["median"], "23")
            self.assertEqual(meta["skipped_wrong_geography"], 1)

    def test_wrong_only_geography_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oesm25st.csv"
            with path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(SCOPED_HEADER)
                writer.writerow(["12", "Florida", "47-2141", "29", "25", "20", "31",
                                 "4", "000000", "cross-industry", "1235", "detailed"])
            with self.assertRaisesRegex(ValueError, "No valid state rows"):
                read_oews(path, "state")

    def test_duplicate_area_soc_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.csv"
            row = ["12", "Florida", "47-2141", "27", "25", "21", "32"]
            write_csv(path, [row, row])
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                read_oews(path, "state")


if __name__ == "__main__":
    unittest.main()
