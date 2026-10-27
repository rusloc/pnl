# Track A AI chat — setup steps for the USER

> Built by fin on 2026-10-23 per ADR-0009 §2 / §8 (Azure OpenAI, EU Data Zone, Entra, no API key). The code is in `fabric-app/` behind the switch `RAYFIN_PUBLIC_PNL_CHAT` (off). These are the steps only you can do (Azure, local tooling, deploy). Placeholders in `<…>`; no secrets in this file.

## A. Azure resource (EU Data Zone, Entra only)

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
az group create -n rg-acme-pnl-ai -l swedencentral
# Azure AI Foundry resource (kind AIServices: Azure OpenAI endpoint + Foundry project route)
az cognitiveservices account create -n <AI_RESOURCE_NAME> -g rg-acme-pnl-ai -l swedencentral \
  --kind AIServices --sku S0 --custom-domain <AI_RESOURCE_NAME> --yes
# key-based auth off: Entra only
az resource update --ids $(az cognitiveservices account show -n <AI_RESOURCE_NAME> -g rg-acme-pnl-ai --query id -o tsv) \
  --set properties.disableLocalAuth=true properties.publicNetworkAccess=Enabled
# Data Zone Standard (EU) deployment of a small tool-calling model
az cognitiveservices account deployment create -n <AI_RESOURCE_NAME> -g rg-acme-pnl-ai \
  --deployment-name gpt-4.1-mini-dz --model-name gpt-4.1-mini --model-version "2025-04-14" --model-format OpenAI \
  --sku-name DataZoneStandard --sku-capacity 50
# the function runs as the owner of the Fabric app item "acme": give that identity inference rights
az role assignment create --assignee "<ITEM_OWNER_UPN_OR_OBJECT_ID>" --role "Cognitive Services OpenAI User" \
  --scope $(az cognitiveservices account show -n <AI_RESOURCE_NAME> -g rg-acme-pnl-ai --query id -o tsv)
# monthly budget alert at 80 % / 100 %
az consumption budget create --budget-name acme-pnl-ai-monthly --amount 50 --time-grain Monthly \
  --start-date $(date +%Y-%m-01) --end-date 2027-12-01 --resource-group rg-acme-pnl-ai \
  --notifications '{"80pct":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":80,"contactEmails":["<EMAIL>"]},"100pct":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":100,"contactEmails":["<EMAIL>"]}}'
az cognitiveservices account show -n <AI_RESOURCE_NAME> -g rg-acme-pnl-ai --query "{endpoint:properties.endpoint, endpoints:properties.endpoints}"
```

Check in the portal: key-based authentication disabled; deployment type *Data Zone Standard*; region in the EU.

**Zero data retention (needs Microsoft's approval):** submit the "Azure OpenAI Limited Access – modified content filters and abuse monitoring" form (https://aka.ms/oai/modifiedaccess). Suggested text: *"Application: internal management P&L reporting assistant (ACME Unified P&L, Microsoft Fabric App). Users: authenticated employees only. Inputs: short natural-language questions about financial statements and capped, aggregated figures returned by the application's own query layer; no personal data. Outputs: short explanatory answers. Request: exemption from abuse-monitoring prompt/completion storage (zero data retention) for subscription <SUBSCRIPTION_ID>, resource <AI_RESOURCE_NAME>, because the content is confidential financial information; the application enforces its own input/output bounds and logs no content."* Until approved, Microsoft may keep prompts up to 30 days for abuse monitoring.

## B. Local tooling (once)

```bash
winget install Microsoft.Azure.FunctionsCoreTools   # or: npm i -g azure-functions-core-tools@4
func --version
cd C:\__PBI\PNL\fabric-app
copy packages\functions\local.settings.example.json packages\functions\local.settings.json
npm run dev     # first type generation; expect src/types.ts unchanged and runtimemetadata.json created (commit it); Ctrl+C
node scripts/validate-functions.mjs
```

## C. Deploy

```bash
cd C:\__PBI\PNL\fabric-app
npm run typecheck && npm run build && npm run lint && npm test
npx rayfin up --dry-run        # expect the recorded deployment and "Build, package, and deploy functions"
npx rayfin up                  # first FULL up with functions
npx rayfin secret set AZURE_OPENAI_ENDPOINT --describe="Azure OpenAI endpoint"      # https://<AI_RESOURCE_NAME>.openai.azure.com
npx rayfin secret set AZURE_OPENAI_DEPLOYMENT --describe="Chat model deployment"    # gpt-4.1-mini-dz
# switch the chat on: add RAYFIN_PUBLIC_PNL_CHAT=on to rayfin/.env, then
npm run build && npx rayfin up staticapp deploy
```

## D. Smoke test

Open the app → "AI assistant" button in the title row → ask "How did Commerce Cloud do in Q3 against budget?" → expect a Key figures card with "Open in view".

- **401 / "auth" error:** the token the function gets is for the Azure AI Foundry audience (`ai.azure.com`), which the classic `openai.azure.com` host may refuse. Set `AZURE_OPENAI_ENDPOINT` to the Foundry project endpoint (`https://<AI_RESOURCE_NAME>.services.ai.azure.com/api/projects/<project>`) with `rayfin secret set` and retry.
- Once RLS roles exist: check that a second user only sees their own rows in the cards.

## Notes

- `rayfin.yml` now enables functions. `npx rayfin up staticapp deploy` (the usual static deploy) is unaffected; a full `npx rayfin up` also deploys the function.
- The provider test fixtures are hand-shaped; replace them with real captures after the first working call (`packages/functions/test/recorded/README.md`).
