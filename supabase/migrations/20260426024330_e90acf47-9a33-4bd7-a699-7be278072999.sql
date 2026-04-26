-- Tabela de feedback do usuário sobre a qualidade de cada raspagem
CREATE TABLE public.scrape_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL,         -- fetch | firecrawl | perplexity-fallback | perplexity
  score INTEGER NOT NULL,       -- 0-100, score automático calculado
  chars INTEGER NOT NULL DEFAULT 0,
  words INTEGER NOT NULL DEFAULT 0,
  page_type TEXT,               -- spa | amp | ssr | static | blocked | unknown
  rating TEXT NOT NULL,         -- 'good' | 'bad'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scrape feedback"
  ON public.scrape_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scrape feedback"
  ON public.scrape_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own scrape feedback"
  ON public.scrape_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all scrape feedback"
  ON public.scrape_feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_scrape_feedback_user_host ON public.scrape_feedback(user_id, host, created_at DESC);
CREATE INDEX idx_scrape_feedback_user_method ON public.scrape_feedback(user_id, method, created_at DESC);