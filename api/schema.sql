-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steps table
CREATE TABLE IF NOT EXISTS steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, step_number)
);

-- Items table (words, phrases, sentences)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES steps(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('word', 'phrase', 'sentence')),
  english TEXT NOT NULL,
  vietnamese TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(step_id, type, english)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_steps_topic_id ON steps(topic_id);
CREATE INDEX IF NOT EXISTS idx_items_step_id ON items(step_id);
CREATE INDEX IF NOT EXISTS idx_topics_order ON topics(order_index);
CREATE INDEX IF NOT EXISTS idx_steps_order ON steps(topic_id, order_index);
CREATE INDEX IF NOT EXISTS idx_items_order ON items(step_id, order_index);

-- Enable Row Level Security
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow public read access)
CREATE POLICY "Allow public read access on topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Allow public read access on steps" ON steps FOR SELECT USING (true);
CREATE POLICY "Allow public read access on items" ON items FOR SELECT USING (true);
