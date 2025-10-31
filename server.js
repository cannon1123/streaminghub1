require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Inicjalizacja Supabase (zmienne z .env)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ====== ENDPOINT: AI Chat ======
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Brak wiadomości' });
    }

    // Pobierz filmy z Supabase
    const { data: movies } = await supabase
      .from('filmy')
      .select('*')
      .limit(50);

    const movieDescriptions = (movies || [])
      .map(m => `Tytuł: ${m.tytul || m.title}, Gatunek: ${m.gatunek || m.genre}, Opis: ${m.opis || m.description}`)
      .join('\n');

    const systemPrompt = `Jesteś asystentem AI dla platformy StreamingHub.
Twoim zadaniem jest rozmawiać z użytkownikiem o jego gustach filmowych i zadawać pytania doprecyzowujące.
Gdy zbierzesz wystarczająco informacji, napisz "=== GOTOWE_DO_REKOMENDACJI ===" na końcu wiadomości.

Dostępne filmy:
${movieDescriptions}

Bądź przyjazny i naturalny.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Wywołanie OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 800
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: 'Brak odpowiedzi z OpenAI' });
    }

    const aiResponse = data.choices[0].message.content;
    const isReady = aiResponse.includes('GOTOWE_DO_REKOMENDACJI');

    res.json({
      response: aiResponse.replace('=== GOTOWE_DO_REKOMENDACJI ===', '').trim(),
      readyForRecommendations: isReady
    });
  } catch (error) {
    console.error('Błąd AI Chat:', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
});

// ====== ENDPOINT: Rekomendacje ======
app.post('/api/recommendations', async (req, res) => {
  try {
    const { preferences } = req.body;

    const { data: movies } = await supabase
      .from('filmy')
      .select('*');

    const movieDescriptions = (movies || [])
      .map(m => `Tytuł: ${m.tytul || m.title}, Gatunek: ${m.gatunek || m.genre}, Opis: ${m.opis || m.description}`)
      .join('\n');

    const systemPrompt = `Jesteś ekspertem od filmów.
Użytkownik opisał swoje preferencje: "${preferences}"

Dostępne filmy:
${movieDescriptions}

Wybierz 3 najlepsze i wyjaśnij dlaczego pasują.
Format:
🎬 [Tytuł]
Dopasowanie: XX%
Dlaczego: [wyjaśnienie]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const recommendations = data.choices[0].message.content;

    res.json({ recommendations });
  } catch (error) {
    console.error('Błąd rekomendacji:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== ENDPOINT: Pobierz filmy ======
app.get('/api/movies', async (req, res) => {
  try {
    const { data: movies } = await supabase
      .from('filmy')
      .select('*')
      .limit(100);
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serwer na http://localhost:${PORT}`);
});
