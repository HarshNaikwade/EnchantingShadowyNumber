# LMStudio Quick Reference

## Installation (2 minutes)

1. Download LMStudio: https://lmstudio.ai
2. Open LMStudio → Models → Search "Gemma" → Click Download
3. Go to Local Server tab → Select Gemma model → Click "Start Server"
4. Verify: Should show "Local server running on http://localhost:1234"

## Start Your App

```bash
# Terminal 1: LMStudio (keep running)
# - Already started in the steps above

# Terminal 2: Backend
cd apps/backend
export AI_PROVIDER=lmstudio
python -m uvicorn main:app --reload

# Terminal 3: Frontend
cd apps/frontend
npm run dev
```

Then open: http://localhost:5000

## Verify Connection

**In UI:** Status bar should show "LMStudio Connected — google/gemma-4-e4b" (green)

**In API:**

```bash
curl http://localhost:8000/api/health | jq .lmstudio_connected
# Returns: true
```

## Configuration

| Setting    | Default               | How to Change          |
| ---------- | --------------------- | ---------------------- |
| Provider   | lmstudio              | UI dropdown or env var |
| Server URL | http://localhost:1234 | UI pencil icon or API  |
| Model      | google/gemma-4-e4b    | Change in LMStudio app |

## Common Commands

```bash
# Switch provider via API
curl -X POST http://localhost:8000/api/settings/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "lmstudio"}'

# Update LMStudio URL
curl -X POST http://localhost:8000/api/settings/lmstudio-url \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:1234"}'

# Check connection status
curl http://localhost:8000/api/health
```

## Troubleshooting

| Issue               | Solution                             |
| ------------------- | ------------------------------------ |
| Connection refused  | Verify LMStudio running on port 1234 |
| Model not found     | Check exact model name in LMStudio   |
| Slow analysis       | Enable GPU in LMStudio settings      |
| Port already in use | Change port in LMStudio config       |

## File Locations

```
docs/
  ├─ LMSTUDIO_SETUP.md      ← Full setup guide
  ├─ INTEGRATION_SUMMARY.md ← Technical details
  └─ README.md              ← Project overview
```

## Model Alternatives

- **Gemma 4** (Recommended): Fast, ~5GB, good quality
- **Llama 2 7B**: Faster, ~4GB, decent quality
- **Mistral 7B**: Good balance, ~4GB
- **Llama 2 70B**: Best quality, ~40GB, needs GPU

## Keyboard Shortcuts

In UI:

- Pencil icon: Edit URL
- Green checkmark: Save URL
- Red X: Cancel edit

## Port Reference

- Frontend: 5000
- Backend: 8000
- LMStudio: 1234
- Ollama: 11434 (if used)

## Reset to Default

```bash
# Clear runtime config (stored URL preferences)
rm apps/backend/core/runtime_config.json

# Use environment defaults
export AI_PROVIDER=lmstudio
export LMSTUDIO_BASE_URL=http://localhost:1234
export LMSTUDIO_MODEL=google/gemma-4-e4b
```

## Need Help?

1. Check status bar for connection indicator
2. See [LMSTUDIO_SETUP.md](LMSTUDIO_SETUP.md) for detailed guide
3. Check backend logs: `cat logs/*.log`
4. API docs: http://localhost:8000/docs
