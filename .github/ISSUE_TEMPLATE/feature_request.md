---
name: Feature request
about: Suggest an idea for this project
title: "[Feature]: This is the title of the feature request"
labels: 'Type: Feature'
assignees: ''

---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Priority**
- [ ] Nice to have
- [ ] Should have
- [ ] Must have

**Additional context**
Add any other context or screenshots about the feature request here.

---

<details>
<summary>🤖 LLM Refinement Prompt</summary>

Copy the issue content above and paste it with this prompt to generate a well-structured issue:

```
You are a technical product manager. Given the raw feature request below,
rewrite it as a well-structured GitHub issue with:

1. **Summary** — One-sentence overview of the feature.
2. **Problem Statement** — Why this matters, who it affects, and how often.
3. **Proposed Solution** — Clear description of the desired behavior.
   Include a simple user flow if applicable.
4. **Acceptance Criteria** — Bullet list of testable conditions for "done".
5. **Out of Scope** — Anything explicitly NOT included.
6. **Technical Notes** (optional) — Implementation hints, relevant APIs,
   or architecture considerations.

Keep the tone concise and professional. Use markdown formatting.
Preserve the original intent — don't add requirements the author didn't imply.

--- RAW FEATURE REQUEST ---
{paste issue content here}
```

</details>
