---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

[Download Resume as PDF](https://drive.google.com/uc?export=download&id=1F3CEzlgadXX5hf0Egj8PjEI5PkAKin7l){: .btn .btn--primary}

Education
======

- M.S. in Computer Science, Yale University, Sep 2026 - May 2028
  - Thesis Track with Full Scholarship
  - Incoming student

- B.S. in Computer Science and Mathematics, University of Illinois Urbana-Champaign, Aug 2022 - May 2026
  - GPA: 3.7/4.0
  - 2026 C.W. Gear Outstanding Undergraduate Student, one of two annual recipients
  - 2025 Dean's List

Work Experience
======

- Machine Learning Engineer Intern, RSI / Self-Evolving Agents, TikTok, Jun 2026 - Present
  - As project lead, designed and shipped TikTok's agent self-evolution framework from 0 to 1 with a closed Solver-Reflector-Evolver loop: the Solver executes tasks, the Reflector attributes failures, and the Evolver iterates reusable skills. Lifted F1 from 62.7% to 81.3% on unoriginal-video detection (9,600 real short videos) and from 76.5% to 87.3% on reposting-account detection (200 accounts).
  - Designed a transferable Online Failure Discovery process: the Reflector mines failure patterns directly from scenarios and Solver agent traces, continuously updates a two-level "scenario to agent failure mode" taxonomy, and distills high-value error clusters into reusable skills, so the same framework self-evolves across scenarios without any human-predefined error types.
  - Trained a video-understanding model: built an account-level SFT dataset of 74K accounts and 1.33M videos, ran distributed full-parameter SFT of Qwen3-VL 2B/4B/8B on 32 H100s with DeepSpeed, and performed cross-domain evaluation and threshold calibration over 53 checkpoints. The final 4B model cut false positives by 42.8% (318 to 182) against the 8B baseline at ~70% recall.

- Research Intern, Large Language Models, Microsoft, Jul 2025 - Sep 2025
  - Built the Excel Coding Agent data engine producing execution-verified SFT/RL data for Excel Copilot's code agent: mined 20,000+ real-world workbooks, back-translated user queries from spreadsheet context, sampled multi-turn Office.js rollouts (write, execute, repair), and used SheetEngine final-state assertions as a programmatic verifier to filter incorrect and reward-hacking solutions.
  - Post-trained the coding agent on this corpus with rejection-sampling SFT and RL over same-task pass/fail rollouts under execution-based reward, improving Office Scripts pass@1 by 15% against the production baseline on a held-out set.

- AI Agent Engineer, Reborn Network, May 2023 - Jul 2023
  - Built an embodied role-playing agent in a Unity VR environment, closing a real-time perception-dialogue-action loop across text, voice, and full-body VR actions at sub-second end-to-end latency.
  - Introduced RAG/vector databases and dual-level (episodic + semantic) memory, improving cross-session recall accuracy from 38% to 61% on an internal multi-session dialogue eval.

Publications
======

<span{% if site.google_scholar_stats_url %} data-scholar-citations data-scholar-url="{{ site.google_scholar_stats_url }}"{% endif %}>200+</span> citations on [Google Scholar](https://scholar.google.com/citations?user={{ site.google_scholar_id }}).

<ul>{% for post in site.publications reversed %}
  {% include archive-single-cv.html %}
{% endfor %}</ul>

Project Experience
======

- OpenManus & OpenManus-RL, Core Author, Jan 2025 - Jul 2025
  - Collaborated with the official OpenManus team as a core contributor to OpenManus-RL, a verl-based agent RL post-training framework; the ecosystem has accumulated 70,000+ GitHub stars.
  - Connected SFT, RL (PPO/GRPO), interactive environments, and trajectory rollout into one unified pipeline to train ReAct agents and tool use on long-horizon tasks such as GAIA, WebShop, and ALFWorld.
  - Unified multi-turn environment interaction, tool actions, validation, and reward under a single ReAct trajectory protocol, and released a dataset of ~49K high-quality agent trajectories spanning OS, Web, Database, Knowledge Graph, Household, and E-commerce scenarios.

- AgentDebugX, Project Lead, Aug 2026 - Present
  - As co-lead, designed and implemented AgentDebugX, the first comprehensive debugging framework for long-horizon agent trajectories; its Detect-Attribute-Recover-Rerun loop turns LLM agent execution traces into auditable root-cause diagnoses, repair suggestions, and verifiable reruns across multi-agent, tool-using, and computer-use agents.
  - Designed the core diagnostic agent DeepDebug, which localizes root causes over multiple rounds via global trajectory investigation; on the 184 Who&When trajectories it raises agent-and-step attribution accuracy from 21.7% to 28.8%, and on GAIA it repairs 13/73 failed tasks in a single round, lifting overall accuracy from 55.8% to 63.6%.
  - Built an open-source infrastructure spanning a Python library, CLI, computer-use support, agentic skills, and an Error Hub, providing unified trajectory ingestion, failure reuse, and regression validation for LangGraph, CrewAI, OpenAI Agents SDK, OpenTelemetry, and OSWorld.

- SeeingEye, Co-first Author / Researcher, Oct 2025 - Present
  - Proposed an agentic information-flow framework that enables text-only LLMs to perform multimodal reasoning through structured, tool-mediated textual context.
  - Designed the perception-to-reasoning pipeline for multimodal tasks while keeping the backbone model text-only.
  - Studied how tool use, intermediate representations, and memory-like context unlock multimodal reasoning behavior in text-only LLMs.
  - Released the work as an arXiv preprint, currently under review at AAAI 2026.
  - Paper: [SeeingEye]({{ base_path }}/files/SeeingEye_Agentic_Information_Flow_Unlocks_Multimodal_Reasoning_in_Text_Only_LLMs.pdf)

Activities and Awards
======

- May 2026: C.W. Gear Outstanding Undergraduate Student, one of two annual recipients
- 2025: UIUC Dean's List
- Aug 2025: RecSys 2025 Reviewer
- Sep 2022: UIUC MechMania 28 AI Hackathon, 2nd Place

Skills
======

- Programming languages: Python, C/C++, C#
- Frameworks and libraries: VERL, vLLM, LangGraph, LangChain, PyTorch, TensorFlow
- AI focus: RL/post-training, LLM agents, multimodal reasoning, self-evolving agents, SFT, RAG, evaluation
