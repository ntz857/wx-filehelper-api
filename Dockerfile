FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Data persistence: mount /app/downloads and /app/messages.db externally
ENV HOST=0.0.0.0
ENV PORT=23051

EXPOSE 23051

CMD ["python", "main.py"]
