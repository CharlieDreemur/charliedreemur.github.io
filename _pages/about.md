---
permalink: /
title: "Howdy! I'm Weijia Zhang"
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

{% assign schedule_url = site.author.schedule_url %}
{% assign schedule_view_embed_url = site.author.schedule_view_embed_url %}
{% assign schedule_appointment_embed_url = site.author.schedule_embed_url %}
{% assign schedule_timezone_label = site.author.schedule_timezone_label | default: "Eastern Time" %}
{% unless schedule_view_embed_url %}{% assign schedule_view_embed_url = schedule_appointment_embed_url %}{% endunless %}
{% unless schedule_view_embed_url %}{% assign schedule_view_embed_url = schedule_url %}{% endunless %}

<div class="home-intro-card" markdown="1">

I am an incoming M.S. student in Computer Science at [Yale University](https://www.yale.edu/) (2026 - 2028), admitted to the **(Thesis Track) M.S. in Computer Science with Full Scholarship**.

I graduated from [UIUC](https://illinois.edu/) in Math + Computer Science, where I was a research assistant in U Lab working on LLM agents, multimodal agents, and agentic RL, advised by [Prof. Jiaxuan You](https://cs.stanford.edu/people/jiaxuan/). I received the [2026 C.W. Gear Outstanding Undergraduate Student](https://siebelschool.illinois.edu/about/awards/undergraduate-scholarships-awards/cw-gear-outstanding-undergraduate-student) award as one of two annual recipients.

Currently, I am a Machine Learning Engineer Intern at [TikTok](https://www.tiktok.com/) working on self-evolving agents.


</div>

## Research

My research studies reliable self-improving agents for long-horizon interactive tasks. I explore how agents can learn from interaction traces and failures, acquire reusable memory and skills, and improve through inference-time evolution and SFT/RL across coding, computer-use, and multimodal environments.

- **Self-Evolving Agents:** recursive self-improvement (RSI), self-evolving harnesses, memory and skills, and multi-agent evolution
- **Multimodal Agents:** game-development agents, GUI and computer-use agents, and agentic world models
- **Agent Post-Training:** SFT and RL for coding agents and long-horizon agents

## News

{% include news-list.html %}

## Gamedev

Beyond research, I am a passoinate indie game developer, feel free to check my game work on the [game page](/game/). I am also willing to discuss the future of AI X Game.

{% if site.space_journey.enabled %}
<aside class="home-easter-egg-hint" aria-label="Easter egg hint">
  <span class="home-easter-egg-hint__icon" aria-hidden="true">🌍</span>
  <span><strong>Psst&hellip; a hidden journey awaits.</strong> Hold the Earth logo in the top-left corner for 5 seconds.</span>
</aside>
{% endif %}

{% include experience-cards.html %}

<div class="home-callout" markdown="1">

## Cooperate With Me
<!-- 
I keep a running list of research ideas on [Idea Planet](https://lead-cardamom-96f.notion.site/Dreeu2mr-s-Idea-Planet-21752d1a5d76802da492e3d5d6a6be53?source=copy_link). -->

Feel free to reach me via [email](mailto:zhangwj.charlie@gmail.com) or [LinkedIn](https://www.linkedin.com/in/weijia-charlie-zhang/).

</div>

<div class="home-schedule-panel">
  <div class="home-schedule-panel__header">
    <h2>my schedule</h2>
    <p>Feel free to check my availability. Times shown in {{ schedule_timezone_label }}.</p>
  </div>
  <div class="home-schedule-panel__frame">
    <iframe
      class="home-schedule-panel__iframe"
      src="{{ schedule_view_embed_url }}"
      title="Google Calendar schedule for Weijia Zhang"
      width="100%"
      height="820"
      style="border: 0; width: 100%; min-height: 820px;"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      frameborder="0"></iframe>
  </div>
  <div class="home-schedule-panel__footer">
    <span>Found a good time?</span>
    <a class="btn btn--info home-schedule-panel__button" href="{{ schedule_url }}" target="_blank" rel="noopener">
      <i class="fa fa-fw fa-calendar-check" aria-hidden="true"></i> Schedule meeting
    </a>
    <a class="home-schedule-panel__link" href="{{ schedule_view_embed_url }}" target="_blank" rel="noopener">Open full view</a>
  </div>
</div>
