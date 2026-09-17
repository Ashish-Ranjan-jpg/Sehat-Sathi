# Use Python 3.10 slim base image
FROM python:3.10-slim

# Install system dependencies: Tesseract OCR, Poppler (PDF renderer), OpenCV dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy requirements file and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Hugging Face Spaces default port is 7860
EXPOSE 7860

# Run Uvicorn FastAPI server on port 7860
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
