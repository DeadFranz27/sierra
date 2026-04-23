FROM python:3.12-slim

RUN addgroup --gid 1000 sierra && adduser --uid 1000 --gid 1000 --disabled-password sierra

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

# Create the data dir with sierra ownership BEFORE switching user.
# Docker named volumes inherit the ownership of the underlying directory
# the first time they're mounted, so this is what lets the unprivileged
# user actually write the SQLite file.
RUN mkdir -p /app/data && chown -R sierra:sierra /app

USER sierra
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
