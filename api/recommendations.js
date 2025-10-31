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
Format odpowiedzi:
🎬 [Tytuł]
Dopasowanie: XX%
Dlaczego: [wyjaśnienie]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
    console.error('Błąd:', error);
    res.status(500).json({ error: error.message });
  }
};
