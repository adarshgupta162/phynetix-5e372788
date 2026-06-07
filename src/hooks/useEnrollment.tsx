import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type BatchEnrollment = Tables<'batch_enrollments'>;

export function useUserEnrollments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: async () => {
      if (!user) return [];

      console.info('[useUserEnrollments] loading enrollments for user:', user.id);

      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('batch_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('enrolled_at', { ascending: false });

      console.log('[useUserEnrollments] enrollments response:', enrollments);
      if (enrollmentsError) {
        console.error('[useUserEnrollments] enrollments error:', enrollmentsError);
        throw enrollmentsError;
      }

      const enrollmentRows = enrollments ?? [];
      const mismatchedUserRows = enrollmentRows.filter((enrollment) => enrollment.user_id !== user.id);
      if (mismatchedUserRows.length > 0) {
        console.warn('[useUserEnrollments] found user_id mismatch rows:', mismatchedUserRows);
      } else {
        console.info('[useUserEnrollments] verified all enrollment user_id values match auth user.id');
      }

      const batchIds = [...new Set(enrollmentRows.map((enrollment) => enrollment.batch_id))];
      if (batchIds.length === 0) {
        return enrollmentRows.map((enrollment) => ({ ...enrollment, batches: null }));
      }

      const { data: batches, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .in('id', batchIds);

      console.log('[useUserEnrollments] batches response:', batches);
      if (batchesError) {
        console.error('[useUserEnrollments] batches error:', batchesError);
        throw batchesError;
      }

      const batchById = new Map((batches ?? []).map((batch) => [batch.id, batch]));
      const combined = enrollmentRows.map((enrollment) => ({
        ...enrollment,
        batches: batchById.get(enrollment.batch_id) ?? null,
      }));

      console.log('[useUserEnrollments] combined enrollment+batches result:', combined);
      return combined;
    },
    enabled: !!user,
  });
}

export function useEnrollmentForBatch(batchId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollment', batchId, user?.id],
    queryFn: async () => {
      if (!user || !batchId) return null;

      const { data, error } = await supabase
        .from('batch_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('batch_id', batchId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!batchId,
  });
}

export function useIsEnrolled(batchId: string | undefined) {
  const { data: enrollment, isLoading } = useEnrollmentForBatch(batchId);
  
  return {
    isEnrolled: !!enrollment,
    enrollment,
    isLoading,
  };
}

export function useAllEnrollments() {
  return useQuery({
    queryKey: ['enrollments', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_enrollments')
        .select(`
          *,
          batches (name, category)
        `)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useEnrollmentsByBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['enrollments', 'batch', batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const { data, error } = await supabase
        .from('batch_enrollments')
        .select('*')
        .eq('batch_id', batchId)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!batchId,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      batchId, 
      userId,
      enrollmentType = 'paid',
      notes,
    }: { 
      batchId: string; 
      userId?: string;
      enrollmentType?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('batch_enrollments')
        .insert({
          batch_id: batchId,
          user_id: userId || user?.id,
          enrollment_type: enrollmentType,
          enrolled_by: user?.id,
          notes,
          is_active: true,
          payment_status: enrollmentType === 'manual' ? 'completed' : 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<BatchEnrollment> & { id: string }) => {
      const { data, error } = await supabase
        .from('batch_enrollments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('batch_enrollments')
        .update({ is_active: false })
        .eq('id', enrollmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

// Hook to get enrolled batch IDs for the current user
export function useEnrolledBatchIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrolled-batch-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('batch_enrollments')
        .select('batch_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data.map(e => e.batch_id);
    },
    enabled: !!user,
  });
}

// Hook to get accessible test IDs based on enrollment
export function useAccessibleTestIds() {
  const { data: batchIds = [] } = useEnrolledBatchIds();

  return useQuery({
    queryKey: ['accessible-test-ids', batchIds],
    queryFn: async () => {
      if (batchIds.length === 0) return [];

      const { data, error } = await supabase
        .from('batch_tests')
        .select('test_id')
        .in('batch_id', batchIds);

      if (error) throw error;
      return [...new Set(data.map(bt => bt.test_id))];
    },
    enabled: batchIds.length > 0,
  });
}
