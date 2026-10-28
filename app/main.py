"""
ReelMood – Movie Review Sentiment Analyzer
FastAPI Backend

PCCSL 508 – Machine Learning Lab | CSE, FISAT
"""

import re
import io
import csv
import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cinesense")

# ── Global: the pipeline is loaded once at startup ───────────────────────────
classifier = None


# ── Lifespan context manager (FastAPI modern startup/shutdown) ────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the fine-tuned DistilBERT model once when the server starts."""
    global classifier
    from transformers import pipeline as hf_pipeline, BertTokenizerFast

    MODEL_DIR = "./sentiment_model"

    logger.info("Loading fine-tuned DistilBERT from %s ...", MODEL_DIR)

    # Load the tokenizer. The checkpoint was saved with BertTokenizerFast, but
    # DistilBERT's forward() does NOT accept token_type_ids.
    # Fix: load the tokenizer, then remove 'token_type_ids' from model_input_names
    # so the pipeline never passes that key to the model.
    tokenizer = BertTokenizerFast.from_pretrained(MODEL_DIR)
    tokenizer.model_input_names = ["input_ids", "attention_mask"]

    # Build the classification pipeline.
    # top_k=None → pipeline returns scores for ALL labels, not just the top one.
    # truncation=True + max_length=256 → silently truncates very long reviews.
    # device=-1 → force CPU inference (safe on machines without a CUDA GPU).
    classifier = hf_pipeline(
        "text-classification",
        model=MODEL_DIR,
        tokenizer=tokenizer,
        top_k=None,
        truncation=True,
        max_length=256,
        device=-1,
    )

    # Log the label mapping so it is visible in the startup output for verification
    id2label = classifier.model.config.id2label
    logger.info("Model loaded successfully. Label map: %s", id2label)

    yield  # ← server is running; execution resumes here on shutdown

    logger.info("Server shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="CineSense API",
    description="CineSense – Movie Review Sentiment Analyzer | PCCSL 508 ML Lab",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow all origins so the frontend can call from any port during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: clean raw review text ─────────────────────────────────────────────
def clean_text(text: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)   # remove HTML tags e.g. <br />
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_must_not_be_empty(cls, v: str) -> str:
        cleaned = clean_text(v)
        if not cleaned:
            raise ValueError("Review text must not be empty.")
        return cleaned


class ScoresModel(BaseModel):
    POSITIVE: float
    NEGATIVE: float


class PredictResponse(BaseModel):
    label: str          # "POSITIVE" or "NEGATIVE"
    confidence: float   # 0.0 – 1.0 (score of the winning label)
    scores: ScoresModel


class BatchResultItem(BaseModel):
    review: str
    label: str
    confidence: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["utility"])
async def health():
    """
    Health check endpoint.
    Returns 200 when the server is running and the model is loaded.
    """
    return {
        "status": "ok",
        "model": "DistilBERT fine-tuned on IMDb",
        "model_loaded": classifier is not None,
    }


@app.post("/predict", response_model=PredictResponse, tags=["prediction"])
async def predict(request: PredictRequest):
    """
    Predict the sentiment of a single movie review.

    - Strips HTML tags from the input
    - Validates that the text is non-empty
    - Truncates to 256 tokens (handled by the pipeline)
    - Returns: label, confidence, and scores for both classes

    The winning label is chosen with max() on the score — no hardcoded
    LABEL_0/LABEL_1 mapping, no reliance on list order.
    """
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    # pipeline returns e.g. [[{"label": "NEGATIVE", "score": 0.99}, {"label": "POSITIVE", "score": 0.01}]]
    raw: List[dict] = classifier(request.text)[0]

    # Build a {label -> score} map for safe lookup by name
    score_map = {item["label"]: item["score"] for item in raw}

    # Pick the winner by highest score — robust to any label order
    winner = max(raw, key=lambda x: x["score"])

    return PredictResponse(
        label=winner["label"],
        confidence=round(winner["score"], 4),
        scores=ScoresModel(
            POSITIVE=round(score_map.get("POSITIVE", 0.0), 4),
            NEGATIVE=round(score_map.get("NEGATIVE", 0.0), 4),
        ),
    )


@app.post("/predict-batch", tags=["prediction"])
async def predict_batch(file: UploadFile = File(...)):
    """
    Predict sentiment for multiple reviews from a .txt or .csv file.

    - Each line / CSV cell is treated as one review
    - Maximum 200 reviews per request
    - Returns a JSON list of {review, label, confidence, scores} objects
    """
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    MAX_REVIEWS = 200

    # Read file bytes and decode
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        text_content = content.decode("latin-1")

    filename = file.filename or ""
    reviews: List[str] = []

    if filename.endswith(".csv"):
        # Treat first column of each row as the review text
        reader = csv.reader(io.StringIO(text_content))
        for row in reader:
            if row:
                reviews.append(row[0])
    else:
        # Plain text: one review per line
        reviews = [line for line in text_content.splitlines() if line.strip()]

    if len(reviews) > MAX_REVIEWS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many reviews. Maximum allowed is {MAX_REVIEWS}, got {len(reviews)}.",
        )

    if not reviews:
        raise HTTPException(status_code=422, detail="No reviews found in the uploaded file.")

    # Clean texts before inference
    cleaned = [clean_text(r) for r in reviews]

    # Batch inference – the pipeline handles batching automatically
    raw_results = classifier(cleaned)

    results: List[dict] = []
    for review, raw in zip(reviews, raw_results):
        score_map = {item["label"]: item["score"] for item in raw}
        winner = max(raw, key=lambda x: x["score"])
        results.append(
            {
                "review": review[:200],  # truncate snippet for display
                "label": winner["label"],
                "confidence": round(winner["score"], 4),
                "scores": {
                    "POSITIVE": round(score_map.get("POSITIVE", 0.0), 4),
                    "NEGATIVE": round(score_map.get("NEGATIVE", 0.0), 4),
                },
            }
        )

    return JSONResponse(content={"results": results, "count": len(results)})


# ── Serve static frontend files ───────────────────────────────────────────────
# The entire frontend lives in ./static/
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the main frontend HTML page."""
    return FileResponse("static/index.html")
