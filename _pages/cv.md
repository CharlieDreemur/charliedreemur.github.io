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

- Research Scientist Intern, Multimodal LLMs/Agents, TikTok, Jun 2026 - Present
  - Designed a self-evolving content-moderation agent framework centered on a ReAct agent that autonomously analyzes individual videos using specialized tools for frame sampling, ASR/OCR, metadata extraction, originality scoring, and watermark/celebrity detection; integrated multimodal evidence with policy-grounded reasoning to produce structured moderation decisions.
  - Built a self-evolution loop where a Reflector aggregates Solver failures into root-cause attribution reports and an Evolver adds, revises, or merges case-relevant skills to refine the Solver, improving the overall F1 score by 15.5%.

- Research Scientist Intern, Microsoft, Jul 2025 - Sep 2025
  - Conducted LLM research for Microsoft 365 Excel Copilot, focusing on spreadsheet text analysis and Office.js code generation.
  - Developed the TextAnalysisSFT data pipeline for Excel Copilot's TextAnalysis API: mined 2,000+ real-world examples from Kaggle, filtered text-heavy spreadsheets, generated user queries and Office.js programs, and validated executions with SheetEngine.
  - The resulting dataset improved Office Scripts code-generation accuracy by 15%.

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

- SeeingEye, Co-first Author / Researcher, Oct 2025 - Present
  - Proposed an agentic information-flow framework that enables text-only LLMs to perform multimodal reasoning through structured, tool-mediated textual context.
  - Designed the perception-to-reasoning pipeline for multimodal tasks while keeping the backbone model text-only.
  - Studied how tool use, intermediate representations, and memory-like context unlock multimodal reasoning behavior in text-only LLMs.
  - Released the work as an arXiv preprint, currently under review at EMNLP 2026.
  - Paper: [SeeingEye]({{ base_path }}/files/SeeingEye_Agentic_Information_Flow_Unlocks_Multimodal_Reasoning_in_Text_Only_LLMs.pdf)

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
