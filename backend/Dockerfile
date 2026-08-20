# syntax=docker/dockerfile:1

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
# git is required for pip to clone the private missiongroupsystems-auth package
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml README.md ./

# Install Python dependencies.
# missiongroupsystems-auth and passport-client install from private GitHub repos — inject a PAT via
# BuildKit secret. Deploy with: flyctl deploy --build-secret gh_token=$EBB_PACKAGES_TOKEN
#
# The pip upgrade is load-bearing: the image's bundled pip (24.0) answers an unsatisfiable
# constraint by backtracking to ResolutionTooDeep after ~45min instead of naming the offender.
RUN --mount=type=secret,id=gh_token,required=false \
    pip install --no-cache-dir --upgrade pip && \
    if [ -f /run/secrets/gh_token ]; then \
        TOKEN=$(cat /run/secrets/gh_token) && \
        git config --global url."https://${TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi && \
    pip install --no-cache-dir .; \
    EXIT_CODE=$?; \
    git config --global --unset-all url.https://github.com/.insteadOf 2>/dev/null || true; \
    exit $EXIT_CODE

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# Expose port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
