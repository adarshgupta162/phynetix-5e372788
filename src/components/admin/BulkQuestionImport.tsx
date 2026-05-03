import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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

  const options = [1, 2, 3, 4]
    .map((i) => row[`option_${i}`]?.trim())
    .filter(Boolean)
    .map((text, i) => ({ label: `(${i + 1})`, text }));

  let correctAnswer: any;
  const ca = row.correct_answer?.trim();
  if (qType === "integer") {
    correctAnswer = ca;
  } else if (qType === "multiple_correct" && ca?.includes(",")) {
    correctAnswer = ca.split(",").map((v: string) => Number(v.trim()) - 1);
  } else {
    correctAnswer = Number(ca) - 1;
  }

  const tagsRaw = row.tags?.toString().trim() || "";
  const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];

  return {
    subject: row.subject?.trim() || "Physics",
    chapter: row.chapter?.trim() || null,
    topic: row.topic?.trim() || null,
    question_text: row.question_text?.trim() || null,
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

  // ─── Sheet 1: Instructions ───────────────────────────────────────────
  const instructions: (string | number)[][] = [
    ["Phynetix - Bulk Question Import Template"],
    [""],
    ["HOW TO USE"],
    ["1. Fill rows in the 'Questions' sheet using the column rules below."],
    ["2. Do NOT rename, reorder or delete the header row in 'Questions'."],
    ["3. See 'Examples' sheet for fully worked rows for every question type."],
    ["4. Save as .xlsx and upload it on the Bulk Import page."],
    [""],
    ["COLUMN", "REQUIRED", "ACCEPTED VALUES / NOTES"],
    ["subject", "Yes", "Physics / Chemistry / Mathematics / Biology (free text)"],
    ["chapter", "No", "Free text e.g. Mechanics, Atomic Structure"],
    ["topic", "No", "Free text e.g. Kinematics"],
    ["question_text", "Yes", "Plain text or LaTeX (KaTeX). e.g. $\\\\int x\\\\,dx$. See public/katex-reference.md"],
    ["option_1 .. option_4", "MCQ only", "Required for single_correct / multiple_correct. Leave blank for integer."],
    ["correct_answer", "Yes", "single_correct: 1|2|3|4   |   multiple_correct: 1,3 (comma list)   |   integer: numeric value e.g. 5 or 3.14"],
    ["question_type", "Yes", "single_correct  |  multiple_correct  |  integer"],
    ["marks", "No", "Default 4. Any positive number (3, 4, 5...). Used for full marks."],
    ["negative_marks", "No", "Default 1. Penalty for wrong answer. Set 0 for no negative."],
    ["difficulty", "No", "easy | medium | hard. Default medium."],
    ["time_seconds", "No", "Suggested time per question. Default 60."],
    ["solution_text", "No", "Plain text or LaTeX. Shown to students after submission."],
    ["tags", "No", "Comma-separated tags for searching/filtering, e.g. 'jee2023,formula,trick'"],
    [""],
    ["MARKING SCHEMES (auto-applied at submission)"],
    ["single_correct", "+marks for correct, -negative_marks for wrong, 0 if skipped"],
    ["multiple_correct (JEE Adv style, scales with marks)",
      "All correct: +marks | 3-of-4: +marks*3/4 | 2-of-N: +marks/2 | 1-of-N: +marks/4 | Any wrong selection: -negative_marks"],
    ["integer", "+marks if numeric value matches (tolerance < 0.01), -negative_marks otherwise"],
    [""],
    ["MULTIPLE CORRECT - HOW TO ENTER ANSWERS"],
    ["If options 1,3 are correct → correct_answer = 1,3"],
    ["If options 2,3,4 are correct → correct_answer = 2,3,4"],
    ["Order does not matter, no spaces required."],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 80 }];
  // Merge title row visually
  wsI["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instructions");

  // ─── Sheet 2: Examples ───────────────────────────────────────────────
  const exampleHeader = EXPECTED_COLUMNS;
  const exampleRows: (string | number)[][] = [
    exampleHeader,
    [
      "Physics", "Mechanics", "Kinematics",
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
      "Mathematics", "Calculus", "Definite Integrals",
      "Evaluate $\\int_0^1 2x\\,dx$",
      "", "", "", "",
      "1", "integer", 4, 0, "easy", 45,
      "$\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$",
      "integral,formula,easy",
    ],
    [
      "Physics", "Modern Physics", "Photoelectric Effect",
      "All correct statements about photoelectric effect are:",
      "Stopping potential depends on frequency",
      "Photoelectric current depends on intensity",
      "Work function depends on metal",
      "KE depends on intensity",
      "1,2,3", "multiple_correct", 3, 1, "medium", 75,
      "KE_max depends on frequency, not intensity. Hence 1,2,3 are correct.",
      "photoelectric,modern,jee_adv",
    ],
  ];
  const wsE = XLSX.utils.aoa_to_sheet(exampleRows);
  wsE["!cols"] = exampleHeader.map((c) => ({
    wch: c === "question_text" || c === "solution_text" ? 50 : c.startsWith("option_") ? 22 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, wsE, "Examples");

  // ─── Sheet 3: Questions (the sheet users fill) ───────────────────────
  const questionsSheet: (string | number)[][] = [
    EXPECTED_COLUMNS,
    [
      "Physics", "", "",
      "Replace this with your question text",
      "Option A", "Option B", "Option C", "Option D",
      "1", "single_correct", 4, 1, "medium", 60, "", "",
    ],
  ];
  const wsQ = XLSX.utils.aoa_to_sheet(questionsSheet);
  wsQ["!cols"] = EXPECTED_COLUMNS.map((c) => ({
    wch: c === "question_text" || c === "solution_text" ? 45 : c.startsWith("option_") ? 22 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, wsQ, "Questions");

  return wb;
}

function downloadTemplate() {
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, "phynetix_question_import_template.xlsx");
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
