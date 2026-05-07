# LMStudio Integration Guide

This project now supports **LMStudio** as a local AI provider alongside Ollama and Groq.

## What is LMStudio?

LMStudio is a cross-platform application for running Large Language Models locally. It provides an OpenAI-compatible API that makes it easy to integrate with applications.

## Installation

### 1. Download and Install LMStudio

- **Download**: Visit [https://lmstudio.ai](https://lmstudio.ai)
- **Install**: Follow the platform-specific installation instructions for Windows, macOS, or Linux
- **System Requirements**: Recommended 16GB+ RAM, GPU support (CUDA/Metal) for better performance

### 2. Download a Model

Once LMStudio is installed and running:

1. Open LMStudio application
2. Go to the **Models** tab
3. Search for and download your model (e.g., "Gemma 4", "Llama 2", etc.)
   - Gemma 4 is recommended (faster, optimized for compliance tasks)
   - Other options: Llama 2 7B, Mistral 7B, etc.
4. Wait for the download to complete (~4-13GB depending on model)

### 3. Load the Model

1. Go to the **Local Server** tab in LMStudio
2. Select your downloaded model from the dropdown
3. Click **Start Server**
4. You should see: `Local server running on http://localhost:1234`

## Configuration

### Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Use LMStudio as the AI provider
AI_PROVIDER=lmstudio

# LMStudio server URL (default is localhost:1234)
LMSTUDIO_BASE_URL=http://localhost:1234

# Model name to use (must match exactly what's loaded in LMStudio)
LMSTUDIO_MODEL=google/gemma-4-e4b
```

### Alternative: Use the UI Configuration

Instead of environment variables, you can dynamically configure the URL in the application:

1. Start the backend and frontend
2. Look at the **AI Provider** selector in the top status bar
3. Click the dropdown and select **LMStudio**
4. If LMStudio is not reachable, click **"Change URL"** to update the endpoint

## Running the Application

### Option 1: Docker Compose (Recommended)

If using Docker Compose, add LMStudio configuration to your `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - AI_PROVIDER=lmstudio
      - LMSTUDIO_BASE_URL=http://host.docker.internal:1234
      # Use host.docker.internal to reach the host machine from Docker

  frontend:
    # Frontend automatically picks up backend settings via API
```

### Option 2: Local Development

```bash
# Terminal 1: Start LMStudio (GUI application)
# - Open LMStudio
# - Select and load your model
# - Click "Start Server"

# Terminal 2: Start Backend
cd apps/backend
export AI_PROVIDER=lmstudio
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Start Frontend
cd apps/frontend
npm run dev
```

### Option 3: Using Pre-configured Tasks

If configured, you can use VS Code tasks:

```bash
# Run Backend: dev server (configured task)
# Run Frontend: dev server (configured task)
```

Then set the environment variable before starting:

```bash
export AI_PROVIDER=lmstudio
```

## Model Recommendations

### For Compliance Analysis

1. **Gemma 4** (Recommended)
   - Size: ~9B parameters
   - Speed: Fast, good for real-time analysis
   - Download: ~5GB quantized
   - Accuracy: Good for regulatory text understanding

2. **Llama 2 70B** (High Performance)
   - Size: 70B parameters
   - Speed: Slower, requires GPU
   - Download: ~40GB
   - Accuracy: Excellent for complex compliance analysis

3. **Mistral 7B**
   - Size: ~7B parameters
   - Speed: Very fast
   - Download: ~4GB
   - Accuracy: Good for general tasks

## Verifying the Connection

### Via API

Check the health endpoint:

```bash
curl http://localhost:8000/api/health
```

Response should include:

```json
{
  "status": "ok",
  "ai_provider": "lmstudio",
  "ai_connected": true,
  "ai_model": "google/gemma-4-e4b",
  "lmstudio_connected": true,
  "lmstudio_url": "http://localhost:1234"
}
```

### Via UI

1. Open the application in your browser
2. Look at the status bar in the top-right
3. You should see: **"LMStudio Connected — google/gemma-4-e4b"** (in green)
4. If showing warning: "Not reachable at http://localhost:1234"
   - Verify LMStudio is running
   - Check the URL in the status bar
   - Click "Change URL" if needed

## Troubleshooting

### Connection Issues

**Error: "Not reachable at http://localhost:1234"**

1. Verify LMStudio is running
   - Check LMStudio application window
   - Look for "Local server running on http://localhost:1234"

2. Check firewall settings
   - Port 1234 must be accessible
   - Add exception if using Windows Firewall

3. Verify model is loaded
   - In LMStudio, check if a model is selected
   - Click "Start Server" if not running

4. Try updating the URL
   - Click "Change URL" in the app
   - Test with the same URL

### Model Not Found

**Error: "Model 'google/gemma-4-e4b' not found"**

1. Verify the exact model name in LMStudio
   - Go to Local Server tab
   - Check the model dropdown
   - Copy the exact name

2. Update environment variable or UI

   ```bash
   export LMSTUDIO_MODEL=gemma2
   ```

3. Restart the backend

### Performance Issues

1. **Very slow responses**
   - Check system RAM usage
   - Close other applications
   - Consider using a smaller model
   - Enable GPU acceleration in LMStudio

2. **Timeout errors**
   - Increase timeout in backend (analyze.py)
   - Reduce document size for analysis
   - Use a faster model

## API Endpoints

The backend exposes the following endpoints for managing LMStudio:

```bash
# Get current AI provider
GET /api/settings/provider

# Switch to LMStudio
POST /api/settings/provider
Body: { "provider": "lmstudio" }

# Get LMStudio URL
GET /api/settings/lmstudio-url

# Update LMStudio URL
POST /api/settings/lmstudio-url
Body: { "url": "http://localhost:1234" }

# Health check (includes LMStudio status)
GET /api/health
```

## Switching Between Providers

You can dynamically switch between providers without restarting:

1. **Via UI**: Use the dropdown in the status bar
2. **Via API**: POST to `/api/settings/provider` with the provider name
3. **Via Environment**: Restart the application with different `AI_PROVIDER`

Supported providers:

- `ollama` - Local Ollama server
- `lmstudio` - Local LMStudio server
- `groq` - Cloud-based Groq API

## Performance Notes

### LMStudio vs Ollama

| Feature           | LMStudio            | Ollama            |
| ----------------- | ------------------- | ----------------- |
| API Compatibility | OpenAI-compatible   | Native format     |
| UI                | Graphical interface | CLI-only          |
| Model Management  | Built-in downloader | Manual/CLI-based  |
| Performance       | Excellent with GPU  | Good with GPU     |
| Ease of Use       | Very easy           | Moderate          |
| Model Variety     | Large selection     | Excellent variety |

### Recommended Settings for Compliance

In the application (`apps/backend/services/ai/analyzer.py`), the following parameters are used:

- **Temperature**: 0.1 (low, for deterministic compliance analysis)
- **Max Tokens**: 2048 (sufficient for compliance reports)
- **Timeout**: 120 seconds (allows for thorough analysis)

## Next Steps

1. ✅ Install LMStudio from [lmstudio.ai](https://lmstudio.ai)
2. ✅ Download Gemma 4 or your preferred model
3. ✅ Start the LMStudio server
4. ✅ Start the backend with `AI_PROVIDER=lmstudio`
5. ✅ Start the frontend
6. ✅ Verify connection in the status bar
7. ✅ Upload and analyze your compliance documents

## Support

For issues:

- **LMStudio**: Check [LMStudio documentation](https://lmstudio.ai/docs)
- **This Application**: Check logs in the `/logs` directory
- **API Errors**: Check the health endpoint response

## References

- [LMStudio Official Site](https://lmstudio.ai)
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference)
- [Supported Models](https://huggingface.co/models)
