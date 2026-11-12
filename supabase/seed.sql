-- DEVELOPMENT SEED ONLY. Never run against production. Creates published/draft styles; no users or passwords.
insert into public.styles (name, category, status) values
  ('Stick-figure explainer', 'Stickman', 'published'),
  ('Motion graphics', 'Motion graphics', 'needs_review'),
  ('Whiteboard', 'Whiteboard', 'draft')
on conflict do nothing;
