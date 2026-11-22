"""CUTLINE · photograph service on Modal (SDXL base 1.0, OpenRAIL++-M, A10G)."""

from __future__ import annotations

import hmac
import io
import os

import modal

MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
STEPS = 28
GUIDANCE = 6.0
SIZES = {"4:5": (896, 1152), "1:1": (1024, 1024), "16:9": (1344, 768), "3:1": (1536, 640)}
NEGATIVE = (
    "text, letters, watermark, logo, signature, frame, border, collage, cartoon, illustration, "
    "3d render, oversaturated, deformed hands, deformed face, extra limbs"
)

app = modal.App("cutline-photograph")


def download_weights() -> None:
    import torch
    from diffusers import StableDiffusionXLPipeline

    StableDiffusionXLPipeline.from_pretrained(
        MODEL, torch_dtype=torch.float16, variant="fp16", use_safetensors=True
    )


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "diffusers==0.31.0",
        "transformers==4.46.3",
        "accelerate==1.1.1",
        "safetensors==0.4.5",
        "fastapi[standard]==0.115.5",
    )
    .run_function(download_weights)
)

with image.imports():
    import torch
    from diffusers import StableDiffusionXLPipeline
    from fastapi import HTTPException, Request, Response


@app.cls(
    gpu="A10G",
    image=image,
    secrets=[modal.Secret.from_name("cutline-image-key")],
    scaledown_window=120,
    max_containers=2,
    timeout=300,
)
class Photograph:
    @modal.enter()
    def load(self) -> None:
        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            MODEL, torch_dtype=torch.float16, variant="fp16", use_safetensors=True
        ).to("cuda")

    @modal.fastapi_endpoint(method="POST")
    def develop(self, request: Request, body: dict):
        expected = os.environ.get("CUTLINE_IMAGE_KEY", "")
        given = request.headers.get("x-cutline-key", "")
        if not expected or not hmac.compare_digest(given, expected):
            raise HTTPException(status_code=401, detail="unauthorized")

        prompt = str(body.get("prompt", "")).strip()
        if not 10 <= len(prompt) <= 900:
            raise HTTPException(status_code=422, detail="prompt must be 10-900 characters")
        frame = str(body.get("frame", "4:5"))
        if frame not in SIZES:
            raise HTTPException(status_code=422, detail="unsupported frame")
        try:
            seed = int(body.get("seed", 0)) % 2_147_483_647
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="seed must be an integer")

        width, height = SIZES[frame]
        generator = torch.Generator("cuda").manual_seed(seed)
        result = self.pipe(
            prompt=prompt,
            negative_prompt=NEGATIVE,
            num_inference_steps=STEPS,
            guidance_scale=GUIDANCE,
            width=width,
            height=height,
            generator=generator,
        ).images[0]
        buf = io.BytesIO()
        result.save(buf, format="JPEG", quality=90)
        return Response(
            content=buf.getvalue(),
            media_type="image/jpeg",
            headers={"x-model": MODEL, "x-seed": str(seed), "cache-control": "no-store"},
        )
