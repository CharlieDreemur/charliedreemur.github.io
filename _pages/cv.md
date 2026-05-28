---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

[Download CV as PDF]({{ base_path }}/files/weijia-zhang-cv.pdf){: .btn .btn--primary}

Education
======

- B.S. in Computer Science and Mathematics, University of Illinois Urbana-Champaign, 2022 - 2026
  - GPA: 3.86/4.0 (Dean's List)
  - Graduation date: May 2026

Research Experience
======

- Research Assistant, U Lab, University of Illinois Urbana-Champaign, Jan 2025 - Present
  - Advisor: Prof. Jiaxuan You
  - SeeingEye: Agentic Information Flow Unlocks Multimodal Reasoning in Text-only LLMs, first author and project lead
  - Designed an agentic information flow using a small VLM ReAct agent to translate VQA tasks into structured intermediate representations for text-only LLM reasoning.
  - Built SmartGridCaption, a visual chain-of-thought and iterative caption-and-patch module for task-specific evidence.
  - Implemented auditable tool selection with capability mask gates and loop termination logic.
  - OpenManus-RL: Better Memory Planning Agent in General Environments via Reinforcement Learning, researcher
  - Implemented ReAct reasoning architecture and multi-agent flow for action optimization.
  - Built an MCP-compatible tool framework for automated tool invocation and output processing.
  - Constructed SFT datasets compatible with AgentBench environments including Gaia, WebArena, WebShop, and AlfWorld.

- Research Intern, Microsoft Research Asia, Jul 2025 - Sep 2025
  - Researched LLM agents and multimodal systems for Microsoft Copilot in Excel.
  - Built TextAnalysisSFT, a multi-threaded pipeline for generating SFT data for the Excel Copilot TextAnalysis API, improving Office Script code-generation accuracy by 75%.

- Research Assistant, University of California, Santa Barbara, Sep 2023 - May 2024
  - Advisor: Prof. Misha Sra
  - Designed a multi-agent social simulation framework to model social contract formation.
  - Implemented persona encoding through prompt engineering and personalized QA sets.
  - Developed an agent economic system and AI policy generation framework.

Work Experience
======

- Programmer, The stu/dio at UIUC, Mar 2024 - May 2025
  - Advisor: Prof. Dan Cermak
  - Developed games in Unreal, Unity, and Godot, including VRchaeology, Resilient Community, and RPG.
  - Researched and implemented VR interaction mechanics and performance optimizations.

- Software Engineer, WeChat Group, Tencent, Aug 2024 - Sep 2024
  - Developed a cross-platform hardware profiler for WeChat Mini Programs across Android and iOS.
  - Built a Unity Mono memory profiler that surfaced hidden allocations and reduced leak-related crashes.

- Software Engineer, NetEase Games, Jul 2024 - Aug 2024
  - Developed a SQLite, Flask, and Vue asset database for multi-terabyte game art assets.
  - Implemented a multi-threaded, Redis-cached scanner that accelerated folder-to-database ingest.
  - Rendered interactive mesh-to-level dependency graphs for technical artists.

- LLM Software Engineer, Reborn Network, May 2023 - Jul 2023
  - Developed a multiplayer role-playing agents Unity VR game with text, voice, and embodied VR actions.
  - Introduced vector-database long-term memory with RAG for persistent agent-player interactions.
  - Created a shareable character-card framework for user-generated NPC setup.

Teaching
======

- Course Assistant, CS 233: Computer Architecture, University of Illinois Urbana-Champaign
  - Held office hours and one-on-one help sessions on pipelining, caching, memory hierarchy, and related topics.
  - Co-created homework puzzles and helped build and debug the Spimbot MIPS assembly competition.

- Exec and Workshop Lead, UIUC ACM Gamebuilders, Aug 2023 - Present
  - Led weekly workshops on game development topics including computer graphics, Blender, Unity, C#, game AI, and performance optimization.
  - Provided one-on-one technical mentoring on game design, implementation, and debugging.

Honors and Awards
======

- 2025: RecSys reviewer
- 2024: Dean's List, University of Illinois Urbana-Champaign
- 2023: Global Game Jam ranking 9th
- 2023: Ludum Dare ranking top 10%
- 2022: UIUC MechMania28 AI Hackathon 2nd place winner

Academic Interests
======

- AI and LLM agents: multimodal reasoning, vision-language models, reinforcement learning for agentic systems, multi-agent simulation, and social modeling
- Software engineering: game development, performance optimization, profiling, full-stack systems, and systems programming

Publications
======

<ul>{% for post in site.publications reversed %}
  {% include archive-single-cv.html %}
{% endfor %}</ul>

