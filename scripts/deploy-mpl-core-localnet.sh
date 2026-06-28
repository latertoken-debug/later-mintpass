#!/usr/bin/env bash
set -euo pipefail
MPL_CORE_PROGRAM_ID="CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
echo "==> Descargando binario de MPL Core desde Devnet..."
solana program dump -u devnet "$MPL_CORE_PROGRAM_ID" core.so
echo "==> Binario guardado en ./core.so"
echo "==> Recomendado: iniciar el validador con --clone en vez de este script:"
echo "  solana-test-validator --clone $MPL_CORE_PROGRAM_ID --url https://api.devnet.solana.com --reset"