import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCreateBatch, useUpdateBatch, type Batch } from "@/hooks/useBatches";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const batchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  short_description: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  price: z.number().min(0, "Price must be positive"),
  original_price: z.number().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  enrollment_deadline: z.string().optional().nullable(),
  max_students: z.number().optional().nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
});

type BatchFormData = z.infer<typeof batchSchema>;

const categories = [
  { value: "jee_main", label: "JEE Main" },
  { value: "jee_advanced", label: "JEE Advanced" },
  { value: "jee_main_advanced", label: "JEE Main + Advanced" },
  { value: "neet", label: "NEET" },
  { value: "bitsat", label: "BITSAT" },
  { value: "mht_cet", label: "MHT-CET" },
  { value: "foundation", label: "Foundation" },
];

interface BatchEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: Batch | null;
}

export function BatchEditorDialog({ open, onOpenChange, batch }: BatchEditorDialogProps) {
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const isEditing = !!batch;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      name: "",
      short_description: "",
      description: "",
      category: "jee_main",
      price: 0,
      original_price: null,
      start_date: null,
      end_date: null,
      enrollment_deadline: null,
      max_students: null,
      is_active: true,
      is_featured: false,
    },
  });

  // Reset form when batch changes
  useEffect(() => {
    if (batch) {
      reset({
        name: batch.name,
        short_description: batch.short_description || "",
        description: batch.description || "",
        category: batch.category || "jee_main",
        price: batch.price,
        original_price: batch.original_price,
        start_date: batch.start_date,
        end_date: batch.end_date,
        enrollment_deadline: batch.enrollment_deadline,
        max_students: batch.max_students,
        is_active: batch.is_active ?? true,
        is_featured: batch.is_featured ?? false,
      });
      setFeatures((batch.features as string[]) || []);
    } else {
      reset({
        name: "",
        short_description: "",
        description: "",
        category: "jee_main",
        price: 0,
        original_price: null,
        start_date: null,
        end_date: null,
        enrollment_deadline: null,
        max_students: null,
        is_active: true,
        is_featured: false,
      });
      setFeatures([]);
    }
  }, [batch, reset]);

  const onSubmit = async (data: BatchFormData) => {
    try {
      if (isEditing && batch) {
        await updateBatch.mutateAsync({ 
          id: batch.id, 
          ...data,
          features: features,
        });
        toast.success("Batch updated successfully");
      } else {
        await createBatch.mutateAsync({
          name: data.name,
          short_description: data.short_description,
          description: data.description,
          category: data.category,
          price: data.price,
          original_price: data.original_price,
          start_date: data.start_date,
          end_date: data.end_date,
          enrollment_deadline: data.enrollment_deadline,
          max_students: data.max_students,
          is_active: data.is_active,
          is_featured: data.is_featured,
          features: features,
        });
        toast.success("Batch created successfully");
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save batch");
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Batch" : "Create New Batch"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update batch details" : "Create a new test series batch"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Batch Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., JEE Main 2026 Complete Course"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              {batch?.join_code && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Join Code (share with students)</Label>
                    <div className="font-mono text-lg font-bold tracking-wider">{batch.join_code}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(batch.join_code); }}
                    className="text-xs px-3 py-1 border rounded hover:bg-background"
                  >
                    Copy
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={watch("category")}
                    onValueChange={(value) => setValue("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="max_students">Max Students</Label>
                  <Input
                    id="max_students"
                    type="number"
                    placeholder="Unlimited"
                    {...register("max_students", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="short_description">Short Description</Label>
                <Input
                  id="short_description"
                  placeholder="Brief description for cards"
                  {...register("short_description")}
                />
              </div>

              <div>
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed batch description..."
                  rows={4}
                  {...register("description")}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h4 className="font-medium">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="999"
                    {...register("price", { valueAsNumber: true })}
                  />
                  {errors.price && (
                    <p className="text-sm text-destructive mt-1">{errors.price.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="original_price">Original Price (₹)</Label>
                  <Input
                    id="original_price"
                    type="number"
                    placeholder="1999 (for discount display)"
                    {...register("original_price", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-4">
              <h4 className="font-medium">Schedule</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    {...register("start_date")}
                  />
                </div>

                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    {...register("end_date")}
                  />
                </div>

                <div>
                  <Label htmlFor="enrollment_deadline">Enrollment Deadline</Label>
                  <Input
                    id="enrollment_deadline"
                    type="date"
                    {...register("enrollment_deadline")}
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h4 className="font-medium">Features</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a feature (e.g., 30 Full Tests)"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addFeature}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">Show this batch to students</p>
                </div>
                <Switch
                  checked={watch("is_active")}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured</Label>
                  <p className="text-sm text-muted-foreground">Highlight on landing page</p>
                </div>
                <Switch
                  checked={watch("is_featured")}
                  onCheckedChange={(checked) => setValue("is_featured", checked)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEditing ? "Update Batch" : "Create Batch"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
