import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Flag, Clock, User, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Question {
  id: string;
  question_number: number;
  question_type: string;
  options?: string[];
  marks: number;
  negative_marks: number;
  section_id: string;
}

interface EnhancedOMRPanelProps {
  questions: Question[];
  filteredQuestionIds: string[];
  answers: Record<string, string | string[]>;
  markedForReview: Set<string>;
  viewedQuestions: Set<string>;
  currentQuestion: number;
  timeLeft: number;
  studentName: string;
  rollNumber: string;
  targetExam: string;
  avatarUrl?: string;
  testName: string;
  onAnswerChange: (questionId: string, answer: string | string[]) => void;
  onToggleReview: (questionId: string) => void;
  onQuestionClick: (index: number) => void;
  onSubmit: () => void;
  onNext: () => void;
  submitDisabled?: boolean;
}

export default function EnhancedOMRPanel({
  questions,
  filteredQuestionIds,
  answers,
  markedForReview,
  viewedQuestions,
  currentQuestion,
  timeLeft,
  studentName,
  rollNumber,
  targetExam,
  avatarUrl,
  testName,
  onAnswerChange,
  onToggleReview,
  onQuestionClick,
  onSubmit,
  onNext,
  submitDisabled
}: EnhancedOMRPanelProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentQuestion];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;

  const handleOptionClick = (option: string) => {
    if (!currentQ) return;

    if (currentQ.question_type === 'single') {
      onAnswerChange(currentQ.id, option);
    } else if (currentQ.question_type === 'multi') {
      const currentAnswers = (currentAnswer as string[]) || [];
      if (currentAnswers.includes(option)) {
        onAnswerChange(currentQ.id, currentAnswers.filter(a => a !== option));
      } else {
        onAnswerChange(currentQ.id, [...currentAnswers, option]);
      }
    }
  };

  const handleIntegerChange = (value: string) => {
    if (!currentQ) return;
    if (/^-?\d*\.?\d*$/.test(value) || value === '') {
      onAnswerChange(currentQ.id, value);
    }
  };

  const isOptionSelected = (option: string) => {
    if (!currentAnswer) return false;
    if (currentQ?.question_type === 'multi') {
      return (currentAnswer as string[]).includes(option);
    }
    return currentAnswer === option;
  };

  // Get status for question button styling
  const getQuestionStatus = (qId: string) => {
    const ans = answers[qId];
    const isAnswered = ans !== undefined && ans !== '' && 
      (Array.isArray(ans) ? ans.length > 0 : true);
    const isMarked = markedForReview.has(qId);
    const isSeen = viewedQuestions.has(qId);

    if (isAnswered && isMarked) return 'answered-marked';
    if (isAnswered) return 'answered';
    if (isMarked) return 'marked';
    if (!isSeen) return 'unseen';
    return 'not-answered';
  };

  const stats = useMemo(() => {
    let answered = 0;
    let marked = 0;
    let unanswered = 0;
    let unseen = 0;
    let answeredMarked = 0;

    filteredQuestionIds.forEach(qId => {
      const status = getQuestionStatus(qId);
      if (status === 'answered-marked') answeredMarked++;
      else if (status === 'answered') answered++;
      else if (status === 'marked') marked++;
      else if (status === 'unseen') unseen++;
      else unanswered++;
    });

    return { answered, marked, unanswered, unseen, answeredMarked };
  }, [filteredQuestionIds, answers, markedForReview, viewedQuestions]);

  const overallStats = useMemo(() => {
    let answered = 0;
    let marked = 0;
    let unanswered = 0;
    let unseen = 0;
    let answeredMarked = 0;

    questions.forEach(q => {
      const status = getQuestionStatus(q.id);
      if (status === 'answered-marked') answeredMarked++;
      else if (status === 'answered') answered++;
      else if (status === 'marked') marked++;
      else if (status === 'unseen') unseen++;
      else unanswered++;
    });

    return { answered, marked, unanswered, unseen, answeredMarked, total: questions.length };
  }, [questions, answers, markedForReview, viewedQuestions]);

  return (
    <div className="flex flex-col h-full bg-secondary/30 overflow-hidden">
      {/* Top Header - Test Name with Info */}
      <div className="p-3 border-b border-border bg-secondary/50">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm truncate flex-1">{testName}</h2>
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Info className="w-3.5 h-3.5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="p-3">
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold mb-2">Overall Paper Stats</div>
                  <div>Total: {overallStats.total}</div>
                  <div>Attempted: {overallStats.answered + overallStats.answeredMarked}</div>
                  <div>Not Attempted: {overallStats.unanswered}</div>
                  <div>Unseen: {overallStats.unseen}</div>
                  <div>Marked: {overallStats.marked + overallStats.answeredMarked}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Submit Button at Top */}
      <div className="p-3 border-b border-border">
        <Button
          variant="gradient"
          className="w-full"
          onClick={onSubmit}
          disabled={submitDisabled}
        >
          {submitDisabled ? "Submit Disabled" : "Submit Test"}
        </Button>
      </div>

      {/* Student Info with Avatar */}
      <div className="p-3 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/20 text-primary">
              {studentName?.charAt(0) || 'S'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{studentName || 'Student'}</p>
            <p className="text-xs text-muted-foreground">{targetExam || 'JEE'}</p>
            <p className="text-xs text-muted-foreground">Roll: {rollNumber}</p>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className={cn(
        "p-3 border-b border-border",
        timeLeft < 300 ? 'bg-destructive/10' : 'bg-primary/10'
      )}>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
          <Clock className="w-4 h-4" />
          Time Remaining
        </div>
        <div className={cn(
          "text-2xl font-bold font-mono text-center",
          timeLeft < 300 ? 'text-destructive' : 'text-primary'
        )}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Question Area */}
      <div className="flex-1 overflow-auto p-3">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Question {(currentQuestion + 1).toString().padStart(2, '0')}
        </h3>

        {currentQ && (
          <div className="space-y-4">
            {/* Options in 2x2 Grid for MCQ */}
            {(currentQ.question_type === 'single' || currentQ.question_type === 'multi') && (
              <div className="grid grid-cols-2 gap-2">
                {['A', 'B', 'C', 'D'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleOptionClick(option)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border transition-all",
                      isOptionSelected(option)
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                    )}
                  >
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      isOptionSelected(option)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    )}>
                      {option}
                    </span>
                    {isOptionSelected(option) && (
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {currentQ.question_type === 'multi' && (
              <p className="text-xs text-muted-foreground text-center">
                Multiple answers allowed
              </p>
            )}

            {/* Integer/Numerical Input */}
            {(currentQ.question_type === 'integer' || currentQ.question_type === 'numerical') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter your answer:</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={(currentAnswer as string) || ''}
                  onChange={(e) => handleIntegerChange(e.target.value)}
                  placeholder="Enter numerical value"
                  className="text-lg font-mono text-center"
                />
              </div>
            )}

            {/* Mark for Review */}
            <Button
              variant={markedForReview.has(currentQ.id) ? "default" : "outline"}
              className={cn(
                "w-full",
                markedForReview.has(currentQ.id) && "bg-[hsl(270,60%,50%)] hover:bg-[hsl(270,60%,45%)]"
              )}
              onClick={() => onToggleReview(currentQ.id)}
            >
              <Flag className="w-4 h-4 mr-2" />
              {markedForReview.has(currentQ.id) ? 'Marked for Review' : 'Mark for Review'}
            </Button>
          </div>
        )}

        {/* Question Grid for Current Section */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Question Palette
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.filter(q => filteredQuestionIds.includes(q.id)).map((q) => {
              const globalIndex = questions.findIndex(gq => gq.id === q.id);
              const status = getQuestionStatus(q.id);
              const isCurrent = globalIndex === currentQuestion;

              return (
                <button
                  key={q.id}
                  onClick={() => onQuestionClick(globalIndex)}
                  className={cn(
                    "relative w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all overflow-hidden",
                    isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  )}
                  style={status === 'answered-marked' ? {
                    background: 'linear-gradient(135deg, hsl(142,76%,36%) 50%, hsl(270,60%,50%) 50%)',
                    color: 'white'
                  } : undefined}
                >
                  {status !== 'answered-marked' && (
                    <div className={cn(
                      "absolute inset-0",
                      status === 'answered' && 'bg-[hsl(142,76%,36%)]',
                      status === 'marked' && 'bg-[hsl(270,60%,50%)]',
                      status === 'unseen' && 'bg-muted',
                      status === 'not-answered' && 'bg-secondary'
                    )} />
                  )}
                  <span className={cn(
                    "relative z-10",
                    (status === 'answered' || status === 'marked' || status === 'answered-marked') && 'text-white'
                  )}>
                    {q.question_number}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Legend */}
        <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded bg-[hsl(142,76%,36%)]/20">
            <div className="w-3 h-3 rounded bg-[hsl(142,76%,36%)]" />
            <span>Answered: {stats.answered}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[hsl(270,60%,50%)]/20">
            <div className="w-3 h-3 rounded bg-[hsl(270,60%,50%)]" />
            <span>Marked: {stats.marked}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-secondary">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Unseen: {stats.unseen}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded" style={{
            background: 'linear-gradient(135deg, hsl(142,76%,36%,0.2) 50%, hsl(270,60%,50%,0.2) 50%)'
          }}>
            <div className="w-3 h-3 rounded" style={{
              background: 'linear-gradient(135deg, hsl(142,76%,36%) 50%, hsl(270,60%,50%) 50%)'
            }} />
            <span>Both: {stats.answeredMarked}</span>
          </div>
        </div>
      </div>

      {/* Next Button at Bottom */}
      <div className="p-3 border-t border-border">
        <Button
          variant="glass"
          className="w-full"
          onClick={onNext}
          disabled={currentQuestion === questions.length - 1}
        >
          Next Question
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
