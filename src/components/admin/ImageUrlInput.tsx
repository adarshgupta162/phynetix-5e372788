import { useRef, useState } from "react";
import { Link2, X, Check, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImageUrlInputProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  compact?: boolean;
  label?: string;
}

async function uploadImageFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("Please choose an image file");
    return null;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error("Max image size is 5 MB");
    return null;
  }
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/\s+/g, "_")}`;
  const { data, error } = await supabase.storage
    .from("question-images")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) {
    toast.error(error.message);
    return null;
  }
  const { data: pub } = supabase.storage.from("question-images").getPublicUrl(data.path);
  toast.success("Image uploaded");
  return pub.publicUrl;
}

export function ImageUrlInput({ value, onChange, compact = false, label = "Image" }: ImageUrlInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState(value || "");
  const [previewError, setPreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleConfirm = () => {
    const trimmed = inputUrl.trim();
    if (trimmed) {
      onChange(trimmed);
      setIsOpen(false);
    } else {
      onChange(null);
      setIsOpen(false);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    const url = await uploadImageFile(file);
    setUploading(false);
    if (url) {
      onChange(url);
      setInputUrl(url);
      setIsOpen(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const hiddenFileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={onPickFile}
    />
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2 mt-1">
        {hiddenFileInput}
        {value ? (
          <div className="flex items-center gap-2">
            <img
              src={value}
              alt=""
              className="h-8 w-8 rounded object-cover border"
              onError={() => setPreviewError(true)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="h-6 w-6 p-0 text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Upload
            </Button>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" type="button" className="h-7 text-xs">
                  <Link2 className="w-3 h-3 mr-1" />
                  URL
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-3">
                  <div className="text-sm font-medium">{label} URL</div>
                  <Input
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      setPreviewError(false);
                    }}
                    placeholder="https://example.com/image.png"
                    className="text-sm"
                  />
                  {inputUrl && !previewError && (
                    <div className="border rounded p-2">
                      <img
                        src={inputUrl}
                        alt="Preview"
                        className="max-h-24 mx-auto rounded"
                        onError={() => setPreviewError(true)}
                      />
                    </div>
                  )}
                  {previewError && (
                    <p className="text-xs text-destructive">Failed to load image preview</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirm} className="flex-1">
                      <Check className="w-3 h-3 mr-1" /> Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hiddenFileInput}
      <div className="flex items-center gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Paste image URL or upload..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="border rounded p-2 bg-secondary/30">
          <img
            src={value}
            alt="Preview"
            className="max-h-32 mx-auto rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
}
