/* =========================================================
   Portfolio - api.js
   Live data from external APIs (Assignment 3):
     Option 2 - Weather   (Open-Meteo, home page)
     Option 3 - Quotes    (DummyJSON, home page)
     Option 4 - News      (Hacker News + Spaceflight News, news page)
   None of these APIs need a key, and all allow requests
   from the browser, so the site works on GitHub Pages.
   ========================================================= */


document.addEventListener("DOMContentLoaded", function () {
    // Each widget only exists on some pages, so check first
    if (document.getElementById("weather-widget")) {
        setupWeather();
    }
    if (document.getElementById("quote-widget")) {
        setupQuote();
    }
    if (document.getElementById("news-widget")) {
        setupNews();
    }
});


/* ---------------------------------------------------------
   Shared helpers
   --------------------------------------------------------- */

// Fetches a URL and returns the parsed JSON.
// Throws an Error if the request fails, times out, or the
// server answers with an error status (e.g. 404 or 500).
async function fetchJSON(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(function () {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error("The server responded with status " + response.status + ".");
        }
        return await response.json();
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The request took too long. Please check your connection.");
        }
        if (error instanceof TypeError) {
            // fetch throws a TypeError when the network is unreachable
            throw new Error("Could not reach the server. Please check your internet connection.");
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// Shows a "Loading…" message with a spinner inside a container
function showLoading(container, text) {
    container.replaceChildren();
    const box = document.createElement("div");
    box.className = "api-loading";
    box.setAttribute("role", "status");

    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = text || "Loading…";

    box.append(spinner, label);
    container.append(box);
}

// Shows an error message with a "Try again" button
function showError(container, message, onRetry) {
    container.replaceChildren();
    const box = document.createElement("div");
    box.className = "api-error";
    box.setAttribute("role", "alert");

    const text = document.createElement("p");
    text.textContent = "⚠️ " + message;
    box.append(text);

    if (onRetry) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "toggle-btn";
        retry.textContent = "Try again";
        retry.addEventListener("click", onRetry);
        box.append(retry);
    }

    container.append(box);
}

// Small helper to create an element with a class and text
function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

// Turns a date into "5 min ago", "3 hours ago", "2 days ago"
function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    const units = [
        ["day", 86400],
        ["hour", 3600],
        ["min", 60]
    ];
    for (const [name, size] of units) {
        const amount = Math.floor(seconds / size);
        if (amount >= 1) {
            return amount + " " + name + (amount > 1 && name !== "min" ? "s" : "") + " ago";
        }
    }
    return "just now";
}

// localStorage can throw in private browsing, so wrap it
function readSetting(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function writeSetting(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // Saving is optional
    }
}


/* ---------------------------------------------------------
   Option 2 - Weather (Open-Meteo)
   Step 1: geocoding API turns a city name into coordinates
   Step 2: forecast API returns the current weather there
   --------------------------------------------------------- */

const WEATHER_CITY_KEY = "portfolio-weather-city";

// Open-Meteo returns a WMO weather code; map it to text + icon
const WEATHER_CODES = {
    0: ["Clear sky", "☀️", "🌙"],
    1: ["Mainly clear", "🌤️", "🌙"],
    2: ["Partly cloudy", "⛅", "☁️"],
    3: ["Overcast", "☁️", "☁️"],
    45: ["Fog", "🌫️", "🌫️"],
    48: ["Freezing fog", "🌫️", "🌫️"],
    51: ["Light drizzle", "🌦️", "🌧️"],
    53: ["Drizzle", "🌦️", "🌧️"],
    55: ["Heavy drizzle", "🌧️", "🌧️"],
    56: ["Freezing drizzle", "🌧️", "🌧️"],
    57: ["Freezing drizzle", "🌧️", "🌧️"],
    61: ["Light rain", "🌦️", "🌧️"],
    63: ["Rain", "🌧️", "🌧️"],
    65: ["Heavy rain", "🌧️", "🌧️"],
    66: ["Freezing rain", "🌧️", "🌧️"],
    67: ["Freezing rain", "🌧️", "🌧️"],
    71: ["Light snow", "🌨️", "🌨️"],
    73: ["Snow", "🌨️", "🌨️"],
    75: ["Heavy snow", "❄️", "❄️"],
    77: ["Snow grains", "🌨️", "🌨️"],
    80: ["Rain showers", "🌦️", "🌧️"],
    81: ["Rain showers", "🌦️", "🌧️"],
    82: ["Heavy showers", "⛈️", "⛈️"],
    85: ["Snow showers", "🌨️", "🌨️"],
    86: ["Snow showers", "🌨️", "🌨️"],
    95: ["Thunderstorm", "⛈️", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️", "⛈️"],
    99: ["Thunderstorm with hail", "⛈️", "⛈️"]
};

function setupWeather() {
    const form = document.getElementById("weather-form");
    const input = document.getElementById("weather-city");
    const result = document.getElementById("weather-result");
    const quickCities = document.querySelectorAll(".city-chip");

    async function loadCity(city) {
        input.value = city;
        showLoading(result, "Loading weather for " + city + "…");

        try {
            const weather = await getWeather(city);
            renderWeather(result, weather);
            writeSetting(WEATHER_CITY_KEY, weather.city);
        } catch (error) {
            showError(result, error.message, function () {
                loadCity(city);
            });
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        const city = input.value.trim();
        if (city === "") {
            showError(result, "Please type a city name first.");
            input.focus();
            return;
        }
        loadCity(city);
    });

    quickCities.forEach(function (chip) {
        chip.addEventListener("click", function () {
            loadCity(chip.dataset.city);
        });
    });

    // Start with the last city the visitor looked up, or Cairo
    loadCity(readSetting(WEATHER_CITY_KEY) || "Cairo");
}

async function getWeather(city) {
    const geoUrl = "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name="
        + encodeURIComponent(city);
    const geo = await fetchJSON(geoUrl);

    if (!geo.results || geo.results.length === 0) {
        throw new Error("We couldn't find a city called \"" + city + "\". Check the spelling and try again.");
    }

    const place = geo.results[0];
    const weatherUrl = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + place.latitude
        + "&longitude=" + place.longitude
        + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day"
        + "&daily=temperature_2m_max,temperature_2m_min"
        + "&forecast_days=1&timezone=auto";
    const data = await fetchJSON(weatherUrl);

    return {
        city: place.name,
        country: place.country || "",
        current: data.current,
        high: data.daily.temperature_2m_max[0],
        low: data.daily.temperature_2m_min[0]
    };
}

function renderWeather(container, weather) {
    const now = weather.current;
    const info = WEATHER_CODES[now.weather_code] || ["Unknown conditions", "🌡️", "🌡️"];
    const icon = now.is_day ? info[1] : info[2];

    const main = el("div", "weather-main");
    const iconEl = el("span", "weather-icon", icon);
    iconEl.setAttribute("role", "img");
    iconEl.setAttribute("aria-label", info[0]);

    const tempBox = el("div");
    tempBox.append(
        el("p", "weather-temp", Math.round(now.temperature_2m) + "°C"),
        el("p", "weather-condition", info[0])
    );
    main.append(iconEl, tempBox);

    const place = el("p", "weather-place", weather.city + (weather.country ? ", " + weather.country : ""));

    const details = el("ul", "weather-details");
    const rows = [
        ["Feels like", Math.round(now.apparent_temperature) + "°C"],
        ["High / Low", Math.round(weather.high) + "° / " + Math.round(weather.low) + "°"],
        ["Humidity", now.relative_humidity_2m + "%"],
        ["Wind", Math.round(now.wind_speed_10m) + " km/h"]
    ];
    rows.forEach(function ([label, value]) {
        const item = el("li");
        item.append(el("span", "detail-label", label), el("span", "detail-value", value));
        details.append(item);
    });

    // Open-Meteo gives the local time at that city, e.g. "2026-10-23T17:30"
    const updated = el("p", "api-source", "Local time " + now.time.slice(11) + " · Data: Open-Meteo");

    container.replaceChildren(place, main, details, updated);
}


/* ---------------------------------------------------------
   Option 3 - Random quote (DummyJSON)
   --------------------------------------------------------- */

function setupQuote() {
    const result = document.getElementById("quote-result");
    const button = document.getElementById("new-quote");

    async function loadQuote() {
        button.disabled = true;
        showLoading(result, "Loading a new quote…");

        try {
            const data = await fetchJSON("https://dummyjson.com/quotes/random");

            const text = el("blockquote", "quote-text", "“" + data.quote + "”");
            const author = el("p", "quote-author", "— " + data.author);
            result.replaceChildren(text, author);
        } catch (error) {
            showError(result, error.message, loadQuote);
        } finally {
            button.disabled = false;
        }
    }

    button.addEventListener("click", loadQuote);
    loadQuote();
}


/* ---------------------------------------------------------
   Option 4 - News headlines
   Each category has its own API URL and a function that
   converts that API's response into the same simple shape:
   { title, url, source, date, summary, image, meta }
   --------------------------------------------------------- */

const NEWS_CATEGORIES = {
    technology: {
        label: "Technology",
        url: "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12",
        convert: convertHackerNews
    },
    business: {
        label: "Startups & Business",
        url: "https://hn.algolia.com/api/v1/search_by_date?query=startup&tags=story&restrictSearchableAttributes=title&typoTolerance=false&numericFilters=points%3E10&hitsPerPage=12",
        convert: convertHackerNews
    },
    space: {
        label: "Space & Science",
        url: "https://api.spaceflightnewsapi.net/v4/articles/?limit=12",
        convert: convertSpaceflightNews
    }
};

const NEWS_CATEGORY_KEY = "portfolio-news-category";

function convertHackerNews(data) {
    return data.hits.map(function (story) {
        // "Ask HN" posts have no external link, so use the discussion page
        const discussion = "https://news.ycombinator.com/item?id=" + story.objectID;
        const url = story.url || discussion;
        return {
            title: story.title,
            url: url,
            source: story.url ? new URL(story.url).hostname.replace(/^www\./, "") : "news.ycombinator.com",
            date: story.created_at,
            summary: "",
            image: "",
            meta: story.points + " points · " + (story.num_comments || 0) + " comments"
        };
    });
}

function convertSpaceflightNews(data) {
    return data.results.map(function (article) {
        return {
            title: article.title,
            url: article.url,
            source: article.news_site,
            date: article.published_at,
            summary: article.summary,
            image: article.image_url,
            meta: ""
        };
    });
}

function setupNews() {
    const tabs = document.querySelectorAll(".news-tab");
    const result = document.getElementById("news-result");
    const refresh = document.getElementById("news-refresh");
    const heading = document.getElementById("news-heading");

    let current = readSetting(NEWS_CATEGORY_KEY);
    if (!NEWS_CATEGORIES[current]) {
        current = "technology";
    }
    // Counts requests so a slow, older response can't replace a newer one
    let requestId = 0;

    async function loadNews(key) {
        current = key;
        writeSetting(NEWS_CATEGORY_KEY, key);
        const category = NEWS_CATEGORIES[key];
        const thisRequest = ++requestId;

        tabs.forEach(function (tab) {
            const active = tab.dataset.category === key;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
        });
        heading.textContent = "Latest in " + category.label;
        refresh.disabled = true;
        showLoading(result, "Loading " + category.label.toLowerCase() + " headlines…");

        try {
            const data = await fetchJSON(category.url);
            if (thisRequest !== requestId) {
                return; // the user picked another tab meanwhile
            }
            const articles = category.convert(data).filter(function (article) {
                return article.title && /^https?:\/\//.test(article.url);
            });
            renderNews(result, articles);
        } catch (error) {
            if (thisRequest !== requestId) {
                return;
            }
            showError(result, error.message, function () {
                loadNews(key);
            });
        } finally {
            if (thisRequest === requestId) {
                refresh.disabled = false;
            }
        }
    }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            loadNews(tab.dataset.category);
        });
    });

    refresh.addEventListener("click", function () {
        loadNews(current);
    });

    loadNews(current);
}

function renderNews(container, articles) {
    if (articles.length === 0) {
        showError(container, "No headlines are available in this category right now.");
        return;
    }

    const grid = el("div", "news-grid");

    articles.forEach(function (article) {
        const card = el("article", "news-card");

        if (article.image) {
            const img = el("img", "news-image");
            img.src = article.image;
            img.alt = "";
            img.loading = "lazy";
            // Hide broken images instead of showing an empty box
            img.addEventListener("error", function () {
                img.remove();
            });
            card.append(img);
        }

        const body = el("div", "news-body");
        body.append(el("p", "news-source", article.source + " · " + timeAgo(article.date)));

        const title = el("h3", "news-title");
        const link = el("a", "", article.title);
        link.href = article.url;
        link.target = "_blank";
        link.rel = "noopener";
        title.append(link);
        body.append(title);

        if (article.summary) {
            body.append(el("p", "news-summary", article.summary));
        }
        if (article.meta) {
            body.append(el("p", "news-meta", article.meta));
        }

        card.append(body);
        grid.append(card);
    });

    container.replaceChildren(grid);
}
