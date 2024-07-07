const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const openai = require('openai');

require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json());

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';
const openai_client = new openai.OpenAI();

async function run_search(brand, country) {
    const query = `which CPG owns ${brand} in the country ${country}?`;
    const response = await axios.get(GOOGLE_SEARCH_URL, {
        params: { q: query },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    console.log()

    const $ = cheerio.load(response.data);
    const links = [];
    $('a').each((index, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith('/url?q=')) {
            const link = href.split('/url?q=')[1].split('&sa=U&')[0];
            console.log(link)
            links.push(link);
        }
    });

    return links.slice(0, 10);
}

async function fetch_webpage_content(url) {
    const response = await axios.get(url);
    return response.data;
}

async function process_with_openai(content) {
    const completion = await openai_client.chat.completions.create({
        messages: [
            { role: "system", content: "Extract this webpage data to this json schema: company_name -> string, date_created -> string MM/DD/YYYY" },
            { role: "system", content: content }
        ],
        model: "gpt-3.5-turbo",
        response_format: { "type": "json_object" }
    });

    return completion.choices[0];
}

async function get_structured_schema(links) {
    const structuredData = [];

    for (const link of links) {
        try {
            const content = await fetch_webpage_content(link);
            const processedData = await process_with_openai(content);
            structuredData.push({
                url: link,
                ...processedData
            });
        } catch (error) {
            console.error(`Error processing link ${link}:`, error);
            structuredData.push({
                url: link,
                error: 'Failed to process this link'
            });
        }
    }

    return structuredData;
}

app.get('/get_brand_verdict', async (req, res) => {
    const { brand, country } = req.query;

    if (!brand || !country) {
        return res.status(400).json({ error: 'Brand and country are required parameters' });
    }

    console.log(brand, country)

    try {
        const links = await run_search(brand, country);
        const structuredSchema = get_structured_schema(links);
        res.json({ brand, country, results: structuredSchema });
    } catch (error) {
        res.status(500).json({ error: 'Error performing search' });
    }
});

app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
