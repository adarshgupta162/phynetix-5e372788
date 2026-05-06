import { useState } from "react";
import { useBatches } from "@/hooks/useBatches";
import { useEnrolledBatchIds } from "@/hooks/useEnrollment";
import { BatchCard } from "./BatchCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter } from "lucide-react";
import { JoinBatchByCode } from "./JoinBatchByCode";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "jee_main", label: "JEE Main" },
  { value: "jee_advanced", label: "JEE Advanced" },
  { value: "neet", label: "NEET" },
  { value: "bitsat", label: "BITSAT" },
  { value: "mht_cet", label: "MHT-CET" },
  { value: "foundation", label: "Foundation" },
];

interface BatchCatalogProps {
  showEnrollButtons?: boolean;
}

export function BatchCatalog({ showEnrollButtons = true }: BatchCatalogProps) {
  const { data: batches, isLoading } = useBatches();
  const { data: enrolledBatchIds = [] } = useEnrolledBatchIds();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filteredBatches = batches?.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(search.toLowerCase()) ||
      batch.short_description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || batch.category === category;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Category" />
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

      {/* Batch Grid */}
      {filteredBatches && filteredBatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBatches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              isEnrolled={enrolledBatchIds.includes(batch.id)}
              showEnrollButton={showEnrollButtons}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No batches found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
