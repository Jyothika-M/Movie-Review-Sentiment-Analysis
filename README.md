# CineSense — Movie Review Sentiment Analyzer

**CineSense** is a production-quality, cinematic AI-powered movie review sentiment analyzer built with a fine-tuned DistilBERT model, a FastAPI backend, and a fully animated vanilla HTML/CSS/JS frontend.

> *PCCSL 508 – Machine Learning Lab | Department of CSE, Federal Institute of Science and Technology (FISAT)*

---

## Quick Start

```bash
# 1. Clone / navigate to the project folder
cd c:\Projects\ML

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** in your browser.

---

## Features

| Feature | Details |
|---------|---------|
| **Sentiment Analysis** | Fine-tuned DistilBERT on 50,000 IMDb reviews |
| **Cinematic UI** | Midnight cinema theme, theater curtains, projector beam, film strips |
| **Animations** | Intro splash, confetti (positive), screen shake (negative), star fill, count-up |
| **History Panel** | Last 10 analyses as ticket stubs |
| **Batch Mode** | Upload .csv/.txt, donut chart, CSV download (max 200 reviews) |
| **Sound Toggle** | Web Audio API clap & ding (no audio files) |
| **Light/Dark Mode** | Dark cinema (default) + warm sepia light mode |
| **Accessibility** | `prefers-reduced-motion`, ARIA labels, keyboard focus |

---

## API Endpoints

### `GET /health`
```json
{ "status": "ok", "model": "DistilBERT fine-tuned on IMDb", "model_loaded": true }
```

### `POST /predict`
**Request:**
```json
{ "text": "This film was an absolute masterpiece!" }
```
**Response:**
```json
{
  "label": "POSITIVE",
  "confidence": 0.9953,
  "scores": { "POSITIVE": 0.9953, "NEGATIVE": 0.0047 }
}
```

### `POST /predict-batch`
Upload a `.csv` or `.txt` file (one review per line, max 200).  
**Response:** `{ "results": [...], "count": N }`

---

## Project Structure

```
c:\Projects\ML\
├── app/
│   └── main.py          # FastAPI backend
├── static/
│   ├── index.html       # Single-page frontend
│   ├── style.css        # Midnight cinema design system
│   ├── animations.js    # Cinematic animation engine
│   └── app.js           # App logic (API, history, batch, metrics)
├── sentiment_model/     # Fine-tuned DistilBERT (do not modify)
│   ├── config.json
│   ├── model.safetensors
│   ├── tokenizer.json
│   └── tokenizer_config.json
├── requirements.txt
├── test_api.py          # API test script
└── README.md
```

---

## Editing Model Metrics

Open `static/app.js` and update the `MODEL_METRICS` object at the top:

```js
const MODEL_METRICS = {
  Accuracy:  { value: '93.21', unit: '%' },
  Precision: { value: '93.08', unit: '%' },
  Recall:    { value: '93.37', unit: '%' },
  F1:        { value: '93.22', unit: '%' },
};
```

---

## Viva Notes

- **DistilBERT**: A distilled version of BERT with 6 transformer layers, 66M parameters, 40% smaller and 60% faster than BERT-base while retaining 97% of performance.
- **IMDb Dataset**: 50,000 reviews (25K train / 25K test), balanced positive/negative.
- **Fine-tuning**: Classification head trained for 3 epochs on a GPU; base weights frozen.
- **`top_k=None`**: Pipeline returns all class scores; winner chosen by `max()` — no hardcoded label mapping.
- **`BertTokenizerFast`** with `model_input_names = ["input_ids", "attention_mask"]` ensures `token_type_ids` are never passed to DistilBERT's forward method.
- **FastAPI lifespan**: Model loaded once at startup using `@asynccontextmanager`, shared across all requests via global `classifier`.
- **CORS**: Enabled with `CORSMiddleware` to allow the frontend to call from any origin during development.
