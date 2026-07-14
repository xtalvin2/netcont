
CREATE TABLE IF NOT EXISTS public.advertisements (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  type            text NOT NULL CHECK (type IN ('image', 'video', 'url')),
  content_url     text,          -- image src / video src (for type image|video)
  link_url        text,          -- clickable destination URL (all types)
  caption         text,          -- optional sub-text shown on banner
  is_active       boolean DEFAULT true NOT NULL,
  display_order   integer DEFAULT 0 NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

-- RLS: authenticated admins can do everything; anon can read active ads
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_active_ads"
  ON public.advertisements FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "auth_all_ads"
  ON public.advertisements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_advertisements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION update_advertisements_updated_at();

-- seed 2 demo ads
INSERT INTO public.advertisements (title, type, content_url, link_url, caption, is_active, display_order) VALUES
  ('Fast Internet for Everyone', 'image', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', 'https://wa.me/2348000000000', 'Connect today — plans from ₦200', true, 1),
  ('Upgrade Your Plan', 'url', null, '/packages', 'Get full-day access for just ₦1,200', true, 2);
