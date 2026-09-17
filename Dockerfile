FROM python:3.10-slim

# Install system dependencies (Tesseract OCR, Poppler PDF utilities, OpenCV requirements)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create working directories
RUN mkdir -p uploaded_documents pipeline_stages

EXPOSE 8000

# Start FastAPI server (reads PORT environment variable or defaults to 8000)
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
