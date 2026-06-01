---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

[Download Resume as PDF]({{ base_path }}/files/Weijia_Zhang_Resume.pdf){: .btn .btn--primary}

Education
======

- M.S. in Computer Science, Yale University, Aug 2026 - May 2028
  - Thesis Track with Full Scholarship
  - Incoming student

- B.S. in Computer Science and Mathematics, University of Illinois Urbana-Champaign, Aug 2022 - May 2026
  - GPA: 3.7/4.0
  - 2026 C.W. Gear Outstanding Undergraduate Student, one of two annual recipients
  - 2025 Dean's List

Work Experience
======

- Research Intern, Microsoft Research Asia, Microsoft, Jul 2025 - Sep 2025
  - Worked on VLM/LLM agent research to improve Microsoft Excel Copilot capabilities.
  - Built the TextAnalysisSFT data pipeline for SFT data generation for the new TextAnalysis API in Excel Copilot.
  - Mined 2000+ real Kaggle samples, filtered heavy-text sheets, generated queries and Office.js code, and validated outputs with SheetEngine.
  - Delivered a dataset that improved Office Script code-generation accuracy by 75%.

- AI Engineer, Reborn Network, May 2023 - Jul 2023
  - Developed a role-playing agent Unity VR game enabling agents to interact through text, voice, and VR actions in real time with under 1s latency.
  - Introduced RAG and vector databases to strengthen long-term agent memory, improving dialogue coherence score from 2/5 to 4/5.
  - Designed a reusable character-card framework, enabling a UGC ecosystem and reducing character persona configuration time by 300%.

- Software Engineer, WeChat Group, Tencent, Aug 2024 - Sep 2024
  - Developed a cross-platform Android and iOS hardware performance analysis tool for WeChat Mini Programs, supporting 200+ partner teams in identifying performance bottlenecks.
  - Built a Unity Mono Memory Profiler that discovered 40+ hidden memory allocation points, reducing memory-leak-related crash rate by 120%.

Publications
======

<ul>{% for post in site.publications reversed %}
  {% include archive-single-cv.html %}
{% endfor %}</ul>

Project Experience
======

- OpenManus & OpenManus-RL, Researcher, Jan 2025 - Jul 2025
  - Collaborated with the official OpenManus team as a core contributor to OpenManus-RL, the follow-up project of OpenManus.
  - The open-source ecosystem has accumulated 60,000+ GitHub stars.
  - Implemented a ReAct-style reasoning architecture and multi-agent collaboration workflows.
  - Built an MCP-based tool-library framework for automated tool invocation and output processing.
  - Constructed high-quality SFT datasets for agent benchmarks including AlfWorld and WebShop.
  - Designed step-level reward signals to improve agent planning and memory capabilities.

- GUIAgentDebugger, First Author / Lead, Jan 2026 - Present
  - Designed a GUI-agent error taxonomy with 4 major categories and 29 subtypes across perception, interaction localization, task reasoning, and external system failures.
  - Built a self-evolving VLM-agent debugging framework that identifies root causes from failed trajectories, distills them into reusable debugging skills, and enables agents to learn from historical failures.
  - Designed a dual-layer memory architecture with episodic and semantic memory, plus intent-aware RAG retrieval for similar-intent trajectory skills.

Activities and Awards
======

- May 2026: C.W. Gear Outstanding Undergraduate Student, one of two annual recipients
- 2025: UIUC Dean's List
- Aug 2025: RecSys 2025 Reviewer
- Sep 2022: UIUC MechMania 28 AI Hackathon, 2nd Place

Skills
======

- Programming languages: Python, C/C++, C#, Java, JavaScript/TypeScript, HTML/CSS, SQL, Rust
- Frameworks and libraries: VERL, VLLM, LangGraph, LangChain, PyTorch, TensorFlow
- AI focus: SFT, reinforcement learning, post-training, RAG, agentic AI, machine learning, generative AI
