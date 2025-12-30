-- E-Learning Tables for Øresund CRM
-- Run this in your Supabase SQL editor

-- =====================================================
-- LESSONS TABLE - Stores lesson/course information
-- =====================================================
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content TEXT, -- Rich text/markdown content
  video_url TEXT, -- Optional video embed
  duration_minutes INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT false, -- Required for all sellers
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LESSON PAGES TABLE - Multiple pages per lesson
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Rich text/markdown content
  page_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- QUIZZES TABLE - Quiz attached to lesson
-- =====================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE UNIQUE, -- One quiz per lesson
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70, -- Percentage needed to pass
  time_limit_minutes INTEGER, -- Optional time limit
  max_attempts INTEGER DEFAULT 3, -- Max attempts allowed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- QUIZ QUESTIONS TABLE - Questions for each quiz
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice', -- multiple_choice, true_false
  options JSONB NOT NULL, -- Array of {text: string, isCorrect: boolean}
  explanation TEXT, -- Explanation shown after answering
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LESSON PROGRESS TABLE - Tracks user progress through lessons
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  current_page INTEGER DEFAULT 1,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- =====================================================
-- QUIZ ATTEMPTS TABLE - Stores each quiz attempt
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL, -- Percentage score
  points_earned INTEGER DEFAULT 0,
  points_possible INTEGER DEFAULT 0,
  is_passed BOOLEAN DEFAULT false,
  answers JSONB, -- Array of {questionId, selectedOption, isCorrect}
  time_spent_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lessons_published ON lessons(is_published);
CREATE INDEX IF NOT EXISTS idx_lessons_sort_order ON lessons(sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_pages_lesson ON lesson_pages(lesson_id, page_number);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Lessons: Admins can CRUD, all authenticated can read published
CREATE POLICY "Admins can manage lessons" ON lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users can view published lessons" ON lessons
  FOR SELECT USING (is_published = true);

-- Lesson Pages: Admins can CRUD, all authenticated can read
CREATE POLICY "Admins can manage lesson pages" ON lesson_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users can view lesson pages" ON lesson_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_pages.lesson_id AND lessons.is_published = true)
  );

-- Quizzes: Admins can CRUD, all authenticated can read
CREATE POLICY "Admins can manage quizzes" ON quizzes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users can view quizzes" ON quizzes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lessons WHERE lessons.id = quizzes.lesson_id AND lessons.is_published = true)
  );

-- Quiz Questions: Admins can CRUD, all authenticated can read
CREATE POLICY "Admins can manage quiz questions" ON quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users can view quiz questions" ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      WHERE quizzes.id = quiz_questions.quiz_id AND lessons.is_published = true
    )
  );

-- Lesson Progress: Users can CRUD their own
CREATE POLICY "Users can manage own lesson progress" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all lesson progress" ON lesson_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Quiz Attempts: Users can CRUD their own, admins can view all
CREATE POLICY "Users can manage own quiz attempts" ON quiz_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all quiz attempts" ON quiz_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_pages_updated_at BEFORE UPDATE ON lesson_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
