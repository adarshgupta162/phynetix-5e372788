import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { JEE_SYLLABUS } from "@/lib/jeeData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertTriangle, Trash2, Loader2,
} from "lucide-react";

const EXPECTED_COLUMNS = [
  "subject", "chapter", "topic", "question_text",
  "option_1", "option_2", "option_3", "option_4",
  "correct_answer", "question_type", "marks", "negative_marks",
  "difficulty", "time_seconds", "solution_text", "tags",
  "question_image_url", "solution_image_url",
];

const REQUIRED_COLUMNS = ["subject", "question_text", "correct_answer", "question_type"];

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

const VALID_TYPES = ["single_correct", "multiple_correct", "integer"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

function validateRow(row: Record<string, string>, idx: number): ParsedRow {
  const errors: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!row[col]?.toString().trim()) errors.push(`Missing ${col}`);
  }
  const qType = row.question_type?.toString().trim().toLowerCase();
  if (qType && !VALID_TYPES.includes(qType)) errors.push(`Invalid question_type: ${qType}`);
  const diff = row.difficulty?.toString().trim().toLowerCase();
  if (diff && !VALID_DIFFICULTIES.includes(diff)) errors.push(`Invalid difficulty: ${diff}`);
  if (row.marks && isNaN(Number(row.marks))) errors.push("marks must be a number");
  if (row.negative_marks && isNaN(Number(row.negative_marks))) errors.push("negative_marks must be a number");
  return { rowIndex: idx, data: row, errors, valid: errors.length === 0 };
}

function mapRowToQuestion(row: Record<string, string>, userId: string) {
  const qType = row.question_type?.trim().toLowerCase() || "single_correct";
  const typeMap: Record<string, string> = {
    single_correct: "single_choice",
    multiple_correct: "multiple_choice",
    integer: "integer",
  };

  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const options = [1, 2, 3, 4]
    .map((i) => row[`option_${i}`]?.trim())
    .filter(Boolean)
    .map((text, i) => ({ label: LETTERS[i], text, image_url: null }));

  let correctAnswer: any;
  const ca = row.correct_answer?.trim();
  if (qType === "integer") {
    correctAnswer = ca;
  } else if (qType === "multiple_correct") {
    // Accept "1,3" or "A,C"
    const parts = (ca || "").split(",").map((v) => v.trim()).filter(Boolean);
    correctAnswer = parts.map((p) => {
      const n = Number(p);
      if (!isNaN(n)) return LETTERS[n - 1];
      return p.toUpperCase();
    });
  } else {
    // single_correct: accept "1" or "A"
    const n = Number(ca);
    correctAnswer = !isNaN(n) ? LETTERS[n - 1] : (ca || "").toUpperCase();
  }

  const tagsRaw = row.tags?.toString().trim() || "";
  const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];

  return {
    subject: row.subject?.trim() || "Physics",
    chapter: row.chapter?.trim() || null,
    topic: row.topic?.trim() || null,
    question_text: row.question_text?.trim() || null,
    question_image_url: row.question_image_url?.trim() || null,
    solution_image_url: row.solution_image_url?.trim() || null,
    question_type: typeMap[qType] || "single_choice",
    options: options.length > 0 ? options : null,
    correct_answer: correctAnswer,
    marks: Number(row.marks) || 4,
    negative_marks: row.negative_marks?.toString().trim() === "" || row.negative_marks === undefined ? 1 : Number(row.negative_marks),
    difficulty: row.difficulty?.trim().toLowerCase() || "medium",
    time_seconds: Number(row.time_seconds) || 60,
    solution_text: row.solution_text?.trim() || null,
    tags,
    created_by: userId,
  };
}

function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const subjects = Object.keys(JEE_SYLLABUS);
  const allChaptersBySubject: Record<string, string[]> = {};
  const allTopicsSet = new Set<string>();
  for (const s of subjects) {
    const chapters = Object.keys(JEE_SYLLABUS[s].chapters);
    allChaptersBySubject[s] = chapters;
    for (const ch of chapters) {
      for (const t of JEE_SYLLABUS[s].chapters[ch]) allTopicsSet.add(t);
    }
  }
  const allTopics = Array.from(allTopicsSet).sort();

  // ─── Sheet 1: Instructions ───────────────────────────────────────────
  const instructions: (string | number)[][] = [
    ["Phynetix - Bulk Question Import Template"],
    [""],
    ["HOW TO USE"],
    ["1. Fill rows in the 'Questions' sheet using the dropdowns where available."],
    ["2. Subject, Chapter, Topic, Type and Difficulty cells have dropdown lists."],
    ["3. Chapter dropdown is FILTERED by Subject — pick subject FIRST, then chapter."],
    ["4. Do NOT rename, reorder or delete the header row in 'Questions'."],
    ["5. Save as .xlsx and upload it on the Bulk Import page."],
    [""],
    ["COLUMN", "REQUIRED", "ACCEPTED VALUES / NOTES"],
    ["subject", "Yes", "Dropdown: Physics / Chemistry / Mathematics"],
    ["chapter", "Recommended", "Dropdown filtered by subject (uses official JEE syllabus)"],
    ["topic", "No", "Dropdown of all topics from JEE syllabus"],
    ["question_text", "Yes", "Plain text or LaTeX (KaTeX). e.g. $\\\\int x\\\\,dx$"],
    ["option_1 .. option_4", "MCQ only", "Required for single_correct / multiple_correct. Leave blank for integer."],
    ["correct_answer", "Yes", "single_correct: 1|2|3|4   |   multiple_correct: 1,3   |   integer: numeric value"],
    ["question_type", "Yes", "Dropdown: single_correct / multiple_correct / integer"],
    ["marks", "No", "Default 4. Any positive number."],
    ["negative_marks", "No", "Default 1. Set 0 for no negative."],
    ["difficulty", "No", "Dropdown: easy / medium / hard"],
    ["time_seconds", "No", "Default 60."],
    ["solution_text", "No", "Plain text or LaTeX."],
    ["tags", "No", "Comma-separated tags, e.g. 'jee2023,formula,trick'"],
    ["question_image_url", "No", "Direct URL to question image (https://...). Or upload after import via the preview table."],
    ["solution_image_url", "No", "Direct URL to solution image."],
    [""],
    ["IMPORTANT — chapter mapping"],
    ["Use the dropdown chapter values exactly. Free-typed chapters that don't match the syllabus"],
    ["will still import but show as 'Unmapped' in the library filters."],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 80 }];
  wsI["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instructions");

  // ─── Sheet 2: Examples ───────────────────────────────────────────────
  const exampleHeader = EXPECTED_COLUMNS;
  const exampleRows: (string | number)[][] = [
    exampleHeader,
    [
      "Physics", "Kinematics", "Projectile Motion",
      "A ball is thrown vertically upward with velocity 20 m/s. Find max height. (g=10 m/s²)",
      "20 m", "10 m", "15 m", "5 m",
      "1", "single_correct", 4, 1, "medium", 60,
      "Using v²=u²-2gh ⇒ h = u²/(2g) = 400/20 = 20 m",
      "kinematics,projectile,jee_main",
    ],
    [
      "Chemistry", "Atomic Structure", "Quantum Numbers",
      "Which of the following are valid quantum number sets for a 3d orbital?",
      "n=3, l=2, m=-2", "n=3, l=0, m=0", "n=3, l=2, m=+1", "n=3, l=1, m=0",
      "1,3", "multiple_correct", 4, 2, "hard", 90,
      "For 3d orbital n=3 and l=2; m can range from -l to +l.",
      "quantum,jee_adv,conceptual",
    ],
    [
      "Mathematics", "Integral Calculus", "Definite Integrals",
      "Evaluate $\\int_0^1 2x\\,dx$",
      "", "", "", "",
      "1", "integer", 4, 0, "easy", 45,
      "$\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$",
      "integral,formula,easy",
    ],
  ];
  const wsE = XLSX.utils.aoa_to_sheet(exampleRows);
  wsE["!cols"] = exampleHeader.map((c) => ({
    wch: c === "question_text" || c === "solution_text" ? 50 : c.startsWith("option_") ? 22 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, wsE, "Examples");

  // ─── Sheet 3: Questions (the sheet users fill) ───────────────────────
  const blankRow = EXPECTED_COLUMNS.map(() => "");
  const questionsSheet: (string | number)[][] = [EXPECTED_COLUMNS];
  // Pre-add 200 empty rows so dropdowns are present without users having to extend them.
  for (let i = 0; i < 200; i++) questionsSheet.push([...blankRow]);
  const wsQ = XLSX.utils.aoa_to_sheet(questionsSheet);
  wsQ["!cols"] = EXPECTED_COLUMNS.map((c) => ({
    wch: c === "question_text" || c === "solution_text" ? 45 : c.startsWith("option_") ? 22 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, wsQ, "Questions");

  // ─── Sheet 4: Lists (hidden, holds the dropdown source data) ─────────
  // Layout:
  //   A: Subjects    B: Physics chapters    C: Chemistry chapters    D: Mathematics chapters
  //   E: Topics      F: question_types      G: difficulties
  const maxChapters = Math.max(...subjects.map((s) => allChaptersBySubject[s].length));
  const maxTopics = allTopics.length;
  const maxRows = Math.max(maxChapters, maxTopics, subjects.length, 4);
  const listsAoA: (string | number)[][] = [];
  listsAoA.push(["Subjects", "Physics", "Chemistry", "Mathematics", "Topics", "Types", "Difficulties"]);
  for (let i = 0; i < maxRows; i++) {
    listsAoA.push([
      subjects[i] || "",
      allChaptersBySubject["Physics"][i] || "",
      allChaptersBySubject["Chemistry"][i] || "",
      allChaptersBySubject["Mathematics"][i] || "",
      allTopics[i] || "",
      ["single_correct", "multiple_correct", "integer"][i] || "",
      ["easy", "medium", "hard"][i] || "",
    ]);
  }
  const wsL = XLSX.utils.aoa_to_sheet(listsAoA);
  wsL["!cols"] = [{ wch: 16 }, { wch: 36 }, { wch: 36 }, { wch: 36 }, { wch: 32 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsL, "Lists");

  // Hide the Lists sheet (still referenceable by formulas)
  const sheetIndex = wb.SheetNames.indexOf("Lists");
  if (!wb.Workbook) wb.Workbook = { Sheets: [] };
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
  wb.SheetNames.forEach((_, i) => {
    if (!wb.Workbook!.Sheets![i]) wb.Workbook!.Sheets![i] = { Hidden: 0 } as any;
  });
  wb.Workbook.Sheets[sheetIndex] = { Hidden: 1 } as any;

  // Defined names so chapter dropdown can use INDIRECT(subject_cell)
  // Named ranges: Physics, Chemistry, Mathematics → chapters columns
  wb.Workbook.Names = [
    {
      Name: "Physics",
      Ref: `Lists!$B$2:$B$${1 + allChaptersBySubject["Physics"].length}`,
    },
    {
      Name: "Chemistry",
      Ref: `Lists!$C$2:$C$${1 + allChaptersBySubject["Chemistry"].length}`,
    },
    {
      Name: "Mathematics",
      Ref: `Lists!$D$2:$D$${1 + allChaptersBySubject["Mathematics"].length}`,
    },
    {
      Name: "_Subjects",
      Ref: `Lists!$A$2:$A$${1 + subjects.length}`,
    },
    {
      Name: "_Topics",
      Ref: `Lists!$E$2:$E$${1 + allTopics.length}`,
    },
    {
      Name: "_Types",
      Ref: `Lists!$F$2:$F$4`,
    },
    {
      Name: "_Difficulties",
      Ref: `Lists!$G$2:$G$4`,
    },
  ] as any;

  return wb;
}

// Build the data-validations XML block for the Questions sheet.
// Columns: A=subject, B=chapter, C=topic, J=question_type, M=difficulty (1-indexed letters).
function buildDataValidationsXml(rows = 200): string {
  const last = rows + 1; // header is row 1
  const dvs = [
    // subject (col A)
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="A2:A${last}"><formula1>=_Subjects</formula1></dataValidation>`,
    // chapter (col B) — dependent on subject in same row
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="B2:B${last}"><formula1>=INDIRECT($A2)</formula1></dataValidation>`,
    // topic (col C)
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="C2:C${last}"><formula1>=_Topics</formula1></dataValidation>`,
    // question_type (col J = 10th)
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="J2:J${last}"><formula1>=_Types</formula1></dataValidation>`,
    // difficulty (col M = 13th)
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="M2:M${last}"><formula1>=_Difficulties</formula1></dataValidation>`,
  ];
  return `<dataValidations count="${dvs.length}">${dvs.join("")}</dataValidations>`;
}

// Inject <dataValidations> into the Questions sheet of the workbook XML (xlsx is a zip).
function injectDataValidations(buffer: ArrayBuffer): Uint8Array {
  const u8 = new Uint8Array(buffer);
  const files = unzipSync(u8);

  // Find the Questions sheet's XML file via workbook.xml + relationships.
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const relsXml = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  // sheet name → r:id
  const sheetMatch = workbookXml.match(/<sheet[^>]*name="Questions"[^>]*r:id="([^"]+)"/);
  if (!sheetMatch) return u8;
  const rid = sheetMatch[1];
  const targetMatch = relsXml.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`));
  if (!targetMatch) return u8;
  const target = `xl/${targetMatch[1].replace(/^\/?xl\//, "")}`;
  const sheetKey = files[target] ? target : Object.keys(files).find((k) => k.endsWith(targetMatch[1]));
  if (!sheetKey || !files[sheetKey]) return u8;

  let sheetXml = strFromU8(files[sheetKey]);
  const dvXml = buildDataValidationsXml(200);

  // Insert <dataValidations> after </sheetData> (or before </worksheet> if missing).
  if (sheetXml.includes("<dataValidations")) {
    // already present — replace
    sheetXml = sheetXml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, dvXml);
  } else if (sheetXml.includes("</sheetData>")) {
    sheetXml = sheetXml.replace("</sheetData>", `</sheetData>${dvXml}`);
  } else {
    sheetXml = sheetXml.replace("</worksheet>", `${dvXml}</worksheet>`);
  }

  files[sheetKey] = strToU8(sheetXml);
  return zipSync(files);
}

function downloadTemplate() {
  const wb = buildTemplateWorkbook();
  const arrayBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const finalBytes = injectDataValidations(arrayBuf);
  const blob = new Blob([finalBytes.buffer.slice(finalBytes.byteOffset, finalBytes.byteOffset + finalBytes.byteLength) as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "phynetix_question_import_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
export default function BulkQuestionImport() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; importedIds?: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    setResult(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const parsed = (res.data as Record<string, string>[]).map((r, i) => validateRow(r, i + 1));
          setRows(parsed);
          toast.success(`Parsed ${parsed.length} rows from CSV`);
        },
        error: () => toast.error("Failed to parse CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        // Prefer "Questions" sheet, otherwise the first non-instructional sheet, else the first sheet.
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase() === "questions") ||
          wb.SheetNames.find((n) => !["instructions", "examples"].includes(n.toLowerCase())) ||
          wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        const parsed = data.map((r, i) => validateRow(r, i + 1));
        setRows(parsed);
        toast.success(`Parsed ${parsed.length} rows from "${sheetName}"`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Unsupported file format. Use .csv or .xlsx");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleDownloadTemplate = () => {
    downloadTemplate();
    toast.success("Excel template downloaded");
  };

  const handleImport = async () => {
    if (!user) return toast.error("You must be logged in");
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return toast.error("No valid rows to import");

    setImporting(true);
    let success = 0;
    let failed = 0;
    const BATCH_SIZE = 50;
    const importedIds: string[] = [];

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE).map((r) => mapRowToQuestion(r.data, user.id));
      const { data, error } = await supabase.from("phynetix_library").insert(batch as any).select("id");
      if (error) {
        failed += batch.length;
        console.error("Batch insert error:", error);
      } else {
        success += (data?.length || batch.length);
        if (data) importedIds.push(...data.map((d: any) => d.id));
      }
    }

    // Log to audit
    if (importedIds.length > 0) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "bulk_import",
        entity_type: "phynetix_library",
        new_value: { count: importedIds.length, question_ids: importedIds },
      } as any);
    }

    const invalidCount = rows.length - validRows.length;
    setResult({ success, failed: failed + invalidCount, importedIds });
    setImporting(false);
    if (success > 0) toast.success(`${success} questions imported successfully`);
    if (failed + invalidCount > 0) toast.error(`${failed + invalidCount} rows failed/skipped`);
  };

  const handleRevert = async () => {
    if (!result?.importedIds?.length) return;
    const ids = result.importedIds;
    setImporting(true);
    const { error } = await supabase.from("phynetix_library").delete().in("id", ids);
    if (error) {
      toast.error("Failed to revert: " + error.message);
    } else {
      toast.success(`Reverted ${ids.length} imported questions`);
      if (user) {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "bulk_import_revert",
          entity_type: "phynetix_library",
          new_value: { count: ids.length, question_ids: ids },
        } as any);
      }
      setResult(null);
      setRows([]);
    }
    setImporting(false);
  };

  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bulk Question Import</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload CSV or Excel files to import questions into the library
          </p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
          <Download className="h-4 w-4" /> Download Excel Template
        </Button>
      </div>

      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
        />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-foreground font-medium">Drag & drop your file here or click to browse</p>
        <p className="text-muted-foreground text-sm mt-1">Supports .csv and .xlsx files</p>
      </Card>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <FileSpreadsheet className="h-3 w-3" /> {rows.length} rows
          </Badge>
          <Badge className="gap-1 bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3" /> {validCount} valid
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> {invalidCount} invalid
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRows([]); setResult(null); }}>
              Clear All
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {validCount} Questions
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <Card className="p-4 flex items-center gap-4">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Import Complete</p>
            <p className="text-sm text-muted-foreground">
              {result.success} imported successfully, {result.failed} failed/skipped
            </p>
          </div>
          {result.importedIds && result.importedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleRevert} disabled={importing} className="gap-2">
              <Trash2 className="h-4 w-4" /> Revert Import
            </Button>
          )}
        </Card>
      )}

      {/* Preview Table */}
      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead className="min-w-[200px]">Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="w-16">Errors</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={row.valid ? "" : "bg-destructive/5"}
                  >
                    <TableCell className="text-muted-foreground">{row.rowIndex}</TableCell>
                    <TableCell>
                      {row.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.data.subject}</TableCell>
                    <TableCell>{row.data.chapter}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{row.data.question_text}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {row.data.question_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.data.correct_answer}</TableCell>
                    <TableCell>{row.data.marks || "4"}</TableCell>
                    <TableCell>{row.data.difficulty || "medium"}</TableCell>
                    <TableCell>
                      {row.errors.length > 0 && (
                        <span className="text-xs text-destructive" title={row.errors.join(", ")}>
                          {row.errors.length} error{row.errors.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
