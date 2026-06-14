# Faculty Profile: Prof. Aviral Kumar — CMU CS + MLD

**Position:** Assistant Professor（joined Fall 2024）
**Institution:** Carnegie Mellon University, CS + Machine Learning Department (joint)
**Website:** https://aviralkumar2907.github.io/
**Report date:** 2026-06-12

---

## Research Focus
Reinforcement learning and decision-making, with emphasis on: offline RL, scaling up RL for foundation models, RL for LLM reasoning and agentic capabilities, self-correction in LLMs, robotic learning, foundation model decision-making.

## Academic Profile
- PhD: UC Berkeley (2023), advised by Sergey Levine
- AI2050 Early Career Fellow (Schmidt Sciences, 2025)
- Samsung AI Researcher of the Year Award (2024)
- Joined CMU September 2024 — lab still building

## Key Publications

| Paper | Venue | Relevance to Weijia |
|-------|-------|---------------------|
| **SCoRe**: Training LMs to Self-Correct via Reinforcement Learning | NeurIPS'24 | Multi-turn online RL for LLM self-correction using self-generated data — mirrors Weijia's step-level reward design in OpenManus-RL |
| **ArCHer**: Training LM Agents via Hierarchical Multi-Turn RL | ICML'24 | Hierarchical RL for multi-turn LLM agent — direct overlap with Weijia's ReAct-style reasoning + multi-agent workflow |
| Offline RL scaling → LLM reasoning | 2024–2025 | 6-8x compute efficiency, 8x data efficiency when applying offline RL techniques to LLM reasoning/agentic capabilities |
| Exploration with Foundation Models | arXiv 2025 | Foundation model + RL exploration for decision-making |

## Fit with Weijia Zhang

| Dimension | Assessment |
|-----------|-----------|
| RL post-training for LLM agents | ✅ Core strength — SCoRe, ArCHer are exactly this |
| Step-level reward / multi-turn RL | ✅ Direct overlap with OpenManus-RL reward design |
| Agentic AI | ✅ Multi-turn LLM agent training is his primary focus |
| Offline RL → foundation models | ✅ Scaling offline RL to LLM reasoning and agentic tasks |
| SFT data pipeline | ⚠️ Adjacent (his focus is RL, not SFT data curation) |
| GUI / VLM agents | ⚠️ Robotics-heavy, some VLM decision-making work |
| RAG / retrieval | ❌ Not his focus |

## Cold Email Strategy
- Reference: **OpenManus-RL** (step-level reward signals for agent planning) → maps to his SCoRe/ArCHer work
- Reference: **GUIAgentDebugger** (error taxonomy + self-evolving debug framework) → maps to self-correction capability research
- Reference: **MSRA TextAnalysisSFT** → shows data pipeline + evaluation engineering experience
- Mention: Interested in the intersection of offline RL and long-horizon LLM agent training

## Verdict
**P1 套磁**。Joined CMU Fall 2024, lab is still early-stage with PhD slots available. Research is the closest match to Weijia's OpenManus-RL and agentic AI work among all CMU faculty. RL+agents is his core identity, not a side project.
