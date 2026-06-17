# Weijia Zhang Resume Materials Audit

## Fit Verdict

Strong fit for LLM agent / multimodal reasoning / AI research internship roles.

Evidence in `files/` strongly supports a profile around LLM agents, multimodal reasoning, CUA debugging, benchmark/evaluation design, SFT/RL data construction, and multi-agent systems. The main risk is that several industry metrics in the original resume are not backed by files in this folder, so the polished resume keeps them either conservative or clearly framed as internal validation.

## Papers Fully Read

- `SeeingEye_Agentic_Information_Flow_Unlocks_Multimodal_Reasoning_in_Text_Only_LLMs.pdf` - 18 pages.
- `How_Much_Vision_Does_Multimodal_Reasoning_Need.pdf` - 25 pages.
- `Every_Act_Has_Its_Price.pdf` - 15 pages.
- `CUADebug_Diagnosing_and_Repairing_Computer_Use_Agent_Failures.pdf` - 23 pages.
- `12843_COGENT_Multiagent_Large_.pdf` - 14 pages.

## Strong Evidence Used In Resume

| Resume claim | Evidence | Status |
| --- | --- | --- |
| CUADebug taxonomy has 4 top-level modules and 29 subtypes | CUADebug paper, Table 1 and Appendix A.6 | Can write |
| CUAErrorBench has 184 human-annotated OSWorld failure trajectories | CUADebug abstract, Section 2, Appendix A.4 | Can write |
| CUADebugger uses paired before/after screenshot inspection and structured RCA submission | CUADebug Section 3.1 and Appendix A.1 | Can write |
| Continual re-rollout improves from 12.20% direct continuation to 25.86%, human RCA 29.21% | CUADebug Table 4 | Can write |
| SeeingEye uses translator/reasoner split, SIR, and multi-round feedback | SeeingEye Sections 3-5 and Appendix A | Can write |
| Vision-Stripping Test profiles P0/T0/T1/V1/V2/VST-Full evidence paths | Vision-Stripping Sections 3-5 | Can write |
| Moral Composition uses two-stage blind ELO benchmark and 29,134 judgments | Every Act Sections 3-4 | Can write |

## Conservative Or Downgraded Claims

| Original claim | Issue | Polished handling |
| --- | --- | --- |
| Publications (100+ citation) | Citation count is not verifiable from local files and changes over time. | Removed count; used `Selected Publications`. |
| Tencent crash rate reduced by 120% | Percentage reduction beyond 100% is mathematically risky without a defined metric. | Rewritten as profiler/allocation tracing supporting crash investigation. |
| Character persona configuration time reduced by 300% | Wording is unclear; "reduced by 300%" is not a stable phrasing. | Rewritten as setup effort cut by roughly 3x. |
| Microsoft 75% Office Script accuracy improvement | Strong but not backed by paper/local logs. | Kept with "internal validation reported" wording; add evidence if available. |
| COGENT publication | PDF is anonymized and does not show authorship. | Not added to publication list without explicit confirmation. |

## Evidence To Add Later

- Internal Microsoft evaluation table or note for the 75% Office Script code-generation improvement.
- Reborn experiment rubric or screenshots/logs for the 2/5 to 4/5 dialogue-coherence claim and sub-second latency.
- Tencent profiler report or bug/crash dashboard for 40+ allocation sites and memory-leak impact.
- Authorship confirmation for COGENT if it should be added as a publication or project.
- Verified Google Scholar citation count if the `100+ citations` header should be restored.
