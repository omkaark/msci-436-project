const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio'); // We will use cheerio to parse HTML

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';

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

function get_structured_schema(links) {
    const structuredData = links.map((link, index) => ({
        id: index + 1,
        url: link,
        description: `Result ${index + 1}`
    }));

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
