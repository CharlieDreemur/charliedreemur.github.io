---
title: "GUIAgentDebugger"
excerpt: "Self-evolving VLM-agent debugging framework with a GUI-agent error taxonomy and dual-layer memory."
collection: portfolio
permalink: /projects/gui-agent-debugger/
date: 2026-01-01
paperurl: "https://arxiv.org/abs/2608.02643"
showcase_group: agent-systems
badge: "First Author · Lead"
date_label: "Jan 2026 – Present"
tags:
  - "Computer-Use Agents"
  - "Self-Evolution"
  - "VLM"
  - "Agent Memory"
---

GUIAgentDebugger is a self-evolving VLM-agent debugging framework for diagnosing GUI-agent failures and improving future rollouts.

Key contributions include:

- Designed a GUI-agent error taxonomy with 4 major categories and 29 subtypes.
- Covered perception, interaction localization, task reasoning, and external system failures across mainstream OSWorld/CUA scenarios.
- Built a framework that identifies root causes from failed trajectories, distills them into reusable debugging skills, and lets agents learn from historical failures.
- Designed a dual-layer memory architecture with episodic and semantic memory.
- Added intent-aware RAG retrieval to inject skills from similar-intent trajectories and improve diagnosis and re-rollout accuracy.
