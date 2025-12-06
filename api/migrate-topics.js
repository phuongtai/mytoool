import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateTopics() {
  console.log('Starting topics migration to Supabase...\n');

  // Load topics.json
  const topicsPath = path.join(__dirname, '..', 'src', 'data', 'topics.json');
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));

  console.log(`Found ${topics.length} topics to migrate\n`);

  // Insert topics
  for (const topic of topics) {
    console.log(`Migrating topic: ${topic.topic}`);
    
    // Insert topic
    const { data: topicData, error: topicError } = await supabase
      .from('topics')
      .upsert({
        name: topic.topic,
        description: topic.description || '',
        order_index: topics.indexOf(topic)
      }, { onConflict: 'name' })
      .select()
      .single();

    if (topicError) {
      console.error(`Error inserting topic ${topic.topic}:`, topicError);
      continue;
    }

    console.log(`  ✓ Topic created with ID: ${topicData.id}`);

    // Insert steps
    for (const step of topic.steps || []) {
      const { data: stepData, error: stepError } = await supabase
        .from('steps')
        .upsert({
          topic_id: topicData.id,
          step_number: step.step,
          order_index: step.step - 1
        }, { onConflict: 'topic_id,step_number' })
        .select()
        .single();

      if (stepError) {
        console.error(`  Error inserting step ${step.step}:`, stepError);
        continue;
      }

      // Insert items (words, phrases, sentences)
      const items = [];
      
      step.words?.forEach((word, idx) => {
        items.push({
          step_id: stepData.id,
          type: 'word',
          english: word.en,
          vietnamese: word.vi,
          order_index: idx
        });
      });

      step.phrases?.forEach((phrase, idx) => {
        items.push({
          step_id: stepData.id,
          type: 'phrase',
          english: phrase.en,
          vietnamese: phrase.vi,
          order_index: step.words?.length || 0 + idx
        });
      });

      step.sentences?.forEach((sentence, idx) => {
        items.push({
          step_id: stepData.id,
          type: 'sentence',
          english: sentence.en,
          vietnamese: sentence.vi,
          order_index: (step.words?.length || 0) + (step.phrases?.length || 0) + idx
        });
      });

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('items')
          .upsert(items, { onConflict: 'step_id,type,english' });

        if (itemsError) {
          console.error(`  Error inserting items for step ${step.step}:`, itemsError);
        } else {
          console.log(`  ✓ Step ${step.step}: ${items.length} items`);
        }
      }
    }
  }

  console.log('\n✅ Migration completed!');
}

migrateTopics().catch(console.error);
