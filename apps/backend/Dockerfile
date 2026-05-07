FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libpoppler-cpp-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/backend/ .

RUN mkdir -p /app/uploads /app/logs

EXPOSE 8000

CMD ["python", "main.py"]
