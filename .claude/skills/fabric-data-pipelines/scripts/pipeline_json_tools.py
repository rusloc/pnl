#!/usr/bin/env python3
"""
pipeline_json_tools.py - validate, inspect and convert Fabric pipeline-content.json files (no network needed).

  validate     <pipeline-content.json>          structural + semantic checks; exit 1 on errors, prints warnings
  refs         <pipeline-content.json>          list environment-bound references (connection GUIDs, workspace/artifact ids, notebook/dataflow ids)
  from-export  <Name.json from UI export zip>   convert the ARM-template export into pipeline-content.json
               [--map "placeholder name=guid" ...] [--out pipeline-content.json]
  encode       <pipeline-content.json>          print the base64 payload for a definition part
  decode       <base64 string | getDefinition response.json> [--part pipeline-content.json]   print the decoded JSON

The validator encodes what the Fabric service and the DataPipeline definition reference enforce: unique activity names,
dependsOn targets that exist, allowed dependency conditions, known activity types, required typeProperties per type,
policy only on non-control activities, nesting rules (no ForEach inside ForEach/Until), limits (120 activities,
50 parameters, batchCount <= 50, 8192-char expressions), Fabric-vs-ADF fields (no linkedServiceName/inputs/outputs/
connectVia/url), RefreshDataflow needing dataflowType=DataflowFabric, and bare "@..." strings that should be Expression objects.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

ACTIVITY_TYPES = {
    "Copy", "AzureHDInsight", "SparkJobDefinition", "InvokeCopyJob", "ExecuteSSISPackage", "SqlServerStoredProcedure",
    "InvokePipeline", "ExecutePipeline", "Delete", "KustoQueryLanguage", "Lookup", "WebActivity", "GetMetadata",
    "IfCondition", "Switch", "ForEach", "AzureMLExecutePipeline", "DataLakeAnalyticsScope", "Wait", "Fail", "Until",
    "Filter", "TridentNotebook", "DatabricksNotebook", "SetVariable", "AppendVariable", "AzureFunction", "Custom",
    "WebHook", "RefreshDataflow", "RefreshDataFlow", "Script", "Office365Email", "Email", "Office365Outlook",
    "MicrosoftTeams", "Teams", "PBISemanticModelRefresh",
}
CONTROL_NO_POLICY = {"ForEach", "IfCondition", "Switch", "Until", "Filter", "Fail", "Wait", "AppendVariable"}
CONTAINER_KEYS = {  # type -> list of typeProperties keys holding nested activity arrays
    "ForEach": ["activities"], "Until": ["activities"], "IfCondition": ["ifTrueActivities", "ifFalseActivities"],
    "Switch": ["defaultActivities"],  # plus cases[].activities, handled specially
}
REQUIRED_TYPE_PROPS = {
    "Wait": ["waitTimeInSeconds"], "Fail": ["message", "errorCode"], "TridentNotebook": ["notebookId", "workspaceId"],
    "RefreshDataflow": ["dataflowId", "workspaceId"], "RefreshDataFlow": ["dataflowId", "workspaceId"],
    "InvokePipeline": ["pipelineId", "workspaceId"], "ExecutePipeline": ["pipeline"], "Copy": ["source", "sink"],
    "Lookup": ["datasetSettings"], "GetMetadata": ["datasetSettings", "fieldList"], "Delete": ["datasetSettings"],
    "SetVariable": ["variableName", "value"], "AppendVariable": ["variableName", "value"], "ForEach": ["items", "activities"],
    "IfCondition": ["expression"], "Switch": ["on", "cases"], "Until": ["expression", "activities"], "Filter": ["items", "condition"],
    "WebActivity": ["method", "relativeUrl"], "WebHook": ["method", "relativeUrl"], "Script": ["scripts"],
    "SqlServerStoredProcedure": ["storedProcedureName"], "KustoQueryLanguage": ["command"],
    "PBISemanticModelRefresh": ["datasetId", "groupId"], "InvokeCopyJob": ["copyJobId", "workspaceId"],
    "SparkJobDefinition": ["sparkJobDefinitionId", "workspaceId"], "AzureFunction": ["functionName", "method"],
}
NEEDS_CONNECTION = {"InvokePipeline", "WebActivity", "WebHook", "AzureFunction", "PBISemanticModelRefresh", "InvokeCopyJob", "DatabricksNotebook"}
DEP_CONDITIONS = {"Succeeded", "Failed", "Skipped", "Completed"}
PARAM_TYPES = {"string", "int", "float", "bool", "array", "object", "securestring"}
VAR_TYPES = {"string", "boolean", "array", "integer"}
ADF_ONLY_KEYS = {"linkedServiceName", "inputs", "outputs", "connectVia", "dataset", "integrationRuntime"}
GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
TIMEOUT_RE = re.compile(r"^(\d+\.)?\d{1,2}:\d{2}:\d{2}$")


class Report:
    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def _is_expr(v: Any) -> bool:
    return isinstance(v, dict) and v.get("type") == "Expression" and isinstance(v.get("value"), str)


def _walk_activities(activities: List[dict], path: str, rep: Report, seen: Dict[str, str], depth: Tuple[str, ...], counter: List[int],
                     declared_vars: Dict[str, str]) -> None:
    names_here = set()
    for i, act in enumerate(activities):
        loc = f"{path}[{i}]"
        if not isinstance(act, dict):
            rep.err(f"{loc}: activity must be an object"); continue
        name, atype = act.get("name"), act.get("type")
        counter[0] += 1
        if not isinstance(name, str) or not name.strip():
            rep.err(f"{loc}: missing 'name'"); name = f"<unnamed {loc}>"
        else:
            if name in seen:
                rep.err(f"{loc}: duplicate activity name '{name}' (also at {seen[name]}); names must be unique across the whole pipeline")
            seen[name] = loc
            names_here.add(name)
            if len(name) > 55:
                rep.warn(f"'{name}': name longer than 55 chars (ADF limit; Fabric UI may still accept)")
            if re.search(r"[.+?/<>*%&:\\]", name):
                rep.warn(f"'{name}': name contains characters ADF forbids (. + ? / < > * % & : \\); safer to rename")
        if atype not in ACTIVITY_TYPES:
            rep.warn(f"'{name}': unknown activity type '{atype}' (not in the DataPipeline definition enumeration; if copied from View JSON it may still be valid)")
        tp = act.get("typeProperties")
        if not isinstance(tp, dict):
            if act.get("state") != "Inactive":
                rep.err(f"'{name}': 'typeProperties' object is required")
            tp = {}
        for key in ADF_ONLY_KEYS & set(act.keys()):
            rep.err(f"'{name}': '{key}' is an ADF/Synapse field; Fabric uses externalReferences.connection / inline linkedService / datasetSettings")
        for key in ADF_ONLY_KEYS & set(tp.keys()):
            if not (atype == "Copy" and key in ("inputs", "outputs")):
                rep.err(f"'{name}'.typeProperties: '{key}' is an ADF/Synapse field, not valid in Fabric")
        if atype == "WebActivity" and "url" in tp and "relativeUrl" not in tp:
            rep.err(f"'{name}': Web activity uses 'relativeUrl' + a Web connection in Fabric, not 'url'")
        # dependsOn
        deps = act.get("dependsOn", [])
        if not isinstance(deps, list):
            rep.err(f"'{name}': dependsOn must be a list")
        else:
            for d in deps:
                if not isinstance(d, dict) or "activity" not in d:
                    rep.err(f"'{name}': dependsOn entries need {{'activity','dependencyConditions'}}"); continue
                if d["activity"] == name:
                    rep.err(f"'{name}': depends on itself")
                conds = d.get("dependencyConditions", [])
                bad = set(conds) - DEP_CONDITIONS
                if bad:
                    rep.err(f"'{name}': invalid dependencyConditions {sorted(bad)} (allowed: {sorted(DEP_CONDITIONS)})")
                act.setdefault("_dep_targets", []).append(d["activity"])
        # policy
        pol = act.get("policy")
        if atype in CONTROL_NO_POLICY and pol:
            rep.warn(f"'{name}': control activity '{atype}' does not take a 'policy' block (the UI never writes one)")
        elif atype == "SetVariable" and pol and set(pol) - {"secureInput", "secureOutput"}:
            rep.warn(f"'{name}': SetVariable policy only supports secureInput/secureOutput")
        elif atype not in CONTROL_NO_POLICY and atype != "SetVariable" and pol is None and act.get("state") != "Inactive":
            rep.warn(f"'{name}': no 'policy' (timeout/retry); Fabric applies defaults (timeout 7d, retry 0) - usually fine, add one to control retries")
        if isinstance(pol, dict):
            t = pol.get("timeout")
            if t is not None and not (isinstance(t, str) and TIMEOUT_RE.match(t)):
                rep.err(f"'{name}': policy.timeout must look like '0.12:00:00' or '7.00:00:00'")
            ri = pol.get("retryIntervalInSeconds")
            if ri is not None and not (isinstance(ri, int) and 30 <= ri <= 86400):
                rep.err(f"'{name}': policy.retryIntervalInSeconds must be an int between 30 and 86400")
        # required typeProperties
        for key in REQUIRED_TYPE_PROPS.get(atype, []):
            if key not in tp and act.get("state") != "Inactive":
                rep.err(f"'{name}' ({atype}): typeProperties.{key} is required")
        if atype in NEEDS_CONNECTION and not (act.get("externalReferences") or {}).get("connection") and act.get("state") != "Inactive":
            rep.err(f"'{name}' ({atype}): needs externalReferences.connection (a Fabric connection GUID or Expression)")
        if atype in ("RefreshDataflow", "RefreshDataFlow") and tp.get("dataflowType") != "DataflowFabric":
            rep.warn(f"'{name}': RefreshDataflow should set typeProperties.dataflowType = 'DataflowFabric' for Dataflow Gen2 (CI/CD) items; without it the run uses the legacy engine")
        if atype == "ForEach":
            bc = tp.get("batchCount")
            if bc is not None and (not isinstance(bc, int) or bc < 1 or bc > 50):
                rep.err(f"'{name}': ForEach batchCount must be 1..50")
            if "ForEach" in depth or "Until" in depth:
                rep.err(f"'{name}': ForEach cannot be nested inside ForEach/Until (invoke a child pipeline instead)")
        if atype == "Until" and "ForEach" in depth:
            rep.err(f"'{name}': Until cannot be nested inside ForEach")
        if atype in ("SetVariable", "AppendVariable"):
            vn = tp.get("variableName")
            if vn == "pipelineReturnValue":
                if not tp.get("setSystemVariable"):
                    rep.warn(f"'{name}': pipeline return value needs typeProperties.setSystemVariable = true")
            elif vn and vn not in declared_vars:
                rep.err(f"'{name}': variable '{vn}' is not declared under properties.variables")
            elif atype == "AppendVariable" and vn and declared_vars.get(vn, "").lower() != "array":
                rep.err(f"'{name}': AppendVariable target '{vn}' must be of type Array")
        if atype == "Copy":
            for side in ("source", "sink"):
                s = tp.get(side)
                if isinstance(s, dict) and not isinstance(s.get("datasetSettings"), dict) and act.get("state") != "Inactive":
                    rep.err(f"'{name}': Copy {side} needs an inline 'datasetSettings' object (Fabric has no dataset items)")
        # bare expressions
        _scan_expressions(tp, f"'{name}'.typeProperties", rep)
        _check_connections(act, f"'{name}'", rep)
        # nested
        for key in CONTAINER_KEYS.get(atype, []):
            if isinstance(tp.get(key), list):
                _walk_activities(tp[key], f"{loc}.{key}", rep, seen, depth + (atype,), counter, declared_vars)
        if atype == "Switch":
            for ci, case in enumerate(tp.get("cases", []) or []):
                if isinstance(case, dict) and isinstance(case.get("activities"), list):
                    _walk_activities(case["activities"], f"{loc}.cases[{ci}].activities", rep, seen, depth + (atype,), counter, declared_vars)
    # dependsOn targets must be siblings at this level
    for act in activities:
        if isinstance(act, dict):
            for target in act.pop("_dep_targets", []):
                if target not in names_here:
                    rep.err(f"'{act.get('name')}': dependsOn target '{target}' is not a sibling activity at the same level")


PLACEHOLDER_VALUE_RE = re.compile(r"^__[A-Za-z0-9_]+__$|^<.+>$|^\[parameters\('.+'\)\]$")


def _check_connections(node: Any, path: str, rep: Report, _depth: int = 0) -> None:
    """Validate every externalReferences.connection (activity level or inside datasetSettings/stagingSettings)."""
    if isinstance(node, dict):
        er = node.get("externalReferences")
        if isinstance(er, dict):
            c = er.get("connection")
            if isinstance(c, str) and PLACEHOLDER_VALUE_RE.match(c):
                rep.warn(f"{path}: externalReferences.connection is the placeholder {c!r}; replace with a real connection GUID before deploying")
            elif not (isinstance(c, str) and GUID_RE.match(c)) and not _is_expr(c):
                rep.err(f"{path}: externalReferences.connection must be a connection GUID or an Expression object (got {c!r})")
        for key in ("artifactId", "workspaceId", "notebookId", "dataflowId", "pipelineId", "datasetId", "groupId", "copyJobId", "sparkJobDefinitionId"):
            v = node.get(key)
            if isinstance(v, str) and PLACEHOLDER_VALUE_RE.match(v):
                rep.warn(f"{path}.{key}: placeholder {v!r}; replace with the real GUID (or an Expression / library variable) before deploying")
            elif isinstance(v, str) and v and not GUID_RE.match(v) and not v.startswith("@"):
                rep.err(f"{path}.{key}: expected a GUID or an Expression object (got {v!r})")
        for k, v in node.items():
            if k in ("activities", "ifTrueActivities", "ifFalseActivities", "defaultActivities", "cases"):
                continue  # nested activities are validated on their own
            _check_connections(v, f"{path}.{k}", rep, _depth + 1)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _check_connections(v, f"{path}[{i}]", rep, _depth + 1)


def _scan_expressions(node: Any, path: str, rep: Report) -> None:
    """Flag '@...' strings not wrapped as Expression objects, and over-long expressions."""
    if isinstance(node, dict):
        if _is_expr(node):
            if len(node["value"]) > 8192:
                rep.err(f"{path}: expression longer than 8192 characters")
            return
        for k, v in node.items():
            if isinstance(v, str) and v.startswith("@") and not v.startswith("@@") and not v.startswith("@{") and k not in ("Body", "body", "messageBody", "text", "content"):
                rep.warn(f"{path}.{k}: value starts with '@' but is a plain string; wrap it as {{\"value\": \"...\", \"type\": \"Expression\"}} to be evaluated")
            _scan_expressions(v, f"{path}.{k}", rep)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _scan_expressions(v, f"{path}[{i}]", rep)


def validate(doc: Any) -> Report:
    rep = Report()
    if not isinstance(doc, dict):
        rep.err("top level must be a JSON object"); return rep
    props = doc.get("properties")
    if props is None and "activities" in doc:
        rep.warn("top level has no 'properties' wrapper; wrap the document as {\"properties\": {...}} before sending")
        props = doc
    if not isinstance(props, dict):
        rep.err("'properties' object is required"); return rep
    extra = set(doc) - {"properties", "name"}
    if extra:
        rep.warn(f"unexpected top-level keys {sorted(extra)} (only 'properties' is used)")
    for sysk in ("lastModifiedByObjectId", "lastPublishTime"):
        if sysk in props:
            rep.warn(f"properties.{sysk} is system-generated; drop it before create/updateDefinition")
    params = props.get("parameters", {}) or {}
    if not isinstance(params, dict):
        rep.err("properties.parameters must be an object")
    else:
        if len(params) > 50:
            rep.err(f"{len(params)} parameters; max is 50")
        for pn, pd in params.items():
            if not isinstance(pd, dict) or str(pd.get("type", "")).lower() not in PARAM_TYPES:
                rep.err(f"parameter '{pn}': type must be one of {sorted(PARAM_TYPES)}")
    variables = props.get("variables", {}) or {}
    declared_vars: Dict[str, str] = {}
    if not isinstance(variables, dict):
        rep.err("properties.variables must be an object")
    else:
        for vn, vd in variables.items():
            vt = str((vd or {}).get("type", "")) if isinstance(vd, dict) else ""
            if vt.lower() not in VAR_TYPES:
                rep.err(f"variable '{vn}': type must be one of String|Boolean|Array|Integer")
            declared_vars[vn] = vt
    acts = props.get("activities")
    if not isinstance(acts, list):
        rep.err("properties.activities must be a list"); return rep
    if not acts:
        rep.warn("pipeline has no activities")
    counter = [0]
    _walk_activities(acts, "activities", rep, {}, (), counter, declared_vars)
    if counter[0] > 120:
        rep.err(f"{counter[0]} activities including nested ones; max is 120")
    lib = props.get("libraryVariables")
    if lib is not None and not isinstance(lib, dict):
        rep.err("properties.libraryVariables must be an object")
    return rep


# --------------------------------------------------------------------------- refs
def collect_refs(doc: dict) -> Dict[str, List[dict]]:
    """Environment-bound GUIDs a CI/CD process must rewrite: connections, workspace/artifact ids, notebook/dataflow/dataset ids."""
    out: Dict[str, List[dict]] = {"connections": [], "linkedServices": [], "items": [], "libraryVariables": []}
    props = doc.get("properties", doc)

    def walk(node: Any, act: Optional[str], path: str) -> None:
        if isinstance(node, dict):
            if "name" in node and "type" in node and "typeProperties" in node:
                act = node["name"]  # entering an activity
            if "externalReferences" in node and isinstance(node["externalReferences"], dict):
                out["connections"].append({"activity": act, "path": path + ".externalReferences.connection", "value": node["externalReferences"].get("connection")})
            if node.get("type") in ("Lakehouse", "DataWarehouse", "KustoDatabase") and isinstance(node.get("typeProperties"), dict):
                tpp = node["typeProperties"]
                out["linkedServices"].append({"activity": act, "path": path, "kind": node["type"], "workspaceId": tpp.get("workspaceId"),
                                              "artifactId": tpp.get("artifactId"), "endpoint": tpp.get("endpoint"), "rootFolder": tpp.get("rootFolder")})
            for key in ("notebookId", "dataflowId", "pipelineId", "datasetId", "groupId", "copyJobId", "sparkJobDefinitionId", "functionSetId", "environmentId"):
                if key in node:
                    out["items"].append({"activity": act, "path": f"{path}.{key}", "key": key, "value": node[key], "workspaceId": node.get("workspaceId")})
            for k, v in node.items():
                walk(v, act, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, act, f"{path}[{i}]")

    walk(props.get("activities", []), None, "$.properties.activities")
    for alias, spec in (props.get("libraryVariables") or {}).items():
        out["libraryVariables"].append({"alias": alias, **(spec if isinstance(spec, dict) else {})})
    return out


# --------------------------------------------------------------------------- export conversion
PLACEHOLDER_RE = re.compile(r"^\[parameters\('(.+)'\)\]$")


def from_export(template: dict, mapping: Dict[str, str], rep: Report) -> dict:
    resources = template.get("resources") or []
    if not resources or "properties" not in resources[0]:
        raise SystemExit("not a Fabric pipeline export: expected resources[0].properties")
    props = json.loads(json.dumps(resources[0]["properties"]))  # deep copy
    for k in ("lastModifiedByObjectId", "lastPublishTime"):
        props.pop(k, None)
    missing: set = set()

    def subst(node: Any) -> Any:
        if isinstance(node, str):
            m = PLACEHOLDER_RE.match(node)
            if m:
                key = m.group(1)
                if key in mapping:
                    return mapping[key]
                missing.add(key)
            return node
        if isinstance(node, dict):
            return {k: subst(v) for k, v in node.items()}
        if isinstance(node, list):
            return [subst(v) for v in node]
        return node

    props = subst(props)
    for key in sorted(missing):
        rep.warn(f"unresolved placeholder [parameters('{key}')] - pass --map \"{key}=<guid>\"")
    return {"properties": props}


# --------------------------------------------------------------------------- CLI
def _load(path: str) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("validate"); p.add_argument("file")
    p = sub.add_parser("refs"); p.add_argument("file")
    p = sub.add_parser("from-export"); p.add_argument("file"); p.add_argument("--map", action="append", default=[]); p.add_argument("--out")
    p = sub.add_parser("encode"); p.add_argument("file")
    p = sub.add_parser("decode"); p.add_argument("source", help="base64 string, or path to a getDefinition response JSON"); p.add_argument("--part", default="pipeline-content.json")
    a = ap.parse_args(argv)

    if a.cmd == "validate":
        rep = validate(_load(a.file))
        for w in rep.warnings:
            print(f"WARN  {w}")
        for e in rep.errors:
            print(f"ERROR {e}")
        print(f"{len(rep.errors)} error(s), {len(rep.warnings)} warning(s)")
        return 1 if rep.errors else 0
    if a.cmd == "refs":
        print(json.dumps(collect_refs(_load(a.file)), indent=2)); return 0
    if a.cmd == "from-export":
        rep = Report()
        mapping = dict(m.split("=", 1) for m in a.map)
        content = from_export(_load(a.file), mapping, rep)
        for w in rep.warnings:
            print(f"WARN  {w}", file=sys.stderr)
        text = json.dumps(content, indent=2)
        if a.out:
            with open(a.out, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"wrote {a.out}", file=sys.stderr)
        else:
            print(text)
        return 0
    if a.cmd == "encode":
        print(base64.b64encode(json.dumps(_load(a.file)).encode("utf-8")).decode("ascii")); return 0
    if a.cmd == "decode":
        src = a.source
        try:
            doc = _load(src)
            parts = doc.get("definition", doc).get("parts", [])
            part = next((pp for pp in parts if pp.get("path") == a.part), None)
            if part is None:
                raise SystemExit(f"part {a.part} not found; available: {[pp.get('path') for pp in parts]}")
            payload = part["payload"]
        except (OSError, ValueError):
            payload = src
        print(json.dumps(json.loads(base64.b64decode(payload)), indent=2)); return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
