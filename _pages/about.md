---
permalink: /
title: "Howdy! I'm Weijia Zhang"
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

{% assign schedule_url = site.author.schedule_url %}
{% assign schedule_embed_url = site.author.schedule_embed_url %}
{% unless schedule_embed_url %}{% assign schedule_embed_url = schedule_url %}{% endunless %}

<div class="home-intro-card" markdown="1">

I am an incoming M.S. student in Computer Science at [Yale University](https://www.yale.edu/) (2026 - 2028), admitted to the **Two-Year MS Degree with Full Scholarship**.

I graduated from [UIUC](https://illinois.edu/) in Math + Computer Science with the [2026 C.W. Gear Outstanding Undergraduate Student](https://siebelschool.illinois.edu/about/awards/undergraduate-scholarships-awards/cw-gear-outstanding-undergraduate-student) award, as one of two annual recipients.

Currently, I worked as a research assistant in UIUC U Lab on LLM agents, multimodal agents, and agentic RL, advised by [Prof. Jiaxuan You](https://cs.stanford.edu/people/jiaxuan/).


</div>

## News

{% include news-list.html %}

## Research

My research interests center on LLM agents, especially next-generation AI agents that bridge virtual and physical worlds through socially intelligent, tool-agnostic, and ethically grounded architectures.

- Multimodal agents: memory, reasoning, tool use, and multi-agent systems
- Conversational AI: anthropomorphism and social intelligence
- Post-training: agent SFT and RL

## Gamedev

Beyond research, I am a passoinate indie game developer, feel free to check my game work on the [game page](/game/). I am also willing to discuss the future of AI X Game.

## Publications

{% include publications-list.html show_scholar=false category_heading_tag="h3" %}

{% include experience-cards.html %}

## Schedule a Meeting

<div class="home-schedule-board">
  <div class="home-schedule-board__header">
    <div>
      <strong>Google Calendar availability</strong>
      <span>Open slots are shown in your local timezone.</span>
    </div>
    <a class="btn btn--primary home-schedule-board__button" href="{{ schedule_url }}" target="_blank" rel="noopener">
      <i class="fa fa-fw fa-calendar-check" aria-hidden="true"></i> Open scheduler
    </a>
  </div>
  <div class="home-schedule-board__embed">
    <iframe
      src="{{ schedule_embed_url }}"
      title="Google Calendar appointment scheduler for Weijia Zhang"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      frameborder="0"></iframe>
  </div>
  <p class="home-schedule-board__fallback">
    If the calendar does not load, <a href="{{ schedule_url }}" target="_blank" rel="noopener">open it in Google Calendar</a>.
  </p>
</div>

<div class="home-callout" markdown="1">

## Cooperate With Me
<!-- 
I keep a running list of research ideas on [Idea Planet](https://lead-cardamom-96f.notion.site/Dreeu2mr-s-Idea-Planet-21752d1a5d76802da492e3d5d6a6be53?source=copy_link). -->

Feel free to reach me via [email](mailto:zhangwj.charlie@gmail.com) or [LinkedIn](https://www.linkedin.com/in/weijia-charlie-zhang/).

<p class="home-callout-actions">
  <a class="btn btn--danger home-schedule-button" href="{{ schedule_url }}" target="_blank" rel="noopener">
    <i class="fa fa-fw fa-calendar" aria-hidden="true"></i> Schedule a time
  </a>
</p>

</div>
