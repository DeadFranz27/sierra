FROM python:3.12-slim

RUN addgroup --gid 1000 sierra && adduser --uid 1000 --gid 1000 --disabled-password sierra

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER sierra
# Admin API on 8765 (loopback only at runtime — docker-compose does not expose it to host)
EXPOSE 8765
CMD ["python", "main.py"]
