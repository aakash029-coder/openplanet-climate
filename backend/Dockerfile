# 1. Base Image: Lightweight Python environment
FROM python:3.10-slim

# 2. Install System Dependencies (Crucial for PostGIS and GeoPandas math)
RUN apt-get update && apt-get install -y \
    gcc \
    libgdal-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 3. Set Working Directory
WORKDIR /app

# 4. Install Python Requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Security: Create a non-root user (Mandatory for Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user

# 6. Set Environment Variables for the new user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# 7. Set Working Directory to the user's home
WORKDIR $HOME/app

# 8. Copy the OpenPlanet engine files into the container
COPY --chown=user . $HOME/app

# 9. Expose the specific port Hugging Face looks for
EXPOSE 7860

# 10. Start the FastAPI Engine
CMD ["uvicorn", "climate_engine.api.main:app", "--host", "0.0.0.0", "--port", "7860"]