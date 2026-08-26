---
title: "AgentDebugX"
excerpt: "The first comprehensive debugging framework for long-horizon agent trajectories, turning failed runs into auditable diagnoses, repairs, and verifiable reruns."
collection: portfolio
date: 2026-08-01
link: "https://www.agentdebugx.com/"
github: "https://github.com/AgentDebugX/AgentDebugX"
website: "https://www.agentdebugx.com/"
paperurl: "https://arxiv.org/abs/2607.18754"
stars: "100"
showcase_group: agent-systems
badge: "Project Lead"
date_label: "Aug 2026 – Present"
tags:
  - "Agent Debugging"
  - "Failure Attribution"
  - "Recovery"
  - "Validated Reruns"
---

AgentDebugX is a framework-agnostic debugging toolkit for LLM agents, multi-agent systems, tool-using agents, and computer-use agents. Its Detect → Attribute → Recover → Rerun loop turns agent execution traces into auditable root-cause diagnoses, repair suggestions, and verifiable reruns.

Key contributions include:

- Co-led the design and implementation of the framework across multi-agent, tool-using, and computer-use agent settings.
- Designed the core diagnostic agent DeepDebug, which localizes root causes over multiple rounds through global trajectory investigation. On the 184 Who&When trajectories it raises agent-and-step attribution accuracy from 21.7% to 28.8%, and on GAIA it repairs 13 of 73 failed tasks in a single round, lifting overall accuracy from 55.8% to 63.6%.
- Built open-source infrastructure spanning a Python library, CLI, computer-use support, agentic skills, and an Error Hub for unified trajectory ingestion, failure reuse, and regression validation.
- Supported LangGraph, CrewAI, OpenAI Agents SDK, OpenTelemetry, and OSWorld.
