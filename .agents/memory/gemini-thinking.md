---
name: Gemini thinking compatibility
description: Replit proxy compatibility can differ from the model list and SDK enum availability.
---
Do not assume a listed model supports every thinking level exposed by the SDK.

**Why:** A real synthetic-JPEG call through Replit AI Integrations with gemini-3.8-flash returned HTTP 400, "Thinking level is unsupported: THINKING_LEVEL_MINIMAL". The same call with LOW succeeded. The model itself did not need replacement.

**How to apply:** Keep VISION_MODEL configurable. Before changing the model or thinking configuration, validate the exact combination through the integration using a synthetic image, without retaining frames or printing image data.
