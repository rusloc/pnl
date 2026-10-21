#!/usr/bin/env python3
"""
fabric_pipelines.py - create, manage, run, schedule and monitor Microsoft Fabric Data Pipelines over REST.

Importable (`from fabric_pipelines import FabricPipelines`) and a CLI. Only hard dependency: `requests`.
`azure-identity` is used when installed; otherwise a FABRIC_TOKEN env var or a working `az login` is enough.

Auth resolution order
  1. FABRIC_TOKEN                                   pre-acquired bearer token (resource https://api.fabric.microsoft.com)
  2. AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET   service principal (client credentials)
  3. azure.identity.DefaultAzureCredential          managed identity, Azure CLI, VS Code, ...
  4. `az account get-access-token --resource https://api.fabric.microsoft.com`

CLI examples
  python fabric_pipelines.py workspaces
  python fabric_pipelines.py pipelines        --workspace Dev
  python fabric_pipelines.py upsert          --workspace Dev --pipeline "Nightly Load" --content pipeline-content.json --description "Loads dims"
  python fabric_pipelines.py get-definition  --workspace Dev --pipeline "Nightly Load" --out pipeline-content.json
  python fabric_pipelines.py run             --workspace Dev --pipeline "Nightly Load" --param RunDate=2026-10-14 --param BatchSize=500 --wait
  python fabric_pipelines.py status          --workspace Dev --pipeline "Nightly Load" --job <jobInstanceId>
  python fabric_pipelines.py activity-runs   --workspace Dev --pipeline "Nightly Load" --job <jobInstanceId> --failed-only
  python fabric_pipelines.py runs            --workspace Dev --pipeline "Nightly Load"
  python fabric_pipelines.py cancel          --workspace Dev --pipeline "Nightly Load" --job <jobInstanceId> --wait
  python fabric_pipelines.py schedules       --workspace Dev --pipeline "Nightly Load"
  python fabric_pipelines.py schedule-create --workspace Dev --pipeline "Nightly Load" --weekly 06:00 --days Mon,Tue,Wed,Thu,Fri --tz "W. Europe Standard Time"
  python fabric_pipelines.py schedule-update --workspace Dev --pipeline "Nightly Load" --schedule <id> --enabled false
  python fabric_pipelines.py takeover        --workspace Dev --pipeline "Nightly Load"      # make the calling SPN the run identity
  python fabric_pipelines.py delete          --workspace Dev --pipeline "Nightly Load"

Workspace / pipeline arguments accept either a GUID or a display name (names are resolved by listing and exact matching).
`--param name=value` parses value as JSON when possible (500 -> int, true -> bool, [1,2] -> list), else keeps it as a string.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit("pip install requests  (and optionally azure-identity)")

FABRIC_API = os.environ.get("FABRIC_API_BASE", "https://api.fabric.microsoft.com/v1").rstrip("/")  # override for tests / sovereign clouds
FABRIC_SCOPE = os.environ.get("FABRIC_SCOPE", "https://api.fabric.microsoft.com/.default")
JOB_TYPE = "Pipeline"  # job type for DataPipeline items; case-sensitive
TERMINAL_JOB_STATES = {"Completed", "Failed", "Cancelled", "Deduped"}
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


# --------------------------------------------------------------------------- auth
def acquire_token() -> str:
    """Return a bearer token for api.fabric.microsoft.com using the resolution order in the module docstring."""
    tok = os.environ.get("FABRIC_TOKEN")
    if tok:
        return tok.strip()
    tenant, client, secret = (os.environ.get(k) for k in ("AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"))
    try:
        from azure.identity import ClientSecretCredential, DefaultAzureCredential  # type: ignore

        cred = ClientSecretCredential(tenant, client, secret) if (tenant and client and secret) else DefaultAzureCredential()
        return cred.get_token(FABRIC_SCOPE).token
    except ImportError:
        pass
    except Exception as exc:  # fall through to az cli
        sys.stderr.write(f"azure-identity failed ({exc}); trying Azure CLI\n")
    if tenant and client and secret:  # raw OAuth2 client credentials without azure-identity
        r = requests.post(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            data={"grant_type": "client_credentials", "client_id": client, "client_secret": secret, "scope": FABRIC_SCOPE},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["access_token"]
    az = shutil.which("az")
    if az:
        out = subprocess.run([az, "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
                             capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    raise SystemExit("No Fabric credential found. Set FABRIC_TOKEN, or AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET, or run `az login`.")


# --------------------------------------------------------------------------- helpers
def b64_json(obj: Any) -> str:
    return base64.b64encode(json.dumps(obj, ensure_ascii=False).encode("utf-8")).decode("ascii")


def unb64_json(payload: str) -> Any:
    return json.loads(base64.b64decode(payload).decode("utf-8"))


def platform_part(display_name: str, description: str = "", logical_id: Optional[str] = None) -> Dict[str, Any]:
    """Build a .platform file (v2 format) for a DataPipeline item."""
    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "DataPipeline", "displayName": display_name, "description": description},
        "config": {"version": "2.0", "logicalId": logical_id or str(uuid.uuid4())},
    }


class FabricError(RuntimeError):
    def __init__(self, status: int, body: Any, request_id: Optional[str] = None):
        self.status, self.body, self.request_id = status, body, request_id
        code = body.get("errorCode") if isinstance(body, dict) else None
        msg = body.get("message") if isinstance(body, dict) else str(body)[:500]
        super().__init__(f"HTTP {status} {code or ''}: {msg} (requestId={request_id})")

    @property
    def error_code(self) -> Optional[str]:
        return self.body.get("errorCode") if isinstance(self.body, dict) else None


# --------------------------------------------------------------------------- client
class FabricPipelines:
    def __init__(self, token: Optional[str] = None, max_retries: int = 6, verbose: bool = False):
        self.token = token or acquire_token()
        self.max_retries = max_retries
        self.verbose = verbose
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {self.token}", "Accept": "application/json"})

    # ---- low level -------------------------------------------------------
    def _log(self, msg: str) -> None:
        if self.verbose:
            sys.stderr.write(msg + "\n")

    def _request(self, method: str, path: str, *, json_body: Any = None, params: Optional[dict] = None,
                 follow_lro: bool = True, ok: Iterable[int] = (200, 201, 202)) -> requests.Response:
        """One REST call with 429/5xx retries and optional LRO completion. Returns the final response."""
        url = path if path.startswith("http") else f"{FABRIC_API}/{path.lstrip('/')}"
        for attempt in range(self.max_retries + 1):
            self._log(f"{method} {url}")
            r = self.s.request(method, url, json=json_body, params=params, timeout=120)
            if r.status_code == 429 or r.status_code >= 500:
                body = _safe_json(r)
                code = body.get("errorCode") if isinstance(body, dict) else None
                retry_after = r.headers.get("Retry-After")
                if code == "CapacityLimitExceeded" or not retry_after:
                    wait = min(300, (2 ** attempt) * 5 + random.uniform(0, 3))  # capacity throttling: no Retry-After
                else:
                    wait = float(retry_after)
                if attempt == self.max_retries:
                    raise FabricError(r.status_code, body, r.headers.get("requestId") or r.headers.get("x-ms-request-id"))
                self._log(f"  -> {r.status_code} {code}; sleeping {wait:.0f}s")
                time.sleep(wait)
                continue
            if r.status_code not in ok:
                raise FabricError(r.status_code, _safe_json(r), r.headers.get("requestId") or r.headers.get("x-ms-request-id"))
            if r.status_code == 202 and follow_lro and "x-ms-operation-id" in r.headers:
                return self._wait_lro(r)
            return r
        raise RuntimeError("unreachable")

    def _wait_lro(self, resp: requests.Response) -> requests.Response:
        """Poll GET /operations/{id} until Succeeded/Failed, then fetch /result (if any)."""
        op_id = resp.headers["x-ms-operation-id"]
        delay = int(resp.headers.get("Retry-After", "5") or 5)
        url = f"{FABRIC_API}/operations/{op_id}"
        while True:
            time.sleep(max(1, delay))
            poll = self.s.get(url, timeout=60)
            delay = int(poll.headers.get("Retry-After", str(delay)) or delay)
            if poll.status_code == 202:
                continue
            body = _safe_json(poll)
            status = body.get("status") if isinstance(body, dict) else None
            self._log(f"  LRO {op_id}: {status} {body.get('percentComplete') if isinstance(body, dict) else ''}")
            if status in ("NotStarted", "Running"):
                continue
            if status == "Failed":
                raise FabricError(poll.status_code, body.get("error") or body, body.get("requestId"))
            result = self.s.get(url + "/result", timeout=60)
            if result.status_code == 200:
                return result
            return poll  # operations without a result body (e.g. updateDefinition)

    def _paged(self, path: str, params: Optional[dict] = None) -> List[dict]:
        items: List[dict] = []
        params = dict(params or {})
        while True:
            r = self._request("GET", path, params=params)
            body = r.json()
            items.extend(body.get("value", []))
            token = body.get("continuationToken")
            if not token:
                return items
            params["continuationToken"] = token

    # ---- workspaces / folders --------------------------------------------
    def list_workspaces(self) -> List[dict]:
        return self._paged("workspaces")

    def workspace_id(self, name_or_id: str) -> str:
        if UUID_RE.match(name_or_id):
            return name_or_id
        matches = [w for w in self.list_workspaces() if w.get("displayName") == name_or_id and w.get("type") != "Personal"]
        if len(matches) != 1:
            raise SystemExit(f"Workspace '{name_or_id}': {len(matches)} matches (need exactly 1). "
                             "Pass the workspace GUID instead.")
        return matches[0]["id"]

    def folder_id(self, ws: str, folder_name: str) -> str:
        folders = self._paged(f"workspaces/{ws}/folders", {"recursive": "true"})
        matches = [f for f in folders if f.get("displayName") == folder_name]
        if len(matches) != 1:
            raise SystemExit(f"Folder '{folder_name}': {len(matches)} matches in workspace {ws}.")
        return matches[0]["id"]

    # ---- pipeline CRUD ---------------------------------------------------
    def list_pipelines(self, ws: str) -> List[dict]:
        return self._paged(f"workspaces/{ws}/dataPipelines")

    def pipeline_id(self, ws: str, name_or_id: str) -> str:
        if UUID_RE.match(name_or_id):
            return name_or_id
        matches = [p for p in self.list_pipelines(ws) if p.get("displayName") == name_or_id]
        if len(matches) != 1:
            raise SystemExit(f"Pipeline '{name_or_id}': {len(matches)} matches in workspace {ws}.")
        return matches[0]["id"]

    def find_pipeline(self, ws: str, name: str) -> Optional[dict]:
        return next((p for p in self.list_pipelines(ws) if p.get("displayName") == name), None)

    def get_pipeline(self, ws: str, pid: str) -> dict:
        return self._request("GET", f"workspaces/{ws}/dataPipelines/{pid}").json()

    def create_pipeline(self, ws: str, name: str, content: Optional[dict] = None, description: Optional[str] = None,
                        folder_id: Optional[str] = None, platform: Optional[dict] = None) -> dict:
        body: Dict[str, Any] = {"displayName": name}
        if description is not None:
            body["description"] = description[:256]
        if folder_id:
            body["folderId"] = folder_id
        if content is not None:
            parts = [{"path": "pipeline-content.json", "payload": b64_json(content), "payloadType": "InlineBase64"}]
            if platform:
                parts.append({"path": ".platform", "payload": b64_json(platform), "payloadType": "InlineBase64"})
            body["definition"] = {"parts": parts}
        r = self._request("POST", f"workspaces/{ws}/dataPipelines", json_body=body)
        item = _safe_json(r)
        if not (isinstance(item, dict) and item.get("id")):  # LRO succeeded without a result body: resolve by name
            for _ in range(10):
                found = self.find_pipeline(ws, name)
                if found:
                    return found
                time.sleep(3)
            raise RuntimeError(f"Pipeline '{name}' created but not visible yet; re-list the workspace.")
        return item

    def upsert_pipeline(self, ws: str, name: str, content: dict, description: Optional[str] = None,
                        folder_id: Optional[str] = None, platform: Optional[dict] = None) -> dict:
        """Create the pipeline, or replace its definition if the name already exists. Idempotent."""
        existing = self.find_pipeline(ws, name)
        if existing is None:
            try:
                item = self.create_pipeline(ws, name, content, description, folder_id, platform)
                item["_action"] = "created"
                return item
            except FabricError as e:
                if e.error_code != "ItemDisplayNameAlreadyInUse":
                    raise
                existing = self.find_pipeline(ws, name)
                if existing is None:
                    raise
        self.update_definition(ws, existing["id"], content, platform=platform, update_metadata=bool(platform))
        if description is not None and description != existing.get("description"):
            self.update_pipeline(ws, existing["id"], description=description)
        existing["_action"] = "updated"
        return existing

    def update_pipeline(self, ws: str, pid: str, display_name: Optional[str] = None, description: Optional[str] = None) -> dict:
        body = {k: v for k, v in (("displayName", display_name), ("description", description)) if v is not None}
        return self._request("PATCH", f"workspaces/{ws}/dataPipelines/{pid}", json_body=body).json()

    def takeover(self, ws: str, pid: str) -> dict:
        """Re-save the pipeline so the calling identity becomes LastModifiedBy (= the identity the pipeline runs as)."""
        current = self.get_pipeline(ws, pid)
        return self.update_pipeline(ws, pid, description=current.get("description") or "")

    def delete_pipeline(self, ws: str, pid: str, hard: bool = False) -> None:
        self._request("DELETE", f"workspaces/{ws}/dataPipelines/{pid}", params={"hardDelete": "true"} if hard else None)

    def get_definition(self, ws: str, pid: str, decode: bool = True) -> dict:
        """Return {'pipeline-content.json': {...}, '.platform': {...}, '.schedules': {...}} (decoded) or the raw parts."""
        r = self._request("POST", f"workspaces/{ws}/dataPipelines/{pid}/getDefinition", json_body={})
        parts = r.json()["definition"]["parts"]
        if not decode:
            return {"parts": parts}
        return {p["path"]: unb64_json(p["payload"]) for p in parts}

    def get_content(self, ws: str, pid: str) -> dict:
        return self.get_definition(ws, pid)["pipeline-content.json"]

    def update_definition(self, ws: str, pid: str, content: dict, platform: Optional[dict] = None,
                          update_metadata: bool = False) -> None:
        content = dict(content)
        props = content.get("properties")
        if isinstance(props, dict):  # system fields that come back from getDefinition
            props.pop("lastModifiedByObjectId", None)
            props.pop("lastPublishTime", None)
        parts = [{"path": "pipeline-content.json", "payload": b64_json(content), "payloadType": "InlineBase64"}]
        if platform:
            parts.append({"path": ".platform", "payload": b64_json(platform), "payloadType": "InlineBase64"})
        self._request("POST", f"workspaces/{ws}/dataPipelines/{pid}/updateDefinition",
                      json_body={"definition": {"parts": parts}},
                      params={"updateMetadata": "true"} if update_metadata else None)

    # ---- runs ------------------------------------------------------------
    def run(self, ws: str, pid: str, parameters: Optional[dict] = None) -> str:
        """Start a run; returns the job instance id (parsed from the Location header of the 202)."""
        body = {"executionData": {"parameters": parameters}} if parameters else {}
        r = self._request("POST", f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/instances", json_body=body, follow_lro=False)
        loc = r.headers.get("Location", "")
        job_id = loc.rstrip("/").split("/")[-1]
        if not UUID_RE.match(job_id):
            raise RuntimeError(f"Could not parse job instance id from Location header: {loc!r}")
        self._last_retry_after = int(r.headers.get("Retry-After", "60") or 60)
        return job_id

    def get_job(self, ws: str, pid: str, job_id: str) -> dict:
        return self._request("GET", f"workspaces/{ws}/items/{pid}/jobs/instances/{job_id}").json()

    def wait(self, ws: str, pid: str, job_id: str, timeout_s: int = 3600, poll_s: Optional[int] = None,
             on_poll=None) -> dict:
        """Poll until a terminal status. Returns the final job object; raises TimeoutError on timeout (does not cancel)."""
        deadline = time.time() + timeout_s
        time.sleep(min(getattr(self, "_last_retry_after", 10), 30) if poll_s is None else 0)
        while True:
            r = self._request("GET", f"workspaces/{ws}/items/{pid}/jobs/instances/{job_id}")
            job = r.json()
            if on_poll:
                on_poll(job)
            if job.get("status") in TERMINAL_JOB_STATES:
                return job
            if time.time() > deadline:
                raise TimeoutError(f"Job {job_id} still {job.get('status')} after {timeout_s}s")
            delay = poll_s or min(60, max(10, int(r.headers.get("Retry-After", "20") or 20)))
            time.sleep(delay)

    def list_runs(self, ws: str, pid: str) -> List[dict]:
        return self._paged(f"workspaces/{ws}/items/{pid}/jobs/instances")

    def cancel(self, ws: str, pid: str, job_id: str, wait: bool = False) -> dict:
        job = self.get_job(ws, pid, job_id)
        if job.get("status") in TERMINAL_JOB_STATES:
            return job
        self._request("POST", f"workspaces/{ws}/items/{pid}/jobs/instances/{job_id}/cancel", follow_lro=False)
        if not wait:
            return self.get_job(ws, pid, job_id)
        return self.wait(ws, pid, job_id, timeout_s=600, poll_s=5)

    def activity_runs(self, ws: str, job_id: str, after: Optional[datetime] = None, before: Optional[datetime] = None,
                      failed_only: bool = False) -> List[dict]:
        """Activity-level runs for one pipeline run (job instance). Follows the string continuation token."""
        after = after or (datetime.now(timezone.utc) - timedelta(days=7))
        before = before or (datetime.now(timezone.utc) + timedelta(days=1))
        body: Dict[str, Any] = {
            "filters": [{"operand": "Status", "operator": "Equals", "values": ["Failed"]}] if failed_only else [],
            "orderBy": [{"orderBy": "ActivityRunStart", "order": "ASC"}],
            "lastUpdatedAfter": after.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "lastUpdatedBefore": before.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        }
        runs: List[dict] = []
        token: Optional[str] = None
        while True:
            if token:
                body["continuationToken"] = token
            r = self._request("POST", f"workspaces/{ws}/datapipelines/pipelineruns/{job_id}/queryactivityruns", json_body=body)
            page = r.json()
            if isinstance(page, dict):  # defensive: ADF-style envelope
                runs.extend(page.get("value", []))
                token = page.get("continuationToken")
            else:
                runs.extend(page)
                token = None
            if not token:
                return runs

    # ---- schedules -------------------------------------------------------
    def list_schedules(self, ws: str, pid: str) -> List[dict]:
        return self._paged(f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/schedules")

    def create_schedule(self, ws: str, pid: str, configuration: dict, enabled: bool = True,
                        execution_data: Optional[dict] = None) -> dict:
        body: Dict[str, Any] = {"enabled": enabled, "configuration": configuration}
        if execution_data:
            body["executionData"] = execution_data
        return self._request("POST", f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/schedules", json_body=body).json()

    def update_schedule(self, ws: str, pid: str, schedule_id: str, enabled: Optional[bool] = None,
                        configuration: Optional[dict] = None, execution_data: Optional[dict] = None) -> dict:
        current = self._request("GET", f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/schedules/{schedule_id}").json()
        body: Dict[str, Any] = {  # PATCH requires the full body
            "enabled": current["enabled"] if enabled is None else enabled,
            "configuration": configuration or current["configuration"],
        }
        if execution_data or current.get("executionData"):
            body["executionData"] = execution_data or current.get("executionData")
        return self._request("PATCH", f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/schedules/{schedule_id}", json_body=body).json()

    def delete_schedule(self, ws: str, pid: str, schedule_id: str) -> None:
        self._request("DELETE", f"workspaces/{ws}/items/{pid}/jobs/{JOB_TYPE}/schedules/{schedule_id}")

    # ---- connections -----------------------------------------------------
    def list_connections(self) -> List[dict]:
        return self._paged("connections")

    def pipeline_connections(self, ws: str, pid: str) -> List[dict]:
        return self._paged(f"workspaces/{ws}/items/{pid}/connections")


# --------------------------------------------------------------------------- schedule builders
WEEKDAYS = {"mon": "Monday", "tue": "Tuesday", "wed": "Wednesday", "thu": "Thursday", "fri": "Friday", "sat": "Saturday", "sun": "Sunday"}


def schedule_config(kind: str, *, tz: str = "UTC", start: Optional[str] = None, end: str = "2099-01-01T00:00:00",
                    interval: Optional[int] = None, times: Optional[List[str]] = None, days: Optional[List[str]] = None,
                    day_of_month: Optional[int] = None, recurrence: int = 1) -> dict:
    """Build a Job Scheduler configuration. kind: cron | daily | weekly | monthly. Times are hh:mm in `tz` (Windows id)."""
    start = start or (datetime.now() + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S")  # past start = immediate run
    cfg: Dict[str, Any] = {"startDateTime": start, "endDateTime": end, "localTimeZoneId": tz}
    k = kind.lower()
    if k == "cron":
        cfg.update(type="Cron", interval=int(interval or 60))
    elif k == "daily":
        cfg.update(type="Daily", times=times or ["06:00"])
    elif k == "weekly":
        cfg.update(type="Weekly", times=times or ["06:00"], weekdays=[WEEKDAYS.get(d[:3].lower(), d) for d in (days or ["Monday"])])
    elif k == "monthly":
        cfg.update(type="Monthly", times=times or ["02:00"], recurrence=recurrence,
                   occurrence={"occurrenceType": "DayOfMonth", "dayOfMonth": int(day_of_month or 1)})
    else:
        raise ValueError("kind must be cron|daily|weekly|monthly")
    return cfg


# --------------------------------------------------------------------------- CLI
def _safe_json(r: requests.Response) -> Any:
    try:
        return r.json() if r.content else {}
    except ValueError:
        return {"raw": r.text[:1000]}


def _parse_param(kv: str) -> tuple:
    if "=" not in kv:
        raise argparse.ArgumentTypeError("--param expects name=value")
    k, v = kv.split("=", 1)
    try:
        return k, json.loads(v)
    except ValueError:
        return k, v


def _print(obj: Any) -> None:
    print(json.dumps(obj, indent=2, default=str))


def _summarize_activity_runs(runs: List[dict]) -> List[dict]:
    return [{"activityName": a.get("activityName"), "activityType": a.get("activityType"), "status": a.get("status"),
             "durationInMs": a.get("durationInMs"), "start": a.get("activityRunStart"),
             "error": (a.get("error") or {}).get("message") or None} for a in runs]


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--verbose", "-v", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p, pipeline=True):
        p.add_argument("--workspace", "-w", required=True, help="workspace display name or GUID")
        if pipeline:
            p.add_argument("--pipeline", "-p", required=True, help="pipeline display name or GUID")

    sub.add_parser("workspaces")
    common(sub.add_parser("pipelines"), pipeline=False)
    p = sub.add_parser("get"); common(p)
    p = sub.add_parser("get-definition"); common(p); p.add_argument("--out", help="write decoded pipeline-content.json here"); p.add_argument("--raw", action="store_true")
    p = sub.add_parser("upsert", help="create or replace a pipeline from a pipeline-content.json"); common(p)
    p.add_argument("--content", required=True); p.add_argument("--description"); p.add_argument("--folder", help="folder display name")
    p.add_argument("--platform", action="store_true", help="also send a .platform part (new logicalId)")
    p = sub.add_parser("update-definition"); common(p); p.add_argument("--content", required=True)
    p = sub.add_parser("rename"); common(p); p.add_argument("--name", required=True); p.add_argument("--description")
    p = sub.add_parser("takeover"); common(p)
    p = sub.add_parser("delete"); common(p); p.add_argument("--hard", action="store_true")
    p = sub.add_parser("run"); common(p); p.add_argument("--param", type=_parse_param, action="append", default=[])
    p.add_argument("--params-json", help="JSON object of parameters"); p.add_argument("--wait", action="store_true")
    p.add_argument("--timeout", type=int, default=3600); p.add_argument("--poll", type=int)
    p = sub.add_parser("status"); common(p); p.add_argument("--job", required=True)
    p = sub.add_parser("wait"); common(p); p.add_argument("--job", required=True); p.add_argument("--timeout", type=int, default=3600); p.add_argument("--poll", type=int)
    p = sub.add_parser("runs"); common(p); p.add_argument("--limit", type=int, default=20)
    p = sub.add_parser("cancel"); common(p); p.add_argument("--job", required=True); p.add_argument("--wait", action="store_true")
    p = sub.add_parser("activity-runs"); common(p); p.add_argument("--job", required=True); p.add_argument("--failed-only", action="store_true")
    p.add_argument("--full", action="store_true", help="print raw activity run objects incl. input/output")
    p = sub.add_parser("schedules"); common(p)
    p = sub.add_parser("schedule-create"); common(p)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--cron", type=int, metavar="MINUTES"); g.add_argument("--daily", metavar="HH:MM[,HH:MM]")
    g.add_argument("--weekly", metavar="HH:MM[,HH:MM]"); g.add_argument("--monthly", metavar="HH:MM[,HH:MM]"); g.add_argument("--config-json")
    p.add_argument("--days", default="Mon,Tue,Wed,Thu,Fri"); p.add_argument("--day-of-month", type=int, default=1)
    p.add_argument("--tz", default="UTC", help="Windows time zone id, e.g. 'W. Europe Standard Time'")
    p.add_argument("--start"); p.add_argument("--end", default="2099-01-01T00:00:00"); p.add_argument("--disabled", action="store_true")
    p.add_argument("--params-json", help="JSON object of pipeline parameters for scheduled runs (executionData.parameters)")
    p = sub.add_parser("schedule-update"); common(p); p.add_argument("--schedule", required=True)
    p.add_argument("--enabled", choices=["true", "false"]); p.add_argument("--config-json")
    p = sub.add_parser("schedule-delete"); common(p); p.add_argument("--schedule", required=True)
    p = sub.add_parser("connections"); common(p)

    a = ap.parse_args(argv)
    fp = FabricPipelines(verbose=a.verbose)

    if a.cmd == "workspaces":
        _print([{"id": w["id"], "displayName": w.get("displayName"), "type": w.get("type"), "capacityId": w.get("capacityId")} for w in fp.list_workspaces()]); return 0
    ws = fp.workspace_id(a.workspace)
    if a.cmd == "pipelines":
        _print([{"id": p["id"], "displayName": p.get("displayName"), "description": p.get("description"), "folderId": p.get("folderId")} for p in fp.list_pipelines(ws)]); return 0

    if a.cmd == "upsert":
        with open(a.content, encoding="utf-8") as f:
            content = json.load(f)
        if "properties" not in content:
            content = {"properties": content}
        folder = fp.folder_id(ws, a.folder) if a.folder else None
        platform = platform_part(a.pipeline, a.description or "") if a.platform else None
        item = fp.upsert_pipeline(ws, a.pipeline, content, a.description, folder, platform)
        _print({"action": item.pop("_action", "?"), "id": item["id"], "displayName": item.get("displayName"), "workspaceId": ws}); return 0

    pid = fp.pipeline_id(ws, a.pipeline)
    if a.cmd == "get":
        _print(fp.get_pipeline(ws, pid))
    elif a.cmd == "get-definition":
        d = fp.get_definition(ws, pid, decode=not a.raw)
        if a.out and not a.raw:
            with open(a.out, "w", encoding="utf-8") as f:
                json.dump(d["pipeline-content.json"], f, indent=2)
            print(f"wrote {a.out}; other parts: {[k for k in d if k != 'pipeline-content.json']}")
        else:
            _print(d)
    elif a.cmd == "update-definition":
        with open(a.content, encoding="utf-8") as f:
            content = json.load(f)
        fp.update_definition(ws, pid, content if "properties" in content else {"properties": content}); print("definition updated")
    elif a.cmd == "rename":
        _print(fp.update_pipeline(ws, pid, display_name=a.name, description=a.description))
    elif a.cmd == "takeover":
        _print(fp.takeover(ws, pid)); print("LastModifiedBy is now the calling identity", file=sys.stderr)
    elif a.cmd == "delete":
        fp.delete_pipeline(ws, pid, hard=a.hard); print("deleted" + (" (hard)" if a.hard else " (soft)"))
    elif a.cmd == "run":
        params = dict(a.param)
        if a.params_json:
            params.update(json.loads(a.params_json))
        job_id = fp.run(ws, pid, params or None)
        print(json.dumps({"jobInstanceId": job_id, "parameters": params, "statusUrl": f"{FABRIC_API}/workspaces/{ws}/items/{pid}/jobs/instances/{job_id}"}))
        if a.wait:
            try:
                job = fp.wait(ws, pid, job_id, a.timeout, a.poll, on_poll=lambda j: sys.stderr.write(f"  {j.get('status')}\n"))
            except TimeoutError as e:
                print(str(e), file=sys.stderr); return 3
            _print(job)
            if job.get("status") != "Completed":
                failed = _summarize_activity_runs([r for r in fp.activity_runs(ws, job_id) if r.get("status") == "Failed"])
                if failed:
                    print("Failed activities:", file=sys.stderr); _print(failed)
                return 1
    elif a.cmd == "status":
        _print(fp.get_job(ws, pid, a.job))
    elif a.cmd == "wait":
        job = fp.wait(ws, pid, a.job, a.timeout, a.poll); _print(job); return 0 if job.get("status") == "Completed" else 1
    elif a.cmd == "runs":
        runs = sorted(fp.list_runs(ws, pid), key=lambda r: r.get("startTimeUtc") or "", reverse=True)[: a.limit]
        _print([{k: r.get(k) for k in ("id", "status", "invokeType", "startTimeUtc", "endTimeUtc")} | {"error": (r.get("failureReason") or {}).get("message")} for r in runs])
    elif a.cmd == "cancel":
        _print(fp.cancel(ws, pid, a.job, wait=a.wait))
    elif a.cmd == "activity-runs":
        runs = fp.activity_runs(ws, a.job, failed_only=a.failed_only)
        _print(runs if a.full else _summarize_activity_runs(runs))
    elif a.cmd == "schedules":
        _print(fp.list_schedules(ws, pid))
    elif a.cmd == "schedule-create":
        if a.config_json:
            cfg = json.loads(a.config_json)
        elif a.cron:
            cfg = schedule_config("cron", tz=a.tz, start=a.start, end=a.end, interval=a.cron)
        elif a.daily:
            cfg = schedule_config("daily", tz=a.tz, start=a.start, end=a.end, times=a.daily.split(","))
        elif a.weekly:
            cfg = schedule_config("weekly", tz=a.tz, start=a.start, end=a.end, times=a.weekly.split(","), days=a.days.split(","))
        else:
            cfg = schedule_config("monthly", tz=a.tz, start=a.start, end=a.end, times=a.monthly.split(","), day_of_month=a.day_of_month)
        exec_data = {"parameters": json.loads(a.params_json)} if a.params_json else None
        _print(fp.create_schedule(ws, pid, cfg, enabled=not a.disabled, execution_data=exec_data))
    elif a.cmd == "schedule-update":
        _print(fp.update_schedule(ws, pid, a.schedule, enabled=None if a.enabled is None else a.enabled == "true",
                                  configuration=json.loads(a.config_json) if a.config_json else None))
    elif a.cmd == "schedule-delete":
        fp.delete_schedule(ws, pid, a.schedule); print("schedule deleted")
    elif a.cmd == "connections":
        _print(fp.pipeline_connections(ws, pid))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except FabricError as e:
        print(f"Fabric API error: {e}", file=sys.stderr)
        if isinstance(e.body, dict) and e.body.get("moreDetails"):
            print(json.dumps(e.body["moreDetails"], indent=2), file=sys.stderr)
        sys.exit(2)
