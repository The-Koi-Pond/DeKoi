import contextlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
from types import SimpleNamespace


sys.dont_write_bytecode = True

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / ".github" / "bunny-review" / "bunny_review.py"


def load_bunny_review():
    spec = importlib.util.spec_from_file_location("bunny_review_under_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_git(root, *args):
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed:\n{result.stdout}{result.stderr}")
    return result.stdout


def write_packet_repo(root):
    (root / "AGENTS.md").write_text("# Agent Guidance\n\nUse changed-line findings.\n", encoding="utf-8")
    (root / "CONTRIBUTING.md").write_text("# Contributing\n\nUse changed-line findings.\n", encoding="utf-8")
    (root / "ARCHITECTURE.md").write_text("# Architecture\n\nKeep engine code portable.\n", encoding="utf-8")
    agent = root / ".github" / "agents" / "dekoi-workflow.md"
    agent.parent.mkdir(parents=True)
    agent.write_text("# Workflow\n\nUse focused proof.\n", encoding="utf-8")
    tool_dir = root / ".github" / "bunny-review"
    tool_dir.mkdir(parents=True)
    (tool_dir / "reviewer-prompt.md").write_text("prompt", encoding="utf-8")
    (tool_dir / "rules.json").write_text(
        json.dumps(
            {
                "path_instructions": [
                    {
                        "prefixes": ["src/"],
                        "guidance": ["skills/example/SKILL.md"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    skill = root / "skills" / "example" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("# Example\n\nSelected path guidance.\n", encoding="utf-8")

    src = root / "src"
    src.mkdir()
    (src / "example.ts").write_text("export const originalValue = 1;\n", encoding="utf-8")
    (src / "second.ts").write_text("export const secondOriginal = 1;\n", encoding="utf-8")
    run_git(root, "init", "-q")
    run_git(root, "config", "user.email", "bunny@example.invalid")
    run_git(root, "config", "user.name", "Bunny Proof")
    run_git(root, "add", ".")
    run_git(root, "commit", "-q", "-m", "base")
    (src / "example.ts").write_text("export const changedValue = 2;\n", encoding="utf-8")
    (src / "second.ts").write_text("export const secondChanged = 2;\n", encoding="utf-8")
    run_git(root, "add", ".")
    run_git(root, "commit", "-q", "-m", "head")
    return tool_dir


def section(packet, title):
    marker = f"## {title}\n"
    start = packet.index(marker) + len(marker)
    next_start = packet.find("\n\n## ", start)
    if next_start == -1:
        return packet[start:]
    return packet[start:next_start]


def run_packet_case(module):
    with tempfile.TemporaryDirectory(prefix="bunny-packet-proof-") as tmp:
        root = pathlib.Path(tmp)
        tool_dir = write_packet_repo(root)
        module.REPO_ROOT = root
        os.environ["BUNNY_REVIEW_PROMPT_PATH"] = str(tool_dir / "reviewer-prompt.md")

        packet = module.build_review_packet("HEAD~1", "", "full")
        overview = section(packet, "patch overview")
        per_file = section(packet, "per-file patch context")

        assert "Raw patch is not repeated here" in overview
        assert "diff --git" not in overview
        assert "changedValue" in per_file
        assert "guidance: AGENTS.md" in packet
        assert "guidance: CONTRIBUTING.md" in packet
        assert "guidance: ARCHITECTURE.md" in packet
        assert "guidance: .github/agents/dekoi-workflow.md" in packet
        assert "guidance: skills/example/SKILL.md" in packet
        changed = module.changed_files("HEAD~1")
        old_threshold = module.MAX_CHUNK_PATCH_CHARS
        try:
            module.MAX_CHUNK_PATCH_CHARS = 1
            raw_chunks = module.chunk_changed_files("HEAD~1", changed)
            _, planned_chunks = module.review_chunks_for_packet_budget("HEAD~1", "", "full", changed)
        finally:
            module.MAX_CHUNK_PATCH_CHARS = old_threshold
        assert len(raw_chunks) > 1, "forced raw patch chunking did not split the fixture"
        assert planned_chunks == [changed], "full packet under budget should not be chunked"
        review_obj = module.normalize_review_object(
            {"findings": [], "nitpicks": [], "pre_merge_checks": []},
            "HEAD~1",
            changed,
        )
        assert review_obj["change_summary"], "missing model summary should get a fallback"
        rendered = module.render_walkthrough(
            review_obj,
            [],
            [],
            [],
            "",
            "0" * 40,
        )
        assert "### 🧭 Loot Summary" in rendered
        assert "No loot summary produced" not in rendered
        assert "Specimen" not in rendered
        assert "### 🔎 Bad Machinery" in rendered
        return len(packet)


def run_semantic_repair_case(module):
    incomplete = {
        "findings": [],
        "nitpicks": [],
        "pre_merge_checks": [],
        "open_questions": [],
        "what_i_checked": [],
    }
    repaired = {
        "change_summary": [
            "Wah, the repair pass restored the missing summary so the review contract has real loot on the table."
        ],
        "findings": [],
        "nitpicks": [],
        "pre_merge_checks": [],
        "open_questions": [],
        "what_i_checked": [
            "Aha, Bunny checked the review packet and repaired the schema gap."
        ],
    }

    class FakeCompletions:
        def __init__(self):
            self.calls = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(
                usage=None,
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=json.dumps(repaired)
                        )
                    )
                ],
            )

    completions = FakeCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    stats = module.build_stats("packet")
    parsed = module.extract_json_or_repair(
        client,
        [{"role": "system", "content": "prompt"}, {"role": "user", "content": "packet"}],
        "FINAL_REVIEW\n" + json.dumps(incomplete),
        stats,
    )

    assert len(completions.calls) == 1, "semantic schema gap should trigger one repair call"
    assert completions.calls[0].get("response_format") == {"type": "json_object"}
    repair_prompt = completions.calls[0]["messages"][-1]["content"]
    assert "FINAL_REVIEW followed" not in repair_prompt
    assert "Do not include FINAL_REVIEW" in repair_prompt
    assert parsed["change_summary"] == repaired["change_summary"]
    assert parsed["_schema_repair_gaps"], "repair diagnostics should be retained"
    normalized = module.normalize_review_object(parsed, "HEAD~1", ["src/example.ts"])
    assert normalized["what_i_checked"][0].startswith("Bunny repaired the model review JSON")
    return stats["model_calls"]


def run_json_repair_format_case(module):
    repaired = {
        "change_summary": ["Wah, the no-JSON response got repaired into a proper review object."],
        "findings": [],
        "nitpicks": [],
        "pre_merge_checks": [],
        "open_questions": [],
        "what_i_checked": ["Bunny checked the no-JSON repair path."],
    }

    class FakeCompletions:
        def __init__(self):
            self.calls = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(
                usage=None,
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=json.dumps(repaired)
                        )
                    )
                ],
            )

    completions = FakeCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    stats = module.build_stats("packet")
    parsed = module.extract_json_or_repair(
        client,
        [{"role": "system", "content": "prompt"}, {"role": "user", "content": "packet"}],
        "No JSON here.",
        stats,
    )
    assert parsed["change_summary"] == repaired["change_summary"]
    assert completions.calls[0].get("response_format") == {"type": "json_object"}
    repair_prompt = completions.calls[0]["messages"][-1]["content"]
    assert "FINAL_REVIEW followed" not in repair_prompt
    assert "Do not include FINAL_REVIEW" in repair_prompt

    class RejectingCompletions:
        def __init__(self):
            self.calls = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            if "response_format" in kwargs:
                raise RuntimeError("unsupported parameter: response_format")
            return SimpleNamespace(
                usage=None,
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=json.dumps(repaired)
                        )
                    )
                ],
            )

    rejecting = RejectingCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=rejecting))
    parsed = module.extract_json_or_repair(
        client,
        [{"role": "system", "content": "prompt"}, {"role": "user", "content": "packet"}],
        "Still no JSON.",
        module.build_stats("packet"),
    )
    assert parsed["change_summary"] == repaired["change_summary"]
    assert len(rejecting.calls) == 2
    assert "response_format" in rejecting.calls[0]
    assert "response_format" not in rejecting.calls[1]


def run_model_key_case(module):
    old_llm = os.environ.get("LLM_API_KEY")
    old_openai = os.environ.get("OPENAI_API_KEY")
    old_base_url = os.environ.get("LLM_BASE_URL")
    try:
        os.environ["LLM_API_KEY"] = "provider-key"
        os.environ["LLM_BASE_URL"] = "https://provider.example/v1"
        os.environ.pop("OPENAI_API_KEY", None)
        assert module.model_api_key() == "provider-key"
        provider_configs = module.model_client_configs()
        assert len(provider_configs) == 1
        assert provider_configs[0]["api_key"] == "provider-key"
        assert provider_configs[0]["base_url"] == "https://provider.example/v1"
        assert provider_configs[0]["fallback_to_openai_direct"] is False

        os.environ.pop("LLM_API_KEY", None)
        os.environ["OPENAI_API_KEY"] = "openai-key"
        os.environ["LLM_BASE_URL"] = "https://stale.example/v1"
        assert module.model_api_key() == "openai-key"
        openai_configs = module.model_client_configs()
        assert len(openai_configs) == 2
        assert openai_configs[0]["base_url"] == "https://stale.example/v1"
        assert openai_configs[0]["fallback_to_openai_direct"] is True
        assert openai_configs[1]["base_url"] is None
        assert openai_configs[1]["fallback_to_openai_direct"] is False

        os.environ.pop("LLM_BASE_URL", None)
        direct_configs = module.model_client_configs()
        assert len(direct_configs) == 1
        assert direct_configs[0]["base_url"] is None
    finally:
        if old_llm is None:
            os.environ.pop("LLM_API_KEY", None)
        else:
            os.environ["LLM_API_KEY"] = old_llm
        if old_openai is None:
            os.environ.pop("OPENAI_API_KEY", None)
        else:
            os.environ["OPENAI_API_KEY"] = old_openai
        if old_base_url is None:
            os.environ.pop("LLM_BASE_URL", None)
        else:
            os.environ["LLM_BASE_URL"] = old_base_url


def run_failure_redaction_case(module):
    detail = module.model_failure_detail(
        RuntimeError(
            "Incorrect API key provided: sk-secretprefix***************************************secret."
        )
    )
    assert "sk-secretprefix" not in detail
    assert "secret." not in detail
    assert "[redacted-api-key]" in detail


def run_status_case(module):
    with tempfile.TemporaryDirectory(prefix="bunny-status-proof-") as tmp:
        root = pathlib.Path(tmp)
        review = root / "review.json"
        control = root / "bunny-ci-control.json"
        review.write_text(
            json.dumps({"findings": [], "pre_merge_checks": []}),
            encoding="utf-8",
        )
        control.write_text(
            json.dumps({"failed": [{"name": "DeKoi CI", "conclusion": "failure"}]}),
            encoding="utf-8",
        )
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            module.status_state(
                SimpleNamespace(
                    review_json=str(review),
                    ci_control=str(control),
                    draft="false",
                    job_status="success",
                )
        )
        text = output.getvalue()
        assert "state=success" in text
        assert "Required CI checks failed" not in text

        control.write_text(
            json.dumps({"failed": [], "missing": [], "pending": ["Frontend and Project Contracts"]}),
            encoding="utf-8",
        )
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            module.status_state(
                SimpleNamespace(
                    review_json=str(review),
                    ci_control=str(control),
                    draft="false",
                    job_status="success",
                )
            )
        text = output.getvalue()
        assert "state=success" in text
        assert "Required CI checks were pending or missing" not in text


def run_command_mode_case(module):
    old_body = os.environ.get("BUNNY_COMMENT_BODY")
    old_mode = os.environ.get("BUNNY_REVIEW_MODE")
    try:
        os.environ["BUNNY_COMMENT_BODY"] = "/bunny-review incremental"
        os.environ["BUNNY_REVIEW_MODE"] = "full"
        assert module.parse_command_mode() == "incremental"

        os.environ["BUNNY_COMMENT_BODY"] = "/bunny-review full"
        assert module.parse_command_mode() == "full"

        os.environ["BUNNY_COMMENT_BODY"] = "auto pull_request_target dispatch"
        os.environ["BUNNY_REVIEW_MODE"] = "auto"
        assert module.parse_command_mode() == "auto"
    finally:
        if old_body is None:
            os.environ.pop("BUNNY_COMMENT_BODY", None)
        else:
            os.environ["BUNNY_COMMENT_BODY"] = old_body
        if old_mode is None:
            os.environ.pop("BUNNY_REVIEW_MODE", None)
        else:
            os.environ["BUNNY_REVIEW_MODE"] = old_mode


def main():
    module = load_bunny_review()
    packet_len = run_packet_case(module)
    repair_calls = run_semantic_repair_case(module)
    run_json_repair_format_case(module)
    run_model_key_case(module)
    run_failure_redaction_case(module)
    run_status_case(module)
    run_command_mode_case(module)
    print(
        "bunny_review_smoke "
        f"packet_len={packet_len} "
        f"semantic_repair_calls={repair_calls} "
        "patch_overview_dedup=true "
        "packet_budget_chunking=true "
        "summary_fallback=true "
        "semantic_repair=true "
        "json_response_format=true "
        "no_json_repair=true "
        "response_format_fallback=true "
        "render_voice=true "
        "model_key_fallback=true "
        "model_base_url_fallback=true "
        "model_failure_redaction=true "
        "ci_control_status_ignored=true "
        "incremental_command_mode=true"
    )


if __name__ == "__main__":
    main()
