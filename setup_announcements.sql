-- Run this SQL in your Supabase SQL Editor to create the announcements table

CREATE TABLE public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('announcement', 'assignment')),
    faculty_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    target_divisions JSONB, -- Array of division strings, or null for all
    target_batches JSONB, -- Array of batch strings, or null for all
    due_date TIMESTAMPTZ, -- Optional, mostly for assignments
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone (authenticated) can view announcements
-- (Filtering logic for students is handled in the frontend for simpler UI/UX in this case, 
--  but you could restrict it further based on the profiles and students tables)
CREATE POLICY "Enable read access for authenticated users" 
    ON public.announcements FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Policy: Only faculty and admins can insert announcements
CREATE POLICY "Enable insert for faculty and admins" 
    ON public.announcements FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('faculty', 'admin')
        )
    );

-- Policy: Only the faculty who created it (or admin) can update
CREATE POLICY "Enable update for owner faculty" 
    ON public.announcements FOR UPDATE
    USING (
        faculty_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Policy: Only the faculty who created it (or admin) can delete
CREATE POLICY "Enable delete for owner faculty" 
    ON public.announcements FOR DELETE 
    USING (
        faculty_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
