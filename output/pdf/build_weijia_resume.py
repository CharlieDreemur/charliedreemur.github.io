from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfgen import canvas


OUT = Path("output/pdf/Weijia_Zhang_Resume_polished.pdf")
PAGE_W, PAGE_H = letter
LEFT = RIGHT = 0.28 * inch
TOP = 0.24 * inch
BOTTOM = 0.23 * inch
WIDTH = PAGE_W - LEFT - RIGHT


def esc(text: str) -> str:
    return escape(text, {"'": "&apos;", '"': "&quot;"})


def link(label: str, href: str) -> str:
    return f'<link href="{esc(href)}"><u>{esc(label)}</u></link>'


def bold(text: str) -> str:
    return f"<b>{esc(text)}</b>"


def italic(text: str) -> str:
    return f"<i>{esc(text)}</i>"


styles = {
    "contact": ParagraphStyle(
        "contact",
        fontName="Times-Roman",
        fontSize=8.4,
        leading=9.3,
        alignment=1,
        textColor=colors.black,
    ),
    "section": ParagraphStyle(
        "section",
        fontName="Times-Roman",
        fontSize=12.0,
        leading=12.0,
        spaceAfter=0,
        textColor=colors.black,
    ),
    "entry": ParagraphStyle(
        "entry",
        fontName="Times-Roman",
        fontSize=9.1,
        leading=9.8,
        textColor=colors.black,
    ),
    "entry_bold": ParagraphStyle(
        "entry_bold",
        fontName="Times-Bold",
        fontSize=9.1,
        leading=9.8,
        textColor=colors.black,
    ),
    "body": ParagraphStyle(
        "body",
        fontName="Times-Roman",
        fontSize=8.0,
        leading=8.8,
        textColor=colors.black,
    ),
    "body_bullet": ParagraphStyle(
        "body_bullet",
        fontName="Times-Roman",
        fontSize=8.0,
        leading=8.8,
        leftIndent=12,
        firstLineIndent=-7,
        textColor=colors.black,
    ),
    "small": ParagraphStyle(
        "small",
        fontName="Times-Roman",
        fontSize=7.65,
        leading=8.35,
        textColor=colors.black,
    ),
    "small_bullet": ParagraphStyle(
        "small_bullet",
        fontName="Times-Roman",
        fontSize=7.55,
        leading=8.2,
        leftIndent=11,
        firstLineIndent=-7,
        textColor=colors.black,
    ),
}


@dataclass
class Entry:
    title: str
    date: str
    subtitle: str | None = None
    bullets: list[str] | None = None


def draw_para(c: canvas.Canvas, text: str, y: float, width: float = WIDTH, style_name: str = "body") -> float:
    para = Paragraph(text, styles[style_name])
    _, h = para.wrap(width, y - BOTTOM)
    para.drawOn(c, LEFT, y - h)
    return y - h


def draw_table(c: canvas.Canvas, row: list[str], y: float, col_widths: list[float], style_name: str = "entry") -> float:
    data = [[Paragraph(cell, styles[style_name]) for cell in row]]
    table = Table(data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    _, h = table.wrap(WIDTH, y - BOTTOM)
    table.drawOn(c, LEFT, y - h)
    return y - h


def section(c: canvas.Canvas, title: str, y: float) -> float:
    y -= 3.0
    c.setFont("Times-Roman", 12.0)
    c.drawString(LEFT, y - 10.0, title.upper())
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.45)
    c.line(LEFT, y - 12.5, PAGE_W - RIGHT, y - 12.5)
    return y - 16.0


def entry(c: canvas.Canvas, e: Entry, y: float, bullet_style: str = "body_bullet") -> float:
    y = draw_table(c, [bold(e.title), esc(e.date)], y, [WIDTH * 0.72, WIDTH * 0.28], "entry")
    if e.subtitle:
        y = draw_para(c, italic(e.subtitle), y, WIDTH, "small") - 0.3
    for bullet in e.bullets or []:
        y = draw_para(c, "- " + bullet, y, WIDTH - 8, bullet_style) - 0.15
    return y - 1.0


def make_resume() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Weijia Zhang Resume - Polished")
    y = PAGE_H - TOP

    c.setFont("Times-Bold", 24)
    name = "Weijia Zhang"
    c.drawCentredString(PAGE_W / 2, y - 18, name)
    y -= 30
    contact = "2172003915 | zhangwj.charlie@gmail.com | "
    contact += link("linkedin.com/in/weijia-charlie-zhang", "https://www.linkedin.com/in/weijia-charlie-zhang/")
    contact += " | "
    contact += link("charliedreemur.github.io", "https://charliedreemur.github.io")
    contact += " | "
    contact += link("Google Scholar", "https://scholar.google.com/citations?user=JN57tLsAAAAJ&hl=en")
    y = draw_para(c, contact, y, WIDTH, "contact") - 4

    y = section(c, "Education", y)
    education = [
        Entry(
            "Yale University",
            "Aug 2026 - May 2028",
            "M.S. in Computer Science, Thesis Track with Full Scholarship | Incoming Student",
        ),
        Entry(
            "University of Illinois Urbana-Champaign (UIUC)",
            "Aug 2022 - May 2026",
            "B.S. in Computer Science and Mathematics | GPA: 3.7/4.0; Dean's List 2025",
        ),
    ]
    for e in education:
        y = entry(c, e, y)

    y = section(c, "Work Experience", y)
    work = [
        Entry(
            "Microsoft Research Asia (MSRA)",
            "July 2025 - Sep 2025",
            "Research Intern",
            [
                "Conducted VLM/LLM agent research for Excel Copilot, focusing on spreadsheet text-analysis workflows and Office.js code generation for the TextAnalysis API.",
                "Built a TextAnalysisSFT data-generation pipeline: mined 2,000+ Kaggle spreadsheet samples, filtered heavy-text sheets, generated query/Office.js pairs, and validated outputs with SheetEngine; internal validation reported a 75% relative improvement in Office Script code-generation accuracy.",
            ],
        ),
        Entry(
            "Reborn Network",
            "May 2023 - July 2023",
            "AI Engineer",
            [
                "Developed a Unity VR role-playing agent game with real-time text, voice, and VR-action interaction under a sub-second latency target.",
                "Added RAG/vector-store memory for persistent character context, improving human-rated dialogue coherence from 2/5 to 4/5.",
                "Designed a reusable character-card schema for UGC personas, cutting persona setup effort by roughly 3x.",
            ],
        ),
        Entry(
            "Tencent, WeChat Group",
            "Aug 2024 - Sep 2024",
            "Software Engineer",
            [
                "Built a cross-platform Android/iOS performance analysis tool for WeChat Mini Programs, helping 200+ partner teams diagnose hardware bottlenecks.",
                "Implemented a Unity Mono memory profiler and allocation tracing workflow; identified 40+ hidden allocation sites and supported memory-leak crash investigation.",
            ],
        ),
    ]
    for e in work:
        y = entry(c, e, y)

    y = section(c, "Selected Publications", y)
    pubs = [
        f"{bold('Weijia Zhang')}, Zijia Liu, Tianyi Zhang, Ruiqi Chen, Lian Zhang, Haoru Li, Haoqi Chen, Jiaxuan You. \"How Much Vision Does Multimodal Reasoning Need? Vision-Stripping for Multimodal Benchmarks.\" Under review at NeurIPS 2026.",
        f"{bold('Weijia Zhang')}, Ruiqi Chen, Yunze Xiao, Weihao Xuan. \"Every Act Has Its Price: Compressed Moral Composition in Frontier LLMs.\" Under review at EMNLP 2026.",
        f"{bold('Weijia Zhang')}*, Zijia Liu*, Haoru Li*, Haoqi Chen*, Jiaxuan You. \"SeeingEye: Agentic Information Flow Unlocks Multimodal Reasoning in Text-only LLMs.\" arXiv preprint, under review at EMNLP 2026.",
        f"Gordon Dai*, {bold('Weijia Zhang')}*, Jinhan Li, Siqi Yang, Srihas Rao, Arthur Caetano, Misha Sra. \"Artificial Leviathan: Exploring Social Evolution of LLM Agents Through the Lens of Hobbesian Social Contract Theory.\" AI Behavioral Science Workshop, ACM SIGKDD 2024.",
        f"Miaomiao Li, Hao Chen, Yang Wang, Tingyuan Zhu, {bold('Weijia Zhang')}, Kaijie Zhu, Kam-Fai Wong, Jindong Wang. \"Understanding and Mitigating the Bias Inheritance in LLM-based Data Augmentation on Downstream Tasks.\" ACL 2026 Oral.",
        f"Kunlun Zhu, Zijia Liu, Bingxuan Li, Muxin Tian, Yingxuan Yang, Jiaxun Zhang, Pengrui Han, Qipeng Xie, Fuyang Cui, {bold('Weijia Zhang')}, et al. \"Where LLM Agents Fail and How They Can Learn From Failures.\" arXiv preprint.",
    ]
    for p in pubs:
        y = draw_para(c, "- " + p, y, WIDTH - 6, "small_bullet") - 0.15
    y -= 1

    y = section(c, "Research Projects", y)
    projects = [
        Entry(
            "CUADebug / GUIAgentDebugger",
            "Jan 2026 - Present",
            "First Author / Lead",
            [
                "Designed a CUA root-cause taxonomy with 4 top-level modules and 29 subtypes covering perception, grounding/interaction, reasoning/control, and external/system failures.",
                "Built CUAErrorBench from 184 human-annotated OSWorld failure trajectories across Claude, Gemini, and Qwen agents, with labels for root step, subtype, evidence, correction, and confidence.",
                "Developed a tool-augmented RCA debugger that inspects paired before/after screenshots, action traces, and execution status, then submits structured root-cause evidence and repair recipes.",
                "Added episodic-memory retrieval for reusable debugging lessons; in continual re-rollout experiments, improved success from 12.20% direct continuation to 25.86%, approaching 29.21% with human RCA.",
            ],
        ),
        Entry(
            "OpenManus & OpenManus-RL",
            "Jan 2025 - July 2025",
            "Researcher / Core Contributor",
            [
                "Collaborated with the official OpenManus team on OpenManus-RL, the follow-up to the 60k+ star OpenManus open-source agent ecosystem.",
                "Implemented ReAct-style reasoning and multi-agent collaboration workflows, including an MCP-based tool-library interface for automated tool invocation and output handling.",
                "Built SFT data and step-level reward signals for AlfWorld and WebShop agent benchmarks to support planning and memory experiments.",
            ],
        ),
    ]
    for e in projects:
        y = entry(c, e, y, "small_bullet")

    y = section(c, "Activities & Awards", y)
    deans_list = bold("UIUC Dean's List")
    awards = (
        f"{bold('C.W. Gear Outstanding Undergraduate Student')} (2 people per year), May 2026; "
        f"{deans_list}, 2025; "
        f"{bold('RecSys 2025 Reviewer')}, Aug 2025; "
        f"{bold('UIUC MechMania 28 AI Hackathon')}, 2nd Place, Sep 2022."
    )
    y = draw_para(c, awards, y, WIDTH, "small") - 1

    y = section(c, "Skills", y)
    skills = [
        f"{bold('Programming:')} Python, C/C++, C#, Java, JavaScript/TypeScript, HTML/CSS, SQL, Rust",
        f"{bold('Frameworks:')} VERL, vLLM, LangGraph, LangChain, PyTorch, TensorFlow",
        f"{bold('AI Focus:')} LLM Agents, Multimodal Reasoning, SFT, RL/Post-training, RAG, Evaluation",
    ]
    for s in skills:
        y = draw_para(c, s, y, WIDTH, "small") - 0.1

    if y < BOTTOM:
        raise RuntimeError(f"Content overflowed by {BOTTOM - y:.1f} points")

    c.showPage()
    c.save()


if __name__ == "__main__":
    make_resume()
    print(OUT)
