import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
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
import { Input } from "@/components/ui/input";
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertTriangle, Trash2, Loader2,
  ImageIcon, Link as LinkIcon,
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

function buildTemplateRows(): Record<string, string>[] {
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
  const subjectList = subjects.join(" | ");
  const typeList = VALID_TYPES.join(" | ");
  const difficultyList = VALID_DIFFICULTIES.join(" | ");
  const topicPreview = allTopics.slice(0, 12).join(" | ");
  const chapterPreview = Object.entries(allChaptersBySubject)
    .map(([subject, chapters]) => `${subject}: ${chapters.slice(0, 5).join(", ")}${chapters.length > 5 ? "..." : ""}`)
    .join(" || ");

  return [
    {
      subject: "Physics",
      chapter: "Kinematics",
      topic: "Projectile Motion",
      question_text: "A ball is thrown vertically upward with velocity 20 m/s. Find max height. (g=10 m/s²)",
      option_1: "20 m",
      option_2: "10 m",
      option_3: "15 m",
      option_4: "5 m",
      correct_answer: "1",
      question_type: "single_correct",
      marks: "4",
      negative_marks: "1",
      difficulty: "medium",
      time_seconds: "60",
      solution_text: "Using v²=u²-2gh ⇒ h = u²/(2g) = 400/20 = 20 m",
      tags: "kinematics,projectile,jee_main",
      question_image_url: "",
      solution_image_url: "",
    },
    {
      subject: "Chemistry",
      chapter: "Atomic Structure",
      topic: "Quantum Numbers",
      question_text: "Which of the following are valid quantum number sets for a 3d orbital?",
      option_1: "n=3, l=2, m=-2",
      option_2: "n=3, l=0, m=0",
      option_3: "n=3, l=2, m=+1",
      option_4: "n=3, l=1, m=0",
      correct_answer: "1,3",
      question_type: "multiple_correct",
      marks: "4",
      negative_marks: "2",
      difficulty: "hard",
      time_seconds: "90",
      solution_text: "For 3d orbital n=3 and l=2; m can range from -l to +l.",
      tags: "quantum,jee_adv,conceptual",
      question_image_url: "",
      solution_image_url: "",
    },
    {
      subject: "Mathematics",
      chapter: "Integral Calculus",
      topic: "Definite Integrals",
      question_text: "Evaluate $\\int_0^1 2x\\,dx$",
      option_1: "",
      option_2: "",
      option_3: "",
      option_4: "",
      correct_answer: "1",
      question_type: "integer",
      marks: "4",
      negative_marks: "0",
      difficulty: "easy",
      time_seconds: "45",
      solution_text: "$\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$",
      tags: "integral,formula,easy",
      question_image_url: "",
      solution_image_url: "",
    },
    {
      subject: "",
      chapter: "",
      topic: "",
      question_text: "Template notes: keep headers unchanged. Subjects=" + subjectList,
      option_1: "",
      option_2: "",
      option_3: "",
      option_4: "",
      correct_answer: "",
      question_type: "Allowed types: " + typeList,
      marks: "",
      negative_marks: "",
      difficulty: "Allowed difficulty: " + difficultyList,
      time_seconds: "",
      solution_text: "Topic sample: " + topicPreview + " | Chapter sample: " + chapterPreview,
      tags: "",
      question_image_url: "",
      solution_image_url: "",
    },
  ];
}

function downloadTemplate() {
  const csv = Papa.unparse(buildTemplateRows(), { columns: EXPECTED_COLUMNS });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "phynetix_question_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Inline image cell for preview rows ───────────────────────────────
function RowImageCell({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Not an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5 MB");
    setUploading(true);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.name.replace(/\s+/g, "_")}`;
    const { data, error } = await supabase.storage.from("question-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.error(error.message);
    } else {
      const { data: pub } = supabase.storage.from("question-images").getPublicUrl(data.path);
      onChange(pub.publicUrl);
      toast.success(`${label} uploaded`);
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      {value ? (
        <div className="flex items-center gap-1">
          <img src={value} alt={label} className="w-10 h-10 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-destructive">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            title={`Upload ${label}`}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs"
            onClick={() => setShowUrl((s) => !s)}
            title={`Paste ${label} URL`}
          >
            <LinkIcon className="h-3 w-3" />
          </Button>
        </div>
      )}
      {showUrl && !value && (
        <Input
          autoFocus
          placeholder="https://image.url"
          className="h-7 text-xs"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v) onChange(v);
            setShowUrl(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) onChange(v);
              setShowUrl(false);
            }
          }}
        />
      )}
    </div>
  );
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
    } else {
      toast.error("Unsupported file format. Use .csv");
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
    toast.success("CSV template downloaded");
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

  const updateRowField = (idx: number, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? validateRow({ ...r.data, [field]: value }, r.rowIndex) : r
      )
    );
  };

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bulk Question Import</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload CSV files to import questions into the library
          </p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
          <Download className="h-4 w-4" /> Download CSV Template
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
            accept=".csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
          />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-foreground font-medium">Drag & drop your file here or click to browse</p>
        <p className="text-muted-foreground text-sm mt-1">Supports .csv files only</p>
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
                  <TableHead className="w-[160px]">Question Image</TableHead>
                  <TableHead className="w-[160px]">Solution Image</TableHead>
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
                      <RowImageCell
                        label="question image"
                        value={row.data.question_image_url || ""}
                        onChange={(v) => updateRowField(i, "question_image_url", v)}
                      />
                    </TableCell>
                    <TableCell>
                      <RowImageCell
                        label="solution image"
                        value={row.data.solution_image_url || ""}
                        onChange={(v) => updateRowField(i, "solution_image_url", v)}
                      />
                    </TableCell>
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
