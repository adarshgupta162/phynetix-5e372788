import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, BookOpen,
  Clock, Eye, EyeOff, Settings2, ImagePlus, Check, X, Library
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBatches, type Batch } from "@/hooks/useBatches";
import { LibraryPickerModal } from "@/components/admin/LibraryPickerModal";

interface DPPQuestion {
  id?: string;
  dpp_id: string;
  question_number: number;
  question_text: string | null;
  question_image_url: string | null;
  question_type: string;
  options: any[];
  correct_answer: any;
  marks: number;
  negative_marks: number;
  solution_text: string | null;
  solution_image_url: string | null;
  difficulty: string;
  order_index: number;
}

interface DPPData {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  is_published: boolean | null;
  is_timed: boolean | null;
  access_type: string | null;
  batch_id: string | null;
  publish_date: string | null;
}

export default function DPPEditor() {
  const { dppId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: batches = [] } = useBatches();

  const [dpp, setDpp] = useState<DPPData | null>(null);
  const [questions, setQuestions] = useState<DPPQuestion[]>([]);
  const [activeQ, setActiveQ] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dppId) fetchDPP();
  }, [dppId]);

  const fetchDPP = async () => {
    setLoading(true);
    const [dppRes, qRes] = await Promise.all([
      supabase.from('dpps').select('*').eq('id', dppId!).single(),
      supabase.from('dpp_questions').select('*').eq('dpp_id', dppId!).order('order_index'),
    ]);

    if (dppRes.data) setDpp(dppRes.data);
    if (qRes.data) setQuestions(qRes.data as DPPQuestion[]);
    setLoading(false);
  };

  const saveDPP = async () => {
    if (!dpp) return;
    setSaving(true);

    const { error } = await supabase
      .from('dpps')
      .update({
        title: dpp.title,
        description: dpp.description,
        subject: dpp.subject,
        chapter: dpp.chapter,
        topic: dpp.topic,
        difficulty: dpp.difficulty,
        duration_minutes: dpp.duration_minutes,
        is_timed: dpp.is_timed,
        access_type: dpp.access_type,
        batch_id: dpp.batch_id,
        publish_date: dpp.publish_date,
      })
      .eq('id', dpp.id);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "DPP saved" });
    }
    setSaving(false);
  };

  const addQuestion = async () => {
    if (!dppId) return;
    const newQ: Partial<DPPQuestion> = {
      dpp_id: dppId,
      question_number: questions.length + 1,
      question_type: 'single_choice',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correct_answer: 'A',
      marks: 4,
      negative_marks: 1,
      difficulty: 'medium',
      order_index: questions.length,
    };

    const { data, error } = await supabase
      .from('dpp_questions')
      .insert(newQ as any)
      .select()
      .single();

    if (!error && data) {
      setQuestions(prev => [...prev, data as DPPQuestion]);
      setActiveQ(questions.length);
      toast({ title: `Question ${questions.length + 1} added` });
    }
  };

  const saveQuestion = async (q: DPPQuestion) => {
    if (!q.id) return;
    const { error } = await supabase
      .from('dpp_questions')
      .update({
        question_text: q.question_text,
        question_image_url: q.question_image_url,
        question_type: q.question_type,
        options: q.options as any,
        correct_answer: q.correct_answer as any,
        marks: q.marks,
        negative_marks: q.negative_marks,
        solution_text: q.solution_text,
        solution_image_url: q.solution_image_url,
        difficulty: q.difficulty,
      })
      .eq('id', q.id);

    if (!error) toast({ title: `Q${q.question_number} saved` });
  };

  const deleteQuestion = async (q: DPPQuestion) => {
    if (!q.id || !confirm(`Delete Q${q.question_number}?`)) return;
    const { error } = await supabase.from('dpp_questions').delete().eq('id', q.id);
    if (!error) {
      const updated = questions.filter(x => x.id !== q.id).map((x, i) => ({
        ...x,
        question_number: i + 1,
        order_index: i,
      }));
      setQuestions(updated);
      setActiveQ(Math.min(activeQ, updated.length - 1));
      toast({ title: "Question deleted" });
    }
  };

  const updateQuestion = (index: number, patch: Partial<DPPQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...patch } : q));
  };

  const togglePublish = async () => {
    if (!dpp) return;
    const newVal = !dpp.is_published;
    const { error } = await supabase.from('dpps').update({ is_published: newVal }).eq('id', dpp.id);
    if (!error) {
      setDpp(prev => prev ? { ...prev, is_published: newVal } : prev);
      toast({ title: newVal ? "Published!" : "Unpublished" });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!dpp) {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold mb-2">DPP not found</h2>
          <Button onClick={() => navigate('/admin/dpps')}>Go back</Button>
        </div>
      </AdminLayout>
    );
  }

  const currentQ = questions[activeQ];

  return (
    <AdminLayout>
      <div className="h-screen flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dpps')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Input
              value={dpp.title}
              onChange={(e) => setDpp(prev => prev ? { ...prev, title: e.target.value } : prev)}
              className="text-lg font-semibold border-none bg-transparent w-72 focus-visible:ring-1"
            />
            <Badge variant={dpp.is_published ? "default" : "secondary"}>
              {dpp.is_published ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={togglePublish}>
              {dpp.is_published ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {dpp.is_published ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" onClick={saveDPP} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Settings + Question palette */}
          <div className="w-72 border-r border-border overflow-y-auto p-4 space-y-6 bg-card/30">
            <Tabs defaultValue="settings">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="settings"><Settings2 className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
                <TabsTrigger value="questions"><BookOpen className="w-3.5 h-3.5 mr-1" />Questions</TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={dpp.subject} onValueChange={v => setDpp(prev => prev ? { ...prev, subject: v } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="Chemistry">Chemistry</SelectItem>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chapter</Label>
                  <Input value={dpp.chapter || ''} onChange={e => setDpp(prev => prev ? { ...prev, chapter: e.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input value={dpp.topic || ''} onChange={e => setDpp(prev => prev ? { ...prev, topic: e.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={dpp.difficulty || 'medium'} onValueChange={v => setDpp(prev => prev ? { ...prev, difficulty: v } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Publish Date</Label>
                  <Input type="date" value={dpp.publish_date || ''} onChange={e => setDpp(prev => prev ? { ...prev, publish_date: e.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={dpp.description || ''} onChange={e => setDpp(prev => prev ? { ...prev, description: e.target.value } : prev)} rows={3} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Timed</Label>
                  <Switch checked={!!dpp.is_timed} onCheckedChange={v => setDpp(prev => prev ? { ...prev, is_timed: v } : prev)} />
                </div>
                {dpp.is_timed && (
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={dpp.duration_minutes || 30} onChange={e => setDpp(prev => prev ? { ...prev, duration_minutes: parseInt(e.target.value) } : prev)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Access Type</Label>
                  <Select value={dpp.access_type || 'public'} onValueChange={v => setDpp(prev => prev ? { ...prev, access_type: v, batch_id: v === 'public' ? null : prev?.batch_id || null } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public (All Students)</SelectItem>
                      <SelectItem value="batch_only">Batch Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dpp.access_type === 'batch_only' && (
                  <div className="space-y-2">
                    <Label>Batch</Label>
                    <Select value={dpp.batch_id || ''} onValueChange={v => setDpp(prev => prev ? { ...prev, batch_id: v } : prev)}>
                      <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                      <SelectContent>
                        {batches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questions" className="mt-4">
                <div className="space-y-2">
                  <Button onClick={addQuestion} className="w-full gap-2" size="sm">
                    <Plus className="w-4 h-4" />
                    Add Question
                  </Button>
                  <div className="grid grid-cols-5 gap-1.5 mt-3">
                    {questions.map((q, i) => (
                      <button
                        key={q.id || i}
                        onClick={() => setActiveQ(i)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          i === activeQ
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : q.question_text || q.question_image_url
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Main Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {questions.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
                  <p className="text-muted-foreground mb-4">Add your first question to get started</p>
                  <Button onClick={addQuestion}><Plus className="w-4 h-4 mr-2" />Add Question</Button>
                </div>
              </div>
            ) : currentQ ? (
              <motion.div
                key={activeQ}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Question {activeQ + 1}</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveQuestion(currentQ)}>
                      <Save className="w-4 h-4 mr-1" />Save Q
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteQuestion(currentQ)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Question Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select value={currentQ.question_type} onValueChange={v => updateQuestion(activeQ, { question_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_choice">Single Choice (MCQ)</SelectItem>
                        <SelectItem value="multi_choice">Multiple Choice</SelectItem>
                        <SelectItem value="integer">Integer Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={currentQ.difficulty} onValueChange={v => updateQuestion(activeQ, { difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Marks */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marks</Label>
                    <Input type="number" value={currentQ.marks} onChange={e => updateQuestion(activeQ, { marks: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Negative Marks</Label>
                    <Input type="number" value={currentQ.negative_marks} onChange={e => updateQuestion(activeQ, { negative_marks: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question Text (supports LaTeX)</Label>
                  <Textarea
                    value={currentQ.question_text || ''}
                    onChange={e => updateQuestion(activeQ, { question_text: e.target.value })}
                    placeholder="Enter the question text here. Use \(...\) for inline LaTeX and \[...\] for display LaTeX."
                    rows={4}
                  />
                </div>

                {/* Question Image */}
                <div className="space-y-2">
                  <Label>Question Image URL</Label>
                  <Input
                    value={currentQ.question_image_url || ''}
                    onChange={e => updateQuestion(activeQ, { question_image_url: e.target.value })}
                    placeholder="https://..."
                  />
                  {currentQ.question_image_url && (
                    <img src={currentQ.question_image_url} alt="Question" className="max-h-40 rounded-lg border border-border" />
                  )}
                </div>

                {/* Options (for MCQ types) */}
                {(currentQ.question_type === 'single_choice' || currentQ.question_type === 'multi_choice') && (
                  <div className="space-y-3">
                    <Label>Options</Label>
                    {(currentQ.options || []).map((opt: any, oi: number) => (
                      <div key={oi} className="flex items-center gap-3">
                        {currentQ.question_type === 'single_choice' ? (
                          <button
                            onClick={() => updateQuestion(activeQ, { correct_answer: opt.id })}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                              currentQ.correct_answer === opt.id
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-border text-muted-foreground hover:border-primary'
                            }`}
                          >
                            {opt.id}
                          </button>
                        ) : (
                          <Checkbox
                            checked={Array.isArray(currentQ.correct_answer) && currentQ.correct_answer.includes(opt.id)}
                            onCheckedChange={(checked) => {
                              const current = Array.isArray(currentQ.correct_answer) ? currentQ.correct_answer : [];
                              const updated = checked
                                ? [...current, opt.id]
                                : current.filter((x: string) => x !== opt.id);
                              updateQuestion(activeQ, { correct_answer: updated });
                            }}
                          />
                        )}
                        <Input
                          value={opt.text}
                          onChange={e => {
                            const newOpts = [...currentQ.options];
                            newOpts[oi] = { ...opt, text: e.target.value };
                            updateQuestion(activeQ, { options: newOpts });
                          }}
                          placeholder={`Option ${opt.id}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Integer answer */}
                {currentQ.question_type === 'integer' && (
                  <div className="space-y-2">
                    <Label>Correct Answer (integer)</Label>
                    <Input
                      type="number"
                      value={typeof currentQ.correct_answer === 'number' ? currentQ.correct_answer : ''}
                      onChange={e => updateQuestion(activeQ, { correct_answer: parseInt(e.target.value) })}
                      placeholder="Enter the correct integer answer"
                    />
                  </div>
                )}

                {/* Solution */}
                <div className="space-y-2">
                  <Label>Solution Text (supports LaTeX)</Label>
                  <Textarea
                    value={currentQ.solution_text || ''}
                    onChange={e => updateQuestion(activeQ, { solution_text: e.target.value })}
                    placeholder="Explain the solution here..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Solution Image URL</Label>
                  <Input
                    value={currentQ.solution_image_url || ''}
                    onChange={e => updateQuestion(activeQ, { solution_image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
