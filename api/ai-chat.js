const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

Bądź przyjazny i naturalny. Mów po polsku.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
      return res.status(500).json({ error: 'Brak odpowiedzi z OpenAI', details: data });
    }

    const aiResponse = data.choices[0].message.content;
    const isReady = aiResponse.includes('GOTOWE_DO_REKOMENDACJI');

    res.json({
      response: aiResponse.replace('=== GOTOWE_DO_REKOMENDACJI ===', '').trim(),
      readyForRecommendations: isReady
    });
  } catch (error) {
    console.error('Błąd:', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};
