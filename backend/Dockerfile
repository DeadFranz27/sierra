FROM python:3.12-slim

RUN addgroup --gid 1000 sierra && adduser --uid 1000 --gid 1000 --disabled-password sierra

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

USER sierra
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
