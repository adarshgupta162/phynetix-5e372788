import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon, GripVertical, MoveUp, MoveDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  label?: string;
}

export function MultiImageUpload({
  value = [],
  onChange,
  disabled,
  className,
  compact = false,
  label = "Images"
}: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.name.replace(/\s+/g,"_")}`;
      const { data, error } = await supabase.storage
        .from("question-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false, contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("question-images")
        .getPublicUrl(data.path);

      onChange([...value, urlData.publicUrl]);
      toast({ title: "Image uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
  };

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newUrls = [...value];
    [newUrls[index - 1], newUrls[index]] = [newUrls[index], newUrls[index - 1]];
    onChange(newUrls);
  };

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const newUrls = [...value];
    [newUrls[index], newUrls[index + 1]] = [newUrls[index + 1], newUrls[index]];
    onChange(newUrls);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* Image list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card group"
            >
              {/* Reorder controls */}
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || disabled}
                  className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground"
                  title="Move up"
                >
                  <MoveUp className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === value.length - 1 || disabled}
                  className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground"
                  title="Move down"
                >
                  <MoveDown className="w-3 h-3" />
                </button>
              </div>

              {/* Image preview */}
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="max-h-32 max-w-[200px] rounded border border-border object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className={cn("text-xs", compact ? "h-7" : "h-9")}
      >
        {uploading ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <ImageIcon className="w-3 h-3 mr-1" />
            Add {label}
          </>
        )}
      </Button>
    </div>
  );
}
