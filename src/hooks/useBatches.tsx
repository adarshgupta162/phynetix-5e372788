import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type Batch = Tables<'batches'>;
export type BatchEnrollment = Tables<'batch_enrollments'>;

export function useBatches() {
  return useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Batch[];
    },
  });
}

export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      if (!batchId) return null;
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error) throw error;
      return data as Batch;
    },
    enabled: !!batchId,
  });
}

export function useAllBatches() {
  return useQuery({
    queryKey: ['batches', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Batch[];
    },
  });
}

export function useFeaturedBatches() {
  return useQuery({
    queryKey: ['batches', 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      return data as Batch[];
    },
  });
}

export function useBatchTests(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batch-tests', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      
      const { data, error } = await supabase
        .from('batch_tests')
        .select(`
          *,
          tests (*)
        `)
        .eq('batch_id', batchId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!batchId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (batch: Omit<Partial<Batch>, 'id' | 'created_at' | 'updated_at'> & { name: string }) => {
      const { data, error } = await supabase
        .from('batches')
        .insert({
          name: batch.name,
          description: batch.description,
          short_description: batch.short_description,
          instructions: (batch as any).instructions,
          welcome_message: (batch as any).welcome_message,
          price: batch.price || 0,
          original_price: batch.original_price,
          category: batch.category,
          start_date: batch.start_date,
          end_date: batch.end_date,
          enrollment_deadline: batch.enrollment_deadline,
          max_students: batch.max_students,
          is_active: batch.is_active ?? true,
          is_featured: batch.is_featured ?? false,
          features: batch.features,
          syllabus: batch.syllabus,
          thumbnail_url: batch.thumbnail_url,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Batch> & { id: string }) => {
      const { data, error } = await supabase
        .from('batches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch', data.id] });
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}
