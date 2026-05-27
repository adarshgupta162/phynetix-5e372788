import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, BookOpen, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LatexRenderer } from "@/components/ui/latex-renderer";

interface SolutionSectionProps {
  solutionText?: string;
  steps?: string[];
  finalAnswer?: string;
  chapter?: string;
  topic?: string;
  isAttemptMode?: boolean;
  onShowSolution?: () => void;
  solutionImageUrl?: string;
  solutionImageUrls?: string[];
}

export function SolutionSection({
  solutionText,
  steps = [],
  finalAnswer,
  chapter,
  topic,
  isAttemptMode = false,
  onShowSolution,
  solutionImageUrl,
  solutionImageUrls,
}: SolutionSectionProps) {
  const [showWorking, setShowWorking] = useState(true);
  const [inverted, setInverted] = useState(true);


  if (isAttemptMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold font-display flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Solution
          </h3>
          <Button onClick={onShowSolution} className="bg-primary text-primary-foreground">
            View Solution
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Solution is hidden in attempt mode. Click to reveal.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold font-display flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          SOLUTION
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowWorking(!showWorking)}
          className="text-muted-foreground hover:text-foreground"
        >
          {showWorking ? (
            <>
              Hide Working <ChevronUp className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              Show Working <ChevronDown className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Solution Content */}
      <AnimatePresence>
        {showWorking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {(() => {
              const allImages = solutionImageUrls?.length ? solutionImageUrls : solutionImageUrl ? [solutionImageUrl] : [];
              if (!allImages.length) return null;
              return (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInverted((v) => !v)}
                      className="text-xs"
                    >
                      <Contrast className="w-3.5 h-3.5 mr-1" />
                      {inverted ? "Original colors" : "Invert colors"}
                    </Button>
                  </div>
                  {allImages.map((url, idx) => (
                    <div key={idx} className="rounded-lg overflow-hidden border border-border/50 bg-black p-2 flex justify-center">
                      <img
                        src={url}
                        alt={`Solution ${idx + 1}`}
                        className={cn("max-w-full", inverted && "invert hue-rotate-180")}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {solutionText && (
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  <LatexRenderer content={solutionText} />
                </div>
              </div>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="text-sm text-foreground leading-relaxed pt-0.5">
                      <LatexRenderer content={step} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Final Answer */}
            {finalAnswer && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <div className="text-sm font-medium text-success">
                  ∴ <LatexRenderer content={finalAnswer} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapter & Topic */}
      {(chapter || topic) && (
        <div className="pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {chapter && <span>Chapter: {chapter}</span>}
            {chapter && topic && <span className="mx-2">•</span>}
            {topic && <span>Topic: {topic}</span>}
          </p>
        </div>
      )}
    </motion.div>
  );
}
